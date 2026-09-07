// src/lib/runnerAnimTriggers.js
import { statusWorsened } from '../constants/runnerAnimations';
import { forwardNeighbors, neighborPosition } from './hexDirection';
import { RUNNER_TYPES } from '../constants/GameConstants';

// Сколько мс держим "недавно получил выстрел" по runnerId (2026-09-07, живой
// прогон — "вместо fly отработала move при отбросе выстрелом"). Эвристика
// move/fly для runner_save (см. ниже) считает knockback по расстоянию —
// forwardNeighbors(prev).find(...) — но случайное направление отброса от
// выстрела иногда СОВПАДАЕТ с одним из 3 forward-соседей старой позиции,
// и тогда знакомая эвристика ошибочно классифицирует явный отброс как
// обычный шаг (move). Раз мы точно знаем, что этого бегуна только что
// подстрелили (runner_damage с ухудшением статуса, см. ниже), последующее
// перемещение того же бегуна форсируем как 'fly', не полагаясь на эвристику
// расстояния. TTL — на случай, если urner_damage без последующего
// перемещения (просто урон без отброса) никогда не "заберёт" метку сам —
// не должна протухать бесконечно.
const RECENTLY_SHOT_TTL_MS = 4000;
const recentlyShotRunners = new Map(); // runnerId -> timestamp

function markRecentlyShot(runnerId) {
    // Заодно чистим протухшие записи — карта живёт весь сеанс модуля,
    // не хотим копить мусор за долгую партию.
    for (const [id, ts] of recentlyShotRunners) {
        if (Date.now() - ts > RECENTLY_SHOT_TTL_MS) recentlyShotRunners.delete(id);
    }
    recentlyShotRunners.set(runnerId, Date.now());
}

function consumeRecentlyShot(runnerId) {
    const ts = recentlyShotRunners.get(runnerId);
    if (ts == null) return false;
    recentlyShotRunners.delete(runnerId);
    return Date.now() - ts <= RECENTLY_SHOT_TTL_MS;
}

/**
 * Смотрит на versioned-событие ДО того, как его применит runnerGameReducer
 * (нужно старое состояние бегуна для сравнения), и решает, нужно ли завести
 * транзиентную анимацию (move/fly/gotShot/destroyed). Чистая функция —
 * единственный побочный эффект через переданный trigger(runnerId, kind, extra)
 * (см. hooks/useRunnerAnimations), сам стейт не трогает.
 *
 * 'runner_save' → сравниваем старую и новую позицию бегуна:
 *   - бегун только что вышел из резерва (prev.segment был null) → БЕЗ
 *     анимации вообще (по прямому запросу пользователя, 2026-09-01) — до
 *     этого момента он нигде не был нарисован, скользить неоткуда, просто
 *     появляется в клетке в позе idle.
 *   - не изменилась → ничего (событие не про перемещение).
 *   - новая клетка — один из 3 forwardNeighbors старой → обычный шаг вперёд
 *     (move, с РЕАЛЬНЫМ направлением этого шага — важно и для самого первого
 *     step_move, и для КАЖДОГО последующего "схлопнутого" шага multi-hop
 *     движения, см. CLAUDE.md про то, что один /move может дать несколько
 *     Action::TYPE_MOVE подряд — у каждого своя пара старая/новая позиция,
 *     каждая тут своя forwardNeighbors-проверка). Вместе с направлением —
 *     depthChanged/targetLaneShifted, нужны constants/runnerAnimations
 *     #resolveMoveAssetDirection, чтобы отличить чисто боковой шаг на
 *     "отставшую" (смещённую на пол-сегмента назад) дорожку от диагонали
 *     вперёд — первое визуально идёт south-*, не north-*.
 *   - иначе (не сосед) → отскок/телепорт (столкновение, аномалия, ракета и
 *     т.п.) — бэк НЕ шлёт отдельного сигнала "это был knockback" (см.
 *     обсуждение в CLAUDE.md), это осознанно принятая эвристика по
 *     расстоянию, а не точный сигнал. Исключение — аномалия: та шлёт СВОЙ
 *     явный транзиентный сигнал (см. handleTransientRunnerAnimEvent ниже),
 *     который форсит 'fly' через pending-мерж независимо от этой эвристики.
 *
 * 'runner_damage'/'runner_destroy' → сравниваем статус: стало ХУЖЕ (не
 * лечение) → gotShot, а если конечный статус — destroyed → сразу terminal
 * 'destroyed' (с fromStatus = статус ДО удара, для выбора healthy/damaged
 * набора анимации, см. constants/runnerAnimations#getRunnerAnimationImage).
 *
 * Каждый trigger() тут передаёт `toPosition` (кроме damage/destroy — они
 * позицию не меняют) — useRunnerAnimations ставит шаг в очередь ЭТОГО
 * бегуна и проигрывает по одному, а не перезаписывает предыдущий (2026-08-31,
 * второй заход) — иначе каскад из нескольких runner_save подряд (отскок от
 * столкновения → аномалия → отлёт из неё) схлопывался бы в одну финальную
 * анимацию, минуя промежуточные шаги (см. подробности в useRunnerAnimations).
 */
