// src/components/game/BoardGrid.js
import React, { useMemo, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BOARD_LAYOUT, CELL_OPACITY, FRAGMENT_COLORS, HIGHLIGHT_COLOR } from '../../constants/GameConstants';
import { indexRunnersByCell } from '../../lib/board';
import RunnerToken from './RunnerToken';
import RunnerTokenSlide from './RunnerTokenSlide';

/**
 * Статичное окно из `cols` подряд идущих колонок трассы (rows × cols, обычно
 * 6×8) — клетки на экране НИКОГДА не двигаются. До 2026-08-30 окно прыгало
 * сразу на целый фрагмент (`blockIndex` 0..2, TOTAL_BLOCKS штук). По
 * дальнейшему запросу пользователя это заменено на посегментный сдвиг:
 * `windowStart` (из useBoardScroll, глобальный индекс левого/нижнего края
 * окна в терминах cell.col, шаг ±1 на нажатие/повтор при удержании) выбирает,
 * какие именно `cols` подряд идущих глобальных колонок сейчас отрисованы —
 * компонент фильтрует gridData/runners по диапазону `[windowStart,
 * windowStart+cols)`, без transform/offset вообще.
 *
 * Альбомная раскладка (orientation='landscape'): дорожки — горизонтальные
 * полосы, стек по вертикали. Ряды через один сдвинуты на пол-ячейки
 * (кирпичная кладка). Порядок колонок внутри дорожки — обычный (globalCol
 * возрастает слева направо).
 *
 * Портретная раскладка (orientation='portrait'): дорожки — вертикальные
 * полосы, стек по горизонтали. Движение по трассе — СНИЗУ ВВЕРХ (начало
 * трассы у панели игрока внизу экрана): левый край окна снизу, дальше по
 * треку — выше. Реализовано `flexDirection: 'column-reverse'` — чисто
 * layout-свойство (ячейки в массиве идут по возрастанию globalCol,
 * column-reverse рисует их снизу вверх сам), без transform/контр-отражений.
 *
 * Токены бегунов в обеих раскладках рисуются ОДНИМ отдельным абсолютным
 * слоем НАД сеткой (а не вложены в ячейки) — раньше (Android, альбомная
 * раскладка) вложенный токен иногда рисовался ПОД картинкой сегмента
 * (view-flattening), отдельный слой поверх это обходит независимо от
 * компоновки ячейки. Слой тоже фильтруется по окну — среди runnersByCell
 * берём только тех, чей глобальный столбец (segment*cols+positionX) сейчас
 * виден.
 *
 * Тап по клетке всегда сообщается наружу через onCellPress: используется и
 * для звука/фидбека, и для тап-плейсмента выбранного бегуна. Формат cell.id
 * ("segment-row-localCol") и семантика row/col/blockIndex одинаковы в обеих
 * раскладках — меняется только то, как клетки визуально расположены на
 * экране, не координаты, которые видит GameBoardScreen.
 */

// Картинка типа клетки (road/sand/...) чуть МЕНЬШЕ слота и отцентрована —
// подсветка легальной клетки (тонкая рамка+заливка) видна по краю слота
// в этом зазоре.
const SEGMENT_INSET = 0.06;
const HIGHLIGHT_BORDER_WIDTH = 1.5;
// Линия-подсветка стыка фрагментов (см. рендер ниже) — по прямому запросу
// пользователя, 2026-08-30, тот же цвет, что FragmentLabelStrip использует
// для полосы этого фрагмента (FRAGMENT_COLORS[blockIndex]).
const FRAGMENT_BOUNDARY_LINE_PX = 3;
// Минимальное время показа коллизионной позы (2026-09-01, по прямому запросу
// пользователя — "коллизия слишком быстро отыгрывает") — см. подробный
// разбор у tokenOverlay ниже.
const COLLISION_MIN_HOLD_MS = 1000;

