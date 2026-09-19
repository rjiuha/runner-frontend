// src/hooks/useMercure.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { MERCURE_URL } from '../config/env';
import { createEventSource, closeEventSource } from '../lib/eventSource';
import { createLogger } from '../lib/logger';

const log = createLogger('MERCURE');

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
// реконнекта в этом файле целиком висит на этом событии.
//
// ЭТО ОСТАЁТСЯ независимой, редкой подстраховкой (2026-09-15: раньше это
// был ЕДИНСТВЕННЫЙ способ заметить обрыв — теперь есть быстрый путь ниже,
// см. SILENCE_TIMEOUT_MS, но stale-check не убран на случай, если heartbeat
// на бэке когда-нибудь отключат/сломают — независимая защита дешевле, чем
// полагаться на единственный механизм).
const STALE_CHECK_INTERVAL_MS = 45000;

// 2026-09-15: Mercure-хаб теперь шлёт heartbeat (`heartbeat 15s` в
// MERCURE_EXTRA_DIRECTIVES бэка) — периодический SSE-комментарий,
// который lib/eventSource.js (собственный транспорт, см. там подробный
// докстринг про замену EventSource/react-native-sse) отдаёт сюда как
// событие `ping`, наравне с `message`. Раз хаб гарантированно шлёт
// что-то РЕАЛЬНОЕ каждые ~15с, полное молчание (ни одного события, ни
// heartbeat-а) дольше SILENCE_TIMEOUT_MS — уже НАДЁЖНЫЙ (не гадательный,
// в отличие от старого "тишина = может, просто думает соперник") сигнал,
// что транспорт мёртв — форсируем connect() сразу, не дожидаясь
// STALE_CHECK_INTERVAL_MS. Порог — с запасом на ~2 пропущенных heartbeat-а
// (сетевой джиттер, единичный запоздавший пинг — не повод дёргать
// реконнект). Если когда-нибудь поменяется интервал heartbeat на бэке —
// поправить и это значение.
const SILENCE_TIMEOUT_MS = 35000;

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
    const silenceTimerRef = useRef(null); // см. SILENCE_TIMEOUT_MS выше
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
        log(`sync() старт gen=${gen}`);

        try {
            const snap = await cb.current.fetchSnapshot();
            if (gen !== genRef.current) {
                log(`sync() gen=${gen} устарел (текущий=${genRef.current}), игнор`);
                return;
            }

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
            log(`sync() OK gen=${gen} version=${ver} (из буфера доиграно ${pending.filter((e) => e.version <= ver).length})`);
        } catch (e) {
            if (gen !== genRef.current) return;
            setStatus('error');
            log(`sync() ПРОВАЛ gen=${gen}:`, e?.userMessage ?? e?.message ?? e, `— ретрай через ${Math.round(backoff(attemptRef.current))}мс`);
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
            log(`transient: ${e.event ?? '?'}`);
            cb.current.onTransient?.(e);
            return;
        }
        if (stateRef.current === null || syncingRef.current) {
            log(`event v${e.version} (${e.event ?? '?'}) — в буфер (стейт ещё null/идёт sync)`);
            bufferRef.current.push(e);
            return;
        }

        const cur = versionRef.current;
        if (e.version <= cur) { log(`event v${e.version} — дубль (уже на v${cur}), игнор`); return; }
        if (e.version === cur + 1) {
            log(`event v${e.version} (${e.event ?? '?'}) — применено`);
            commit(cb.current.reduce(stateRef.current, e), e.version);
            return;
        }
        log(`event v${e.version} — ПРОПУСК (жду v${cur + 1}), в буфер + форс sync()`);
        bufferRef.current.push(e);   // пропуск — не угадываем
        sync(genRef.current);
    }, [sync]);

    const disconnect = useCallback(() => {
        genRef.current += 1;
        clearTimeout(timerRef.current);
        clearTimeout(silenceTimerRef.current);
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
        log(`connect() gen=${gen} topic=${topic}`);

        // РЕАЛЬНЫЙ ЖИВОЙ БАГ (найден и воспроизведён 2026-09-19, см. диагностику
        // в чате — прямая подписка curl'ом на хаб + пере-логин двух свежих
        // тестовых аккаунтов): подписка на ПРИВАТНЫЙ Mercure-топик
        // авторизуется куки `mercureAuthorization` (веб, credentials:'include')
        // / токеном, который выдаёт и ОБНОВЛЯЕТ КАЖДЫЙ ответ бэка под КОНКРЕТНЫЙ
        // topic (бэк, read-only, MercureTokenGenerator — scoped на
        // "lobby_{id}"/"runner_game_{id}"). Раньше SSE-запрос уходил ДО того,
        // как REST-вызов sync() вообще успевал прийти и закоммитить эту куку —
        // если у cookie-jar браузера/нативного клиента ЕЩЁ НЕ БЫЛО валидной
        // куки под ИМЕННО этот топик (типичный случай — самое первое
        // подключение к партии/лобби после логина/навигации), Mercure всё
        // равно ПРИНИМАЛ соединение (200 OK, "New subscriber" в логах хаба),
        // но НИ РАЗУ не доставлял по нему ни одного приватного апдейта за
        // весь срок жизни этого соединения — оно выглядело живым (heartbeat
        // проходит, 'ping' исправно сбрасывает SILENCE-таймер, 'error' не
        // срабатывает никогда), просто ни одно РЕАЛЬНОЕ игровое/лобби-событие
        // не долетало, пока соединение само не переустанавливалось по другой
        // причине (например STALE_CHECK, у которого REST-запрос попутно
        // освежает куку ПЕРЕД реконнектом — поэтому баг маскировался: после
        // вынужденного реконнекта всё внезапно "чинилось само"). Живьём
        // подтверждено: пре-warm куки (лишний GET с credentials ДО открытия
        // SSE) полностью убирал пропуск; без него — терялось первое же
        // событие на свежем топике, каждый раз воспроизводимо.
        //
        // Фикс — SSE больше не открывается ПАРАЛЛЕЛЬНО с sync(), а строго
        // ПОСЛЕ того как его REST-запрос (тот самый, что release'ит свежую
        // куку) гарантированно завершился — неважно, успехом или ошибкой
        // (`sync()` сама уже ретраит с бэкоффом, здесь просто ждём, чтобы не
        // повиснуть). Старое опасение ("если ждать SSE 'open' перед sync() —
        // вечный спиннер при недоступном хабе") тут не воспроизводится: мы
        // ждём REST, а не SSE — REST может быть недоступен независимо, и
        // тогда просто откроем SSE следом (задержки лишней не будет), а если
        // недоступен ИМЕННО хаб — SSE как и раньше уйдёт в свой error/backoff.
        sync(gen).finally(() => {
            if (gen !== genRef.current) return; // отменено — новый connect() уже подменил generation

            const es = createEventSource(
                `${MERCURE_URL}?topic=${encodeURIComponent(topic)}`,
                token,
            );
            esRef.current = es;

            // См. SILENCE_TIMEOUT_MS выше — взводится сразу (не дожидаясь даже
            // 'open', на случай зависшего DNS/handshake) и перевзводится на
            // КАЖДЫЙ реально пришедший байт ('ping' — heartbeat, 'message' —
            // настоящее событие). Если ни разу не перевзвёлся за отведённое
            // время — транспорт мёртв, форсируем полный connect(), как и
            // делает stale-check, только по факту тишины, а не по таймеру
            // "может, ещё не пора спросить бэк".
            const armSilence = () => {
                if (gen !== genRef.current) return;
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    if (gen !== genRef.current) return;
                    log(`SILENCE ${SILENCE_TIMEOUT_MS}мс без единого байта (даже heartbeat) gen=${gen} — канал мёртв, форс-реконнект`);
                    connect();
                }, SILENCE_TIMEOUT_MS);
            };
            armSilence();

            es.addEventListener('open', () => { log(`SSE open gen=${gen}`); armSilence(); });

            es.addEventListener('ping', () => armSilence());

            es.addEventListener('message', (ev) => {
                armSilence();
                if (gen !== genRef.current || !ev?.data) return;
                try { handleEvent(JSON.parse(ev.data)); } catch (parseErr) {
                    log('message: не удалось распарсить JSON:', parseErr?.message, String(ev.data).slice(0, 200));
                }
            });

            es.addEventListener('error', () => {
                if (gen !== genRef.current) return;
                clearTimeout(silenceTimerRef.current); // это подключение уже мертво — не дать ему само сработать поверх обычного backoff
                setStatus('error');
                const delay = backoff(attemptRef.current);
                log(`SSE error gen=${gen} — реконнект через ${Math.round(delay)}мс (попытка №${attemptRef.current + 1})`);
                timerRef.current = setTimeout(() => {
                    if (gen === genRef.current) connect();
                }, delay);
                attemptRef.current += 1;
            });
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
                log(`stale-check: локально v${versionRef.current}, на бэке v${snap.version}`, snap.version > versionRef.current ? '— ОТСТАЛИ, форс-реконнект' : '— норма');
                if (snap.version > versionRef.current) connect();
            } catch (e) {
                log('stale-check: сам REST недоступен:', e?.userMessage ?? e?.message ?? e);
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
                log('AppState active — форс-реконнект');
                attemptRef.current = 0;
                connect();
            }
        });
        return () => sub.remove();
    }, [connect, enabled, topic]);

    return { state, status, resync: connect };
}