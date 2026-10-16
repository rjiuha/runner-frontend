// src/constants/ricochetVfx.js

/**
 * 2026-10-17, по прямому запросу пользователя — визуальный след пролетающей
 * пули рикошета (см. lib/runnerAnimTriggers.js/GameBoardScreen.js#reduceAndLog
 * — событие `ricochet` несёт `from`/`to`, см. CLAUDE.md за полным разбором
 * контракта). Ассеты пользователя:
 * - native: `assets/sprites/ricochet/glowing_neon_energy_proj-Idle.png` —
 *   2-строчный AI-спрайт-лист (row 0 — 8 статичных "rotations"-поз по
 *   направлениям, НЕ используется; row 1 — "Walking", 8 кадров, направление
 *   "south", т.е. нарисована летящей ВНИЗ экрана). Та же методика, что и у
 *   основного пака бегунов (`spritePackStrips.js`) — вырезана в отдельный
 *   файл-полоску (`strip.png`, 640×80, row=0 внутри самого файла), исходный
 *   многострочный .png оставлен на диске (источник для возможной
 *   перенарезки), .json-разметка удалена — метаданные (cell/frameCount)
 *   захардкожены тут же, читать её больше не нужно.
 * - web: `assets/images/runners/ricochet/fly_south.gif` — тот же кадр/та же
 *   "south"-ориентация, 80×80, 8 кадров — браузер анимирует gif сам, доп.
 *   метаданных не нужно.
 *
 * Оба ассета нарисованы летящими СТРОГО ВНИЗ (south) — поворот под реальное
 * направление полёта делает вызывающий код (BoardGrid.js) через
 * `transform:rotate`, не отдельными кадрами на каждое из 6 гекс-направлений.
 */
const CELL_SIZE = 80;
const FRAME_COUNT = 8;

export const RICOCHET_NATIVE_FRAME = {
    source: require('../assets/sprites/ricochet/strip.png'),
    cell: { w: CELL_SIZE, h: CELL_SIZE },
    sheet: { w: CELL_SIZE * FRAME_COUNT, h: CELL_SIZE },
    row: 0,
    frameCount: FRAME_COUNT,
};

export const RICOCHET_WEB_SOURCE = require('../assets/images/runners/ricochet/fly_south.gif');

// Длительность полёта — по прямому запросу пользователя: база + надбавка за
// дистанцию, "быстро, но заметно". Реальная дистанция в клетках считается в
// BoardGrid.js (там живёт пиксельная геометрия доски) — эти константы только
// хранят саму формулу.
export const RICOCHET_BASE_DURATION_MS = 300;
export const RICOCHET_PER_CELL_DURATION_MS = 100;
