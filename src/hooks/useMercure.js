// src/hooks/useMercure.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { MERCURE_URL } from '../config/env';
import { createEventSource, closeEventSource } from '../lib/eventSource';

const backoff = (n) => {
    const max = Math.min(1000 * 2 ** n, 30000);
    return max / 2 + Math.random() * (max / 2); // джиттер: клиенты не бьют хаб залпом
};

// Раз в STALE_CHECK_INTERVAL_MS сверяем версию с REST-снапшотом — живой тест,
// 2026-09-08, поймал именно ту "зависшую партию, помогает только рестарт"
// жалобу пользователя вживую: Mercure-хаб честно залогировал "Subscriber
// disconnected" для EventSource этого клиента, но НИКАКОГО последующего
// "New subscriber" так и не случилось — react-native-sse (обёртка над OkHttp
// на Android) не всегда шлёт 'error', когда соединение тихо обрывается
// (например транспорт/NAT/эмулятор молча закрывает сокет) — а вся логика
// реконнекта в этом файле целиком висит на этом событии. Раз хаб не шлёт
// периодический heartbeat, а элапсд-тайм-аут ненадёжен (партия пошаговая,
// тишина в несколько минут, пока думает оппонент — совершенно нормальна),
// единственный способ НАДЁЖНО заметить именно ТАКОЙ обрыв — периодически
// СВЕРЯТЬ версию с бэком напрямую, а не гадать по времени молчания.
const STALE_CHECK_INTERVAL_MS = 45000;

/**
 * Протокол: подписка → буфер → снапшот → отсечение по версии → live.
 * Порядок важен: сначала слушаем, потом грузим снапшот — иначе теряются
 * события, пришедшие между запросом и ответом.
 *
 * @param {object}   o
 * @param {string?}  o.topic
 * @param {string?}  o.token        null на вебе (cookie)
 * @param {Function} o.fetchSnapshot  () => Promise<{state, version}>
 * @param {Function} o.reduce         (state, event) => state
 * @param {Function} [o.onTransient]  события без version
 */
export function useMercure({ topic, token = null, fetchSnapshot, reduce, onTransient, enabled = true }) {
    const [state, setState] = useState(null);
    const [status, setStatus] = useState('idle'); // idle|connecting|syncing|live|error

    // колбэки в ref — иначе новая ссылка на каждый рендер переподключает SSE
    const cb = useRef({ fetchSnapshot, reduce, onTransient });
    cb.current = { fetchSnapshot, reduce, onTransient };

    const versionRef = useRef(0);
    const stateRef = useRef(null);
    const bufferRef = useRef([]);
    const syncingRef = useRef(false);
    const esRef = useRef(null);
    const attemptRef = useRef(0);
    const timerRef = useRef(null);
    const genRef = useRef(0); // отсекает ответы отменённых подключений

    const commit = (next, version) => {
        stateRef.current = next;
        versionRef.current = version;
        setState(next);
    };

    const sync = useCallback(async (gen) => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        setStatus('syncing');

        try {
            const snap = await cb.current.fetchSnapshot();
            if (gen !== genRef.current) return;

            let cur = snap.state;
            let ver = snap.version;

            // всё старше снапшота уже в нём учтено
            const pending = bufferRef.current
                .filter((e) => typeof e.version === 'number' && e.version > ver)
                .sort((a, b) => a.version - b.version);
            bufferRef.current = [];

            for (const e of pending) {
                if (e.version !== ver + 1) break; // дырка — доберём следующим sync
                cur = cb.current.reduce(cur, e);
                ver = e.version;
            }

            commit(cur, ver);
            attemptRef.current = 0;
            setStatus('live');
        } catch {
            if (gen !== genRef.current) return;
            setStatus('error');
            timerRef.current = setTimeout(() => {
                syncingRef.current = false;
                sync(genRef.current);
            }, backoff(attemptRef.current++));
            return;
        } finally {
            syncingRef.current = false;
        }
    }, []);

    const handleEvent = useCallback((e) => {
        // транзиентные (chat_message, lobby_closed) — мимо версий
        if (typeof e.version !== 'number') {
            cb.current.onTransient?.(e);
            return;
        }
        if (stateRef.current === null || syncingRef.current) {
            bufferRef.current.push(e);
            return;
        }

        const cur = versionRef.current;
        if (e.version <= cur) return;                       // дубль после реконнекта
        if (e.version === cur + 1) {
            commit(cb.current.reduce(stateRef.current, e), e.version);
            return;
        }
        bufferRef.current.push(e);   // пропуск — не угадываем
        sync(genRef.current);
    }, [sync]);

    const disconnect = useCallback(() => {
        genRef.current += 1;
        clearTimeout(timerRef.current);
        closeEventSource(esRef.current);
        esRef.current = null;
        bufferRef.current = [];
        syncingRef.current = false;
    }, []);

    const connect = useCallback(() => {
        if (!topic || !enabled) return;
        disconnect();

        const gen = genRef.current;
        setStatus('connecting');

        const es = createEventSource(
            `${MERCURE_URL}?topic=${encodeURIComponent(topic)}`,
            token,
        );
        esRef.current = es;

        // Снапшот грузим сразу, а не по 'open': если Mercure-хаб недоступен
        // (порт закрыт, CORS, хаб не поднят), 'open' не наступит никогда,
        // а раньше это означало вечный спиннер — sync() просто не вызывался.
        // REST и SSE независимы: буфер событий (bufferRef) уже умеет принимать
        // события, пришедшие до/во время sync, так что запуск здесь безопасен.
        sync(gen);

        es.addEventListener('message', (ev) => {
            if (gen !== genRef.current || !ev?.data) return;
            try { handleEvent(JSON.parse(ev.data)); } catch {}
        });

        es.addEventListener('error', () => {
            if (gen !== genRef.current) return;
            setStatus('error');
            timerRef.current = setTimeout(() => {
                if (gen === genRef.current) connect();
            }, backoff(attemptRef.current++));
        });
    }, [topic, token, enabled, disconnect, sync, handleEvent]);

    useEffect(() => {
        connect();
        return disconnect;
    }, [connect, disconnect]);

    // Молчаливая фоновая проверка "жив ли на самом деле SSE" (см. комментарий
    // у STALE_CHECK_INTERVAL_MS выше) — НЕ трогает status/UI сама по себе,
    // просто периодически спрашивает REST-снапшот; если его версия УЖЕ
    // обогнала то, что мы применили через живой поток, значит поток тихо
    // умер — полный connect() (не просто sync()) чинит именно ЭТО: если
    // сдохла не только доставленная версия, а сам транспорт, одного
    // REST-подтягивания недостаточно — следующее реальное событие партии
    // всё равно никогда бы не пришло по мёртвому соединению.
    useEffect(() => {
        if (!topic || !enabled) return undefined;
        const interval = setInterval(async () => {
            if (syncingRef.current || stateRef.current === null) return;
            try {
                const snap = await cb.current.fetchSnapshot();
                if (snap.version > versionRef.current) connect();
            } catch {
                // REST сам недоступен — не забота этой проверки, тем и
                // занимается обычный error-хендлер EventSource/его backoff.
            }
        }, STALE_CHECK_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [topic, enabled, connect]);

    // iOS рвёт соединения в фоне молча, без события error
    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active' && enabled && topic) {
                attemptRef.current = 0;
                connect();
            }
        });
        return () => sub.remove();
    }, [connect, enabled, topic]);

    return { state, status, resync: connect };
}