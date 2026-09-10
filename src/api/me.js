// src/api/me.js
import { request } from './client';

export const meApi = {
    /**
     * GET /api/me — профиль + компактная сводка "где сейчас пользователь"
     * (см. AuthController::me() на бэке, read-only): `lobby`/`game` — либо
     * null, либо { id, status }. Это НЕ полный payload лобби/партии (без
     * players/track/т.п.) — если нужны полные данные, всё равно требуется
     * follow-up lobbyApi.byId()/runnerGameApi.get(), этот вызов только для
     * определения, КУДА направить пользователя сразу после авторизации.
     */
    get: () => request('/me'),
};
