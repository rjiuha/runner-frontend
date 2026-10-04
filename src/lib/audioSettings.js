// src/lib/audioSettings.js
import { storage } from './storage';

const STORAGE_KEY = 'audio_settings_v1';

/**
 * Единый на всё приложение стор громкости (2026-10-04, по прямому запросу
 * пользователя — панель настроек в игре должна показывать "фактическое"
 * значение каждого канала, не 1.0 с невидимым программным приглушением
 * поверх). Раньше эти числа были захардкожены прямо в местах, где создаётся
 * плеер (GameBoardScreen#MUSIC_VOLUME=0.1, collisionSound.volume=0.5,
 * useMenuMusic#MENU_MUSIC_VOLUME=0.1) — теперь это ЕДИНСТВЕННЫЙ источник,
 * оба места (игровые звуки в GameBoardScreen И меню-музыка в useMenuMusic)
 * читают его через useAudioSettings().
 *
 * 4 канала (см. GameSettingsModal.js):
 *  - music — фоновая музыка, И игровая (GameBoardScreen), И меню/лобби
 *    (useMenuMusic) — один и тот же регулятор на обе, это один "вид" звука
 *    с точки зрения пользователя.
 *  - commentator — голосовые комментарии результатов (constants/
 *    commentSounds.js — COMMENT_SOUNDS, канал commentSound).
 *  - voice — реплики бегунов при выборе (RUNNER_SOUNDS active/
 *    damagedActive, канал voiceSound) — ОТДЕЛЬНО от остальных игровых
 *    звуков по прямому запросу пользователя, 2026-10-04.
 *  - action — всё остальное игровое: выстрелы (shootSound), шаги
 *    (moveSound), ожидание решения при столкновении (collisionSound),
 *    появление Жнеца/Мяча (startSound).
 *
 * Два слоя значений:
 *  - `saved` — то, что реально лежит в AsyncStorage (постоянное).
 *  - `current` — "живое" значение, может отличаться от `saved`, пока
 *    пользователь таскает слайдер в GameSettingsModal, НЕ нажав
 *    "Сохранить" — звук при этом уже меняется (мгновенный preview), но при
 *    выходе без сохранения откатывается обратно на `saved`
 *    (revertAudioSettings). Все звуковые каналы подписаны на `current`
 *    (через useAudioSettings), не на `saved` напрямую.
 */
export const AUDIO_DEFAULTS = Object.freeze({
    music: 0.1,
    commentator: 1.0,
    voice: 1.0,
    action: 0.5,
});

let saved = { ...AUDIO_DEFAULTS };
let current = { ...AUDIO_DEFAULTS };
let loaded = false;
let loadPromise = null;
const listeners = new Set();

function notify() {
    listeners.forEach((fn) => fn(current));
}

/** Разово грузит сохранённые значения из storage — идемпотентно, можно звать из нескольких мест. */
export function ensureAudioSettingsLoaded() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
        const raw = await storage.get(STORAGE_KEY);
        let parsed = null;
        try {
            parsed = raw ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }
        saved = { ...AUDIO_DEFAULTS, ...(parsed || {}) };
        current = { ...saved };
        loaded = true;
        notify();
        return current;
    })();
    return loadPromise;
}

export function getAudioSettings() {
    return current;
}

export function getSavedAudioSettings() {
    return saved;
}

export function isAudioSettingsLoaded() {
    return loaded;
}

/** Живое изменение (слайдер тащат) — звучит сразу, но НЕ пишется в storage. */
export function setAudioSettingsLive(partial) {
    current = { ...current, ...partial };
    notify();
}

/** "Сохранить" — текущие (живые) значения становятся постоянными. */
export async function commitAudioSettings() {
    saved = { ...current };
    await storage.set(STORAGE_KEY, JSON.stringify(saved));
}

/** "Выйти без сохранения" — откатывает живые значения к последним сохранённым. */
export function revertAudioSettings() {
    current = { ...saved };
    notify();
}

export function subscribeAudioSettings(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
