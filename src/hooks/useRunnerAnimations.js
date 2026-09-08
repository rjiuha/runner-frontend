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
// pose-анимацией (шагами). move — ещё на 20% быстрее (2026-09-02, по прямому
// запросу пользователя, "анимацию передвижений с сегмента на сегмент можно
// сделать процентов на 20 быстрее") — 1800×0.8, в паре с SLIDE_DURATION_MS
// там же (1700×0.8). attack/gotShot/fly не трогал — запрос был именно про
// движение между клетками.
const ANIM_DURATION_MS = { move: 1440, attack: 1800, gotShot: 1400, fly: 2200, start: 2200, bomb: 1800 };

// 'wait' — синтетический шаг очереди (не приходит с бэка), см.
// lib/runnerAnimTriggers.js: держит проигравшего коллизию на общей клетке,
// пока победитель доигрывает СВОЮ 'move'-позу, чтобы BoardGrid успел
// отрендерить коллизионную позу хотя бы один кадр, прежде чем проигравший
// реально улетит (fly). Длительность — с запасом больше ANIM_DURATION_MS.move
// (1440мс), не тютелька-в-тютельку, чтобы victim гарантированно "осел"
// позже победителя, а не одновременно/раньше (2026-09-07).
const KNOCKBACK_WAIT_MS = 1650;

// Страховочный таймаут для 'pending'-заготовок (step_move/anomaly, см.
// lib/runnerAnimTriggers.js) — заготовка ждёт ВТОРОЙ trigger (реальный
// runner_save с toPosition), который должен её ДОПОЛНИТЬ на месте (см. merge
// в trigger() ниже). Обычная длительность ANIM_DURATION_MS[kind] (900-1440мс)
// тут неуместна — если подтверждающее событие задерживается ДОЛЬШЕ этого
// срока (сетевой джиттер), таймаут срабатывает раньше мерджа и запускает
// "дёрганье" (см. подробный разбор у места использования, 2026-09-08). Это
// ЗАВЕДОМО больше нормального времени доставки события (обычно десятки-сотни
// мс) — чистая подстраховка на случай, если оно вообще не придёт.
const PENDING_SAFETY_TIMEOUT_MS = 8000;

