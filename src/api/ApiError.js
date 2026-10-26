// src/api/ApiError.js
import { t } from '../lib/i18n';

/**
 * Единый тип ошибки для всего приложения.
 * Экранам не нужно знать про HTTP-статусы — они спрашивают у ошибки
 * «ты про сеть?», «лобби исчезло?» и показывают понятный текст.
 */
export class ApiError extends Error {
    constructor(status, code, message, payload) {
        super(message);
        this.name = 'ApiError';
        this.status = status;   // 0 = сеть/таймаут
        this.code = code;       // машинный код с бека
        this.payload = payload; // сырое тело ответа
    }

    get isNetwork() {
        return this.status === 0;
    }

    get isUnauthorized() {
        return this.status === 401;
    }

    /** Лобби/игра больше не существует — не ошибка, а сигнал уйти в меню */
    get isGone() {
        return this.status === 404;
    }

    /**
     * gameId активной партии пользователя — только для ошибки
     * ACTIVE_GAME_EXISTS (`POST /api/lobby`/`POST /api/lobby/{id}/join`,
     * когда у игрока уже есть незавершённая партия, см.
     * `LobbyException::activeGameExists()` на бэке, read-only). `null` для
     * любой другой ошибки — экранам не нужно самим лезть в сырой
     * `payload.error.details`, 2026-10-15, по прямому запросу пользователя
     * (редирект вместо тоста на создании/входе в лобби).
     */
    get activeGameId() {
        if (this.code !== 'ACTIVE_GAME_EXISTS') return null;
        return this.payload?.error?.details?.gameId ?? null;
    }

    /**
     * Текст для пользователя — читает ТЕКУЩУЮ локаль напрямую (lib/i18n.js#t,
     * не хук useI18n — этот класс не React-компонент, а ошибка создаётся
     * вне рендера на каждый неудачный запрос, реактивность на смену языка
     * тут не нужна, важно лишь прочитать актуальный язык в момент показа).
     */
    get userMessage() {
        if (this.isNetwork) return t('common.networkError');
        if (this.status >= 500) return t('common.serverError');
        return this.message || t('common.genericError');
    }
}