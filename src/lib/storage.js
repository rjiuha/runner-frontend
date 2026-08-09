// src/lib/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Единая точка доступа к хранилищу.
 * Смысл обёртки: когда захотим перенести токены в expo-secure-store,
 * менять придётся только этот файл, а не всё приложение.
 */
export const KEYS = {
    access: 'access_token',
    refresh: 'refresh_token',
};

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