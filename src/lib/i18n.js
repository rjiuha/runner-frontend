// src/lib/i18n.js
import { storage } from './storage';
import ru from '../locales/ru';
import en from '../locales/en';

const STORAGE_KEY = 'locale_v1';

export const LOCALES = Object.freeze({ RU: 'ru', EN: 'en' });
export const DEFAULT_LOCALE = LOCALES.RU;

const DICTIONARIES = { [LOCALES.RU]: ru, [LOCALES.EN]: en };

/**
 * Переключение языка UI (2026-10-26, по прямому запросу пользователя) —
 * тот же приём, что у lib/dialogSettings.js: ОДНО дискретное значение,
 * применяется и пишется в storage сразу по выбору (не слайдер с live-
 * preview, как у lib/audioSettings.js — отдельный шаг "Сохранить" тут не
 * нужен). Загружается лениво — см. ensureI18nLoaded, тот же паттерн, что у
 * useDialogOrientation/useAudioSettings (без блокировки старта приложения,
 * см. App.js — там эти стора вообще не трогаются, подхватываются первым
 * компонентом, который вызовет свой хук).
 *
 * Словари — src/locales/ru.js|en.js, вложенные объекты по экрану/разделу,
 * ключ строка через resolvePath (`t('auth.login.title')`). Значение словаря
 * может быть:
 *  - строкой с `{param}`-плейсхолдерами (interpolate ниже);
 *  - функцией `(params) => string` — для фраз, где порядок слов между RU/EN
 *    отличается настолько, что плейсхолдер-замена в одном шаблоне на оба
 *    языка была бы противоестественной (например «Накат для «X» выбран» vs
 *    «Roll for "X" selected» — разный порядок конструкции).
 * Отсутствующий ключ в текущей локали падает на RU (словарь-источник
 * истины), а не на сам ключ — писать которые-то значения как ключ обычно
 * означает забытый перевод, лучше увидеть русский текст, чем "game.foo.bar".
 */
let current = DEFAULT_LOCALE;
let loaded = false;
let loadPromise = null;
const listeners = new Set();

function notify() {
    listeners.forEach((fn) => fn(current));
}

export function ensureI18nLoaded() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
        const raw = await storage.get(STORAGE_KEY);
        current = raw === LOCALES.RU || raw === LOCALES.EN ? raw : DEFAULT_LOCALE;
        loaded = true;
        notify();
        return current;
    })();
    return loadPromise;
}

export function getLocale() {
    return current;
}

export function isI18nLoaded() {
    return loaded;
}

export async function setLocale(value) {
    if (value !== LOCALES.RU && value !== LOCALES.EN) return;
    current = value;
    notify();
    await storage.set(STORAGE_KEY, value);
}

export function subscribeLocale(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function resolvePath(dict, key) {
    let node = dict;
    for (const part of key.split('.')) {
        if (node == null) return undefined;
        node = node[part];
    }
    return node;
}

function interpolate(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : ''));
}

/**
 * `t(key, params)` — читает ТЕКУЩУЮ локаль (модульную переменную `current`),
 * не привязан к React — можно звать и вне компонента (например в
 * lib/notify.js-сообщениях, собираемых до рендера). Компоненты должны
 * подписываться через hooks/useI18n.js, чтобы перерендериться при смене
 * языка — сам `t()` не реактивен.
 */
export function t(key, params) {
    const value = resolvePath(DICTIONARIES[current], key) ?? resolvePath(DICTIONARIES[DEFAULT_LOCALE], key);
    if (value == null) return key;
    if (typeof value === 'function') return value(params ?? {});
    return interpolate(value, params);
}
