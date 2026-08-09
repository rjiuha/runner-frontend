// src/api/ApiError.js

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

    /** Текст для пользователя */
    get userMessage() {
        if (this.isNetwork) return 'Нет связи с сервером. Проверь подключение.';
        if (this.status >= 500) return 'Сервер недоступен. Попробуй позже.';
        return this.message || 'Что-то пошло не так';
    }
}