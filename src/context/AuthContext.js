// src/context/AuthContext.js
import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

import { authApi } from '../api/auth';
import { clearTokens, loadTokens, setOnAuthLost, getAccessToken } from '../api/client';
import { userFromToken } from '../lib/jwt';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [isLoading, setIsLoading] = useState(true); // читаем хранилище при старте
    const [user, setUser] = useState(null);           // null = не авторизован

    // Восстановление сессии
    useEffect(() => {
        let cancelled = false;

        // Клиент сообщит, если рефреш провалился — тогда выкидываем на логин
        setOnAuthLost(() => setUser(null));

        loadTokens()
            .then(({ accessToken }) => {
                if (cancelled) return;
                setUser(accessToken ? userFromToken(accessToken) : null);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    const signIn = useCallback(async (email, password) => {
        const { token } = await authApi.login(email, password);
        setUser(userFromToken(token));
    }, []);

    const signUp = useCallback(async (email, password, username) => {
        await authApi.register(email, password, username);
        // Регистрация не выдаёт токенов, поэтому сразу логинимся:
        // пользователю не нужно вводить те же данные второй раз
        await authApi.login(email, password);
        setUser(userFromToken(getAccessToken()));
    }, []);

    const signOut = useCallback(async () => {
        await clearTokens();
        setUser(null);
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