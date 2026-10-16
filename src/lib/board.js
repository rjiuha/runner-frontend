// src/lib/board.js
import { GAME_CONFIG, PLAYER_STEP, RUNNER_STATUS, RUNNER_TYPES, SEGMENT_IMAGES, TAP_MODE } from '../constants/GameConstants';
import { forwardNeighbors, cellKey } from './hexDirection';

const KNOWN_CELL_TYPES = new Set(Object.values(GAME_CONFIG.CELL_TYPES)); // road/sand/mud/wall/fire/acid/danger/anomaly

/**
 * Реальные ячейки из assets/tracks/*.json иногда несут суффикс уровня опасности
 * ('danger_2', 'danger_3' — под них позже кладутся случайные жетоны рубашкой
 * вверх). С 2026-08-28 у 'anomaly' есть свой ассет (black_hole_*, см.
 * SEGMENT_IMAGES) — больше не падает на 'danger'. Всё неизвестное/
 * отсутствующее — 'road' (дефолт по ТЗ, пока бэк не прислал тайл).
 */
export function resolveCellVisual(rawType) {
    if (!rawType) return 'road';
    const base = String(rawType).split('_')[0].toLowerCase();
    return KNOWN_CELL_TYPES.has(base) ? base : 'road';
}

/** Простой строковый хэш (детерминированный, без внешних зависимостей). */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

/**
 * Выбор конкретного варианта ассета клетки из группы по типу — детерминированно
 * по id клетки (НЕ Math.random): у каждого типа теперь несколько картинок
 * (см. SEGMENT_IMAGES), нужно, чтобы клетка держала СВОЙ вариант стабильно на
 * всю партию (gridData пересчитывается на каждое live-обновление стейта, и
 * настоящий рандом на каждый вызов заставлял бы картинку клетки "прыгать"/
 * перезапускать gif-анимацию при каждом ре-рендере экрана).
 *
 * До 2026-09-18 тут был особый случай для 'wall' (бэк присылал только общий
 * тип, acid/burn выбирал сам фронт случайно, см. pickDeathVariant в истории
 * файла) — бэк теперь сам отдаёт 'fire'/'acid' как отдельные типы клетки
 * (RoadType::FIRE/ACID), так что оба идут обычным путём ниже, как и любой
 * другой многовариантный тип.
 */
export function pickSegmentImage(type, cellId) {
    const variants = SEGMENT_IMAGES[type] || SEGMENT_IMAGES.road;
    return variants[hashString(cellId) % variants.length];
}

/**
 * Тип "подложки" под клетки danger/mud/fire/acid — по прямому запросу
 * пользователя, 2026-08-30/31: под danger кладём road, под mud
 * (грязь/dirt) — случайный (детерминированно по id клетки, как и сам
 * pickSegmentImage) sand. fire/acid — road под низ (2026-09-13/18 — стена
 * сама непрозрачна, но у неё, как и у остальных типов, есть SEGMENT_INSET-
 * зазор по краю слота, и под ним по прямому запросу пользователя должна
 * быть видна дорога, не пустой фон экрана). anomaly (black_hole) — БЕЗ
 * подложки (2026-09-15, прямой запрос "убери road из-под black_hole") — под
 * чёрной дырой ничего не должно просвечивать. Остальные типы (road/sand) —
 * это они сами и есть "земля", подложки не нужно.
 */
export const BASE_IMAGE_TYPE = { danger: 'road', mud: 'sand', fire: 'road', acid: 'road' };

/** Картинка подложки для типа клетки, или null если подложка не нужна (см. BASE_IMAGE_TYPE). */
export function pickBaseImage(type, cellId) {
    const baseType = BASE_IMAGE_TYPE[type];
    return baseType ? pickSegmentImage(baseType, cellId) : null;
}

/**
 * Разворачивает 3 фрагмента трассы (trackBegin/trackMiddle/trackEnd — форма
 * {name, grid}, см. RunnerGame::toArray() на бэке) в плоский список ячеек для
 * BoardGrid. Сетка на бэке — grid[X][Y]: X (0..cols-1) — позиция вперёд по
 * фрагменту, Y (0..rows-1) — номер дорожки. На экране Y становится "row"
 * (вертикаль), X — "col" (горизонталь, по нему идёт прокрутка).
 *
 * @param {Array<{name:string, grid:string[][]}|null|undefined>} segments  [begin, middle, end]
 */
