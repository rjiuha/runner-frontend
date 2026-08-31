// src/hooks/useRunnerAnimations.js
import { useCallback, useRef, useState } from 'react';

// У React Native Image(gif) нет колбэка "анимация доиграла" — длительность
// одноразовых анимаций (move/attack/gotShot/fly) захардкожена оценкой, не
// точной длиной самого gif. 'destroyed' сюда не входит — терминальное
// состояние, откатывать в idle не нужно (см. trigger ниже).
// Вдвое медленнее исходных (900/900/700/1100) — по прямому запросу
// пользователя, 2026-08-31, после первого живого теста. См. также
// RunnerTokenSlide.SLIDE_DURATION_MS — держим её в паре с ANIM_DURATION_MS.move,
// чтобы скольжение между клетками не расходилось по времени с самой
// pose-анимацией (шагами).
const ANIM_DURATION_MS = { move: 1800, attack: 1800, gotShot: 1400, fly: 2200 };

/**
 * Стейт-стор транзиентных анимаций бегунов (move/attack/gotShot/fly/destroyed)
 * по runnerId — см. lib/runnerAnimTriggers про то, ЧТО именно триггерит каждую
 * из них. 'collision' сюда НЕ входит — это derived-состояние, вычисляется
 * прямо в BoardGrid по факту "2 бегуна на одной клетке", не по событию.
 */
export function useRunnerAnimations() {
    const [anims, setAnims] = useState({});
    const timers = useRef({});
    const nonceRef = useRef(0);

    const trigger = useCallback((runnerId, kind, extra) => {
        if (runnerId == null) return;
        clearTimeout(timers.current[runnerId]);
        // nonce — растёт на КАЖДЫЙ вызов, даже если kind/direction совпадают с
        // предыдущим триггером (два шага UP подряд при многошаговом ходе) —
        // без него RunnerToken.animKey не менялся бы, и <Image> (см. key там)
        // не перезапускал бы gif с первого кадра при повторной той же анимации.
        const nonce = ++nonceRef.current;
        setAnims((prev) => ({ ...prev, [runnerId]: { kind, nonce, ...extra } }));

        if (kind === 'destroyed') return; // терминально, таймер отката не нужен

        timers.current[runnerId] = setTimeout(() => {
            setAnims((prev) => {
                if (prev[runnerId]?.kind !== kind) return prev; // уже перекрыто новым триггером
                const next = { ...prev };
                delete next[runnerId];
                return next;
            });
        }, ANIM_DURATION_MS[kind] ?? 900);
    }, []);

    return { anims, trigger };
}