export default function BoardGrid({
    gridData,
    rows,
    cols,
    segmentW,
    segmentH,
    windowStart = 0,
    orientation = 'landscape',
    containerWidth,
    containerHeight,
    runners = [],
    playerColorById = {},
    selectedRunnerId = null,
    highlightedCells = null,
    runnerAnims = null,
    runnerVisualPositions = null,
    currentTurnPlayerId = null,
    onCellPress,
}) {
    // Пока у бегуна играет очередь анимаций (см. hooks/useRunnerAnimations),
    // доска рисует его в позиции ТЕКУЩЕГО шага очереди, а не в реальной
    // (game-стейт уже применил её целиком) — иначе промежуточные "остановки"
    // каскада (отскок/аномалия/...) не отрисовались бы ни одним кадром, см.
    // подробный разбор в useRunnerAnimations. Как только очередь опустеет,
    // runnerVisualPositions[id] пропадает, и клетка снова берётся из runner
    // напрямую (к этому моменту она уже совпадает с последним шагом очереди).
    const effectiveRunners = useMemo(() => {
        if (!runnerVisualPositions || Object.keys(runnerVisualPositions).length === 0) return runners;
        return runners.map((r) => {
            const pos = runnerVisualPositions[r.id];
            return pos ? { ...r, ...pos } : r;
        });
    }, [runners, runnerVisualPositions]);
    const runnersByCell = useMemo(() => indexRunnersByCell(effectiveRunners), [effectiveRunners]);
    // Кольцо-токен — увеличено с 0.72 до 0.82 от слота (2026-08-31, девятый
    // заход) по прямому запросу пользователя: одиночный персонаж должен быть
    // "почти размером с плитку". Вместе с BOARD_TOKEN_IMAGE_SCALE ниже картинка
    // получается ~0.97×segmentSize — заполняет почти весь тайл, не вылезая
    // заметно за его пределы (не путать с прошлыми попытками ×1.8/×1.34, где
    // персонаж читался как "вне клетки", см. история в CLAUDE.md).
    const tokenSize = Math.floor(Math.min(segmentW, segmentH) * 0.82);
    // Картинка внутри кольца — по умолчанию 0.68*size (RunnerToken). Итоговая
    // картинка = tokenSize*BOARD_TOKEN_IMAGE_SCALE ≈ 0.97×segmentSize на вебе.
    // На native — ещё +30% (×1.3), а следующим заходом (2026-09-01, третий
    // раз) ЕЩЁ +15% (×1.15, итого ×1.495 от исходного) — низ картинки
    // прижат к низу клетки вместо центра (см. anchorBottom/imageAlign ниже),
    // так что "ноги" остаются на месте, а верхняя часть туловища выпирает
    // всё дальше вверх — ровно то, что попросил пользователь. Только для
    // Android/iOS — веб-версию просил не трогать (там текущий размер/
    // центрирование уже устраивает).
    const isNativeToken = Platform.OS !== 'web';
    const BOARD_TOKEN_IMAGE_SCALE = isNativeToken ? 1.18 * 1.3 * 1.15 : 1.18;
    // Пара при коллизии — несколько раундов живой правки на Android
    // (2026-08-31/09-01, по факту увиденного пользователем): 0.575 → 0.75 →
    // 0.9 от одиночной картинки, зазор 0.06 → 0.02 от сегмента. Финально —
    // персонажи в паре ТОЧНО того же размера, что и в idle (pairImageSize =
    // singleImageSize, множитель убран целиком), зазор НЕ трогаем (пользователь
    // явно попросил оставить как есть и "посмотреть как будет"). Пара
    // по-прежнему шире одной клетки при таком размере — осознанно (см.
    // комментарий у BOARD_TOKEN_IMAGE_SCALE выше: "не уменьшались" важнее,
    // чем "не вылезать за плитку" по прямому пожеланию пользователя).
    const singleImageSize = tokenSize * BOARD_TOKEN_IMAGE_SCALE;
    const pairImageSize = singleImageSize;
    const pairGap = Math.max(2, Math.floor(Math.min(segmentW, segmentH) * 0.02));
    const pairSize = Math.floor(pairImageSize / BOARD_TOKEN_IMAGE_SCALE);
    const isPortrait = orientation === 'portrait';
    // По запросу пользователя: только в веб-браузере, только в альбомной
    // (горизонтальной) раскладке, и только для road/sand/mud (не
    // wall/danger/anomaly) — картинки этих типов повёрнуты на 90° по часовой
    // (CSS-transform rotate(90deg), клетки квадратные — поворот без
    // искажений/подмены width↔height).
    const rotateEligible = Platform.OS === 'web' && !isPortrait;
    const ROTATE_TYPES = new Set(['road', 'sand', 'mud']);

    const windowEnd = windowStart + cols; // эксклюзивно
    const visibleCells = useMemo(
        () => gridData.filter((cell) => cell.col >= windowStart && cell.col < windowEnd),
        [gridData, windowStart, windowEnd],
    );

    // Ключ карты — "segment-row-localCol" (см. lib/board#indexRunnersByCell).
    // segment*cols+localCol даёт тот же globalCol, что и cell.col — только
    // бегуны из видимого сейчас окна попадают в оверлей.
    //
    // Ровно 2 бегуна на клетке — это столкновение (правила игры не допускают
    // больше 2 разом дольше одного тика) — по прямому запросу пользователя,
    // 2026-08-31, вместо "первый бегун + значок +N" они рисуются РЯДОМ, лицом
    // друг к другу (анимация collision_east/west). Кто слева/справа — не
    // угадать по данным (бэк не шлёт "кто откуда пришёл"), простое
    // детерминированное правило: текущий активный игрок (тот, кто "наехал")
    // — справа (лицом влево, collision_west), другой — слева (лицом вправо,
    // collision_east); если почему-то НИ ОДИН из двух бегунов не принадлежит
    // текущему игроку (не должно случаться в норме) — фолбэк по возрастанию id.
    // 3+ бегунов на клетке (не должно происходить по правилам) — старое
    // поведение "первый + значок +N", см. type:'stack' ниже.
    // ПЛОСКИЙ список — один элемент НА БЕГУНА (не на клетку), key всегда
    // runner.id, независимо от того, солирует он на клетке или в паре при
    // столкновении. Раньше пара оборачивалась в `<React.Fragment key={cellKey}>`
    // — React сверяет ключи СПИСКА на ЕГО СОБСТВЕННОМ уровне вложенности: пока
    // бегун был один, его RunnerTokenSlide был ПРЯМЫМ элементом списка с
    // key=runner.id; как только на клетку заезжал второй бегун, тот же бегун
    // вдруг оказывался ВНУТРИ Fragment с key=CELL — на верхнем уровне списка
    // это выглядело как "исчез элемент с key=216, появился новый элемент с
    // key='0-2-1'" (Fragment), и React полностью размонтировал/монтировал
    // поддерево — Animated-состояние RunnerTokenSlide (см. компонент) терялось,
    // и следующее перемещение (в частности разлёт после автоматического
    // разрешения коллизии) рисовалось телепортом, а не анимированным перелётом
    // (жалоба пользователя, 2026-08-31, живой тест). Теперь ключ на верхнем
    // уровне списка ВСЕГДА id бегуна — переход соло↔пара для НЕГО просто
    // меняет x/y/size у ТОГО ЖЕ элемента списка, что штатно подхватывает
    // RunnerTokenSlide.
    // Холды коллизий — { [pairKey]: { until, x, y, leftRunner, rightRunner } },
    // pairKey = "меньшийId-большийId" (стабилен независимо от того, кто слева/
    // справа). Мутируется ПРЯМО в теле useMemo ниже (не через setState) — это
    // намеренно: холды не должны триггерить отдельный ре-рендер сами по себе,
    // они просто МЕНЯЮТ то, что решает вычислить tokenOverlay на уже
    // идущем рендере. holdTick — единственный способ ЗАСТАВИТЬ React
    // пересчитать tokenOverlay РОВНО когда истекает минимальное время показа,
    // даже если до этого не прилетело вообще ни одного нового события/пропа
    // (см. setTimeout ниже).
    const collisionHoldsRef = useRef({});
    const [holdTick, setHoldTick] = useState(0);

    // Один элемент — один бегун (см. комментарий выше про плоский список и
    // стабильный key=runner.id). Коллизия (2 бегуна на клетке) — особый
    // случай с двумя доп. требованиями пользователя, 2026-09-01:
    //   1) Коллизионная поза не должна появляться РАНЬШЕ, чем "приезжающий"
    //      бегун доиграет СВОЮ анимацию ходьбы/перелёта (`runnerAnims[id].kind
    //      === 'move'|'fly'`) — до этого оба рисуются как обычные независимые
    //      solo-токены (визуально один из них едет в клетку, где стоит
    //      другой — RunnerTokenSlide это уже умеет благодаря стабильному key).
    //   2) Как только оба "settled" — коллизия должна быть видна НЕ МЕНЬШЕ
    //      COLLISION_MIN_HOLD_MS, даже если бэк уже увёл одного из них в
    //      другую клетку буквально в следующем событии. Реализовано холдом:
    //      пока pairKey активен, реальные позиции ОБОИХ бегунов в этом
    //      цикле игнорируются целиком (heldRunnerIds) — их рисует ТОЛЬКО
    //      второй проход снизу, на замороженных x/y/leftRunner/rightRunner,
    //      пока не истечёт `until`. RunnerTokenSlide не видит разницы между
    //      "x/y не менялись, потому что мы держим холд" и "x/y реально не
    //      менялись" — как только холд снимается и мы наконец отдаём его
    //      РЕАЛЬНУЮ (уже возможно ушедшую вперёд) позицию, он честно
    //      анимированно доскользит остаток пути.
    const tokenOverlay = useMemo(() => {
        const items = [];
        const now = Date.now();

        const pushSolo = (runner, sx, sy) => {
            items.push({
                runnerId: runner.id, runner, x: sx, y: sy,
                boxW: segmentW, boxH: segmentH, tokenSize,
                anim: runnerAnims?.[runner.id] ?? null,
                anchorBottom: isNativeToken,
            });
        };
        // Бокс пары — ТОТ ЖЕ segmentW×segmentH, что у соло-токена, НИКОГДА
        // не pairSize (жалоба пользователя, 2026-09-01, четвёртый заход:
        // "анимация перемещения проигрывается уже в целевом сегменте" —
        // настоящая причина найдена в RunnerTokenSlide: тот сравнивает
        // width/height между рендерами и, если они ИЗМЕНИЛИСЬ, считает это
        // сменой раскладки экрана — мгновенно телепортирует БЕЗ слайда (см.
        // компонент, resized-ветка, задумана для поворота/ресайза окна).
        // Раньше пара использовала бокс размером pairSize — ЛЮБОЙ переход
        // соло↔пара (вход в коллизию/выход из неё) МЕНЯЛ width/height и ложно
        // срабатывал эту защиту, съедая слайд ровно в момент приезда/отскока.
        // Теперь бокс константен при любом переходе — разъезд между двумя
        // персонажами даёт ЧИСТО transform:translateX на самом RunnerToken
        // (innerOffsetX ниже), размер бокса это не трогает вообще.
        const pushPair = (leftRunner, rightRunner, cellX, cellY) => {
            // Расстояние от центра клетки до центра КАЖДОГО токена — уменьшено
            // на 7% (жалоба пользователя, 2026-09-01, третий заход: "чуть
            // сблизь анимации коллизии"). Трогаем именно offset, не pairGap
            // отдельно — эффект остаётся пропорциональным независимо от
            // текущего pairSize.
            const offset = (pairGap / 2 + pairSize / 2) * 0.93;
            items.push({
                runnerId: leftRunner.id, runner: leftRunner,
                x: cellX, y: cellY, boxW: segmentW, boxH: segmentH, tokenSize: pairSize,
                anim: { kind: 'collision', side: 'east' },
                // Пара крепится к низу клетки ТАК ЖЕ, как одиночный токен (см.
                // anchorBottom/isNativeToken выше) — раньше была единственным
                // состоянием, которое центрировалось по вертикали, пользователь
                // прямо попросил единообразия ("должны быть так же, как и в
                // других состояниях"). На вебе — по-прежнему центр (не трогаем).
                anchorBottom: isNativeToken,
                innerOffsetX: -offset,
            });
            items.push({
                runnerId: rightRunner.id, runner: rightRunner,
                x: cellX, y: cellY, boxW: segmentW, boxH: segmentH, tokenSize: pairSize,
                anim: { kind: 'collision', side: 'west' },
                anchorBottom: isNativeToken,
                innerOffsetX: offset,
            });
        };

        const heldRunnerIds = new Set();
        for (const pairKey of Object.keys(collisionHoldsRef.current)) {
            const hold = collisionHoldsRef.current[pairKey];
            if (now >= hold.until) { delete collisionHoldsRef.current[pairKey]; continue; }
            heldRunnerIds.add(hold.leftRunner.id);
            heldRunnerIds.add(hold.rightRunner.id);
        }
        const refreshedPairKeys = new Set();

        for (const [key, cellRunners] of runnersByCell.entries()) {
            const visible = cellRunners.filter((r) => !heldRunnerIds.has(r.id));
            if (visible.length === 0) continue; // оба тут заморожены — их рисует второй проход

            const [segStr, rowStr, colStr] = key.split('-');
            const segment = Number(segStr);
            const row = Number(rowStr);
            // BOARD_LAYOUT.COLS (всегда 8 — реальных колонок в сегменте
            // данных с бэка), НЕ проп cols (viewportCols — сколько колонок
            // видно на экране прямо сейчас, динамическая величина в
            // портретной раскладке). Раньше тут стоял cols — совпадало с
            // BOARD_LAYOUT.COLS только пока viewportCols случайно был = 8,
            // и токены уезжали в сторону, как только видно меньше/больше 8
            // колонок (жалоба пользователя, 2026-08-31 — "персонажи вне
            // сегментов дороги"). colStr (positionX бегуна) — локальная
            // колонка ВНУТРИ сегмента данных, а не внутри вьюпорта.
            const globalCol = segment * BOARD_LAYOUT.COLS + Number(colStr);
            if (globalCol < windowStart || globalCol >= windowEnd) continue;
            const localCol = globalCol - windowStart;
            const x = isPortrait
                ? row * segmentW
                : localCol * segmentW + (row % 2 === 0 ? segmentW / 2 : 0);
            const y = isPortrait
                ? (cols - 1 - localCol) * segmentH + (row % 2 === 0 ? segmentH / 2 : 0)
                : row * segmentH;

            if (visible.length === 2) {
                const [a, b] = visible;
                const isArriving = (r) => {
                    const kind = runnerAnims?.[r.id]?.kind;
                    return kind === 'move' || kind === 'fly';
                };
                if (isArriving(a) || isArriving(b)) {
                    pushSolo(a, x, y);
                    pushSolo(b, x, y);
                    continue;
                }

                // Оба settled — коллизия. Кто слева/справа (см. комментарий
                // у tokenOverlay выше про детерминированное правило по
                // currentTurnPlayerId/id) считаем ОДИН раз на весь холд —
                // сторона не должна "прыгать" посреди показа.
                const pairKey = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
                let hold = collisionHoldsRef.current[pairKey];
                if (!hold) {
                    const aIsMover = String(a.playerId) === String(currentTurnPlayerId);
                    const bIsMover = String(b.playerId) === String(currentTurnPlayerId);
                    let leftRunner;
                    let rightRunner;
                    if (aIsMover && !bIsMover) [leftRunner, rightRunner] = [b, a];
                    else if (bIsMover && !aIsMover) [leftRunner, rightRunner] = [a, b];
                    else [leftRunner, rightRunner] = a.id < b.id ? [a, b] : [b, a];
                    hold = { until: now + COLLISION_MIN_HOLD_MS, x, y, leftRunner, rightRunner };
                    collisionHoldsRef.current[pairKey] = hold;
                    setTimeout(() => setHoldTick((t) => t + 1), COLLISION_MIN_HOLD_MS + 30);
                } else {
                    hold.x = x; hold.y = y; // пока реально вместе — держим позицию свежей
                }
                refreshedPairKeys.add(pairKey);
                pushPair(hold.leftRunner, hold.rightRunner, x, y);
                continue;
            }

            // 1 (или 3+, не должно происходить по правилам — старое
            // поведение "первый + значок +N") видимый бегун на клетке.
            const topRunner = visible[0];
            items.push({
                runnerId: topRunner.id, runner: topRunner,
                x, y, boxW: segmentW, boxH: segmentH, tokenSize,
                anim: runnerAnims?.[topRunner.id] ?? null,
                badgeCount: visible.length,
                // Низ картинки прижат к низу клетки вместо центра — ТОЛЬКО
                // на native (см. isNativeToken выше), только у одиночных
                // токенов (у пары свой маленький бокс "впритык" к самому
                // персонажу, там anchorBottom не нужен — центр).
                anchorBottom: isNativeToken,
            });
        }

        // Пары, которые уже РАЗЪЕХАЛИСЬ по-настоящему (бэк увёл одного из
        // них в другую клетку), но минимальное время показа ещё не истекло —
        // дорисовать на замороженной (последней известной вместе) позиции.
        for (const [pairKey, hold] of Object.entries(collisionHoldsRef.current)) {
            if (refreshedPairKeys.has(pairKey)) continue;
            pushPair(hold.leftRunner, hold.rightRunner, hold.x, hold.y);
        }

        return items;
    }, [
        runnersByCell, windowStart, windowEnd, cols, segmentW, segmentH, isPortrait,
        currentTurnPlayerId, pairGap, pairSize, tokenSize, runnerAnims, isNativeToken, holdTick,
    ]);

    // Линия-стык фрагментов как ОДНА непрерывная "змейка" через все дорожки,
    // не отдельные несвязанные отрезки на каждой (жалоба пользователя,
    // 2026-08-30) — на каждой дорожке рисуем сам стык (горизонтальный отрезок
    // в портрете, вертикальный в альбомной), ПЛЮС отрезок-перемычку до
    // соседней дорожки, компенсирующий кирпичный сдвиг между ними
    // (segmentH/2 в портрете, segmentW/2 в альбомной — тот же сдвиг, что даёт
    // laneIdx%2 marginTop/marginLeft у самих ячеек). Координаты считаются той
    // же формулой, что и у tokenOverlay выше (там уже проверено, что она
    // совпадает с реальной раскладкой ячеек) — здесь просто взят НИЖНИЙ край
    // (портрет) / ЛЕВЫЙ край (альбомная) клетки, с которой начинается
    // фрагмент, вместо центра клетки.
    const fragmentBoundarySegments = useMemo(() => {
        const half = FRAGMENT_BOUNDARY_LINE_PX / 2;
        const segments = [];
        const numFragments = Math.round(BOARD_LAYOUT.TOTAL_COLS / BOARD_LAYOUT.COLS);
        for (let f = 1; f < numFragments; f++) {
            const boundaryCol = f * BOARD_LAYOUT.COLS;
            const localCol = boundaryCol - windowStart;
            if (localCol < 0 || localCol >= cols) continue; // стык сейчас не в видимом окне
            const color = FRAGMENT_COLORS[f % FRAGMENT_COLORS.length];

            if (isPortrait) {
                // Нижний край клетки localCol в дорожке lane — та же формула, что
                // у tokenOverlay.y (верх клетки), + segmentH.
                const edgeY = (lane) =>
                    (cols - 1 - localCol) * segmentH + (lane % 2 === 0 ? segmentH / 2 : 0) + segmentH;
                for (let lane = 0; lane < rows; lane++) {
                    const y = edgeY(lane);
                    segments.push({
                        key: `h-${f}-${lane}`,
                        style: {
                            left: lane * segmentW, top: y - half,
                            width: segmentW, height: FRAGMENT_BOUNDARY_LINE_PX,
                            backgroundColor: color,
                        },
                    });
                    if (lane < rows - 1) {
                        const yNext = edgeY(lane + 1);
                        segments.push({
                            key: `v-${f}-${lane}`,
                            style: {
                                left: (lane + 1) * segmentW - half, top: Math.min(y, yNext) - half,
                                width: FRAGMENT_BOUNDARY_LINE_PX, height: Math.abs(yNext - y) + FRAGMENT_BOUNDARY_LINE_PX,
                                backgroundColor: color,
                            },
                        });
                    }
                }
            } else {
                // Левый край клетки localCol в дорожке lane — та же формула, что
                // у tokenOverlay.x (альбомная ветка не реверснута, левый край и
                // так граничит с предыдущей клеткой, доп. смещения не нужно).
                const edgeX = (lane) => localCol * segmentW + (lane % 2 === 0 ? segmentW / 2 : 0);
                for (let lane = 0; lane < rows; lane++) {
                    const x = edgeX(lane);
                    segments.push({
                        key: `v-${f}-${lane}`,
                        style: {
                            left: x - half, top: lane * segmentH,
                            width: FRAGMENT_BOUNDARY_LINE_PX, height: segmentH,
                            backgroundColor: color,
                        },
                    });
                    if (lane < rows - 1) {
                        const xNext = edgeX(lane + 1);
                        segments.push({
                            key: `h-${f}-${lane}`,
                            style: {
                                left: Math.min(x, xNext) - half, top: (lane + 1) * segmentH - half,
                                width: Math.abs(xNext - x) + FRAGMENT_BOUNDARY_LINE_PX, height: FRAGMENT_BOUNDARY_LINE_PX,
                                backgroundColor: color,
                            },
                        });
                    }
                }
            }
        }
        return segments;
    }, [windowStart, cols, rows, segmentW, segmentH, isPortrait]);

    return (
        <View
            style={[
                styles.container,
                isPortrait && styles.containerBottomAnchored,
                { width: containerWidth, height: containerHeight },
            ]}
        >
            <View style={isPortrait ? styles.laneRow : undefined}>
                {Array.from({ length: rows }).map((_, laneIdx) => {
                    const laneCells = visibleCells
                        .filter((cell) => cell.row === laneIdx)
                        .sort((a, b) => a.col - b.col); // возрастание globalCol
                    return (
                        <View
                            key={`lane-${laneIdx}`}
                            style={[
                                isPortrait ? styles.laneColumn : styles.row,
                                isPortrait && { height: cols * segmentH },
                                laneIdx % 2 === 0 &&
                                    (isPortrait ? { marginTop: segmentH / 2 } : { marginLeft: segmentW / 2 }),
                            ]}
                        >
                            {laneCells.map((cell) => {
                                const highlighted = highlightedCells?.has(cell.id) ?? false;
                                return (
                                    <TouchableOpacity
                                        key={cell.id}
                                        onPress={() => onCellPress?.(cell)}
                                        style={{ width: segmentW, height: segmentH }}
                                        activeOpacity={0.75}
                                    >
                                        {cell.baseImage && (
                                            // Подложка (road под danger/anomaly, sand под mud, см.
                                            // lib/board#pickBaseImage) — во весь слот, БЕЗ инсета и
                                            // БЕЗ уменьшенной прозрачности (это "земля", она всегда
                                            // непрозрачна) — сама клетка (danger/anomaly/mud, см. ниже)
                                            // рисуется поверх с меньшей opacity, поэтому подложка
                                            // просвечивает сквозь неё.
                                            <Image
                                                source={cell.baseImage}
                                                style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    width: segmentW,
                                                    height: segmentH,
                                                    resizeMode: 'stretch',
                                                    // baseImage — всегда road или sand (см. BASE_IMAGE_TYPE),
                                                    // оба входят в ROTATE_TYPES — доп. проверка не нужна.
                                                    ...(rotateEligible ? { transform: [{ rotate: '90deg' }] } : null),
                                                }}
                                            />
                                        )}
                                        {highlighted && (
                                            <View
                                                style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    width: segmentW,
                                                    height: segmentH,
                                                    backgroundColor: `${HIGHLIGHT_COLOR}55`,
                                                    borderWidth: HIGHLIGHT_BORDER_WIDTH,
                                                    borderColor: HIGHLIGHT_COLOR,
                                                }}
                                                pointerEvents="none"
                                            />
                                        )}
                                        <Image
                                            source={cell.image}
                                            style={{
                                                position: 'absolute',
                                                left: segmentW * (SEGMENT_INSET / 2),
                                                top: segmentH * (SEGMENT_INSET / 2),
                                                width: segmentW * (1 - SEGMENT_INSET),
                                                height: segmentH * (1 - SEGMENT_INSET),
                                                resizeMode: 'stretch',
                                                // road/sand непрозрачны (не просвечивают подсветку под
                                                // собой); wall — лёгкая прозрачность (заливка подсветки
                                                // видна по краю); danger/anomaly/mud — ещё прозрачнее
                                                // (по прямому запросу пользователя, чтобы сквозь них было
                                                // видно baseImage-подложку выше), см. CELL_OPACITY.
                                                opacity: CELL_OPACITY[cell.type] ?? 0.9,
                                                ...(rotateEligible && ROTATE_TYPES.has(cell.type)
                                                    ? { transform: [{ rotate: '90deg' }] }
                                                    : null),
                                            }}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    );
                })}

                <View
                    style={[
                        styles.tokenOverlayLayer,
                        isPortrait
                            ? { width: rows * segmentW, height: cols * segmentH }
                            : { width: cols * segmentW, height: rows * segmentH },
                    ]}
                    pointerEvents="none"
                >
                    {tokenOverlay.map((item) => (
                        // key — ВСЕГДА id бегуна, ОДИН И ТОТ ЖЕ элемент списка при переходе
                        // солист↔пара (см. комментарий у tokenOverlay) — RunnerTokenSlide
                        // хранит Animated.ValueXY во внутреннем ref, переживающем ре-рендеры
                        // ТОЛЬКО если React не пересоздаёт сам компонент.
                        <RunnerTokenSlide
                            key={item.runnerId}
                            x={item.x}
                            y={item.y}
                            width={item.boxW}
                            height={item.boxH}
                            style={item.anchorBottom ? styles.tokenLayerBottom : styles.tokenLayer}
                            windowStart={windowStart}
                        >
                            <RunnerToken
                                type={item.runner.type}
                                status={item.runner.status}
                                color={playerColorById[item.runner.playerId]}
                                size={item.tokenSize}
                                imageScale={BOARD_TOKEN_IMAGE_SCALE}
                                showRing={false}
                                imageAlign={item.anchorBottom ? 'bottom' : 'center'}
                                selected={item.runnerId === selectedRunnerId}
                                anim={item.anim}
                                style={item.innerOffsetX ? { transform: [{ translateX: item.innerOffsetX }] } : null}
                            />
                            {item.badgeCount > 1 && (
                                <View style={styles.stackBadge}>
                                    <Text style={styles.stackBadgeText}>+{item.badgeCount - 1}</Text>
                                </View>
                            )}
                        </RunnerTokenSlide>
                    ))}
                </View>

                <View
                    style={[
                        styles.fragmentBoundaryLayer,
                        isPortrait
                            ? { width: rows * segmentW, height: cols * segmentH }
                            : { width: cols * segmentW, height: rows * segmentH },
                    ]}
                    pointerEvents="none"
                >
                    {fragmentBoundarySegments.map((seg) => (
                        <View key={seg.key} style={[styles.fragmentBoundarySegment, seg.style]} />
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // БЕЗ overflow:'hidden' (было раньше) — единственное место во всей цепочке
    // рендера токена (RunnerTokenSlide/tokenLayer/RunnerToken#ring нигде своего
    // overflow не задают), которое реально обрезало картинку. Токен на доске
    // умышленно крупнее слота клетки (~1.45× по каждой стороне, см.
    // BOARD_TOKEN_IMAGE_SCALE — "картинка может быть даже БОЛЬШЕ кольца, это
    // осознанный эффект") и прижат к низу клетки — избыток всегда уходит ВВЕРХ.
    // Для интерьерных клеток избыток просто перекрывает соседний (уже
    // отрисованный) ряд сверху, визуально безобидно; для САМОГО ВЕРХНЕГО ряда
    // видимого окна деваться избытку было некуда — обрезался край персонажа
    // (жалоба пользователя, 2026-09-02, скриншот). Сетка ячеек (сама
    // clipping-чувствительная часть в СТАРОМ непрерывном скролле) сейчас
    // рендерится дискретным окном (windowStart, см. шапку файла) и ВСЕГДА
    // ровно заполняет containerWidth/Height без остатка — обрезать тут
    // больше нечего, кроме самих токенов, которым обрезка как раз мешает.
    container: {},
    containerBottomAnchored: { justifyContent: 'flex-end' },
    row: { flexDirection: 'row', alignItems: 'center' },
    // Дорожки расположены слева направо (портретная раскладка), каждая — свой
    // вертикальный стек ячеек. column-reverse: клетки в массиве идут по
    // возрастанию localCol, но рисуются СНИЗУ ВВЕРХ (localCol=0 внизу) — см.
    // шапку файла.
    // alignItems:'flex-start' — не дефолтный 'stretch': с ним все лейн-колонки
    // растягивались/сжимались под общую высоту ряда и "съедали" эффект
    // marginTop у нечётных лейнов (кирпичная кладка пропадала целиком — баг
    // с реального теста на Android), явная height у колонок это чинит только
    // если сам ряд не пытается их дополнительно растянуть.
    laneRow: { flexDirection: 'row', alignItems: 'flex-start' },
    laneColumn: { flexDirection: 'column-reverse' },
    // Один слой на весь текущий блок — см. комментарий в JSX про то, почему
    // токены больше не вложены в ячейки. zIndex ВЫШЕ fragmentBoundaryLayer —
    // персонажи должны рисоваться ПОВЕРХ линии-стыка фрагментов, не под ней
    // (жалоба пользователя, 2026-09-01, четвёртый заход — было наоборот).
    tokenOverlayLayer: { position: 'absolute', top: 0, left: 0, zIndex: 4, elevation: 4 },
    // Слой линии-стыка фрагментов (см. fragmentBoundarySegments) — ПОД
    // токенами (zIndex ниже tokenOverlayLayer), та же защита от Android
    // view-flattening (см. CLAUDE.md, пятый заход), что и у остальных
    // абсолютных слоёв этого компонента.
    fragmentBoundaryLayer: { position: 'absolute', top: 0, left: 0, zIndex: 2, elevation: 2 },
    fragmentBoundarySegment: { position: 'absolute' },
    tokenLayer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Только native (см. isNativeToken/anchorBottom в компоненте) — низ
    // персонажа прижат к низу клетки вместо центра, картинка (которая теперь
    // на 30% крупнее сегмента) выпирает вверх, а не поровну на все 4 стороны.
    tokenLayerBottom: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    stackBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 14,
        height: 14,
        borderRadius: 7,
        paddingHorizontal: 3,
        backgroundColor: '#000000cc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stackBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
});
