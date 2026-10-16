// src/api/client.js
import { API_URL, REQUEST_TIMEOUT } from '../config/env';
import { secureStorage, TOKEN_KEYS } from '../lib/secureStorage';
import { ApiError } from './ApiError';
import { createLogger } from '../lib/logger';

const log = createLogger('API');

// Поля, которые никогда не логируем целиком (пароли/токены) — по прямому
// запросу пользователя логировать "каждый вызов", но это не повод писать
// пароль открытым текстом в терминал/logcat.
const REDACT_KEYS = new Set(['password', 'confirm', 'refresh_token']);
function redactBody(body) {
    if (!body || typeof body !== 'object') return body;
    const copy = {};
    for (const [k, v] of Object.entries(body)) copy[k] = REDACT_KEYS.has(k) ? '***' : v;
    return copy;
}

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
    accessToken = await secureStorage.get(TOKEN_KEYS.access);
    refreshToken = await secureStorage.get(TOKEN_KEYS.refresh);
    return { accessToken, refreshToken };
}

export async function setTokens({ token, refresh_token }) {
    accessToken = token;
    refreshToken = refresh_token;
    await secureStorage.set(TOKEN_KEYS.access, token);
    if (refresh_token) await secureStorage.set(TOKEN_KEYS.refresh, refresh_token);
}

export async function clearTokens() {
    accessToken = null;
    refreshToken = null;
    refreshPromise = null;
    await secureStorage.multiRemove([TOKEN_KEYS.access, TOKEN_KEYS.refresh]);
}

export function getAccessToken() {
    return accessToken;
}

/** См. api/auth.js#logout — нужен, чтобы отправить ЕГО на сервер при выходе. */
export function getRefreshToken() {
    return refreshToken;
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

    log('token/refresh: старт (общий на все конкурентные 401)');
    refreshPromise = (async () => {
        if (!refreshToken) {
            log('token/refresh: НЕТ refresh_token');
            // 2026-10-16: симметрично ветке REFRESH_FAILED ниже — на практике
            // недостижимо напрямую (request() зовёт doRefresh только когда
            // refreshToken уже truthy), но если когда-нибудь станет достижимо
            // (другой вызывающий код), состояние должно чиститься так же.
            await clearTokens();
            onAuthLost?.();
            throw new ApiError(401, 'NO_REFRESH', 'Нужен вход');
        }

        const { response, body } = await rawFetch('/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
            log(`token/refresh: ПРОВАЛ (${response.status}) — разлогиниваем`);
            await clearTokens();
            onAuthLost?.();
            throw new ApiError(401, 'REFRESH_FAILED', 'Сессия истекла, войди снова');
        }

        log('token/refresh: OK, новый access-токен получен');
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
    const startedAt = Date.now();
    log(`-> ${method} ${path}`, body !== undefined ? redactBody(body) : '');

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

    try {
        let { response, body: data } = await send(auth ? accessToken : null);

        // Ровно ОДНА повторная попытка после рефреша.
        // Если и со свежим токеном 401 — дело не в сроке жизни, крутить бессмысленно.
        if (response.status === 401 && auth && refreshToken) {
            log(`   ${method} ${path}: 401, пробуем рефреш и один повтор`);
            const fresh = await doRefresh();
            ({ response, body: data } = await send(fresh));
        }

        if (!response.ok) {
            if (response.status === 401) {
                await clearTokens();
                onAuthLost?.();
            }
            // 2026-10-14: бэк перешёл на единый конверт ApiExceptionSubscriber —
            // {"error":{"code","message","status","details"?}}, не голую строку
            // {"error":"..."} как раньше. data?.error теперь объект почти везде
            // под /api (RunnerGame/Lobby/auth-ошибки) — старый data?.error как
            // текст больше не приходит, фолбэки оставлены только на случай
            // ответа, не прошедшего через конверт (например самого Symfony).
            const errorEnvelope = data?.error;
            const err = new ApiError(
                response.status,
                (typeof errorEnvelope === 'object' ? errorEnvelope?.code : null) ?? null,
                (typeof errorEnvelope === 'object' ? errorEnvelope?.message : errorEnvelope)
                    ?? data?.message ?? data?.detail ?? `Ошибка ${response.status}`,
                data,
            );
            log(`<- ${method} ${path} ${response.status} FAIL (${Date.now() - startedAt}мс):`, err.userMessage);
            throw err;
        }

        log(`<- ${method} ${path} ${response.status} OK (${Date.now() - startedAt}мс)`);
        return data;
    } catch (e) {
        if (!(e instanceof ApiError)) {
            // Сетевая/таймаут-ошибка — rawFetch уже завернул её в ApiError(0, ...),
            // так что сюда попадают только по-настоящему неожиданные throw.
            log(`<- ${method} ${path} EXCEPTION (${Date.now() - startedAt}мс):`, e?.message ?? e);
        } else if (e.status === 0) {
            log(`<- ${method} ${path} ${e.code} (${Date.now() - startedAt}мс):`, e.userMessage);
        }
        throw e;
    }
}