// src/api/lobby.js
import { request } from './client';
import { normalizeLobby, normalizeLobbyList } from './normalize';

/**
 * Зеркало LobbyController. Каждый метод сразу нормализует ответ,
 * поэтому экраны работают с одной стабильной формой данных
 * и не знают про maxLobbyPlayers / host-строкой / прочие особенности бека.
 */
export const lobbyApi = {
    create: async (maxPlayers) =>
        normalizeLobby(await request('/lobby', { method: 'POST', body: { maxPlayers } })),

    join: async (id) => normalizeLobby(await request(`/lobby/${id}/join`, { method: 'POST' })),

    leave: () => request('/lobby/leave', { method: 'POST' }),

    /** GET /api/lobby — моё текущее лобби. null, если я ни в одном */
    mine: async () => {
        const raw = await request('/lobby');
        return raw ? normalizeLobby(raw) : null;
    },

    byId: async (id) => normalizeLobby(await request(`/lobby/${id}`)),

    ready: () => request('/lobby/ready', { method: 'POST' }),
    unready: () => request('/lobby/unready', { method: 'POST' }),
    send: (message) => request('/lobby/send', { method: 'POST', body: { message } }),

    search: async ({ maxPlayers, limit = 20, offset = 0 } = {}) => {
        const q = new URLSearchParams();
        if (maxPlayers != null) q.set('maxPlayers', String(maxPlayers));
        q.set('limit', String(limit));
        q.set('offset', String(offset));
        return normalizeLobbyList(await request(`/lobbies?${q.toString()}`));
    },
};