// 'destroyed' сознательно НЕ имеет записи здесь (терминальный шаг, не идёт
// через обычный setTimeout ниже — см. advanceQueue) — DESTROYED_HIDE_DELAY_MS
// ниже управляет ОТДЕЛЬНЫМ таймером, который прячет токен с доски после того,
// как анимация уничтожения успела показаться (по прямому запросу
// пользователя, 2026-09-07 — "хочется, чтобы персонаж исчез с дороги", а не
// висел там вечно в позе уничтожения).
const DESTROYED_HIDE_DELAY_MS = 1800;

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
    // Бегуны, чья 'destroyed'-анимация уже доиграла — токен на доске должен
    // полностью исчезнуть (см. DESTROYED_HIDE_DELAY_MS), а не висеть вечно
    // в позе уничтожения. Персистентно до reset() (полный ресинк стейта).
    const [hiddenIds, setHiddenIds] = useState(() => new Set());
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
        // Заготовка (pending) ЕЩЁ НЕ несёт позицию — если показать её позу
        // прямо сейчас, токен на пару кадров "шагает на месте" (поза уже
        // сменилась, x/y — ещё старые), а когда чуть позже придёт мердж с
        // реальной toPosition, поза/позиция обновятся ВТОРОЙ раз почти сразу
        // следом — на реальном устройстве это читалось как дёрганье/"будто
        // телепортируется на изначальный сегмент" (жалоба пользователя,
        // 2026-09-08, третий раз за сессию — предыдущий фикс той же сессии,
        // PENDING_SAFETY_TIMEOUT_MS, устранял ДРУГУЮ причину той же жалобы —
        // преждевременную очистку по таймауту, но не этот двухфазный показ).
        // Раз в норме мердж приходит за десятки-сотни мс (обычная сетевая
        // задержка между step_move и runner_save), безопаснее ПОДОЖДАТЬ его и
        // показать позу и позицию ОДНИМ кадром — токен остаётся в текущей
        // (старой) позе до этого момента, а не мигает лишней промежуточной.
        if (!pending) {
            const nonce = ++nonceRef.current;
            setAnims((prev) => ({ ...prev, [runnerId]: { kind, nonce, ...animExtra } }));
        }
        if (toPosition) {
            setVisualPositions((prev) => ({ ...prev, [runnerId]: toPosition }));
        }

        if (kind === 'destroyed') {
            queues.current[runnerId] = []; // терминально — остальная очередь неважна
            // Не оставляем бегуна вечно висеть в позе уничтожения — после
            // того, как анимация успела показаться, прячем токен с доски
            // насовсем (см. hiddenIds выше). 'anims' запись тоже стираем —
            // не то чтобы это было важно (бегун скрыт), но иначе она бы
            // висела в стейте бесполезным мусором до конца партии.
            timers.current[runnerId] = setTimeout(() => {
                setAnims((prev) => {
                    if (!(runnerId in prev)) return prev;
                    const next = { ...prev };
                    delete next[runnerId];
                    return next;
                });
                setHiddenIds((prev) => (prev.has(runnerId) ? prev : new Set(prev).add(runnerId)));
            }, DESTROYED_HIDE_DELAY_MS);
            return;
        }

        // `pending`-заготовка (см. lib/runnerAnimTriggers.js — step_move/
        // anomaly) ждёт ВТОРОЙ trigger (реальный runner_save с toPosition),
        // который должен её ДОПОЛНИТЬ на месте (см. merge-ветку в trigger()
        // ниже), а не превращаться в отдельный шаг. Раньше у заготовки был
        // ОБЫЧНЫЙ ANIM_DURATION_MS[kind] таймаут (900-1440мс) — если
        // подтверждающее событие задерживалось (сетевой джиттер) дольше
        // этого срока, таймаут срабатывал ПЕРВЫМ, "no more steps"-ветка
        // выше очищала anims/visualPositions ДО прихода мерджа, и когда
        // runner_save всё же приходил, он уже не находил pending-заготовку
        // для мерджа (active.current[runnerId] уже null) — заводил
        // ОТДЕЛЬНЫЙ, второй 'move'-шаг с нуля. Визуально это давало ровно
        // то дёрганье, на которое пожаловался пользователь, 2026-09-08:
        // "то в движении, то телепортируется на изначальный сегмент, то
        // снова в движении" — фаза 1 (заготовка играет позу на месте, без
        // сдвига позиции), фаза 2 (преждевременная очистка — поза сбрасывается
        // в idle на том же месте), фаза 3 (запоздавший второй 'move' наконец
        // реально едет). PENDING_SAFETY_TIMEOUT_MS — с большим запасом
        // (обычно мердж приходит за десятки-сотни мс), это подстраховка на
        // случай, если подтверждающее событие вообще НЕ придёт, а не
        // ожидаемый путь выполнения.
        timers.current[runnerId] = setTimeout(
            () => advanceQueue(runnerId),
            pending ? PENDING_SAFETY_TIMEOUT_MS : kind === 'wait' ? KNOCKBACK_WAIT_MS : (ANIM_DURATION_MS[kind] ?? 900),
        );
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
                    // Заготовка была запущена со СТРАХОВОЧНЫМ таймаутом
                    // (PENDING_SAFETY_TIMEOUT_MS, см. advanceQueue) — теперь,
                    // когда мердж её финализировал, переставляем таймер на
                    // ШТАТНУЮ длительность этого kind, иначе шаг играл бы
                    // аномально долго (до самого страховочного таймаута).
                    if (timers.current[runnerId]) clearTimeout(timers.current[runnerId]);
                    timers.current[runnerId] = setTimeout(
                        () => advanceQueue(runnerId),
                        finalKind === 'wait' ? KNOCKBACK_WAIT_MS : (ANIM_DURATION_MS[finalKind] ?? 900),
                    );
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
        setHiddenIds(new Set());
    }, []);

    return { anims, visualPositions, hiddenIds, trigger, reset };
}
