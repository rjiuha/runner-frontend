// src/api/runnerGame.js
import { request } from './client';
import { normalizeRunnerGame } from './normalize';

/**
 * Зеркало RunnerGameController. GET не принимает id — бек сам находит
 * активную партию текущего пользователя (аналогично lobbyApi.mine()).
 * select/move/collision/shoot/ability пока не вызываются с экрана (Фаза 2
 * фронта, см. план в CLAUDE.md) — тела запросов 1-в-1 из README бэка.
 */
export const runnerGameApi = {
    get: async () => normalizeRunnerGame(await request('/runner_game')),

    start: () => request('/runner_game/start', { method: 'POST' }),

    select: (runnerId, dice, type) =>
        request('/runner_game/select', { method: 'POST', body: { runnerId, dice, type } }),

    move: (firstPosition, direction) =>
        request('/runner_game/move', { method: 'POST', body: { firstPosition, direction } }),

    // Шаг ROAD_BONUS: предлагается, только если бегун ни разу не сходил с дороги
    // за весь ход (см. PLAYER_STEP.ROAD_BONUS) — accept выдаёт бегуну
    // game.trackGain доп. очков перемещения и возвращает в шаг MOVE.
    roadBonus: (accept) =>
        request('/runner_game/road_bonus', { method: 'POST', body: { accept } }),

    collision: (accept) =>
        request('/runner_game/collision', { method: 'POST', body: { accept } }),

    shoot: (accept, direction) =>
        request('/runner_game/shoot', { method: 'POST', body: { accept, direction } }),

    // details: null (не undefined!) — при accept:false бэк падает 500-й, если
    // ключ "details" вообще отсутствует в теле запроса (нетипизированное
    // свойство DTO остаётся неинициализированным — см. CLAUDE.md). JSON.stringify
    // выкидывает undefined-поля из тела, поэтому дефолт именно null.
    ability: (accept, details = null) =>
        request('/runner_game/ability', { method: 'POST', body: { accept, details } }),
};
