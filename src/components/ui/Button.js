// src/components/ui/Button.js
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { colors, radius, spacing, font } from '../../theme';
import { CLICK_SOUND } from '../../constants/uiSounds';
import { useAudioSettings } from '../../hooks/useAudioSettings';

const VARIANTS = {
    primary: { bg: colors.primaryTranslucent, fg: colors.textOnDark },
    danger: { bg: colors.danger, fg: colors.textOnDark },
    info: { bg: colors.info, fg: colors.textOnDark },
    success: { bg: colors.success, fg: colors.textOnDark },
    muted: { bg: colors.muted, fg: colors.textOnDark },
};

/**
 * @param {'primary'|'danger'|'info'|'success'|'muted'} [variant]
 * @param {boolean} [loading] показывает спиннер и блокирует нажатия
 */
export default function Button({
                                   title,
                                   onPress,
                                   variant = 'primary',
                                   loading = false,
                                   disabled = false,
                                   style,
                                   textStyle,
                               }) {
    const v = VARIANTS[variant] ?? VARIANTS.primary;
    // Пока идёт запрос — кнопка обязана быть заблокирована,
    // иначе двойной тап отправит два POST (два лобби, два логина)
    const isBlocked = disabled || loading;

    // Клик (2026-10-14, по прямому запросу пользователя — "все кнопки
    // приложения глобально") — свой плеер прямо в Button, тот же приём, что
    // уже используют EventLogPanel/PlayerSwitchPanel (самодостаточный
    // компонент, без прокидывания звука через вызывающую сторону). Канал —
    // action ("Игровые звуки"), тот же, где теперь живут остальные UI-клики
    // (constants/uiSounds.js). TouchableOpacity сам не зовёт onPress, пока
    // isBlocked — звук тоже не играет на заблокированную кнопку, это
    // естественное следствие, а не отдельная проверка.
    const audioSettings = useAudioSettings();
    const clickSound = useAudioPlayer(CLICK_SOUND);
    useEffect(() => {
        clickSound.volume = audioSettings.action;
    }, [clickSound, audioSettings.action]);
    const handlePress = useCallback(() => {
        clickSound.seekTo(0);
        clickSound.play();
        onPress?.();
    }, [clickSound, onPress]);

    return (
        <TouchableOpacity
            style={[styles.base, { backgroundColor: v.bg }, isBlocked && styles.blocked, style]}
            onPress={handlePress}
            disabled={isBlocked}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={v.fg} />
            ) : (
                // noGlobalTint (2026-09-13, см. App.js) — кнопка сама выбирает
                // контрастный цвет текста под СВОЙ фон (v.fg), а не глобальный
                // циан: на насыщенных вариантах (info и т.п.) циан сливался с
                // фоном (живая жалоба пользователя).
                <Text style={[styles.label, { color: v.fg }, textStyle]} noGlobalTint>{title}</Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        minHeight: 52,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    blocked: { opacity: 0.5 },
    label: { fontSize: font.body + 2, fontWeight: 'bold' },
});