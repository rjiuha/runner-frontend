// src/store/lobbyReducer.js

/** Чистая функция: состояние + событие → новое состояние. Без сети, легко тестируется. */
export function lobbyReducer(lobby, e) {
    switch (e.event) {
        case 'player_joined':
            if (lobby.players.some((p) => p.id === e.player.id)) return lobby;
            return {
                ...lobby,
                players: [...lobby.players, {
                    id: e.player.id,
                    username: e.player.username,
                    isReady: e.player.status === 'ready',
                    joinedAt: e.player.joinedAt,
                }],
            };

        case 'player_left':
            return {
                ...lobby,
                players: lobby.players.filter((p) => p.id !== e.playerId),
                host: e.newHost ?? lobby.host,
            };

        case 'player_ready':
            return {
                ...lobby,
                players: lobby.players.map((p) =>
                    p.id === e.playerId ? { ...p, isReady: e.status === 'ready' } : p,
                ),
            };

        case 'game_created':
            return { ...lobby, gameId: e.gameId };

        default:
            return lobby;
    }
}