// src/components/ui/Button.js
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, font } from '../../theme';

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

    return (
        <TouchableOpacity
            style={[styles.base, { backgroundColor: v.bg }, isBlocked && styles.blocked, style]}
            onPress={onPress}
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