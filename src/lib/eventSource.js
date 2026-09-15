// src/lib/eventSource.js
import { Platform } from 'react-native';
import { createLogger } from './logger';

const log = createLogger('SSE');

const CRLF = '\r\n';
const LF = '\n';
const CR = '\r';

/**
 * Собственный, минимальный транспорт SSE — заменяет браузерный
 * `EventSource` (веб) и `react-native-sse` (Android), 2026-09-15, по
 * прямому запросу пользователя.
 *
 * ПРИЧИНА: обе штатные реализации разбирают протокол SSE сами и отдают
 * наружу ТОЛЬКО настоящие события (`data: ...`) — строки-комментарии
 * (`: ...`), которыми Mercure-хаб теперь шлёт периодический heartbeat
 * (`heartbeat 15s` в MERCURE_EXTRA_DIRECTIVES бэка, добавлено в этой же
 * сессии), они молча съедают, JS-код их вообще не видит. Живой инцидент
 * (см. CLAUDE.md, разбор через adb logcat + docker logs 2026-09-15):
 * SSE-соединение на Android тихо умерло (TCP/сокет закрылся без единого
 * `error`-события — известная особенность именно react-native-sse/OkHttp
 * на Android), клиент не получил НИ ОДНОГО события 42 секунды, пока не
 * сработал периодический REST stale-check (useMercure.js,
 * STALE_CHECK_INTERVAL_MS=45000) — единственный СУЩЕСТВОВАВШИЙ на тот
 * момент способ вообще заметить обрыв. Восстановление после него — через
 * REST-снапшот целиком (без проигрывания пропущенных событий), поэтому
 * пользователь увидел "телепорт" вместо честной анимации.
 *
 * Здесь SSE-поток разбирается ВРУЧНУЮ (свой построчный парсер ниже),
 * поэтому наружу можно отдать сигнал "пришёл ЛЮБОЙ байт, включая
 * heartbeat" (событие `ping`) ДО и НЕЗАВИСИМО от того, удалось ли этот
 * кусок разобрать в настоящее игровое событие. useMercure.js использует
 * `ping` (наравне с `message`) для честного и быстрого — не по таймеру,
 * а по факту реальной тишины — обнаружения мёртвого канала (см. там
 * SILENCE_TIMEOUT_MS). REST stale-check НЕ убран — остаётся независимой
 * подстраховкой на случай, если heartbeat на бэке когда-нибудь выключат.
 *
 * Публичный контракт НЕ поменялся: `createEventSource(url, token)` отдаёт
 * объект с `addEventListener('open'|'message'|'error'|'ping', cb)` (новый
 * только `ping`) и `close()`/`removeAllEventListeners()` через
 * `closeEventSource(es)` — весь остальной код (`useMercure.js`) трогать
 * по контракту не пришлось, кроме добавления обработчика `ping`.
 */

function detectNewline(text) {
    // Порядок важен: проверяем CRLF ПЕРВЫМ — иначе наивная проверка на
    // голый LF расколола бы "\r\n" на "\r"+"\n", оставляя висячий "\r" в
    // конце КАЖДОЙ строки (в т.ч. внутри JSON в data:) — тот же класс
    // бага, что react-native-sse решает через свой auto-detect.
    if (text.includes(CRLF)) return CRLF;
    if (text.includes(LF)) return LF;
    if (text.includes(CR)) return CR;
    return null;
}

/**
 * Построчный SSE-парсер, независимый от транспорта (fetch-поток на вебе,
 * инкрементальный XHR на native кормят его одинаково через `push(chunk)`).
 * `chunk` — ТОЛЬКО новый, ещё не обработанный кусок (не весь накопленный
 * ответ целиком) — иначе на Android (см. openNative) каждый вызов заново
 * пересканировал бы весь растущий с начала подключения ответ, что при
 * долгой партии становится всё дороже; здесь буферизуется только "хвост"
 * ещё не завершённой строки.
 */
class SseParser {
    constructor({ onEvent, onRaw }) {
        this._buf = '';
        this._nl = null;
        this._type = undefined;
        this._data = [];
        this._onEvent = onEvent;
        this._onRaw = onRaw;
    }

    push(chunk) {
        if (!chunk) return;
        this._onRaw(); // ЛЮБОЙ пришедший кусок — канал жив, даже если это окажется heartbeat
        this._buf += chunk;
        if (this._nl === null) {
            this._nl = detectNewline(this._buf);
            if (this._nl === null) return; // ещё не видели ни одного переноса строки
        }
        const parts = this._buf.split(this._nl);
        this._buf = parts.pop() ?? ''; // последний элемент — возможно неполная строка
        for (const line of parts) this._consumeLine(line);
    }

