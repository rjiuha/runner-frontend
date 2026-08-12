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
        gamePlayers: raw.gamePlayers ?? [],
        runners: raw.runners ?? [],
    };
}