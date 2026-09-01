// src/lib/hexDirection.js

/**
 * Гекс-соседи клетки трассы для ПОДСВЕТКИ/тап-детекции на фронте.
 * positionX — индекс вперёд по сегменту (0-7), positionY — номер дорожки (0-5).
 *
 * ВАЖНО (2026-09-02, несколько раундов живого фидбека пользователя,
 * последний — со скриншотом с отметками X/O): раньше здесь зеркалили
 * DirectionService::run() на бэке 1-в-1 (чередование по чётности positionX).
 * Промежуточная версия делала LEFT_UP/RIGHT_UP ВСЕГДА продвигающими глубину
 * на +1 (как UP) — пользователь на скриншоте explicitно отметил крестами
 * именно эти (мои) клетки как НЕПРАВИЛЬНЫЕ и кружками — клетки РЯДОМ с
 * бегуном на ЕГО ЖЕ глубине (без продвижения) как правильные: "визуально
 * согласно гексогональному расположению, сегмент слева-впереди на
 * полсегмента, справа-впереди на полсегмента". Это ТОЧНО геометрически
 * честный гекс-сосед по кирпичному сдвигу дорожек в BoardGrid (`laneIdx % 2
 * === 0` → сдвиг на пол-сегмента, см. компонент) — та версия, что уже была
 * реализована и затем ошибочно откачена по чуть более раннему сообщению
 * пользователя ("рогатка"/скриншот с "всегда 3 клетки"), которое, как теперь
 * ясно из уточнения с крестами/кружками, имелось в виду иначе, чем было
 * понято. Итоговое, подтверждённое правило: депт-продвижение диагонали
 * зависит от чётности ТЕКУЩЕЙ (не целевой) дорожки бегуна —
 *   - С НЕЧЁТНОЙ дорожки LEFT_UP/RIGHT_UP продвигают глубину (positionX+1),
 *     как и UP.
 *   - С ЧЁТНОЙ дорожки LEFT_UP/RIGHT_UP НЕ продвигают глубину (та же
 *     positionX) — сосед всё равно визуально впереди ровно на пол-сегмента
 *     благодаря сдвигу целевой (нечётной, несдвинутой) дорожки.
 * Зависимость — от чётности ИМЕННО positionY (номер дорожки), не positionX —
 * потому что именно по этой оси реально сдвинуты клетки в BoardGrid.
 *
 * Это чисто фронтовое решение "что показывать доступным и куда засчитывать
 * тап" — реальную позицию после /move всё равно определяет бэк своей (иной,
 * по positionX) логикой (см. известный нерешённый вопрос про
 * DirectionService.php в CLAUDE.md); если бэк применит ход иначе, чем было
 * подсвечено/тапнуто, визуальная позиция бегуна разойдётся с ожиданием до
 * следующего live-обновления — риск принят пользователем.
 * Игрок сам выбирает только 3 "вперёд" направления (MoveDto/ShootDto
 * разрешают только их), назад — только для служебных эффектов на бэке.
 * Стрелять можно ТОЛЬКО строго вперёд (UP) — диагонали для SHOOT исключены
 * отдельным фильтром в GameBoardScreen, эта функция общая для MOVE и SHOOT.
 */
export const MOVE_DIRECTIONS = ['LEFT_UP', 'UP', 'RIGHT_UP'];

/**
 * Клетка-сосед по направлению. Может уйти за пределы текущего сегмента
 * (positionX > 7 → соседний сегмент) — вызывающий код сам решает, что делать
 * с сегментом за пределами трёх загруженных (см. forwardNeighbors).
 */
export function neighborPosition({ positionX, positionY, segment }, direction) {
    // См. докстринг выше — продвигаем глубину диагоналей только с НЕЧЁТНОЙ
    // дорожки (визуальный сдвиг чётных дорожек в BoardGrid уже даёт нужные
    // пол-сегмента "бесплатно").
    const advanceDiagonal = positionY % 2 !== 0;
    let next;
    switch (direction) {
        case 'UP':
            next = { positionX: positionX + 1, positionY };
            break;
        case 'LEFT_UP':
            next = advanceDiagonal
                ? { positionX: positionX + 1, positionY: positionY + 1 }
                : { positionX, positionY: positionY + 1 };
            break;
        case 'RIGHT_UP':
            next = advanceDiagonal
                ? { positionX: positionX + 1, positionY: positionY - 1 }
                : { positionX, positionY: positionY - 1 };
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
