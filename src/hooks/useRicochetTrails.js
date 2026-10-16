// src/hooks/useRicochetTrails.js
import { useCallback, useRef, useState } from 'react';

// Страховочный таймер очистки — НЕ реальная длительность полёта конкретной
// пули (ту считает BoardGrid.js от реальной пиксельной дистанции, см.
// constants/ricochetVfx.js) — с большим запасом больше любого реалистичного
// полёта, просто чтобы запись не осталась в стейте навечно, если что-то
// пойдёт не так с рендером/анимацией.
const SAFETY_CLEANUP_MS = 2500;

let nextTrailId = 0;

/**
 * 2026-10-17, по прямому запросу пользователя — визуальный след пролетающей
 * пули рикошета (см. ricochetVfx.js/BoardGrid.js). Тот же приём, что уже
 * используется у useMineBlasts.js (одноразовый эффект, сам снимается по
 * таймеру) — но тут список (может лететь несколько пуль почти одновременно,
 * если рикошет цепляется дальше — см. CLAUDE.md), не объект по cellId.
 */
export function useRicochetTrails() {
    const [trails, setTrails] = useState([]);
    const timersRef = useRef({});

    const trigger = useCallback((from, to) => {
        if (!from || !to) return;
        const id = ++nextTrailId;
        setTrails((prev) => [...prev, { id, from, to }]);
        timersRef.current[id] = setTimeout(() => {
            setTrails((prev) => prev.filter((t) => t.id !== id));
            delete timersRef.current[id];
        }, SAFETY_CLEANUP_MS);
    }, []);

    return { trails, trigger };
}