export function flattenTrackSegments(segments, rows, cols) {
    const data = [];
    segments.forEach((segment, blockIndex) => {
        const grid = segment?.grid;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const rawType = grid?.[col]?.[row] ?? null;
                const id = `${blockIndex}-${row}-${col}`;
                const type = resolveCellVisual(rawType);
                data.push({
                    id,
                    row,
                    col: col + blockIndex * cols,
                    blockIndex,
                    segmentName: segment?.name ?? null,
                    rawType,
                    type,
                    image: pickSegmentImage(type, id),
                    baseImage: pickBaseImage(type, id),
                });
            }
        }
    });
    return data;
}

/**
 * "Пик" 4-го фрагмента (trackNext) — по прямому запросу пользователя,
 * 2026-09-08: без него бегуну физически некуда шагнуть с последней клетки
 * 3-го фрагмента (см. известный TODO в CLAUDE.md). Разворачивает ТОЛЬКО
 * ПЕРВУЮ колонку (positionX=0) каждой дорожки trackNext — не весь фрагмент
 * целиком (тот ещё не должен быть виден по дизайну, только его "передний
 * край"). blockIndex захардкожен в 3 (следующий после 0/1/2 у обычных
 * фрагментов), col — абсолютная глобальная колонка, куда встаёт эта
 * единственная "пиковая" клетка (см. BOARD_LAYOUT.TOTAL_COLS = 3*COLS+1).
 * Формат id/ключа СОВПАДАЕТ с обычными ячейками (`${blockIndex}-${row}-${col
 * внутри сегмента=0}`) — lib/hexDirection#cellKey строит тот же формат для
 * соседа с segment=3, positionX=0, так что подсветка/тап-детекция работают
 * без доп. кода. trackNext сейчас НЕ отдаётся бэком ни в REST-снапшоте, ни в
 * game_track_updated (см. CLAUDE.md, читано read-only) — пока это не
 * добавят, `trackNext` будет `undefined`, и функция просто вернёт [] (пик не
 * рисуется, поведение как раньше).
 */
export function flattenPeekColumn(trackNext, rows, peekCol) {
    const grid = trackNext?.grid;
    if (!grid) return [];
    const data = [];
    for (let row = 0; row < rows; row++) {
        const rawType = grid?.[0]?.[row] ?? null;
        const id = `3-${row}-0`;
        const type = resolveCellVisual(rawType);
        data.push({
            id,
            row,
            col: peekCol,
            blockIndex: 3,
            segmentName: trackNext?.name ?? null,
            rawType,
            type,
            image: pickSegmentImage(type, id),
            baseImage: pickBaseImage(type, id),
        });
    }
    return data;
}

/**
 * Группирует видимое окно прокрутки [windowStart, windowStart+viewportCols)
 * по фрагменту трассы (blockIndex = floor(globalCol/fragmentCols)) — для
 * FragmentLabelStrip (портретная раскладка), чтобы показать имя фрагмента(ов),
 * видимых прямо сейчас, и границу между ними, если окно как раз пересекает
 * стык. Порядок результата — по возрастанию localCol (0 = ближе к
 * windowStart), что в портретной раскладке соответствует НИЗУ полосы (то же
 * направление, что и сама сетка — движение по трассе снизу вверх, см.
 * BoardGrid).
 */
export function computeFragmentBands(windowStart, viewportCols, fragmentCols, segmentNames) {
    const bands = [];
    for (let i = 0; i < viewportCols; i++) {
        const globalCol = windowStart + i;
        const blockIndex = Math.floor(globalCol / fragmentCols);
        const last = bands[bands.length - 1];
        if (last && last.blockIndex === blockIndex) last.count += 1;
        else bands.push({ blockIndex, count: 1, name: segmentNames?.[blockIndex] ?? null });
    }
    return bands;
}

