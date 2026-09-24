// src/api/normalize.js

/**
 * Приводит ответ бека к единой форме, на которую опирается весь UI.
 * Смысл: если завтра бек переименует поле, правка будет здесь, в одном месте,
 * а не в пяти экранах.
 */
export function normalizeLobby(raw) {
    if (!raw) return null;

    return {
        id: raw.id,
        version: raw.version ?? 0,
        status: raw.status,                                   // 'waiting' | 'starting'
        maxPlayers: raw.maxPlayers ?? raw.maxPlayers ?? 0, // ← сглаживаем расхождение
        // host может прийти строкой (старый формат) или объектом {id, username}
        host: typeof raw.host === 'string'
            ? { id: null, username: raw.host }
            : raw.host ?? null,
        players: (raw.players ?? []).map(normalizePlayer),
        mercure: raw.mercure ?? null,                          // { topic, token, expiresAt }
    };
}

export function normalizePlayer(raw) {
    return {
        id: raw.id,                 // user.id — по нему сопоставляем события
        username: raw.username,
        isReady: raw.status === 'ready',
        joinedAt: raw.joinedAt,
    };
}

export function normalizeLobbyList(raw) {
    return {
        items: (raw?.lobbies ?? []).map(normalizeLobby),
        count: raw?.count ?? 0,
        limit: raw?.limit ?? 0,
    };
}

/**
 * RunnerGame::toArray() отдаёт форму, уже совпадающую с тем, что читают
 * компоненты доски (см. constants/mockGameData.js) — лишней перекладки полей
 * не нужно. version защищаем дефолтом на случай, если бек когда-нибудь снова
 * перестанет её отдавать (как было с Lobby).
 */
export function normalizeRunnerGame(raw) {
    if (!raw) return null;

    return {
        ...raw,
        version: raw.version ?? 0,
        // Защитная коррекция бэкового бага (коммит 59aea0f, 2026-09-24) —
        // RunnerPlayerViewModel::$step объявлен ?string вместо ?int (PlayerStep
        // на бэке честный int-backed enum), PHP молча приводит число в строку
        // при присваивании. Только GET /api/runner_game (эта ViewModel) —
        // живые Mercure-события (player_step/step_selection/step_begin) шлют
        // 'step' => $player->getStep() напрямую, без ViewModel, там тип верный
        // (сверено чтением всех трёх файлов, не по памяти). Без коррекции
        // ЛЮБОЕ строгое сравнение myStep === PLAYER_STEP.XXX по всему фронту
        // молча никогда не совпадает после REST-снапшота/reconnect — "Твой
        // ход" показывается (playerOrder сравнивается через String()), а
        // подсказки/драг кубиков — нет (жалоба пользователя, 2026-09-24).
        gamePlayers: (raw.gamePlayers ?? []).map((p) => ({
            ...p,
            step: p.step == null ? p.step : Number(p.step),
        })),
        runners: raw.runners ?? [],
    };
}