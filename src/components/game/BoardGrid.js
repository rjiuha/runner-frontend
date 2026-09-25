// src/components/game/BoardGrid.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    BOARD_LAYOUT, CELL_OPACITY, FRAGMENT_COLORS, HIGHLIGHT_COLOR, MINE_BLAST_IMAGES, MINE_BLAST_OFFSET,
    MINE_BLAST_SCALE, RUNNER_STATUS, RUNNER_TYPES,
} from '../../constants/GameConstants';
import { indexRunnersByCell, BASE_IMAGE_TYPE } from '../../lib/board';
import { ghostPairKey } from '../../lib/ghostPairs';
import { createLogger } from '../../lib/logger';
import RunnerToken from './RunnerToken';

// ВРЕМЕННО — диагностика "телепорт" (см. RunnerTokenSlide.js#SLIDEDBG), убрать после.
const dbgLog = createLogger('WINDBG');
import RunnerTokenSlide, { SLIDE_DURATION_MS } from './RunnerTokenSlide';

// Прилёт Жнеца из резерва — вдвое медленнее обычного слайда (см. RunnerTokenSlide#duration),
// по прямому запросу пользователя, 2026-09-09: "он двигается очень быстро, может стоит
// продлить анимацию передвижения жнеца из резерва на игровое поле в два раза". Только эта
// ОДНА анимация — обычные шаги остальных бегунов используют SLIDE_DURATION_MS как есть.
const REAPER_PREVIEW_SLIDE_MS = SLIDE_DURATION_MS * 2;

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
// Персональный инсет по типу клетки — переопределяет SEGMENT_INSET там, где
// нужно другое значение. road/sand — 5% (по прямому запросу пользователя,
// 2026-09-14, второй заход того же дня). mud/dirt — несколько раундов той же
// сессии: 5%→8%→12% (каждый раз "ещё на N процентных пунктов меньше картинку
// внутри слота", т.е. +N% к зазору), только у mud — road/sand не трогали.
const TYPE_INSET = { road: 0.05, sand: 0.05, mud: 0.12 };
const HIGHLIGHT_BORDER_WIDTH = 1.5;
// Линия-подсветка стыка фрагментов (см. рендер ниже) — по прямому запросу
// пользователя, 2026-08-30, тот же цвет, что FragmentLabelStrip использует
// для полосы этого фрагмента (FRAGMENT_COLORS[blockIndex]).
const FRAGMENT_BOUNDARY_LINE_PX = 3;
// Минимальное время показа коллизионной позы — было 1000мс (2026-09-01, по
// прямому запросу пользователя — "коллизия слишком быстро отыгрывает"),
// сокращено до 600мс по ОБРАТНОМУ запросу, 2026-09-08 ("сделай, чтобы
// коллизия длилась поменьше") — см. подробный разбор у tokenOverlay ниже.
const COLLISION_MIN_HOLD_MS = 600;

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
    hiddenRunnerIds = null,
    ghostPairs = null,
    mineBlasts = null,
    onCollisionPoseStart = null,
    onCollisionPoseEnd = null,
    // Настоящий сигнал "действие для этого бегуна реально закончилось на
    // экране" (2026-09-25, см. hooks/useRunnerAnimations.js#completeStep) —
    // прокидывается ДАЛЬШЕ в RunnerTokenSlide (слайд реально доехал —
    // move/fly) и в RunnerToken (полоска реально дорисовала последний кадр —
    // остальные транзиентные позы, только native). BoardGrid сам ничего не
    // решает, просто передаёт runnerId/nonce КОНКРЕТНОГО шага очереди —
    // см. tokenOverlay ниже.
    onAnimStepEnd = null,
    reaperPreview = null,
    columnOpacities = null,
    // Клетки, временно замороженные в ДОвскрытом виде (см. GameBoardScreen
    // #heldCells) — cell.id → {type, image, baseImage}, полностью подменяет
    // реальные (уже обновлённые в game-стейте) значения для конкретной
    // клетки, пока её id остаётся ключом в этом объекте.
    cellOverrides = null,
    onCellPress,
}) {
    // Пока у бегуна играет очередь анимаций (см. hooks/useRunnerAnimations),
    // доска рисует его в позиции ТЕКУЩЕГО шага очереди, а не в реальной
    // (game-стейт уже применил её целиком) — иначе промежуточные "остановки"
    // каскада (отскок/аномалия/...) не отрисовались бы ни одним кадром, см.
    // подробный разбор в useRunnerAnimations. Как только очередь опустеет,
    // runnerVisualPositions[id] пропадает, и клетка снова берётся из runner
    // напрямую (к этому моменту она уже совпадает с последним шагом очереди).
    // Бегуны, чья 'destroyed'-анимация уже доиграла (см.
    // useRunnerAnimations#hiddenIds) — исключаем ИЗ ВСЕГО (индексации по
    // клеткам, коллизионных пар и т.п.), не только из финального рендера, по
    // прямому запросу пользователя, 2026-09-07: уничтоженный бегун должен
    // полностью выбыть с доски, а не висеть в позе уничтожения вечно.
    const liveRunners = useMemo(
        () => (hiddenRunnerIds && hiddenRunnerIds.size ? runners.filter((r) => !hiddenRunnerIds.has(r.id)) : runners),
        [runners, hiddenRunnerIds],
    );
    const effectiveRunners = useMemo(() => {
        if (!runnerVisualPositions || Object.keys(runnerVisualPositions).length === 0) return liveRunners;
        return liveRunners.map((r) => {
            const pos = runnerVisualPositions[r.id];
            return pos ? { ...r, ...pos } : r;
        });
    }, [liveRunners, runnerVisualPositions]);
    const runnersByCell = useMemo(() => indexRunnersByCell(effectiveRunners), [effectiveRunners]);
    // Кольцо-токен — увеличено с 0.72 до 0.82 от слота (2026-08-31, девятый
    // заход) по прямому запросу пользователя: одиночный персонаж должен быть
    // "почти размером с плитку". Вместе с BOARD_TOKEN_IMAGE_SCALE ниже картинка
    // получается ~0.97×segmentSize — заполняет почти весь тайл, не вылезая
    // заметно за его пределы (не путать с прошлыми попытками ×1.8/×1.34, где
    // персонаж читался как "вне клетки", см. история в CLAUDE.md).
    const tokenSize = Math.floor(Math.min(segmentW, segmentH) * 0.82);
    // Картинка внутри кольца — по умолчанию 0.68*size (RunnerToken). Итоговая
    // картинка = tokenSize*BOARD_TOKEN_IMAGE_SCALE — ещё +30% (×1.3), а
    // следующим заходом (2026-09-01, третий раз) ЕЩЁ +15% (×1.15, итого
    // ×1.495 от исходного) — низ картинки прижат к низу клетки вместо
    // центра (см. anchorBottom/imageAlign ниже), так что "ноги" остаются на
    // месте, а верхняя часть туловища выпирает всё дальше вверх. Раньше
    // это было ТОЛЬКО для Android/iOS (веб — свой, меньший ×1.18 с
    // центрированием, по прямой просьбе пользователя не трогать веб) — по
    // ОБРАТНОМУ прямому запросу, 2026-09-09 ("сделай размер и расположение
    // персонажа на дороге в браузере такими же, как на android"), платформенная
    // развилка убрана целиком — оба используют одни и те же значения.
    const BOARD_TOKEN_IMAGE_SCALE = 1.18 * 1.3 * 1.15;
    // 2026-09-25 — попытка платформенной развилки (+10%, потом +25% СВЕРХУ
    // BOARD_TOKEN_IMAGE_SCALE, только Android) ОТКАЧЕНА по прямому запросу
    // пользователя для всех типов, КРОМЕ скаута — тот увеличение сохраняет.
    // Общий множитель (переменная выше) снова как до 2026-09-25, унификация
    // веб/android от 2026-09-09 не тронута для tank/athlete/reaper/ball.
    // Только SPRINTER на Android получает доп. ×1.25 — см. использование
    // ниже, в самом JSX (imageScale у солового RunnerToken), не здесь: это
    // per-type решение, не общая константа геометрии (та нужна и для
    // pairSize/tokenSize, которые ДОЛЖНЫ остаться едиными для всех типов).
    const SPRINTER_ANDROID_IMAGE_SCALE = BOARD_TOKEN_IMAGE_SCALE * (Platform.OS === 'android' ? 1.25 : 1);
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

    // Ключ карты — "segment|row|localCol" (см. lib/board#indexRunnersByCell —
    // разделитель `|`, не `-`, значения могут быть отрицательными).
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

    // Последняя известная КЛЕТКА (не пиксельная позиция — та меняется вместе
    // с windowStart) каждого бегуна, { [runnerId]: {segment,positionX,
    // positionY} } — по прямому запросу пользователя, 2026-09-11: "бегуна
    // отбросило по диагонали за пределы карты — при отбросе телепортировало
    // на соседний сегмент, только потом сработала анимация fly". Настоящая
    // причина: когда клетка бегуна временно оказывается ВНЕ видимого окна
    // прокрутки (windowStart/windowEnd ниже), главный цикл просто пропускает
    // его (`continue`) — он выпадает из `items`, React размонтирует его
    // `RunnerTokenSlide`, тот теряет свою внутреннюю память "откуда ехать"
    // (`prevPos`, см. компонент). Когда бегун на следующем хопе (multi-hop
    // отброс — Stupor на бэке шлёт НЕСКОЛЬКО runner_save подряд, по одному на
    // каждый хоп, см. CLAUDE.md) снова попадает в окно, компонент
    // монтируется заново — по коду это "первый показ", слайда не будет,
    // токен просто ставится на новое место (видимо как телепорт). Мутируется
    // ПРЯМО в теле useMemo (тот же приём, что уже applied для
    // collisionHoldsRef выше) — не должен сам по себе триггерить ре-рендер.
    const lastKnownCellRef = useRef({});

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

        // onTop — доп. явный zIndex (не только порядок в массиве, см.
        // reaperOnTop ниже) — у этого проекта долгая история именно Android-
        // специфичных багов с порядком отрисовки токенов на доске (см.
        // CLAUDE.md — "токен под сегментом"/"квадрат вместо кружка"/
        // "персонажи прорисовываются под полосой", всё лечилось явным
        // zIndex/elevation, порядок в дереве сам по себе не всегда уважался).
        // col — глобальный номер колонки (см. globalCol ниже), нужен ТОЛЬКО
        // для BoardGrid#columnOpacities (хореография сдвига фрагментов, 2026-
        // 09-10: токены обязаны затухать/материализовываться СО СВОЕЙ
        // колонкой, а не отдельно от сетки — иначе Жнец на удаляемом фрагменте
        // снова не исчезнет, как уже было пойманным багом раньше).
        // Пиксельная позиция клетки (segment/positionX/positionY) в ТЕКУЩЕМ
        // окне прокрутки — та же формула, что и у основного цикла ниже,
        // вынесена сюда, чтобы её можно было применить и к УЖЕ НЕ видимой
        // (старой, запомненной в lastKnownCellRef) клетке ради enterFrom.
        // Специально НЕ клэмпится к видимому диапазону — если клетка сейчас
        // вне окна, результат будет отрицательным/за пределами сетки, и
        // RunnerTokenSlide как раз это использует, чтобы токен визуально
        // "въехал" оттуда, где он реально был.
        const cellPixelPos = (segment, positionX, positionY) => {
            const gCol = segment * BOARD_LAYOUT.COLS + positionX;
            const lCol = gCol - windowStart;
            return {
                x: isPortrait ? positionY * segmentW : lCol * segmentW + (positionY % 2 === 0 ? segmentW / 2 : 0),
                y: isPortrait
                    ? (cols - 1 - lCol) * segmentH + (positionY % 2 === 0 ? segmentH / 2 : 0)
                    : positionY * segmentH,
            };
        };

        const pushSolo = (runner, sx, sy, sCol, onTop = false, enterFrom = undefined) => {
            const anim = runnerAnims?.[runner.id] ?? null;
            items.push({
                runnerId: runner.id, runner, x: sx, y: sy, col: sCol,
                boxW: segmentW, boxH: segmentH, tokenSize,
                anim,
                anchorBottom: true,
                onTop,
                enterFrom,
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
        const pushPair = (leftRunner, rightRunner, cellX, cellY, cellCol, enterFromLeft = undefined, enterFromRight = undefined) => {
            // Расстояние от центра клетки до центра КАЖДОГО токена — уменьшено
            // на 7% (жалоба пользователя, 2026-09-01, третий заход: "чуть
            // сблизь анимации коллизии"). Трогаем именно offset, не pairGap
            // отдельно — эффект остаётся пропорциональным независимо от
            // текущего pairSize.
            const offset = (pairGap / 2 + pairSize / 2) * 0.93;
            items.push({
                runnerId: leftRunner.id, runner: leftRunner,
                x: cellX, y: cellY, col: cellCol, boxW: segmentW, boxH: segmentH, tokenSize: pairSize,
                anim: { kind: 'collision', side: 'east' },
                // Пара крепится к низу клетки ТАК ЖЕ, как одиночный токен (см.
                // anchorBottom выше) — раньше была единственным состоянием,
                // которое центрировалось по вертикали, пользователь прямо
                // попросил единообразия ("должны быть так же, как и в других
                // состояниях"). Веб и native теперь ведут себя одинаково (см.
                // BOARD_TOKEN_IMAGE_SCALE выше, 2026-09-09).
                anchorBottom: true,
                innerOffsetX: -offset,
                enterFrom: enterFromLeft,
            });
            items.push({
                runnerId: rightRunner.id, runner: rightRunner,
                x: cellX, y: cellY, col: cellCol, boxW: segmentW, boxH: segmentH, tokenSize: pairSize,
                anim: { kind: 'collision', side: 'west' },
                anchorBottom: true,
                innerOffsetX: offset,
                enterFrom: enterFromRight,
            });
        };

        // hold.until — НЕ ставится в момент создания холда (см. pushPair ниже) —
        // остаётся null, ПОКА пара РЕАЛЬНО ещё сталкивается (оба всё ещё видны
        // на одной клетке, т.е. коллизия НЕ разрешена, ждём решение игрока).
        // Настоящий БАГ №1 (пойман живьём, 2026-09-10: "анимация коллизии
        // бесконечно повторяется", столкновение разных размеров, где игрок
        // должен решить "Использовать/Перебросить") — раньше `until`
        // выставлялся СРАЗУ при создании холда, и цикл ниже безусловно удалял
        // холд, как только оно истекало (COLLISION_MIN_HOLD_MS=600мс), ДАЖЕ
        // ЕСЛИ пара всё ещё реально стоит на одной клетке. Таймер минимального
        // показа стартует ТОЛЬКО в момент, когда пара ДЕЙСТВИТЕЛЬНО разъехалась
        // (см. ниже), не раньше.
        //
        // Настоящий БАГ №2 (пойман живьём, 2026-09-10: "после переброса
        // анимация коллизии кончилась чуть позже, чем началось передвижение
        // проигравшего") — "разъехались ли уже" раньше проверялось ПО-РАЗНОМУ
        // в двух разных местах на РАЗНОМ рендере: вот этот блок в начале
        // функции читал `collisionHoldsRef` таким, каким он был НА КОНЕЦ
        // ПРЕДЫДУЩЕГО рендера (until ещё null), а отдельный "стухший" цикл в
        // самом конце функции (после главного цикла по cellRunners) только
        // ТУТ ЖЕ обнаруживал реальный разъезд и выставлял until. На ЭТОМ
        // переходном рендере (первом, где backend уже увёл проигравшего)
        // heldRunnerIds ещё пуст (по старым данным) — главный цикл ниже
        // честно находит проигравшего на его НОВОЙ реальной клетке и рисует
        // как обычный токен (видно начавшееся движение), а "стухший" цикл в
        // конце ТОГО ЖЕ рендера ЕЩЁ РАЗ пушит его через pushPair на старой
        // замороженной позиции — тот же runnerId дважды в items за один
        // рендер, и замороженная поза столкновения продолжает висеть поверх/
        // рядом с уже реально сдвинувшимся токеном, пока heldRunnerIds не
        // "догонит" на следующих рендерах (до ~600мс).
        // Фикс — не ждать следующего рендера: "разъехались ли" определяется
        // СРАЗУ по актуальному runnersByCell ЭТОГО же рендера (runnerCellOf),
        // исключение из главного цикла И отрисовка через pushPair происходят
        // в одном и том же проходе, без разрыва в рендер.
        const runnerCellOf = new Map();
        for (const [cellKey, cellRunners] of runnersByCell.entries()) {
            for (const r of cellRunners) runnerCellOf.set(r.id, cellKey);
        }
        const heldRunnerIds = new Set();
        for (const pairKey of Object.keys(collisionHoldsRef.current)) {
            const hold = collisionHoldsRef.current[pairKey];
            const leftCell = runnerCellOf.get(hold.leftRunner.id);
            const rightCell = runnerCellOf.get(hold.rightRunner.id);
            const stillTogether = leftCell != null && leftCell === rightCell;
            if (stillTogether) continue; // ещё реально вместе — главный цикл ниже сам найдёт и обновит pushPair

            // Разъехались (сейчас или раньше) — держим на замороженной позиции.
            if (hold.until == null) {
                hold.until = now + COLLISION_MIN_HOLD_MS;
                setTimeout(() => setHoldTick((t) => t + 1), COLLISION_MIN_HOLD_MS + 30);
            } else if (now >= hold.until) {
                delete collisionHoldsRef.current[pairKey];
                // Симметрично onCollisionPoseStart — сигнал "поза столкновения
                // ЭТОЙ пары только что реально закончилась" (2026-09-11, для
                // цикличного /sounds/collision.wav в GameBoardScreen — тот
                // должен звучать РОВНО пока видна поза, не дольше и не
                // короче). setTimeout(...,0) — та же причина, что и у
                // onCollisionPoseStart чуть выше: не дёргаем чужой
                // setState-колбэк прямо в теле useMemo.
                if (onCollisionPoseEnd) setTimeout(() => onCollisionPoseEnd(pairKey), 0);
                continue;
            }
            heldRunnerIds.add(hold.leftRunner.id);
            heldRunnerIds.add(hold.rightRunner.id);
            pushPair(hold.leftRunner, hold.rightRunner, hold.x, hold.y, hold.col);
        }

        for (const [key, cellRunners] of runnersByCell.entries()) {
            const visible = cellRunners.filter((r) => !heldRunnerIds.has(r.id));
            if (visible.length === 0) continue; // оба тут заморожены — уже дорисованы выше (см. runnerCellOf/heldRunnerIds)

            // `|`, не `-` — см. lib/board#indexRunnersByCell: значения могут
            // быть отрицательными (бегуна унесло за боковой край трассы), с
            // дефисом-разделителем разбор ключа съезжал по индексам.
            const [segStr, rowStr, colStr] = key.split('|');
            const segment = Number(segStr);
            const row = Number(rowStr);
            const positionX = Number(colStr);

            // Запоминаем последнюю известную клетку каждого бегуна ДО того,
            // как решаем, попадает ли она в видимое окно (см. докстринг у
            // lastKnownCellRef выше) — и ЧИТАЕМ старое значение (если было)
            // ПЕРЕД перезаписью, чтобы использовать его как enterFrom для
            // RunnerTokenSlide, если этот бегун сейчас монтируется заново
            // после временного выпадения из `items`. Если позиция не
            // менялась (bегун и на прошлом, и на этом рендере был тут же),
            // enterFrom совпадёт с текущим x/y — RunnerTokenSlide его просто
            // проигнорирует (используется только на ПЕРВОМ рендере компонента).
            const enterFromByRunnerId = {};
            for (const r of visible) {
                const prevKnown = lastKnownCellRef.current[r.id];
                if (prevKnown) enterFromByRunnerId[r.id] = cellPixelPos(prevKnown.segment, prevKnown.positionX, prevKnown.positionY);
                else if (runnerAnims?.[r.id]) dbgLog('НЕТ prevKnown для', r.id, 'anim=', runnerAnims[r.id]?.kind);
                lastKnownCellRef.current[r.id] = { segment, positionX, positionY: row };
            }

            // BOARD_LAYOUT.COLS (всегда 8 — реальных колонок в сегменте
            // данных с бэка), НЕ проп cols (viewportCols — сколько колонок
            // видно на экране прямо сейчас, динамическая величина в
            // портретной раскладке). Раньше тут стоял cols — совпадало с
            // BOARD_LAYOUT.COLS только пока viewportCols случайно был = 8,
            // и токены уезжали в сторону, как только видно меньше/больше 8
            // колонок (жалоба пользователя, 2026-08-31 — "персонажи вне
            // сегментов дороги"). positionX — локальная колонка ВНУТРИ
            // сегмента данных, а не внутри вьюпорта.
            const globalCol = segment * BOARD_LAYOUT.COLS + positionX;
            if (globalCol < windowStart || globalCol >= windowEnd) {
                for (const r of visible) {
                    if (runnerAnims?.[r.id]) {
                        dbgLog('ВЫПАЛ из окна бегун', r.id, 'globalCol=', globalCol, 'windowStart=', windowStart, 'windowEnd=', windowEnd, 'anim=', runnerAnims[r.id]?.kind);
                    }
                }
                continue;
            }
            const localCol = globalCol - windowStart;
            const x = isPortrait
                ? row * segmentW
                : localCol * segmentW + (row % 2 === 0 ? segmentW / 2 : 0);
            const y = isPortrait
                ? (cols - 1 - localCol) * segmentH + (row % 2 === 0 ? segmentH / 2 : 0)
                : row * segmentH;

            if (visible.length === 2) {
                const [a, b] = visible;
                // "Призрак" — мирное сосуществование на одной клетке, НЕ
                // коллизия (см. lib/ghostPairs.js, по прямому запросу
                // пользователя, 2026-09-09: "стоят рядом в idle, пока это не
                // последний ход призрачного бегуна"). Реальная (не ghost)
                // коллизия НИКОГДА не оставляет двух бегунов НАДОЛГО на одной
                // клетке — проигравший либо мгновенно уводится
                // (авторазрешение того же размера), либо ждёт
                // game.extraTurnPlayer (отдельная, уже обработанная ветка на
                // GameBoardScreen) — так что если конкретно ЭТА пара помечена
                // как ghost, рисуем solo/solo безусловно, минуя даже
                // isArriving-проверку ниже (тот же приём, что у Жнеца).
                if (ghostPairs?.has(ghostPairKey(a.id, b.id, segment, positionX, row))) {
                    pushSolo(a, x, y, globalCol, false, enterFromByRunnerId[a.id]);
                    pushSolo(b, x, y, globalCol, false, enterFromByRunnerId[b.id]);
                    continue;
                }
                // Жнец на клетке — это НЕ столкновение, а ловушка (бегун,
                // закончивший ход на этой клетке, уничтожается — см.
                // lib/runnerAnimTriggers.js#'bomb'), по прямому запросу
                // пользователя, 2026-09-08: обычная поза "лицом друг к другу"
                // тут неуместна (жертва вот-вот исчезнет). Оба рисуются как
                // независимые соло-токены — Жнец играет СВОЮ 'bomb'-анимацию,
                // жертва — 'destroyed' (с задержкой после bomb, см. triggers),
                // затем скрывается через hiddenRunnerIds.
                if (a.type === RUNNER_TYPES.REAPER || b.type === RUNNER_TYPES.REAPER) {
                    // Жнец — ВСЕГДА поверх (по прямому запросу пользователя,
                    // 2026-09-08: "заходит кто-то на его клетку — загораживает
                    // его") — оба рисуются одним и тем же соло-токеном на
                    // одинаковых x/y (см. комментарий выше). Раньше порядок
                    // пуша был "как лежат в visible" (порядок бегунов в самом
                    // game.runners) — чисто случайный, кто из двух окажется
                    // сверху. Явный `onTop` (см. pushSolo) — не только
                    // порядок в массиве (жертва пушится первой, Жнец вторым),
                    // но и zIndex, на случай если сам Android не уважает
                    // порядок в дереве для двух соседних абсолютных View
                    // (см. комментарий у pushSolo).
                    const [victim, reaper] = a.type === RUNNER_TYPES.REAPER ? [b, a] : [a, b];
                    pushSolo(victim, x, y, globalCol, false, enterFromByRunnerId[victim.id]);
                    pushSolo(reaper, x, y, globalCol, true, enterFromByRunnerId[reaper.id]);
                    continue;
                }
                const isArriving = (r) => {
                    const kind = runnerAnims?.[r.id]?.kind;
                    return kind === 'move' || kind === 'fly';
                };
                if (isArriving(a) || isArriving(b)) {
                    pushSolo(a, x, y, globalCol, false, enterFromByRunnerId[a.id]);
                    pushSolo(b, x, y, globalCol, false, enterFromByRunnerId[b.id]);
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
                    // until: null — таймер минимального показа ЕЩЁ НЕ запущен,
                    // пара только что столкнулась и всё ещё реально вместе на
                    // клетке (см. докстринг у heldRunnerIds выше) — запустится
                    // позже, когда пара реально разъедется (см. runnerCellOf/
                    // heldRunnerIds в начале функции).
                    hold = { until: null, x, y, col: globalCol, leftRunner, rightRunner };
                    collisionHoldsRef.current[pairKey] = hold;
                    // Сигнал наружу "поза столкновения только что появилась"
                    // — GameBoardScreen играет звук столкновения РОВНО в этот
                    // момент (жалоба пользователя, 2026-09-07: раньше звук
                    // стоял на game.extraTurnPlayer, что совпадало с началом
                    // движения заезжающего бегуна, а не с самой позой).
                    // setTimeout(...,0) — не дёргаем колбэк родителя ПРЯМО во
                    // время рендера (эта useMemo уже мутирует collisionHoldsRef
                    // как задокументированное исключение, но вызов чужого
                    // setState-триггерящего колбэка прямо в рендере — другой,
                    // более рискованный случай) — откладываем на следующий
                    // тик, как и holdTick парой строк выше.
                    if (onCollisionPoseStart) setTimeout(() => onCollisionPoseStart(pairKey), 0);
                } else {
                    hold.x = x; hold.y = y; hold.col = globalCol; // пока реально вместе — держим позицию свежей
                }
                pushPair(hold.leftRunner, hold.rightRunner, x, y, globalCol,
                    enterFromByRunnerId[hold.leftRunner.id], enterFromByRunnerId[hold.rightRunner.id]);
                continue;
            }

            // 1 (или 3+, не должно происходить по правилам — старое
            // поведение "первый + значок +N") видимый бегун на клетке.
            const topRunner = visible[0];
            const topAnim = runnerAnims?.[topRunner.id] ?? null;
            items.push({
                runnerId: topRunner.id, runner: topRunner,
                x, y, col: globalCol, boxW: segmentW, boxH: segmentH, tokenSize,
                anim: topAnim,
                badgeCount: visible.length,
                // Низ картинки прижат к низу клетки вместо центра — веб и
                // native одинаково (см. BOARD_TOKEN_IMAGE_SCALE выше,
                // 2026-09-09).
                anchorBottom: true,
                enterFrom: enterFromByRunnerId[topRunner.id],
            });
        }

        // Пары, разъехавшиеся ПО-НАСТОЯЩЕМУ, уже обнаружены и дорисованы
        // ВЫШЕ, ДО этого цикла (см. runnerCellOf/heldRunnerIds в начале
        // функции) — отдельного хвостового прохода больше не нужно, именно
        // разрыв между "определить здесь" и "дорисовать там" на разных
        // рендерах и был причиной бага №2 (см. комментарий выше).

        return items;
    }, [
        runnersByCell, windowStart, windowEnd, cols, segmentW, segmentH, isPortrait,
        currentTurnPlayerId, pairGap, pairSize, tokenSize, runnerAnims, holdTick,
        onCollisionPoseStart, onCollisionPoseEnd, ghostPairs,
    ]);

    // Локальное превью "прилёта" Жнеца ИЗ-ЗА КРАЯ карты (2026-09-07, по
    // прямому запросу пользователя) — НЕ настоящий бегун из `runners` (у него
    // ещё нет реального runnerId, бэк узнает о размещении только вызовом
    // /ability, который отправляется ПОСЛЕ выбора направления, см.
    // GameBoardScreen#handleReaperShoot), а чисто визуальный элемент,
    // построенный ТОЙ ЖЕ формулой x/y, что и обычные токены (см. цикл по
    // runnersByCell выше). `enterFrom` — точка ЗА пределами видимой доски по
    // боковой оси (row*segmentW), в ту же сторону, что и сама pose-анимация
    // 'start'/move[side] (see RUNNER_ANIMATION_SETS.reaper) — на первом же
    // рендере RunnerTokenSlide проигрывает слайд оттуда (см. её enterFrom
    // проп). Пока не reaperPreview.settled — держим анимацию 'start' (ходьба),
    // после — просто idle (осел на месте, ждём выбора направления). Не
    // проверено живьём (нет доступа к устройству в этой сессии) — направление
    // "откуда приезжает" (east=слева, west=справа) выбрано по аналогии с
    // компасом, не подтверждено на реальном ассете.
    const reaperPreviewItem = useMemo(() => {
        if (!reaperPreview) return null;
        const { segment, positionX, positionY, side } = reaperPreview;
        const globalCol = segment * BOARD_LAYOUT.COLS + positionX;
        if (globalCol < windowStart || globalCol >= windowEnd) return null;
        const localCol = globalCol - windowStart;
        const row = positionY;
        const x = isPortrait ? row * segmentW : localCol * segmentW + (row % 2 === 0 ? segmentW / 2 : 0);
        const y = isPortrait ? (cols - 1 - localCol) * segmentH + (row % 2 === 0 ? segmentH / 2 : 0) : row * segmentH;
        const enterOffset = segmentW * 3;
        const enterFrom = { x: side === 'east' ? x - enterOffset : x + enterOffset, y };
        return { x, y, enterFrom };
    }, [reaperPreview, windowStart, windowEnd, isPortrait, segmentW, segmentH, cols]);

    // Одноразовые взрывы мины (см. GameBoardScreen#mineBlasts/useMineBlasts.js)
    // — `mineBlasts` прилетает как {cellId: variantIndex}, cellId в формате
    // "segment-positionY-positionX" (см. GameBoardScreen#reduceAndLog,
    // `${segment}-${positionY}-${positionX}`) — сегмент/координаты клетки,
    // где вскрылась мина, всегда неотрицательные (это РЕВЕАЛ клетки трассы,
    // не текущая позиция бегуна после отброса — split('-') тут безопасен,
    // в отличие от разбора runnersByCell-ключей, где положительный/
    // отрицательный positionY возможен). Та же пиксельная формула, что и у
    // reaperPreviewItem выше — якорь по НИЗУ клетки, размер/сдвиг вверх
    // считает styles.mineBlastLayer-рендер ниже (MINE_BLAST_SCALE/OFFSET).
    const mineBlastOverlay = useMemo(() => {
        if (!mineBlasts) return [];
        const items = [];
        for (const cellId of Object.keys(mineBlasts)) {
            const [segStr, pYStr, pXStr] = cellId.split('-');
            const segment = Number(segStr);
            const positionY = Number(pYStr);
            const positionX = Number(pXStr);
            const globalCol = segment * BOARD_LAYOUT.COLS + positionX;
            if (globalCol < windowStart || globalCol >= windowEnd) continue;
            const localCol = globalCol - windowStart;
            const x = isPortrait
                ? positionY * segmentW
                : localCol * segmentW + (positionY % 2 === 0 ? segmentW / 2 : 0);
            const y = isPortrait
                ? (cols - 1 - localCol) * segmentH + (positionY % 2 === 0 ? segmentH / 2 : 0)
                : positionY * segmentH;
            items.push({ key: cellId, x, y, variant: mineBlasts[cellId] });
        }
        return items;
    }, [mineBlasts, windowStart, windowEnd, isPortrait, segmentW, segmentH, cols]);

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
        // f <= numFragments (не < ) — последний проход (f===numFragments) даёт
        // boundaryCol === TOTAL_COLS-1, ровно "пик"-колонку 4-го фрагмента
        // (см. lib/board#flattenPeekColumn/TRACK_SHIFT_PEEK_COL в
        // GameBoardScreen) — раньше эта линия не рисовалась вообще (жалоба
        // пользователя, 2026-09-14: "куда-то делась полоска, отделяющая 4
        // фрагмент-триггер"), цвет берётся тем же FRAGMENT_COLORS[f%len], что
        // и у FragmentLabelStrip для полосы пика (band.blockIndex===3).
        for (let f = 1; f <= numFragments; f++) {
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

    // Хореография сдвига фрагментов трассы (game_track_updated, см.
    // GameBoardScreen) — БЕЗ дублирующих overlay-слоёв: `columnOpacities`
    // (объект globalCol → Animated.Value, 0=невидим/1=виден) применяется
    // ПРЯМО К РЕАЛЬНЫМ ячейкам (laneCells.map ниже) И к токенам на них
    // (tokenOverlay.map — см. item.col/columnOpacities[item.col] там), по
    // одной колонке за раз — сегменты и их токены (в т.ч. Жнецы) вместе
    // затухают/материализуются из невидимости, а не "прячутся за отдельным
    // слоем, который потом исчезает". Используется симметрично в ОБЕИХ фазах:
    // 'wiping' (значения идут 1→0, gridData у этого инстанса ЗАМОРОЖЕН на
    // старом фрагменте, см. GameBoardScreen) и 'revealing' (0→1, gridData уже
    // реальный/новый) — переписано 2026-09-10 по прямому запросу пользователя
    // ("хочу, чтобы [фрагмент] исчезал посегментно, аналогично тому, как
    // появляется новый") — до этого исчезновение было ЕДИНЫМ фейдом всего
    // контента разом (`contentOpacity`, теперь убран как избыточный).
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
                            {laneCells.map((rawCell) => {
                                // cellOverrides (см. GameBoardScreen#heldCells) — подменяет
                                // ТОЛЬКО type/image/baseImage замороженной клетки, id/row/
                                // col/blockIndex остаются настоящими (тап/подсветка не должны
                                // знать об этой чисто визуальной заморозке).
                                const cell = cellOverrides?.[rawCell.id] ? { ...rawCell, ...cellOverrides[rawCell.id] } : rawCell;
                                const highlighted = highlightedCells?.has(cell.id) ?? false;
                                // Прямое per-column затухание/материализация
                                // РЕАЛЬНОЙ клетки (см. докстринг у return выше) —
                                // columnOpacities отсутствует вне хореографии
                                // сдвига фрагментов, тогда opacity всегда 1
                                // (обычный рендер не затронут).
                                const cellOpacity = columnOpacities ? (columnOpacities[cell.col] ?? 1) : 1;
                                // См. докстринг ниже у cell.image — инсет теперь свой на тип (TYPE_INSET):
                                // road/sand/mud рисуются с 5%-м зазором (2026-09-14, road/sand — второй
                                // заход того же дня, mud/dirt — третий, прямой запрос "внутри неоновой/
                                // белой полоски-квадрата сегмента"), остальные типы — обычным SEGMENT_INSET.
                                // isFullBleed сейчас не срабатывает ни для одного реального типа (оставлен
                                // на случай будущего типа с cellInset===0, полный full-bleed).
                                const cellInset = TYPE_INSET[cell.type] ?? SEGMENT_INSET;
                                const isFullBleed = cellInset === 0;
                                // Подложка (baseImage — road под danger/anomaly/wall, sand под mud, см.
                                // BASE_IMAGE_TYPE) раньше ВСЕГДА рисовалась во весь слот, без зазора —
                                // из-за этого клетки с подложкой (danger/anomaly/wall/mud) визуально
                                // заполняли весь тайл целиком, а road/sand (без подложки, сами себе "земля")
                                // показывали зазор вокруг своей же чуть уменьшенной картинки — отсюда живая
                                // жалоба "danger/dirt/wall сегменты крупнее" (2026-09-14). Теперь подложка
                                // получает ТОТ ЖЕ инсет, что и её собственный тип (road/sand — оба 0.05),
                                // а не full slot — зазор одинаковый у всех типов.
                                const baseType = BASE_IMAGE_TYPE[cell.type];
                                const baseInset = baseType ? (TYPE_INSET[baseType] ?? SEGMENT_INSET) : 0;
                                return (
                                    <TouchableOpacity
                                        key={cell.id}
                                        onPress={() => onCellPress?.(cell)}
                                        style={{ width: segmentW, height: segmentH }}
                                        activeOpacity={0.75}
                                    >
                                        <Animated.View style={{ width: segmentW, height: segmentH, opacity: cellOpacity }}>
                                        {/* road/sand/mud — свой, меньший инсет (5%, TYPE_INSET), картинка
                                            типа клетки рисуется внутри неоновой/белой квадратной обводки
                                            сегмента, не впритык к её краю. Для остальных типов
                                            (danger/anomaly/wall) ничего не меняем — там обычный
                                            SEGMENT_INSET, как и раньше. */}
                                        {cell.baseImage && (
                                            // Подложка (road под danger/anomaly/wall, sand под mud, см.
                                            // lib/board#pickBaseImage) — теперь со СВОИМ инсетом (baseInset,
                                            // см. выше), как и обычный road/sand-тайл, а не во весь слот
                                            // (раньше было так — см. докстринг у baseInset выше про живую
                                            // жалобу "danger/dirt/wall крупнее"). БЕЗ уменьшенной
                                            // прозрачности (это "земля", она всегда непрозрачна) — сама
                                            // клетка рисуется поверх С ИНСЕТОМ (см. ниже); для danger/
                                            // anomaly/mud она ЕЩЁ и просвечивает сквозь саму картинку
                                            // клетки (меньшая opacity), для wall — нет (opacity:1, см.
                                            // CELL_OPACITY).
                                            <Image
                                                source={cell.baseImage}
                                                style={{
                                                    position: 'absolute',
                                                    left: segmentW * (baseInset / 2),
                                                    top: segmentH * (baseInset / 2),
                                                    width: segmentW * (1 - baseInset),
                                                    height: segmentH * (1 - baseInset),
                                                    resizeMode: 'stretch',
                                                    // baseImage — всегда road или sand (см. BASE_IMAGE_TYPE),
                                                    // оба входят в ROTATE_TYPES — доп. проверка не нужна.
                                                    ...(rotateEligible ? { transform: [{ rotate: '90deg' }] } : null),
                                                }}
                                            />
                                        )}
                                        {/* Подсветка ПОД картинкой — для всех типов с ненулевым зазором
                                            (сейчас это все реальные типы, см. cellInset/isFullBleed выше):
                                            её видно в этом зазоре по краю слота. */}
                                        {highlighted && !isFullBleed && (
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
                                                left: isFullBleed ? 0 : segmentW * (cellInset / 2),
                                                top: isFullBleed ? 0 : segmentH * (cellInset / 2),
                                                width: isFullBleed ? segmentW : segmentW * (1 - cellInset),
                                                height: isFullBleed ? segmentH : segmentH * (1 - cellInset),
                                                resizeMode: 'stretch',
                                                // road/sand/wall непрозрачны (не просвечивают подсветку
                                                // под собой); danger/anomaly — прозрачнее (по прямому
                                                // запросу пользователя, чтобы сквозь них было видно
                                                // baseImage-подложку выше), см. CELL_OPACITY.
                                                opacity: CELL_OPACITY[cell.type] ?? 0.9,
                                                ...(rotateEligible && ROTATE_TYPES.has(cell.type)
                                                    ? { transform: [{ rotate: '90deg' }] }
                                                    : null),
                                            }}
                                        />
                                        {/* Подсветка ПОВЕРХ картинки — только для гипотетического
                                            isFullBleed-типа (cellInset===0, сейчас таких нет — все реальные
                                            типы идут через ветку "под картинкой" выше). Оставлено на случай
                                            будущего типа без зазора вообще. */}
                                        {highlighted && isFullBleed && (
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
                                        </Animated.View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    );
                })}

                {mineBlastOverlay.length > 0 && (
                    <View
                        style={[
                            styles.mineBlastLayer,
                            isPortrait
                                ? { width: rows * segmentW, height: cols * segmentH }
                                : { width: cols * segmentW, height: rows * segmentH },
                        ]}
                        pointerEvents="none"
                    >
                        {mineBlastOverlay.map((item) => {
                            const segMin = Math.min(segmentW, segmentH);
                            const blastSize = segMin * MINE_BLAST_SCALE;
                            const blastBottom = item.y + segmentH - segMin * MINE_BLAST_OFFSET;
                            return (
                                <Image
                                    key={item.key}
                                    source={MINE_BLAST_IMAGES[item.variant]}
                                    resizeMode="contain"
                                    style={{
                                        position: 'absolute',
                                        left: item.x + segmentW / 2 - blastSize / 2,
                                        top: blastBottom - blastSize,
                                        width: blastSize,
                                        height: blastSize,
                                    }}
                                />
                            );
                        })}
                    </View>
                )}

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
                            style={[
                                item.anchorBottom ? styles.tokenLayerBottom : styles.tokenLayer,
                                item.onTop && styles.tokenOnTop,
                                // Токен затухает/материализуется СО СВОЕЙ колонкой во
                                // время хореографии сдвига фрагментов (2026-09-10) —
                                // иначе Жнец на удаляемом фрагменте снова не исчезнет
                                // (см. докстринг у pushSolo выше).
                                columnOpacities && { opacity: columnOpacities[item.col] ?? 1 },
                            ]}
                            windowStart={windowStart}
                            enterFrom={item.enterFrom}
                            // onSlideEnd — см. onAnimStepEnd выше. `item.anim`
                            // у синтетических коллизионных пар/призраков —
                            // {kind:'collision',...} БЕЗ nonce (производное
                            // состояние, не шаг очереди useRunnerAnimations) —
                            // onAnimStepEnd сам игнорирует вызов с nonce==null
                            // (см. completeStep), здесь достаточно передать
                            // что есть, без дополнительных проверок.
                            // RunnerTokenSlide НЕ мемоизирован (в отличие от
                            // RunnerToken ниже) — инлайн-замыкание тут ничего
                            // не портит.
                            onSlideEnd={() => onAnimStepEnd?.(item.runnerId, item.anim?.nonce)}
                        >
                            <RunnerToken
                                runnerId={item.runnerId}
                                type={item.runner.type}
                                status={item.runner.status}
                                color={playerColorById[item.runner.playerId]}
                                size={item.tokenSize}
                                imageScale={item.runner.type === RUNNER_TYPES.SPRINTER ? SPRINTER_ANDROID_IMAGE_SCALE : BOARD_TOKEN_IMAGE_SCALE}
                                showRing={false}
                                imageAlign={item.anchorBottom ? 'bottom' : 'center'}
                                selected={item.runnerId === selectedRunnerId}
                                anim={item.anim}
                                style={
                                    // Скаут (SPRINTER) — на 10% высоты сегмента ниже, чем
                                    // остальные типы, ТОЛЬКО на Android (2026-09-25, прямой
                                    // запрос пользователя, потом РАСШИРЕН на коллизию тоже —
                                    // применяется ВЕЗДЕ, включая пару; затем уточнено, что
                                    // сдвиг нужен только на Android, как и SPRINTER_ANDROID_
                                    // IMAGE_SCALE выше — веб не трогаем). ОДИН объект style
                                    // с ОДНИМ массивом transform — если писать innerOffsetX
                                    // и этот сдвиг двумя РАЗНЫМИ объектами в style-массиве,
                                    // RN не мёрджит их transform, а берёт последний целиком
                                    // (потерялся бы горизонтальный разъезд пары у скаута в
                                    // коллизии) — оба транслейта собираются в ОДИН массив,
                                    // filter(Boolean) убирает неприменимые.
                                    (item.innerOffsetX || (item.runner.type === RUNNER_TYPES.SPRINTER && Platform.OS === 'android')) && {
                                        transform: [
                                            item.innerOffsetX && { translateX: item.innerOffsetX },
                                            item.runner.type === RUNNER_TYPES.SPRINTER && Platform.OS === 'android'
                                                && { translateY: Math.round(segmentH * 0.1) },
                                        ].filter(Boolean),
                                    }
                                }
                                // ПРОСТО onAnimStepEnd (стабильная ссылка из
                                // props, см. GameBoardScreen#runnerAnim.completeStep),
                                // НЕ инлайн-замыкание — RunnerToken, в отличие
                                // от RunnerTokenSlide выше, обёрнут в
                                // React.memo (см. докстринг у экспорта, живой
                                // 2026-09-24 перф-фикс: для idle-бегунов пропсы
                                // должны оставаться СТАБИЛЬНЫМИ между рендерами,
                                // иначе memo перестаёт отсекать лишнюю работу
                                // ИМЕННО для самого частого случая — "все
                                // стоят"). Сам финальный колбэк с
                                // runnerId/anim.nonce строится УЖЕ ВНУТРИ
                                // RunnerToken.
                                onAnimStepEnd={onAnimStepEnd}
                            />
                            {item.badgeCount > 1 && (
                                <View style={styles.stackBadge}>
                                    <Text style={styles.stackBadgeText} noGlobalTint>+{item.badgeCount - 1}</Text>
                                </View>
                            )}
                        </RunnerTokenSlide>
                    ))}
                    {reaperPreviewItem && (
                        <RunnerTokenSlide
                            key="__reaperPreview__"
                            x={reaperPreviewItem.x}
                            y={reaperPreviewItem.y}
                            width={segmentW}
                            height={segmentH}
                            style={styles.tokenLayerBottom}
                            windowStart={windowStart}
                            enterFrom={reaperPreviewItem.enterFrom}
                            duration={REAPER_PREVIEW_SLIDE_MS}
                        >
                            <RunnerToken
                                type={RUNNER_TYPES.REAPER}
                                status={RUNNER_STATUS.HEALTHY}
                                color={reaperPreview.color}
                                size={tokenSize}
                                imageScale={BOARD_TOKEN_IMAGE_SCALE}
                                showRing={false}
                                imageAlign="bottom"
                                anim={reaperPreview.settled ? null : { kind: 'start', side: reaperPreview.side }}
                            />
                        </RunnerTokenSlide>
                    )}
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
    // Взрывы мины (см. mineBlastOverlay/GameBoardScreen#mineBlasts) — СТРОГО
    // между дорогой и токенами (zIndex ниже tokenOverlayLayer=4, но выше
    // самой сетки клеток) — по прямому запросу пользователя, 2026-09-15:
    // бегун должен быть на переднем плане, взрыв — под ним. Явный zIndex, не
    // только порядок в JSX (тот же класс Android-специфичных багов с
    // порядком отрисовки, что и у остальных абсолютных слоёв этого файла).
    mineBlastLayer: { position: 'absolute', top: 0, left: 0, zIndex: 3, elevation: 3 },
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
    // Веб и native одинаково (см. anchorBottom в компоненте) — низ персонажа
    // прижат к низу клетки вместо центра, картинка (которая теперь заметно
    // крупнее сегмента) выпирает вверх, а не поровну на все 4 стороны.
    tokenLayerBottom: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    // Жнец поверх бегуна, зашедшего на его клетку (см. onTop у pushSolo) —
    // выше базового zIndex/elevation слоя tokenOverlayLayer (4), явный
    // zIndex/elevation НАДЁЖНЕЕ порядка в дереве конкретно на Android (та же
    // причина, что и у самого tokenOverlayLayer — см. его комментарий).
    tokenOnTop: { zIndex: 10, elevation: 10 },
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
