// src/lib/dialogSettings.js
import { storage } from './storage';

const STORAGE_KEY = 'dialog_settings_v1';

/**
 * 2026-10-15, по прямому запросу пользователя — ориентация сворачиваемой
 * игровой модалки (GameDialogModal): к какой грани экрана прибита ручка
 * (двойная стрелка) и в какую сторону модалка схлопывается. В отличие от
 * audioSettings.js (слайдеры, live-preview + отдельное "Сохранить") — тут
 * ОДНО дискретное значение из выпадающего списка, применяется и пишется в
 * storage СРАЗУ по выбору, без отдельного шага подтверждения (см.
 * GameGeneralSettingsModal.js) — тот же приём, что у обычного системного
 * Settings-экрана, не требует отдельного "dirty"-отслеживания ради одного
 * переключателя.
 */
export const DIALOG_ORIENTATION = Object.freeze({
    LEFT: 'left',
    RIGHT: 'right',
});

export const DEFAULT_DIALOG_ORIENTATION = DIALOG_ORIENTATION.LEFT;

let current = DEFAULT_DIALOG_ORIENTATION;
let loaded = false;
let loadPromise = null;
const listeners = new Set();

function notify() {
    listeners.forEach((fn) => fn(current));
}

export function ensureDialogSettingsLoaded() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
        const raw = await storage.get(STORAGE_KEY);
        current = raw === DIALOG_ORIENTATION.LEFT || raw === DIALOG_ORIENTATION.RIGHT
            ? raw
            : DEFAULT_DIALOG_ORIENTATION;
        loaded = true;
        notify();
        return current;
    })();
    return loadPromise;
}

export function getDialogOrientation() {
    return current;
}

export function isDialogSettingsLoaded() {
    return loaded;
}

/** Применяет И сразу сохраняет — см. докстринг файла, тут нет отдельного "Сохранить". */
export async function setDialogOrientation(value) {
    if (value !== DIALOG_ORIENTATION.LEFT && value !== DIALOG_ORIENTATION.RIGHT) return;
    current = value;
    notify();
    await storage.set(STORAGE_KEY, value);
}

export function subscribeDialogSettings(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