export function handleVersionedRunnerAnimEvent(prevGame, e, trigger) {
    if (e.event === 'runner_save') {
        const patch = e.runnerId;
        const prev = prevGame?.runners?.find((r) => r.id === patch.id);
        const toPosition = { segment: patch.segment, positionX: patch.positionX, positionY: patch.positionY };

        if (!prev) {
            // Бегун вообще не найден в ПРЕДЫДУЩЕМ состоянии. Для обычных
            // бегунов (и Жнеца) это значит "мы просто не видели предыдущего
            // состояния" (холодный коннект/resync) — не можем отличить
            // "только что появился" от "давно там стоит", молчим, как и
            // раньше, просто idle. НО "мяч" (RUNNER_TYPES.BALL,
            // RunnerBallInitService на бэке) — принципиально другой случай:
            // это НАСТОЯЩАЯ первая персистентная запись, он физически не мог
            // существовать раньше этого события (создаётся заново на каждой
            // danger-коллизии) — !prev тут ВСЕГДА означает "только что
            // появился", а не "мы его просто не видели". Играем его 'start'
            // безусловно.
            // runnerType в extra — чисто для звуковой системы
            // (lib/runnerSoundTriggers.js): в момент этого триггера бегуна
            // ещё нет ни в prevGame, ни (пока) в применённом game-стейте, по
            // id его тип не найти — событие несёт его напрямую.
            if (patch.type === 'ball') trigger(patch.id, 'start', { toPosition, runnerType: patch.type });
            return;
        }
        if (prev.segment == null) {
            // Первый выход на трассу (из резерва) — ЗНАЛИ бегуна раньше (был
            // в резерве, segment==null), теперь у него реальный segment.
            // Бегуна ещё нигде не было нарисовано на доске, скользить
            // неоткуда (RunnerTokenSlide на первом рендере и так не анимирует
            // позицию). ДО 2026-09-03 тут вообще не было анимации (по
            // прямому запросу пользователя, 2026-09-01) — теперь добавлен
            // отдельный gif "start" именно под этот момент (установка на
            // стартовую клетку), играем его ОДИН раз на месте (toPosition —
            // чтобы токен сразу отрисовался в правильной клетке, без слайда).
            trigger(patch.id, 'start', { toPosition });
            return;
        }
        if (patch.segment == null) return; // снят с трассы — не наш случай сейчас
        if (prev.segment === patch.segment && prev.positionX === patch.positionX && prev.positionY === patch.positionY) {
            return; // позиция не изменилась — событие не про перемещение (очки/статус и т.п.)
        }

        const neighbor = forwardNeighbors(prev).find(
            (n) => n.segment === patch.segment && n.positionX === patch.positionX && n.positionY === patch.positionY,
        );
        // Если бегуна только что подстрелили (см. RECENTLY_SHOT_TTL_MS выше),
        // это ВСЕГДА отброс, даже если он случайно приземлился на клетку,
        // которая формально является forward-соседом старой позиции —
        // эвристика расстояния тут заведомо ошибается (жалоба пользователя,
        // 2026-09-07: "вместо fly отработала move при отбросе выстрелом").
        const wasJustShot = consumeRecentlyShot(patch.id);
        if (neighbor && !wasJustShot) {
            // depthChanged/targetLaneShifted — для resolveMoveAssetDirection
            // (constants/runnerAnimations): чисто боковой шаг (глубина не
            // изменилась) на дорожку со сдвигом "назад" (чётный индекс, см.
            // BoardGrid — 2026-09-02, сдвиг переключён с нечётных дорожек на
            // чётные) визуально идёт south-*, не north-*, см. комментарий там же.
            trigger(patch.id, 'move', {
                direction: neighbor.direction,
                depthChanged: patch.positionX !== prev.positionX,
                targetLaneShifted: patch.positionY % 2 === 0,
                toPosition,
            });
        } else {
            // Отскок/телепорт (столкновение, выстрел, аномалия, ракета…).
            // Коллизионный частный случай (жалоба пользователя, 2026-09-07,
            // "скаут-vs-скаут"/"скаут наступил на danger с Мячом внутри" —
            // коллизионная поза ни разу не показалась, сразу finalное
            // состояние): если СТАРАЯ клетка ЭТОГО бегуна (та, что он сейчас
            // покидает) в prevGame уже занята ДРУГИМ бегуном — значит именно
            // ОН только что туда заехал и вытолкнул текущего. Раз оба
            // события (заезд победителя + отброс проигравшего) почти всегда
            // приходят одним и тем же тиком (React 18/19 авто-батчинг —
            // см. разбор в CLAUDE.md), сам факт "оба на одной клетке" мог бы
            // никогда не отрендериться, и BoardGrid#pushPair (коллизионная
            // поза) не успевала сработать. Фикс — НЕ телепортируем сразу:
            // сперва проигрываем синтетический шаг 'wait' (тихо стоим на
            // СТАРОЙ, уже общей клетке — getRunnerAnimationImage откатывается
            // на idle для незнакомого kind) длительностью с запасом больше
            // ANIM_DURATION_MS.move победителя — за это время он успевает
            // доиграть СВОЮ 'move'-позу и "осесть" (перестать быть isArriving
            // в BoardGrid), и тогда оба settled на одной клетке хотя бы один
            // рендер — ровно момент, когда пара покажется. Только ПОТОМ
            // реальный 'fly' уводит проигравшего в его новую клетку.
            // Не 100%-надёжная синхронизация (если у победителя была ДЛИННАЯ
            // очередь предыдущих шагов multi-hop — см. известные оговорки в
            // CLAUDE.md про очередь по runnerId), но покрывает типовой случай
            // одного хопа, который и описал пользователь.
            const occupant = prevGame?.runners?.find(
                (r) => r.id !== patch.id
                    && r.segment === prev.segment && r.positionX === prev.positionX && r.positionY === prev.positionY,
            );
            if (occupant) {
                trigger(patch.id, 'wait', {
                    toPosition: { segment: prev.segment, positionX: prev.positionX, positionY: prev.positionY },
                });
            }
            trigger(patch.id, 'fly', { toPosition });
        }
        return;
    }

    if (e.event === 'runner_damage' || e.event === 'runner_destroy') {
        const patch = e.runnerId;
        const prev = prevGame?.runners?.find((r) => r.id === patch.id);
        if (!prev || !statusWorsened(prev.status, patch.status)) return;

        if (patch.status === 'destroyed') {
            trigger(patch.id, 'destroyed', { fromStatus: prev.status });
            // Ловушка Жнеца: "по правилам игры Жнец должен убить того
            // бегуна, который закончил ход на его клетке" (прямой запрос
            // пользователя, 2026-09-03). Бэк это ЧАСТИЧНО умеет
            // (Collision::reaperCollision — но публикует ОБЫЧНОЕ generic
            // 'destroy'-событие без пометки причины, см. читанный бэкенд-код)
            // — сигнала "это была именно бомба Жнеца" бэк не даёт вообще.
            // Эвристика: если ПОСЛЕДНЯЯ ИЗВЕСТНАЯ (до уничтожения) позиция
            // погибшего бегуна совпадает с текущей позицией какого-то
            // Жнеца — считаем это ловушкой и играем Жнецу его 'bomb'
            // отдельным шагом очереди (Жнец анимирует это у СЕБЯ, жертва —
            // своим обычным 'destroyed', уже вызванным строкой выше).
            const reaperHere = prevGame.runners.find(
                (r) => r.type === RUNNER_TYPES.REAPER
                    && r.segment === prev.segment && r.positionX === prev.positionX && r.positionY === prev.positionY,
            );
            if (reaperHere) trigger(reaperHere.id, 'bomb', {});
        } else {
            trigger(patch.id, 'gotShot');
            // Метим — см. RECENTLY_SHOT_TTL_MS/consumeRecentlyShot выше:
            // следующий runner_save ЭТОГО бегуна (если он ещё придёт) должен
            // безусловно считаться отбросом (fly), не обычным шагом.
            markRecentlyShot(patch.id);
        }
        return;
    }

    if (e.event === 'ability_reaper') {
        // Первая (и единственная — бэк не даёт переставлять уже стоящего
        // Жнеца, см. CLAUDE.md) установка Жнеца на трассу. По прямому
        // запросу пользователя, 2026-09-03: Жнец не выходит из резерва как
        // обычный бегун — он "прилетает" сбоку, из-за края трассы, случайно
        // слева или справа (нет игровой логики, влияющей на сторону —
        // чистая визуальная монетка). kind остаётся 'start' (тот же общий
        // механизм отката в idle) — getRunnerAnimationImage сам подставит
        // bucket.move[side] вместо bucket.start, которого у Жнеца нет
        // (см. константы). Если игрок сразу выстрелил при размещении
        // (e.attack — направление n/ne/nw) — вторым шагом очереди играем
        // 'attack', геометрия направления считается ТАК ЖЕ, как у
        // step_shoot ниже (Жнец не двигается, целится через ту же
        // hex-клетку из СВОЕЙ свежепоставленной позиции).
        const side = Math.random() < 0.5 ? 'east' : 'west';
        const toPosition = { segment: e.reaper.segment, positionX: e.reaper.positionX, positionY: e.reaper.positionY };
        // runnerType — см. коммент у 'ball' выше, та же причина (звуковой
        // системе неоткуда иначе узнать тип в момент этого триггера).
        trigger(e.reaper.id, 'start', { side, toPosition, runnerType: RUNNER_TYPES.REAPER });

        if (e.attack) {
            const target = neighborPosition(e.reaper, e.attack);
            const depthChanged = target ? target.positionX !== e.reaper.positionX : false;
            const targetLaneShifted = target ? target.positionY % 2 === 0 : false;
            trigger(e.reaper.id, 'attack', { direction: e.attack, depthChanged, targetLaneShifted });
        }
    }
}

