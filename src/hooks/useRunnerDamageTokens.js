// src/hooks/useRunnerDamageTokens.js
import { useCallback, useRef, useState } from 'react';

/**
 * Локальный стор жетонов повреждений по runnerId —
 * `{ [runnerId]: [token|null, token|null] }`, та же форма, что и мок
 * `runner.damageTokens` (см. constants/mockGameData.js), которую уже читает
 * `RunnerCard` — см. lib/runnerDamageTokens.js про то, откуда берутся типы,
 * почему это вообще нужно (бэк не отдаёт тип жетона, только status) и почему
 * тут ДВА шага (`notePendingType`/`consumePendingType`), а не один прямой
 * trigger — короткая версия: транзиентное событие с типом жетона НЕ всегда
 * значит реальный удар (см. подробный разбор в lib/runnerDamageTokens.js).
 *
 * Ключи — ВСЕГДА `String(runnerId)`: `activeRunner` с бэка — строка
 * (`RunnerPlayer::$activeRunner` типизирован `?string`), а `runner.id` из
 * `game.runners` — число (`Runner::$id` — `?int`) — тот же разъезд типов,
 * что уже не раз ловили в этом проекте (playerOrder/extraTurnPlayer/
 * activeRunner) — читающий код обязан приводить свой `runner.id` к строке
 * тоже (см. использование в GameBoardScreen).
 *
 * Копится ТОЛЬКО из живого потока событий текущей сессии — при
 * переподключении/`resync()` (полный REST-рефетч) накопленное теряется,
 * бэк это состояние нигде не хранит отдельно от `status`. Известное и
 * принятое ограничение (см. TODO в CLAUDE.md).
 */
export function useRunnerDamageTokens() {
    const [tokensByRunner, setTokensByRunner] = useState({});
    // Ref, не state — это чисто внутренняя "память" между transient- и
    // versioned-событиями одного и того же burst'а, сама по себе никогда не
    // рендерится и не должна триггерить ре-рендер экрана.
    const pendingByRunner = useRef({});

    const notePendingType = useCallback((runnerId, type) => {
        if (runnerId == null) return;
        pendingByRunner.current[String(runnerId)] = type;
    }, []);

    const consumePendingType = useCallback((runnerId) => {
        if (runnerId == null) return null;
        const key = String(runnerId);
        const type = pendingByRunner.current[key];
        if (type) delete pendingByRunner.current[key];
        return type ?? null;
    }, []);

    const recordToken = useCallback((runnerId, type) => {
        if (runnerId == null) return;
        setTokensByRunner((prev) => {
            const key = String(runnerId);
            const existing = prev[key] ?? [null, null];
            const emptyIndex = existing.findIndex((slot) => slot == null);
            if (emptyIndex === -1) return prev; // оба слота уже заняты — новый жетон девать некуда
            const next = [...existing];
            next[emptyIndex] = { type };
            return { ...prev, [key]: next };
        });
    }, []);

    // Лечение возвращает бегуна к healthy — локально накопленные жетоны
    // тоже надо стереть, иначе кружки останутся закрашенными вопреки
    // реальному (уже здоровому) статусу.
    const clearRunner = useCallback((runnerId) => {
        if (runnerId == null) return;
        delete pendingByRunner.current[String(runnerId)];
        setTokensByRunner((prev) => {
            const key = String(runnerId);
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const reset = useCallback(() => {
        pendingByRunner.current = {};
        setTokensByRunner({});
    }, []);

    return { tokensByRunner, notePendingType, consumePendingType, recordToken, clearRunner, reset };
}
