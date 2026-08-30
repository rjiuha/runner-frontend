// src/hooks/useBoardScroll.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD_LAYOUT } from '../constants/GameConstants';

const REPEAT_INTERVAL_MS = 250; // вдвое быстрее прежних 500мс, по прямому запросу пользователя

/**
 * Навигация по трассе — сетка (rows × cols, обычно 6×8) на экране физически
 * никогда не двигается (см. BoardGrid.js), клетки в ней просто подменяются
 * на соседний срез трассы. `windowStart` — глобальный индекс (0..TOTAL_COLS-
 * cols) ЛЕВОГО/НИЖНЕГО края видимого окна в терминах cell.col (уже глобальный
 * столбец, см. lib/board#flattenTrackSegments) — BoardGrid показывает cols
 * подряд идущих столбцов начиная с него.
 *
 * До 2026-08-30 (второй заход) окно прыгало сразу на целый фрагмент (8
 * колонок, blockIndex 0..2). По прямому запросу пользователя это заменено на
 * посегментный шаг: одно нажатие — сдвиг ровно на 1 колонку; удержание —
 * повтор каждые REPEAT_INTERVAL_MS (250мс, ускорено с исходных 500мс по
 * следующему запросу пользователя в тот же день), пока палец/курсор не
 * отпущен. Один и тот же механизм
 * для обеих раскладок и платформ (onPressIn запускает немедленный первый шаг
 * + интервал, onPressOut его останавливает) — раньше веб и мобильные вели
 * себя по-разному (плавный скролл на вебе, snap-to-block на мобильных),
 * посегментный шаг одинаково уместен везде, отдельные ветки не нужны.
 */
export function useBoardScroll({ cols }) {
    const maxStart = Math.max(0, BOARD_LAYOUT.TOTAL_COLS - cols);
    const [windowStart, setWindowStart] = useState(0);
    const intervalRef = useRef(null);

    const stopRepeat = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const step = useCallback(
        (dir) => {
            setWindowStart((s) => Math.max(0, Math.min(maxStart, s + dir)));
        },
        [maxStart],
    );

    const startRepeat = useCallback(
        (dir) => {
            stopRepeat();
            step(dir); // немедленный первый шаг — одиночный тап тоже должен сдвинуть на 1
            intervalRef.current = setInterval(() => step(dir), REPEAT_INTERVAL_MS);
        },
        [step, stopRepeat],
    );

    useEffect(() => () => stopRepeat(), [stopRepeat]);

    return {
        windowStart,
        backButtonProps: { onPressIn: () => startRepeat(-1), onPressOut: stopRepeat },
        forwardButtonProps: { onPressIn: () => startRepeat(1), onPressOut: stopRepeat },
    };
}