    _consumeLine(line) {
        if (line === '') {
            if (this._data.length > 0) {
                const event = { type: this._type || 'message', data: this._data.join('\n') };
                this._data = [];
                this._type = undefined;
                this._onEvent(event);
            }
            return;
        }
        if (line.startsWith(':')) return; // комментарий/heartbeat — не событие, только onRaw выше
        if (line.startsWith('event')) this._type = line.replace(/^event:?\s*/, '');
        else if (line.startsWith('data')) this._data.push(line.replace(/^data:?\s*/, ''));
        // id:/retry: сервер шлёт, но фронт версии несёт в самом payload
        // (game.version), last-event-id/автопереподключение по нему не
        // используем — реконнектом целиком управляет useMercure.js.
    }
}

class SseEventTarget {
    constructor() {
        this._handlers = { open: [], message: [], error: [], ping: [] };
        this._closed = false;
        this._close = () => {};
    }
    addEventListener(type, cb) { this._handlers[type]?.push(cb); }
    removeAllEventListeners() { for (const k of Object.keys(this._handlers)) this._handlers[k] = []; }
    _dispatch(type, payload) { for (const cb of this._handlers[type] ?? []) cb(payload); }
}

/** Веб: fetch()+ReadableStream — штатный, широко поддержанный браузерами API. */
function openWeb(url, target) {
    const controller = new AbortController();
    const parser = new SseParser({
        onEvent: (e) => target._dispatch('message', e),
        onRaw: () => target._dispatch('ping', undefined),
    });

    (async () => {
        try {
            const res = await fetch(url, {
                credentials: 'include', // mercureAuthorization-кука, как и раньше у EventSource
                headers: { Accept: 'text/event-stream' },
                signal: controller.signal,
            });
            if (target._closed) return;
            if (!res.ok || !res.body) {
                target._dispatch('error', { status: res.status });
                return;
            }
            target._dispatch('open', undefined);
            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            for (;;) {
                const { done, value } = await reader.read();
                if (target._closed) return;
                if (done) break;
                parser.push(decoder.decode(value, { stream: true }));
            }
            if (!target._closed) target._dispatch('error', { message: 'stream closed' });
        } catch (err) {
            if (target._closed || err?.name === 'AbortError') return;
            log('web: fetch/stream ошибка:', err?.message ?? err);
            target._dispatch('error', { message: err?.message });
        }
    })();

    target._close = () => { try { controller.abort(); } catch {} };
}

/**
 * Native: сырой XMLHttpRequest с инкрементальным чтением responseText —
 * ТОТ ЖЕ приём, что уже проверенно работает на Android в этом проекте
 * (см. history react-native-sse), форкнут (не обёрнут), чтобы получить
 * onRaw-сигнал на КАЖДЫЙ пришедший кусок, включая heartbeat — готовая
 * библиотека такого сигнала не давала вообще.
 *
 * Известное платформенное ограничение (не новое, было и у react-native-sse
 * тем же способом раньше) — `xhr.responseText` копит ВЕСЬ ответ целиком в
 * памяти на всё время жизни подключения (нет API отбросить уже
 * прочитанный префикс). CPU это не бьёт: чтобы не пересканировать
 * растущий текст каждый раз (как это, судя по коду, делает
 * react-native-sse), сюда прокидывается только НОВЫЙ хвост
 * (`text.slice(lastIndex)`), а не весь ответ — сама память просто растёт
 * с той же скоростью, что и раньше.
 */
function openNative(url, token, target) {
    const xhr = new XMLHttpRequest();
    let lastIndex = 0;
    let opened = false;
    let terminated = false; // не дать задвоить 'error' на DONE после xhr.onerror и т.п.
    const parser = new SseParser({
        onEvent: (e) => target._dispatch('message', e),
        onRaw: () => target._dispatch('ping', undefined),
    });

    const finishWithError = (payload) => {
        if (terminated || target._closed) return;
        terminated = true;
        target._dispatch('error', payload);
    };

    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onreadystatechange = () => {
        if (target._closed || terminated) return;
        const rs = xhr.readyState;
        if (rs !== XMLHttpRequest.LOADING && rs !== XMLHttpRequest.DONE) return;

        if (xhr.status >= 200 && xhr.status < 400) {
            if (!opened) {
                opened = true;
                target._dispatch('open', undefined);
            }
            const text = xhr.responseText || '';
            if (text.length > lastIndex) {
                parser.push(text.slice(lastIndex));
                lastIndex = text.length;
            }
            if (rs === XMLHttpRequest.DONE) finishWithError({ message: 'stream closed' });
        } else if (xhr.status !== 0) {
            finishWithError({ status: xhr.status, message: xhr.responseText });
        }
    };

    xhr.onerror = () => finishWithError({ message: 'xhr network error' });
    xhr.ontimeout = () => finishWithError({ message: 'xhr timeout' });

    xhr.send();
    target._close = () => { try { xhr.abort(); } catch {} };
}

export function createEventSource(url, token) {
    const target = new SseEventTarget();
    if (Platform.OS === 'web') openWeb(url, target);
    else openNative(url, token, target);
    return target;
}

/** API у веб/native-веток одинаковый (SseEventTarget) — просто закрываем. */
export function closeEventSource(es) {
    if (!es) return;
    try {
        es._closed = true;
        es.removeAllEventListeners?.();
        es._close?.();
    } catch {}
}