/**
 * Транзиентные события (без version, см. onTransient в useMercure) — уже
 * несут нужное направление напрямую в полях события, сравнивать старое/новое
 * состояние не нужно. gameRef — актуальный `game` НА МОМЕНТ события (нужен
 * только для anomaly — у неё нет activeRunner, только direction, см. ниже).
 */
export function handleTransientRunnerAnimEvent(e, gameRef, trigger) {
    switch (e.event) {
        case 'step_move':
            // pending: true — заготовка, не самостоятельный шаг очереди. Даёт
            // направление раньше, чем придёт реальная позиция, но описывает
            // ТУ ЖЕ передвижку, что последующий 'runner_save' — если его не
            // пометить, очередь (см. useRunnerAnimations) сыграла бы одно и
            // то же перемещение дважды подряд (двойная длительность на самый
            // частый случай — обычный шаг без каскада).
            trigger(e.activeRunner, 'move', { direction: e.direction ?? 'UP', pending: true }); // без direction — первый выход на трассу
            return;
        case 'step_shoot': {
            if (!e.accept) return;
            // Тот же geometry-нюанс, что и у ходьбы (см. runner_save выше и
            // constants/runnerAnimations#resolveMoveAssetDirection) — целится
            // в клетку через ТУ ЖЕ hex-геометрию (canShoot() на бэке проверяет
            // ровно тех же соседей, что и движение), значит клетка-цель может
            // ТАК ЖЕ визуально лежать south-* (если бегун стоит на дорожке,
            // соседняя с которой "смещена вперёд" — цель диагонали в таком
            // случае лежит south, не north), а не только north-* — жалоба
            // пользователя, 2026-09-01, четвёртый заход: "стрельба...
            // неправильная (у солдата по крайней мере), вместо north-west/east
            // должно быть south-west/east". Раньше (до этого захода) 'attack'
            // сознательно НЕ получал такую поправку — ошибочно, стрельба стоя
            // на месте всё равно целится через ту же гекс-клетку, что и шаг.
            const direction = e.direction ?? 'UP';
            const game = gameRef.current;
            const shooter = game?.runners?.find((r) => r.id === e.activeRunner);
            let depthChanged = false;
            let targetLaneShifted = false;
            if (shooter?.segment != null) {
                const target = neighborPosition(shooter, direction);
                if (target) {
                    depthChanged = target.positionX !== shooter.positionX;
                    targetLaneShifted = target.positionY % 2 === 0;
                }
            }
            trigger(e.activeRunner, 'attack', { direction, depthChanged, targetLaneShifted });
            return;
        }
        case 'anomaly': {
            // Аномалию всегда переживает бегун, который СЕЙЧАС двигается —
            // событие направление несёт, а id бегуна — нет, достаём из
            // activeRunner текущего игрока по ходу (game.playerOrder).
            // pending: true — та же заготовка-мерж, что у step_move (см.
            // useRunnerAnimations/trigger): следующий runner_save (реальный
            // отлёт из аномалии) допишет сюда toPosition НА МЕСТЕ вместо
            // отдельного шага очереди, и, что важно именно тут (по прямому
            // запросу пользователя, 2026-09-01), kind ОСТАНЕТСЯ 'fly' —
            // мерж специально не даёт эвристике forwardNeighbors в
            // handleVersionedRunnerAnimEvent переопределить его на 'move',
            // даже если отлёт случайно приземлится на соседнюю клетку.
            const game = gameRef.current;
            const mover = game?.gamePlayers?.find((p) => String(p.id) === String(game.playerOrder));
            if (mover?.activeRunner != null) trigger(mover.activeRunner, 'fly', { pending: true });
            return;
        }
        default:
            return;
    }
}
