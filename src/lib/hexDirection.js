// src/lib/hexDirection.js

/**
 * Зеркало DirectionService::run() на бэке — гекс-соседи клетки трассы.
 * positionX — "строка"/индекс вперёд по сегменту (0-7), positionY —
 * "столбец"/номер дорожки (0-5). Чётность именно positionX (не positionY!)
 * определяет сдвиг LEFT_UP/RIGHT_UP — перепроверено чтением DirectionService.php.
 * Игрок сам выбирает только 3 "вперёд" направления (MoveDto/ShootDto
 * разрешают только их), назад — только для служебных эффектов на бэке.
 */
export const MOVE_DIRECTIONS = ['LEFT_UP', 'UP', 'RIGHT_UP'];

/**
 * Клетка-сосед по направлению. Может уйти за пределы текущего сегмента
 * (positionX > 7 → соседний сегмент) — вызывающий код сам решает, что делать
 * с сегментом за пределами трёх загруженных (см. forwardNeighbors).
 */
export function neighborPosition({ positionX, positionY, segment }, direction) {
    const isEvenX = positionX % 2 === 0;
    let next;
    switch (direction) {
        case 'UP':
            next = { positionX: positionX + 1, positionY };
            break;
        case 'LEFT_UP':
            next = isEvenX
                ? { positionX, positionY: positionY + 1 }
                : { positionX: positionX + 1, positionY: positionY + 1 };
            break;
        case 'RIGHT_UP':
            next = isEvenX
                ? { positionX, positionY: positionY - 1 }
                : { positionX: positionX + 1, positionY: positionY - 1 };
            break;
        default:
            return null;
    }

    let nextSegment = segment;
    if (next.positionX > 7) {
        nextSegment += 1;
        next.positionX = 0;
    } else if (next.positionX < 0) {
        nextSegment -= 1;
        next.positionX = 7;
    }

    return { segment: nextSegment, positionX: next.positionX, positionY: next.positionY };
}

/**
 * До 3 клеток "вперёд" от бегуна (LEFT_UP/UP/RIGHT_UP), отфильтрованных до
 * тех, что физически существуют на текущих 3 загруженных сегментах (0-2) и
 * в пределах дорожек (0-5) — то есть реально отрисованы на доске сейчас.
 * Используется и для подсветки MOVE, и для подсветки SHOOT (canShoot() на
 * бэке проверяет ровно те же 3 соседа).
 */
export function forwardNeighbors(runner) {
    if (runner?.segment == null || runner.positionX == null || runner.positionY == null) return [];

    const result = [];
    for (const direction of MOVE_DIRECTIONS) {
        const cell = neighborPosition(runner, direction);
        if (!cell) continue;
        if (cell.segment < 0 || cell.segment > 2) continue; // за пределами 3 загруженных сегментов
        if (cell.positionY < 0 || cell.positionY > 5) continue; // за пределами дорожек
        result.push({ direction, ...cell });
    }
    return result;
}

/** Ключ ячейки в формате lib/board.js (flattenTrackSegments): "segment-row-col". */
export function cellKey({ segment, positionX, positionY }) {
    return `${segment}-${positionY}-${positionX}`;
}