/**
 * Индекс "бегунов по ячейке" — группирует бегунов по (segment, positionY,
 * positionX), см. BoardGrid#tokenOverlay (единственный потребитель — там
 * только ИТЕРАЦИЯ по записям, не точечный `.get()` по чужому ключу, так что
 * формат ключа не обязан совпадать с cell.id из flattenTrackSegments, только
 * сам с собой).
 *
 * Разделитель — `|`, НЕ `-`: значения могут быть ОТРИЦАТЕЛЬНЫМИ. Бегуна может
 * унести за пределы дорожек (positionY<0 или >5) отбросом от урона (Rocket/
 * Stupor на бэке, read-only — многоклеточный "выстрел ракетой" может
 * отправить бегуна за боковой край трассы, `TrackSegment::isWithinBounds()`
 * на бэке пропускает такое значение как есть, без клэмпа). С разделителем
 * `-` ключ для, например, positionY=-1 выглядел бы "2--1-7" — двойной дефис,
 * `key.split('-')` в BoardGrid съезжал по индексам (жалоба пользователя,
 * 2026-09-08: "мгновенно телепортировало... не было перемещения плавного" —
 * токен рендерился в мусорном месте вместо честного слайда за край доски).
 * `|` не может появиться в строковом представлении числа ни при каких
 * условиях — разбор `split('|')` однозначен для любого знака.
 */
export function indexRunnersByCell(runners) {
    const map = new Map();
    for (const runner of runners) {
        if (runner.segment == null || runner.positionX == null || runner.positionY == null) continue;
        const key = `${runner.segment}|${runner.positionY}|${runner.positionX}`;
        const list = map.get(key);
        if (list) list.push(runner);
        else map.set(key, [runner]);
    }
    return map;
}

const SEGMENT_KEYS = ['trackBegin', 'trackMiddle', 'trackEnd'];

function findRunnerAt(runners, pos) {
    return runners.find(
        (r) => r.segment === pos.segment && r.positionX === pos.positionX && r.positionY === pos.positionY,
    );
}

/** Сырой RoadType клетки прямо из game.trackBegin/Middle/End — grid[positionX][positionY]. */
function rawCellType(game, segment, positionX, positionY) {
    return game?.[SEGMENT_KEYS[segment]]?.grid?.[positionX]?.[positionY] ?? null;
}

// Зеркалит ALLOWLIST бэка (ReaperValidator::validateCell(), read-only,
// D:\Programming\runner-game-backend — ТОЛЬКО road/sand/mud, не блэклист) —
// см. место использования (handleCellPress-подсветка размещения Жнеца) за
// полным разбором найденного аудитом контракта бага 2026-10-15.
const REAPER_ALLOWED_CELL_TYPES = new Set(['road', 'sand', 'mud']);

// Та же пара статусов, что GameBoardScreen.js#DEAD_STATUSES (используется ТАМ
// ещё в паре мест, не связанных с подсветкой клеток — поэтому не вынесена
// сюда единственным источником, просто тот же литерал продублирован; сам
// список производный от RUNNER_STATUS и не может разойтись случайно).
const DEAD_STATUSES = [RUNNER_STATUS.BROKEN, RUNNER_STATUS.DESTROYED];

/**
 * 2026-10-16, вынесено из GameBoardScreen.js по итогам аудита лучших практик
 * (пункт "в" — ОСТОРОЖНО, это игровая логика "что сейчас можно тапнуть",
 * не косметика). Вынос ЧИСТО механический, порядок веток и их содержимое НЕ
 * менялись — только литералы tapMode заменены на TAP_MODE ЕЩЁ РАНЬШЕ, другим
 * заходом (см. git-историю). Возвращает `{ highlightedCells: Set<string>,
 * tapMode: string|null }`, 1-в-1 как раньше возвращал `useMemo` в
 * GameBoardScreen.js — вызывающий код оборачивает в useMemo сам (эта функция
 * чистая, без хуков, саму мемоизацию на себя не берёт).
 */
