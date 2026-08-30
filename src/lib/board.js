// src/lib/board.js
import { GAME_CONFIG, SEGMENT_IMAGES } from '../constants/GameConstants';

const KNOWN_CELL_TYPES = new Set(Object.values(GAME_CONFIG.CELL_TYPES)); // road/sand/mud/wall/danger/anomaly

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
 */
export function pickSegmentImage(type, cellId) {
    const variants = SEGMENT_IMAGES[type] || SEGMENT_IMAGES.road;
    return variants[hashString(cellId) % variants.length];
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
                });
            }
        }
    });
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
 * Индекс "бегунов по ячейке" — ключ совпадает с id ячейки из flattenTrackSegments
 * (segment-row-col = segment-positionY-positionX), поэтому BoardGrid может отдать
 * O(1)-поиск токенов для каждой отрисованной клетки вместо перебора на каждый рендер.
 */
export function indexRunnersByCell(runners) {
    const map = new Map();
    for (const runner of runners) {
        if (runner.segment == null || runner.positionX == null || runner.positionY == null) continue;
        const key = `${runner.segment}-${runner.positionY}-${runner.positionX}`;
        const list = map.get(key);
        if (list) list.push(runner);
        else map.set(key, [runner]);
    }
    return map;
}
