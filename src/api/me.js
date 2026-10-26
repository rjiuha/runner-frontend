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
     * С 2026-10-22 также отдаёт `emailVerified` (bool) — см. ProfileModal.
     */
    get: () => request('/me'),

    /** POST /api/email/verification — повторная отправка кода (не чаще раза в 60с) */
    sendVerificationCode: () => request('/email/verification', { method: 'POST' }),

    /** POST /api/email/verify — код из письма, 6 цифр */
    verifyEmail: (code) => request('/email/verify', { method: 'POST', body: { code: code.trim() } }),

    /**
     * DELETE /api/me — удаление аккаунта текущим паролем. Бэк сам сдаёт
     * активную партию/выходит из лобби, обезличивает пользователя и
     * отзывает refresh-токены — локально всё равно нужно почистить токены
     * (см. AuthContext#deleteAccount), сервер только чистит cookie Mercure.
     */
    deleteAccount: (password) => request('/me', { method: 'DELETE', body: { password } }),
};
