// src/lib/notify.js
import { Alert, Platform } from 'react-native';

/**
 * ВАЖНО: Alert.alert НЕ РАБОТАЕТ в react-native-web — он молча ничего не делает.
 * Все твои проверки «Заполните все поля» на вебе были невидимы.
 * Эта обёртка решает проблему на всех трёх платформах.
 */
export function notify(title, message) {
    if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        globalThis.alert(message ? `${title}\n\n${message}` : title);
        return;
    }
    Alert.alert(title, message);
}

/** Подтверждение действия (выход, покинуть лобби) */
export function confirm(title, message, onConfirm, confirmLabel = 'Да') {
    if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        if (globalThis.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
        return;
    }
    Alert.alert(title, message, [
        { text: 'Отмена', style: 'cancel' },
        { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
}