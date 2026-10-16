// src/lib/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Единая точка доступа к обычному (не секретному) key-value хранилищу —
 * настройки UI/звука (lib/dialogSettings.js, lib/audioSettings.js) и т.п.
 *
 * 2026-10-16: JWT-токены переехали на отдельный lib/secureStorage.js
 * (expo-secure-store на native) — этот файл для них больше не используется.
 * Специально НЕ объединено с secureStorage.js в один модуль с параметром
 * "secure/not" — у потребителей этого файла нет причин получать лимиты
 * SecureStore по размеру значения, а у токенов нет причин попадать в обычный
 * AsyncStorage на native.
 */
export const storage = {
    async get(key) {
        try {
            return await AsyncStorage.getItem(key);
        } catch {
            return null; // повреждённое хранилище не должно ронять запуск
        }
    },

    async set(key, value) {
        try {
            await AsyncStorage.setItem(key, value);
        } catch {}
    },

    async remove(key) {
        try {
            await AsyncStorage.removeItem(key);
        } catch {}
    },

    async multiRemove(keys) {
        try {
            await AsyncStorage.multiRemove(keys);
        } catch {}
    },
};