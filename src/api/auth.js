// src/api/auth.js
import { request, setTokens } from './client';

export const authApi = {
    /** POST /api/login → сохраняет токены и возвращает их */
    async login(email, password) {
        const tokens = await request('/login', {
            method: 'POST',
            auth: false,
            body: { email: email.trim(), password },
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
};