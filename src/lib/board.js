// src/lib/board.js
import { GAME_CONFIG, SEGMENT_IMAGES } from '../constants/GameConstants';

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