export function computeHighlightedCells({
    myTurn, myStep, activeRunner, busy, pendingAbility, runners, totalBlocks, game,
    pendingReaperPlacement, reaperPreviewReady, reaperConfirmed, trackShiftPhase,
    activeRunnerAnimating,
}) {
    // Хореография сдвига фрагментов (trackShiftPhase != null) —
    // "кат-сцена": камера скачет туда-сюда сама, интерактив с доской на
    // это время выключен целиком (по прямому запросу пользователя,
    // 2026-09-08 — "тапать некуда, доска сейчас показывает не то, чем
    // управляет игрок прямо сейчас").
    if (!myTurn || busy || trackShiftPhase) return { highlightedCells: new Set(), tapMode: null };

    if (pendingReaperPlacement && reaperPreviewReady && reaperConfirmed) {
        // Направление выстрела Жнеца сразу при размещении — подсветка
        // на доске вместо кнопок ↖/↑/↗ (единообразно с MOVE, по прямому
        // запросу пользователя, 2026-09-07). Появляется только ПОСЛЕ
        // того, как "прилёт" Жнеца успел доиграть (reaperPreviewReady) И
        // игрок подтвердил размещение (reaperConfirmed, второй диалог,
        // 2026-10-11) — до этого highlightedCells пуст, тапать некуда. Все 3
        // направления вперёд, как у обычного MOVE/SHOOT (2026-09-30, по
        // прямому запросу пользователя — реверс прежнего решения
        // 2026-09-08 "стрелять строго по прямой должен только Жнец").
        // Бэк это уже поддерживал всегда: `ReaperService::run()`
        // (read-only) прогоняет `direction` через ТОТ ЖЕ DirectionService,
        // что и обычный ход, `ReaperDTO`/`DetailsReaperDTO` не
        // ограничивают направление одним UP — ограничение было чисто
        // фронтовым (см. историю коммита).
        //
        // Раньше клетка подсвечивалась БЕЗ проверки раунда/занятости —
        // жалоба пользователя, 2026-09-08: диалог "выстрелить?" появлялся,
        // даже когда бэк заведомо проигнорирует выстрел. Перечитал
        // ReaperService::run() (read-only): сам выстрел применяется
        // ТОЛЬКО если `$player->getGame()->getRound() > 0` (в первом
        // раунде игры, round===0, блок с attackResolver вообще не
        // выполняется — направление в событие ВСЁ РАВНО попадает,
        // ReaperEvent публикуется ДО этой проверки, так что фронт видел
        // e.attack и играл анимацию атаки, хотя урона не было) И только
        // если `$target = $cell->getRunner()` не пуст (пустая клетка —
        // молчаливый no-op). Теперь клетка подсвечивается (и тапабельна)
        // ТОЛЬКО когда оба условия реально выполнены — иначе игроку
        // остаётся только «Без выстрела» (см. stepInstruction/canReaperShoot).
        const cells = game?.round > 0
            ? forwardNeighbors(pendingReaperPlacement)
                .filter((pos) => findRunnerAt(runners, pos))
                .map(cellKey)
            : [];
        return { highlightedCells: new Set(cells), tapMode: TAP_MODE.REAPER_SHOOT };
    }

    if (myStep === PLAYER_STEP.MOVE && activeRunner) {
        // 2026-10-17, по прямому запросу пользователя — живая жалоба: как
        // только бэк подтверждает очередной хоп многошагового хода/наката
        // (busy снимается сразу после ответа сети), следующая клетка уже
        // подсвечена и тапабельна, хотя слайд ПРЕДЫДУЩЕГО хопа на экране ещё
        // доигрывает — можно натыкать несколько реальных ходов подряд,
        // анимация потом "догоняет" их одну за другой. Узко для MOVE (где и
        // воспроизводится — многошаговый ход/накат единственный сценарий,
        // где ОДИН И ТОТ ЖЕ бегун может принять несколько тапов подряд в
        // рамках одного шага; SHOOT/START/Жнец не трогаем, там это не
        // повторяется). activeRunnerAnimating — есть ли у ЭТОГО бегуна
        // прямо сейчас активный шаг очереди useRunnerAnimations (см.
        // GameBoardScreen.js, вычисляется из runnerAnim.anims[activeRunner.id]).
        if (activeRunnerAnimating) return { highlightedCells: new Set(), tapMode: null };
        if (activeRunner.segment == null) {
            // Ещё не на трассе — любая СВОБОДНАЯ клетка заднего края
            // trackBegin (positionX=0). Занятые клетки отфильтрованы —
            // 2026-10-16, по прямому запросу пользователя: бэк это уже
            // отклонял (400), см. CLAUDE.md "первый выход из резерва
            // теперь проверяет занятость стартовой клетки", фикс
            // 2026-09-30 — но фронт до сих пор подсвечивал и позволял
            // тапнуть занятую клетку, отправляя заведомо отклоняемый
            // запрос. Тот же findRunnerAt, что уже фильтрует клетки
            // Жнеца (tapMode===REAPER) чуть ниже.
            const cells = new Set();
            for (let positionY = 0; positionY <= 5; positionY++) {
                const pos = { segment: 0, positionX: 0, positionY };
                if (findRunnerAt(runners, pos)) continue;
                cells.add(cellKey(pos));
            }
            return { highlightedCells: cells, tapMode: TAP_MODE.START };
        }
        // Накат (type=ROLL, см. canSelectRunner) — реверс решения
        // 2026-09-08 ("накат — это строго движение вперёд", только UP),
        // по прямому запросу пользователя, 2026-10-03: теперь все 3
        // клетки вперёд, ПО АНАЛОГИИ С ОБЫЧНЫМ ХОДОМ — та же
        // forwardNeighbors(activeRunner), без фильтра по направлению.
        // isRollMove (вычисляется отдельно в handleCellPress) по-прежнему
        // нужен ДЛЯ ДРУГОГО решения — "накат не должен предлагать доп.
        // выстрел" (2026-09-30) — эта логика не тронута, живёт в
        // GameBoardScreen.js.
        const neighbors = forwardNeighbors(activeRunner);
        return {
            highlightedCells: new Set(neighbors.map(cellKey)),
            tapMode: TAP_MODE.MOVE,
        };
    }

    if (myStep === PLAYER_STEP.SHOOT && activeRunner) {
        // Все 3 направления вперёд (как обычный MOVE) — по прямому
        // уточнению пользователя, 2026-09-08: предыдущее решение
        // (2026-09-02, "стрелять только строго по прямой") оказалось
        // СЛИШКОМ строгим — ограничение "только вперёд, без диагоналей"
        // должно было касаться ТОЛЬКО Жнеца (см. pendingReaperPlacement
        // выше), не обычных бегунов.
        const targets = forwardNeighbors(activeRunner)
            .filter((pos) => {
                const occupant = findRunnerAt(runners, pos);
                return occupant && occupant.type !== RUNNER_TYPES.REAPER && !DEAD_STATUSES.includes(occupant.status);
            });
        return { highlightedCells: new Set(targets.map(cellKey)), tapMode: TAP_MODE.SHOOT };
    }

    if (pendingAbility?.ability === 'reaper') {
        // Любая пустая клетка на всех трёх загруженных сегментах, которую
        // бэк реально разрешит (`ReaperValidator::validateCell()`,
        // read-only) — ТОТ валидатор работает через ALLOWLIST (только
        // road/sand/mud), не блэклист: раньше тут фильтровались только
        // wall/anomaly/danger — fire/acid (замена клеткам wall на треках,
        // см. CLAUDE.md 2026-09-18) не исключались, подсветка предлагала
        // клетки, на которые бэк гарантированно ответит 400
        // INVALID_CELL_TYPE (найдено аудитом контракта, 2026-10-15, не
        // проверено живьём). Зеркалим именно allowlist бэка, не
        // достраиваем блэклист новыми исключениями по одному — так не
        // разойдётся снова при появлении следующего типа клетки. danger
        // отдельно и так уже исключён этим allowlist'ом (жетон опасности
        // под клеткой ещё не вскрыт, ставить туда Жнеца не должно быть
        // можно, см. прямой запрос пользователя, 2026-09-15).
        // 2026-10-14: бэк развернул диапазоны DetailsReaperDTO обратно на
        // стандартные (positionX 0..7 — ряд, positionY 0..5 — дорожка, та
        // же унификация Cell, что и везде) — раньше (см. CLAUDE_ARCHIVE.md,
        // 2026-09-08) они были перевёрнуты (positionX ограничен 0..5), и
        // подсветка нарочно резала последние 2 колонки, чтобы не предлагать
        // клетки, которые бэк всё равно отклонит. Теперь полный диапазон.
        const cells = new Set();
        for (let segment = 0; segment < totalBlocks; segment++) {
            for (let positionX = 0; positionX <= 7; positionX++) {
                for (let positionY = 0; positionY <= 5; positionY++) {
                    const pos = { segment, positionX, positionY };
                    const type = rawCellType(game, segment, positionX, positionY);
                    if (!REAPER_ALLOWED_CELL_TYPES.has(type)) continue;
                    if (findRunnerAt(runners, pos)) continue;
                    cells.add(cellKey(pos));
                }
            }
        }
        return { highlightedCells: cells, tapMode: TAP_MODE.REAPER };
    }

    return { highlightedCells: new Set(), tapMode: null };
}
