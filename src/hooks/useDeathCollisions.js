// src/hooks/useDeathCollisions.js
import { useCallback, useRef, useState } from 'react';

/**
 * Стор "какая клетка Death прямо сейчас должна проиграть collision" (2026-09-12,
 * см. BoardGrid#DeathTile) — Map<cellId, nonce>. nonce — монотонно растущий
 * счётчик, НЕ boolean/timestamp: одна и та же клетка теоретически может
 * увидеть ВТОРОЕ столкновение позже за партию (другой бегун наступит на ту
 * же клетку) — DeathTile сравнивает своё последнее увиденное значение с
 * новым, отличить "новое" от "уже видели" можно только по числу, которое
 * всегда растёт (не по факту "не null").
 *
 * `signals` — обычный React-стейт (не ref, в отличие от useGhostPairs) —
 * BoardGrid получает его напрямую пропом и передаёт КОНКРЕТНОЙ клетке
 * `signals[cell.id]`, DeathTile сам решает, новое ли это значение.
 */
export function useDeathCollisions() {
    const counterRef = useRef(0);
    const [signals, setSignals] = useState({});

    const trigger = useCallback((cellId) => {
        if (!cellId) return;
        counterRef.current += 1;
        const nonce = counterRef.current;
        setSignals((prev) => ({ ...prev, [cellId]: nonce }));
    }, []);

    return { signals, trigger };
}
