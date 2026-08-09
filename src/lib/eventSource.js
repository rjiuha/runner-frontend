// src/lib/eventSource.js
import { Platform } from 'react-native';
import RNEventSource from 'react-native-sse';

/**
 * Веб: нативный EventSource + withCredentials — браузер сам приложит
 * cookie mercureAuthorization. Натив: react-native-sse.
 */
export function createEventSource(url, token) {
    if (Platform.OS === 'web') {
        return new globalThis.EventSource(url, { withCredentials: true });
    }
    return new RNEventSource(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        pollingInterval: 0, // реконнектом управляем сами
    });
}

/** API двух реализаций различается — сглаживаем */
export function closeEventSource(es) {
    if (!es) return;
    try {
        es.removeAllEventListeners?.();
        es.close();
    } catch {}
}