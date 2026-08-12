// src/lib/board.js

/**
 * Данные сетки поля: несколько блоков дороги подряд, чередующихся по типу.
 * Пока это просто road/dirt через блок — реальные типы сегментов придут
 * с бэкенда через trackState.segments (см. GAME_STATE_STRUCTURE).
 */
export function buildGridData(totalBlocks, rows, cols) {
    const data = [];
    for (let b = 0; b < totalBlocks; b++) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                data.push({
                    id: `${b}-${r}-${c}`,
                    row: r,
                    col: c + b * cols,
                    blockIndex: b,
                    type: b % 2 === 0 ? 'road' : 'dirt',
                });
            }
        }
    }
    return data;
}
