// src/hooks/useRunnerAnimations.js
import { useCallback, useRef, useState } from 'react';

// У React Native Image(gif) нет колбэка "анимация доиграла" — длительность
// одноразовых анимаций (move/attack/gotShot/fly) захардкожена оценкой, не
// точной длиной самого gif. 'destroyed' сюда не входит — терминальное
// состояние, откатывать в idle не нужно (см. advanceQueue() ниже).
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
 *
 * **Очередь по runnerId** (2026-08-31, второй заход): бэк может прислать
 * несколько событий про ОДНОГО бегуна почти одновременно — например каскад
 * "отскок от столкновения в клетку опасности → вскрытие клетки оказывается
 * аномалией → аномалия сдвигает бегуна ещё раз" (см. CLAUDE.md про multi-hop
 * /move). Раньше каждый trigger() сразу перезаписывал стейт — все
 * промежуточные шаги схлопывались в последний (жалоба пользователя: персонаж
 * "телепортировался" в клетку аномалии, видна была только финальная
 * анимация). Теперь trigger() кладёт шаг в очередь ЭТОГО бегуна — очередь
 * играет по одному шагу за раз, каждый — свою полную длительность, прежде
 * чем начать следующий. Разные бегуны анимируются независимо (своя очередь
 * на каждый runnerId).
 *
 * **`pending`-слияние** — единственное исключение из "каждый trigger — свой
 * слот": обычный (некаскадный) шаг движения описывается ДВУМЯ событиями
 * подряд про одно и то же перемещение — транзиентным `step_move` (даёт
 * направление, но не позицию) и следующим за ним версионным `runner_save`
 * (даёт реальную позицию), см. lib/runnerAnimTriggers. Раньше это было
 * безобидно — второй trigger просто перезаписывал первый. С очередью это
 * начало бы играть ОДНО и то же перемещение дважды подряд (двойная
 * длительность на самый частый случай — обычный шаг без каскада). Поэтому
 * `step_move` помечает свой шаг `extra.pending = true` — это "заготовка,
 * ждущая подтверждения позиции", а не самостоятельный шаг очереди. Если
 * следующий trigger для того же бегуна приносит `toPosition` (реальное
 * перемещение) и на хвосте очереди/сейчас играет именно такая заготовка —
 * она ДОПОЛНЯЕТСЯ позицией на месте, а не превращается в отдельный шаг.
 * Самостоятельные шаги каскада (отскок/аномалия/финальный отлёт) `pending`
 * не выставляют — они всегда встают в очередь отдельно.
 *
 * `visualPositions[runnerId]` — вторая часть фикса: пока у бегуна есть
 * незавершённая очередь, доска должна рисовать его НЕ в реальной (в game-
 * стейте уже полностью применённой) позиции, а в позиции ТЕКУЩЕГО играемого
 * шага — иначе RunnerTokenSlide (см. компонент) скользил бы сразу к финальной
 * точке, а промежуточные "остановки" по пути не отрисовались бы ни одним
 * кадром. Шаги без реального перемещения (attack/gotShot/анимация-пульс
 * аномалии) `toPosition` не несут и текущую визуальную позицию не трогают.
 */
export function useRunnerAnimations() {
    const [anims, setAnims] = useState({});
    const [visualPositions, setVisualPositions] = useState({});
    const queues = useRef({}); // { [runnerId]: Array<{ kind, extra }> }
    const active = useRef({}); // { [runnerId]: {kind, extra} | null } — текущий играемый шаг
    const timers = useRef({});
    const nonceRef = useRef(0);

    // Одна самозацикленная функция вместо пары play()/advance(), вызывающих
    // друг друга — избегает циклической зависимости между двумя useCallback.
    // Рекурсивный вызов через setTimeout — обычное дело, TDZ тут не грозит:
    // к моменту, когда таймер реально сработает, `advanceQueue` уже давно
    // присвоена (это асинхронный колбэк, а не немедленный вызов при определении).
    const advanceQueue = useCallback((runnerId) => {
        active.current[runnerId] = null;
        const step = queues.current[runnerId]?.shift();
        if (!step) {
            setAnims((prev) => {
                if (!(runnerId in prev)) return prev;
                const next = { ...prev };
                delete next[runnerId];
                return next;
            });
            setVisualPositions((prev) => {
                if (!(runnerId in prev)) return prev;
                const next = { ...prev };
                delete next[runnerId];
                return next;
            });
            return;
        }

        active.current[runnerId] = step;
        const { kind, extra } = step;
        const { toPosition, pending, ...animExtra } = extra ?? {};
        const nonce = ++nonceRef.current;
        setAnims((prev) => ({ ...prev, [runnerId]: { kind, nonce, ...animExtra } }));
        if (toPosition) {
            setVisualPositions((prev) => ({ ...prev, [runnerId]: toPosition }));
        }

        if (kind === 'destroyed') {
            queues.current[runnerId] = []; // терминально — остальная очередь неважна
            return;
        }

        timers.current[runnerId] = setTimeout(() => advanceQueue(runnerId), ANIM_DURATION_MS[kind] ?? 900);
    }, []);

    const trigger = useCallback(
        (runnerId, kind, extra) => {
            if (runnerId == null) return;
            if (!queues.current[runnerId]) queues.current[runnerId] = [];
            const queue = queues.current[runnerId];
            const mergeTarget = queue.length ? queue[queue.length - 1] : active.current[runnerId];

            if (mergeTarget?.extra?.pending && extra?.toPosition) {
                // Заготовка от 'anomaly' (kind уже 'fly', см. lib/runnerAnimTriggers)
                // держит kind — вход в/из аномалии всегда 'fly', даже если
                // следующий runner_save по эвристике forwardNeighbors решил бы
                // иначе (по прямому запросу пользователя, 2026-09-01: "при
                // попадании в аномалию передвижение из неё должно быть
                // анимацией fly", не полагаемся на эвристику для этого
                // случая — есть явный сигнал от бэка). Заготовка от step_move
                // (kind 'move') по-прежнему берёт решение ИЗ ВХОДЯЩЕГО trigger
                // (обычный путь, как было).
                const finalKind = mergeTarget.kind === 'fly' ? 'fly' : kind;
                mergeTarget.kind = finalKind;
                mergeTarget.extra = { ...mergeTarget.extra, ...extra, pending: false };
                if (mergeTarget === active.current[runnerId]) {
                    const { pending, ...animExtra } = mergeTarget.extra;
                    setAnims((prev) => ({ ...prev, [runnerId]: { ...prev[runnerId], ...animExtra, kind: finalKind } }));
                    setVisualPositions((prev) => ({ ...prev, [runnerId]: extra.toPosition }));
                }
                return;
            }

            queue.push({ kind, extra });
            if (!active.current[runnerId]) advanceQueue(runnerId);
        },
        [advanceQueue],
    );

    const reset = useCallback(() => {
        Object.values(timers.current).forEach(clearTimeout);
        timers.current = {};
        queues.current = {};
        active.current = {};
        setAnims({});
        setVisualPositions({});
    }, []);

    return { anims, visualPositions, trigger, reset };
}
