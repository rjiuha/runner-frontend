// src/lib/logger.js
import { Platform } from 'react-native';

/**
 * Единый простой логгер на весь фронт (2026-09-14, по прямому запросу
 * пользователя — "хочу видеть всё в терминале в ходе работы приложения").
 * Формат — `[ЧЧ:ММ:СС.ммм] [платформа:юзернейм] [ТЕГ] сообщение...`.
 *
 * Намеренно ВСЕГДА `console.log`, НИКОГДА `console.warn`/`console.error` —
 * даже для сетевых ошибок и неудачных игровых действий. React Native
 * перехватывает warn/error через LogBox и показывает во весь экран жёлтый/
 * красный оверлей поверх приложения — а бизнес-ошибок в этой игре много и
 * они НЕ баги (напр. "сейчас не твой ход", "неверный email или пароль") —
 * заваливать ими экран оверлеями было бы куда хуже, чем просто строчка в
 * терминале. Кто действительно ищет лог — смотрит в терминал/logcat, не в
 * оверлей.
 *
 * **`[платформа:юзернейм]` (2026-09-14, по прямому уточнению пользователя —
 * "запускаю сразу web-browser и android, источник события в логе тоже
 * должен указываться")** — важная деталь, ради которой это вообще нужно:
 * `console.log` с ДВУХ РАЗНЫХ клиентов физически НЕ сходится в одном
 * терминале сам по себе. Android — уходит в терминал, где крутится Metro
 * (`expo start`/`npm run android`), и дублируется в `adb logcat`
 * (тег `ReactNativeJS`). Web — остаётся ТОЛЬКО в консоли браузера (devtools),
 * Metro его не видит и не может увидеть. Так что смотреть оба живьём
 * одновременно — это ДВЕ разные консоли, как и в этой же сессии при разборе
 * видео (два экрана рядом). Тег платформы+юзернейма — чтобы при сопоставлении
 * (или если лог откуда-то скопирован/переслан) сразу было видно, ЧЕЙ это
 * клиент, а не гадать по контексту.
 *
 * `setLoggerUser` вызывается из AuthContext при входе/выходе/восстановлении
 * сессии — модуль-левый кэш, не React-стейт (логгер вызывается из мест без
 * доступа к контексту, напр. api/client.js).
 */
let currentUsername = null;
export function setLoggerUser(username) {
    currentUsername = username || null;
}

function pad(n, len = 2) {
    return String(n).padStart(len, '0');
}

function timestamp() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function who() {
    return currentUsername ? `${Platform.OS}:${currentUsername}` : Platform.OS;
}

/** @param {string} tag — короткий тег в духе 'API'/'MERCURE'/'AUTH'/'GAME'/'NOTIFY' */
export function createLogger(tag) {
    return (...args) => console.log(`[${timestamp()}] [${who()}] [${tag}]`, ...args);
}
