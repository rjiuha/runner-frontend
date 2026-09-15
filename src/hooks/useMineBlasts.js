// src/hooks/useMineBlasts.js
import { useCallback, useRef, useState } from 'react';
import { MINE_BLAST_DURATION_MS } from '../constants/GameConstants';

/**
 * Одноразовые взрывы мины на клетках — `{ [cellId]: variantIndex }`.
 * Монтируется в момент вскрытия клетки как danger==='mine' (см.
 * GameBoardScreen#reduceAndLog — коррелирует транзиентный 'danger' с
 * версионным game_cell_updated ровно тем же приёмом, что уже используется
 * для ghost_pass/жетонов повреждений в этом проекте: транзиент только
 * запоминает "ждём подтверждения", реальный триггер — на следующем
 * относящемся версионном событии), снимается сам через
 * MINE_BLAST_DURATION_MS без внешнего участия.
 */
export function useMineBlasts() {
    const [blasts, setBlasts] = useState({});
    const timersRef = useRef({});

    const trigger = useCallback((cellId) => {
        const variant = Math.random() < 0.5 ? 0 : 1;
        setBlasts((prev) => ({ ...prev, [cellId]: variant }));
        clearTimeout(timersRef.current[cellId]);
        timersRef.current[cellId] = setTimeout(() => {
            setBlasts((prev) => {
                if (!(cellId in prev)) return prev;
                const next = { ...prev };
                delete next[cellId];
                return next;
            });
        }, MINE_BLAST_DURATION_MS);
    }, []);

    return { blasts, trigger };
}
