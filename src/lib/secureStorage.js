// src/lib/secureStorage.js
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 2026-10-16 — выделено ИЗ lib/storage.js по итогам аудита лучших практик:
 * JWT access/refresh-токены лежали в AsyncStorage (plaintext — SharedPreferences
 * на Android, plist/NSUserDefaults на iOS, localStorage на вебе), сам
 * storage.js честно документировал это как временное решение. Токены — самое
 * чувствительное, что есть в приложении (полный доступ к аккаунту), поэтому
 * им отдельный, более защищённый путь — через expo-secure-store (iOS
 * Keychain / Android Keystore, шифрованно).
 *
 * НЕ меняем сам lib/storage.js — тот остаётся общим key-value хранилищем для
 * ОСТАЛЬНЫХ потребителей (lib/dialogSettings.js, lib/audioSettings.js — это
 * не секреты, а настройки UI/звука, SecureStore для них неуместен: жёсткие
 * лимиты по размеру значения и сама механика шифрования там не нужны). Это
 * НЕ рефакторинг общего storage.js "под один из потребителей" — это отдельный
 *, специализированный модуль только для токенов.
 *
 * expo-secure-store НЕ реализован на вебе вообще (исходник нативного модуля
 * там — пустой объект, `isAvailableAsync()` вернул бы false, а
 * getItemAsync/setItemAsync бросили бы TypeError) — на вебе Keychain/Keystore
 * физически не существует, там используется тот же AsyncStorage (= localStorage
 * на вебе), как и было раньше. Платформенная ветка — ЕДИНСТВЕННЫЙ способ
 * поддержать оба случая одним API.
 */
const useSecureStore = Platform.OS !== 'web';

export const TOKEN_KEYS = {
    access: 'access_token',
    refresh: 'refresh_token',
};

export const secureStorage = {
    async get(key) {
        try {
            return useSecureStore ? await SecureStore.getItemAsync(key) : await AsyncStorage.getItem(key);
        } catch {
            return null; // повреждённое/недоступное хранилище не должно ронять запуск
        }
    },

    async set(key, value) {
        try {
            if (useSecureStore) await SecureStore.setItemAsync(key, value);
            else await AsyncStorage.setItem(key, value);
        } catch {}
    },

    async remove(key) {
        try {
            if (useSecureStore) await SecureStore.deleteItemAsync(key);
            else await AsyncStorage.removeItem(key);
        } catch {}
    },

    // SecureStore не умеет батчем — multiRemove тут просто Promise.all по
    // deleteItemAsync (их всего 2 ключа, access+refresh, не узкое место).
    async multiRemove(keys) {
        try {
            if (useSecureStore) await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(key)));
            else await AsyncStorage.multiRemove(keys);
        } catch {}
    },
};
