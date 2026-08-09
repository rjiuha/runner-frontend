// src/hooks/useMercure.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { MERCURE_URL } from '../config/env';
import { createEventSource, closeEventSource } from '../lib/eventSource';

const backoff = (n) => {
    const max = Math.min(1000 * 2 ** n, 30000);
    return max / 2 + Math.random() * (max / 2); // джиттер: клиенты не бьют хаб залпом
};

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

        es.addEventListener('open', () => {
            if (gen === genRef.current) sync(gen);
        });

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