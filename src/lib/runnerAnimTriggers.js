// src/lib/runnerAnimTriggers.js
import { statusWorsened } from '../constants/runnerAnimations';
import { forwardNeighbors, neighborPosition } from './hexDirection';

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
 *     depthChanged/targetLaneOdd, нужны constants/runnerAnimations
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

        if (!prev || prev.segment == null) {
            // Первый выход на трассу (из резерва) — бегуна ещё НИГДЕ не было
            // нарисовано, скользить неоткуда. По прямому запросу пользователя,
            // 2026-09-01, никакой анимации ходьбы тут не проигрываем — он
            // просто появляется в клетке сразу в позе idle (RunnerTokenSlide
            // на первом рендере и так не анимирует, см. компонент — trigger()
            // тут был бы для чистой "ходьбы стоя на месте", лишний).
            return;
        }
        if (patch.segment == null) return; // снят с трассы — не наш случай сейчас
        if (prev.segment === patch.segment && prev.positionX === patch.positionX && prev.positionY === patch.positionY) {
            return; // позиция не изменилась — событие не про перемещение (очки/статус и т.п.)
        }

        const neighbor = forwardNeighbors(prev).find(
            (n) => n.segment === patch.segment && n.positionX === patch.positionX && n.positionY === patch.positionY,
        );
        if (neighbor) {
            // depthChanged/targetLaneOdd — для resolveMoveAssetDirection
            // (constants/runnerAnimations): чисто боковой шаг (глубина не
            // изменилась) на дорожку со сдвигом "назад" (нечётный индекс)
            // визуально идёт south-*, не north-*, см. комментарий там же.
            trigger(patch.id, 'move', {
                direction: neighbor.direction,
                depthChanged: patch.positionX !== prev.positionX,
                targetLaneOdd: patch.positionY % 2 !== 0,
                toPosition,
            });
        } else {
            trigger(patch.id, 'fly', { toPosition });
        }
        return;
    }

    if (e.event === 'runner_damage' || e.event === 'runner_destroy') {
        const patch = e.runnerId;
        const prev = prevGame?.runners?.find((r) => r.id === patch.id);
        if (!prev || !statusWorsened(prev.status, patch.status)) return;

        if (patch.status === 'destroyed') trigger(patch.id, 'destroyed', { fromStatus: prev.status });
        else trigger(patch.id, 'gotShot');
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
            let targetLaneOdd = false;
            if (shooter?.segment != null) {
                const target = neighborPosition(shooter, direction);
                if (target) {
                    depthChanged = target.positionX !== shooter.positionX;
                    targetLaneOdd = target.positionY % 2 !== 0;
                }
            }
            trigger(e.activeRunner, 'attack', { direction, depthChanged, targetLaneOdd });
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
