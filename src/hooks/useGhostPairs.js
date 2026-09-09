// src/hooks/useGhostPairs.js
import { useCallback, useRef, useState } from 'react';

/**
 * Стор "какие пары бегунов сейчас мирно стоят рядом благодаря призраку" (см.
 * lib/ghostPairs.js за форматом ключа). Set живёт в ref — само содержимое не
 * должно построчно триггерить ре-рендер, `tick` форсит React пересчитать
 * зависящие компоненты (BoardGrid) ровно когда пара добавляется (тот же
 * паттерн, что holdTick в BoardGrid#tokenOverlay).
 */
export function useGhostPairs() {
    const pairsRef = useRef(new Set());
    const [, setTick] = useState(0);

    const record = useCallback((key) => {
        if (!key || pairsRef.current.has(key)) return;
        pairsRef.current.add(key);
        setTick((t) => t + 1);
    }, []);

    return { pairs: pairsRef.current, record };
}
