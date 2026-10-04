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

    // POST /runner_game/start удалён на бэке 2026-09-18 (коммит "remove
    // api/runner_game/start") — партия теперь активируется ЦЕЛИКОМ на бэке
    // синхронно с её созданием (GameFactory::create() сам вызывает
    // RunnerGameFactory::start()), никакого отдельного "готов" от клиента
    // не требуется. К моменту, когда фронт впервые видит игру (по
    // lobby.gameId → GET /api/runner_game), она уже status:'active' с
    // розданными кубиками 1-го раунда — см. GameBoardScreen.js.

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

    // details: null (не undefined!) — ИСПРАВЛЕНО на бэке 2026-09-30
    // (AbilityDto::$details получил дефолт = null), раньше без ключа "details"
    // в теле бэк падал 500-й. Дефолт тут оставлен как дешёвая подстраховка —
    // JSON.stringify всё равно выкидывает undefined-поля из тела, так что
    // явный null ничего не усложняет.
    ability: (accept, details = null) =>
        request('/runner_game/ability', { method: 'POST', body: { accept, details } }),

    // Сдаться — без тела (см. README бэка). Следом бэк шлёт player_surrender
    // → runner_destroy (reason:'surrender') по каждому бегуну → player_out;
    // если это был последний активный игрок — следом game_finish (уже
    // обрабатывается runnerGameReducer/GameFinishModal, см. GameBoardScreen).
    surrender: () => request('/runner_game/surrender', { method: 'POST' }),
};
