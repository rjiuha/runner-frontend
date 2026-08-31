// src/lib/runnerAnimTriggers.js
import { statusWorsened } from '../constants/runnerAnimations';
import { forwardNeighbors } from './hexDirection';

/**
 * Смотрит на versioned-событие ДО того, как его применит runnerGameReducer
 * (нужно старое состояние бегуна для сравнения), и решает, нужно ли завести
 * транзиентную анимацию (move/fly/gotShot/destroyed). Чистая функция —
 * единственный побочный эффект через переданный trigger(runnerId, kind, extra)
 * (см. hooks/useRunnerAnimations), сам стейт не трогает.
 *
 * 'runner_save' → сравниваем старую и новую позицию бегуна:
 *   - не изменилась → ничего (событие не про перемещение).
 *   - новая клетка — один из 3 forwardNeighbors старой → обычный шаг вперёд
 *     (move, с РЕАЛЬНЫМ направлением этого шага — важно и для самого первого
 *     step_move, и для КАЖДОГО последующего "схлопнутого" шага multi-hop
 *     движения, см. CLAUDE.md про то, что один /move может дать несколько
 *     Action::TYPE_MOVE подряд — у каждого своя пара старая/новая позиция,
 *     каждая тут своя forwardNeighbors-проверка).
 *   - иначе (не сосед) → отскок/телепорт (столкновение, аномалия, ракета и
 *     т.п.) — бэк НЕ шлёт отдельного сигнала "это был knockback" (см.
 *     обсуждение в CLAUDE.md), это осознанно принятая эвристика по
 *     расстоянию, а не точный сигнал.
 *
 * 'runner_damage'/'runner_destroy' → сравниваем статус: стало ХУЖЕ (не
 * лечение) → gotShot, а если конечный статус — destroyed → сразу terminal
 * 'destroyed' (с fromStatus = статус ДО удара, для выбора healthy/damaged
 * набора анимации, см. constants/runnerAnimations#getRunnerAnimationImage).
 */
export function handleVersionedRunnerAnimEvent(prevGame, e, trigger) {
    if (e.event === 'runner_save') {
        const patch = e.runnerId;
        const prev = prevGame?.runners?.find((r) => r.id === patch.id);

        if (!prev || prev.segment == null) {
            if (patch.segment != null) trigger(patch.id, 'move', { direction: 'UP' }); // первый выход на трассу
            return;
        }
        if (patch.segment == null) return; // снят с трассы — не наш случай сейчас
        if (prev.segment === patch.segment && prev.positionX === patch.positionX && prev.positionY === patch.positionY) {
            return; // позиция не изменилась — событие не про перемещение (очки/статус и т.п.)
        }

        const neighbor = forwardNeighbors(prev).find(
            (n) => n.segment === patch.segment && n.positionX === patch.positionX && n.positionY === patch.positionY,
        );
        trigger(patch.id, neighbor ? 'move' : 'fly', neighbor ? { direction: neighbor.direction } : undefined);
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
            trigger(e.activeRunner, 'move', { direction: e.direction ?? 'UP' }); // без direction — первый выход на трассу
            return;
        case 'step_shoot':
            if (e.accept) trigger(e.activeRunner, 'attack', { direction: e.direction });
            return;
        case 'anomaly': {
            // Аномалию всегда переживает бегун, который СЕЙЧАС двигается —
            // событие направление несёт, а id бегуна — нет, достаём из
            // activeRunner текущего игрока по ходу (game.playerOrder).
            const game = gameRef.current;
            const mover = game?.gamePlayers?.find((p) => String(p.id) === String(game.playerOrder));
            if (mover?.activeRunner != null) trigger(mover.activeRunner, 'fly');
            return;
        }
        default:
            return;
    }
}
