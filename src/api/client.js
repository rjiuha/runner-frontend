// src/api/client.js
import { API_URL, REQUEST_TIMEOUT } from '../config/env';
import { storage, KEYS } from '../lib/storage';
import { ApiError } from './ApiError';

/**
 * Токены держим в памяти модуля: обращений к ним много (каждый запрос),
 * а AsyncStorage — асинхронный и медленный. Хранилище — только для перезапуска.
 */
let accessToken = null;
let refreshToken = null;

/**
 * Одновременно может «протухнуть» несколько запросов.
 * Если каждый пойдёт рефрешить — refresh_token ротируется, и все, кроме первого,
 * получат 401 и выкинут пользователя. Поэтому держим ОДИН общий промис.
 */
let refreshPromise = null;

/** Колбэк регистрирует AuthContext. Через сеттер — чтобы не было циклического импорта. */
let onAuthLost = null;
export function setOnAuthLost(cb) {
    onAuthLost = cb;
}

export async function loadTokens() {
    accessToken = await storage.get(KEYS.access);
    refreshToken = await storage.get(KEYS.refresh);
    return { accessToken, refreshToken };
}

export async function setTokens({ token, refresh_token }) {
    accessToken = token;
    refreshToken = refresh_token;
    await storage.set(KEYS.access, token);
    if (refresh_token) await storage.set(KEYS.refresh, refresh_token);
}

export async function clearTokens() {
    accessToken = null;
    refreshToken = null;
    refreshPromise = null;
    await storage.multiRemove([KEYS.access, KEYS.refresh]);
}

export function getAccessToken() {
    return accessToken;
}

async function parseBody(response) {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text; // бек мог вернуть HTML-страницу ошибки — не падаем
    }
}

async function rawFetch(path, init, timeoutMs = REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${API_URL}${path}`, {
            ...init,
            signal: controller.signal,
        });
        return { response, body: await parseBody(response) };
    } catch (e) {
        if (e?.name === 'AbortError') {
            throw new ApiError(0, 'TIMEOUT', 'Сервер не ответил вовремя');
        }
        throw new ApiError(0, 'NETWORK', 'Нет соединения с сервером');
    } finally {
        clearTimeout(timer);
    }
}

function doRefresh() {
    if (refreshPromise) return refreshPromise; // уже рефрешим — присоединяйся

    refreshPromise = (async () => {
        if (!refreshToken) {
            throw new ApiError(401, 'NO_REFRESH', 'Нужен вход');
        }

        const { response, body } = await rawFetch('/token/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
            await clearTokens();
            onAuthLost?.();
            throw new ApiError(401, 'REFRESH_FAILED', 'Сессия истекла, войди снова');
        }

        await setTokens(body);
        return body.token;
    })();

    // Замок снимаем ВСЕГДА, даже если рефреш упал.
    // Иначе один сбой сети навсегда заблокирует рефреш до перезапуска приложения.
    refreshPromise
        .catch(() => {})
        .finally(() => {
            refreshPromise = null;
        });

    return refreshPromise;
}

/**
 * @param {string} path      путь после /api, например '/lobby/12/join'
 * @param {object} [options] { method, body, auth, timeoutMs }
 */
export async function request(path, options = {}) {
    const { method = 'GET', body, auth = true, timeoutMs } = options;

    const send = (token) => {
        const headers = { Accept: 'application/json' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (token) headers.Authorization = `Bearer ${token}`;

        return rawFetch(
            path,
            {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                // нужно, чтобы бек мог поставить cookie для Mercure (актуально на вебе)
                credentials: 'include',
            },
            timeoutMs,
        );
    };

    let { response, body: data } = await send(auth ? accessToken : null);

    // Ровно ОДНА повторная попытка после рефреша.
    // Если и со свежим токеном 401 — дело не в сроке жизни, крутить бессмысленно.
    if (response.status === 401 && auth && refreshToken) {
        const fresh = await doRefresh();
        ({ response, body: data } = await send(fresh));
    }

    if (!response.ok) {
        if (response.status === 401) {
            await clearTokens();
            onAuthLost?.();
        }
        throw new ApiError(
            response.status,
            data?.code ?? data?.error ?? null,
            data?.message ?? data?.detail ?? `Ошибка ${response.status}`,
            data,
        );
    }

    return data;
}