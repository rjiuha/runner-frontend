// src/api/auth.js
import { request, setTokens, clearTokens, getRefreshToken } from './client';

export const authApi = {
    /**
     * POST /api/login → сохраняет токены и возвращает их. `login` — email
     * ИЛИ ник (бэк сам отличает по наличию «@», см. README/UserRepository
     * на бэке, read-only, 2026-10-22) — поле раньше называлось `email` в
     * теле запроса, бэк сменил ключ на `login` тем же коммитом, что добавил
     * вход по нику.
     */
    async login(login, password) {
        const tokens = await request('/login', {
            method: 'POST',
            auth: false,
            body: { login: login.trim(), password },
        });
        await setTokens(tokens);
        return tokens;
    },

    /** POST /api/register — токены НЕ возвращает, логин делаем отдельно */
    register(email, password, username) {
        return request('/register', {
            method: 'POST',
            auth: false,
            body: { email: email.trim(), password, username: username.trim() },
        });
    },

    /**
     * POST /api/logout — отзывает refresh-токен на сервере. 2026-09-26,
     * найдено аудитом "какие методы бэка фронт не вызывает" — раньше
     * signOut() (context/AuthContext.js) делал ТОЛЬКО clearTokens(), сервер
     * вообще не уведомлялся, refresh-токен оставался действительным на бэке
     * сколько угодно после "выхода" с этого устройства. Серверный вызов —
     * best-effort: сеть недоступна/токен уже невалиден не должны запирать
     * пользователя внутри аккаунта — локальный выход происходит в любом
     * случае, ошибка сервера тут просто проглатывается.
     */
    async logout() {
        const refresh_token = getRefreshToken();
        if (refresh_token) {
            try {
                await request('/logout', { method: 'POST', body: { refresh_token } });
            } catch {
                // недоступный бэк/уже невалидный токен — не блокируем локальный выход
            }
        }
        await clearTokens();
    },

    /**
     * POST /api/password/forgot — всегда отвечает {"result":"ok"}, даже если
     * такого логина нет/email не подтверждён (бэк не раскрывает, кто
     * зарегистрирован, см. README). `login` — email или ник, как в login().
     */
    forgotPassword(login) {
        return request('/password/forgot', {
            method: 'POST',
            auth: false,
            body: { login: login.trim() },
        });
    },

    /**
     * POST /api/password/reset — код из письма (6 цифр) + новый пароль.
     * Отзывает все refresh-токены на бэке; уже выданные access-токены
     * доживают свой срок (до часа) — локально выходить из сессии не нужно.
     */
    resetPassword(login, code, password) {
        return request('/password/reset', {
            method: 'POST',
            auth: false,
            body: { login: login.trim(), code: code.trim(), password },
        });
    },
};