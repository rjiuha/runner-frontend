// src/context/AuthContext.js
import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

import { authApi } from '../api/auth';
import { clearTokens, loadTokens, setOnAuthLost, getAccessToken } from '../api/client';
import { userFromToken } from '../lib/jwt';
import { createLogger, setLoggerUser } from '../lib/logger';

const AuthContext = createContext(null);
const log = createLogger('AUTH');

// Единственное место, где меняется React-состояние `user` — заодно всегда
// синхронизируем логгеру, ЧЕЙ сейчас клиент (см. lib/logger.js), и логируем
// сам факт смены (2026-09-14, по прямому запросу пользователя — "хочу видеть
// всё в терминале").
function applyUser(setUser, user, reason) {
    setLoggerUser(user?.username ?? null);
    log(reason, user ? `id=${user.id} username=${user.username}` : '(вышел/не авторизован)');
    setUser(user);
}

export function AuthProvider({ children }) {
    const [isLoading, setIsLoading] = useState(true); // читаем хранилище при старте
    const [user, setUser] = useState(null);           // null = не авторизован

    // Восстановление сессии
    useEffect(() => {
        let cancelled = false;

        // Клиент сообщит, если рефреш провалился — тогда выкидываем на логин
        setOnAuthLost(() => applyUser(setUser, null, 'auth-lost (рефреш токена не удался)'));

        loadTokens()
            .then(({ accessToken }) => {
                if (cancelled) return;
                applyUser(setUser, accessToken ? userFromToken(accessToken) : null, 'restore-session');
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    const signIn = useCallback(async (email, password) => {
        const { token } = await authApi.login(email, password);
        applyUser(setUser, userFromToken(token), 'sign-in');
    }, []);

    const signUp = useCallback(async (email, password, username) => {
        await authApi.register(email, password, username);
        // Регистрация не выдаёт токенов, поэтому сразу логинимся:
        // пользователю не нужно вводить те же данные второй раз
        await authApi.login(email, password);
        applyUser(setUser, userFromToken(getAccessToken()), 'sign-up');
    }, []);

    const signOut = useCallback(async () => {
        await clearTokens();
        applyUser(setUser, null, 'sign-out');
    }, []);

    const value = useMemo(
        () => ({ isLoading, user, isAuthenticated: user !== null, signIn, signUp, signOut }),
        [isLoading, user, signIn, signUp, signOut],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth вызван вне <AuthProvider>');
    return ctx;
}