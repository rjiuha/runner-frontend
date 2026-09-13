// src/components/menu/MenuCard.js
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, spacing, font, radius, shadow } from '../../theme';

export default function MenuCard({ title, description, color, onPress, loading, disabled }) {
    const blocked = disabled || loading;

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: color }, blocked && styles.blocked]}
            onPress={onPress}
            disabled={blocked}
            activeOpacity={0.85}
        >
            {loading ? (
                <ActivityIndicator color={colors.textOnDark} />
            ) : (
                // noGlobalTint (2026-09-13, см. App.js) — карточка сама решает
                // цвет текста под СВОЙ (насыщенный, разный на каждой карточке)
                // цветной фон, а не глобальный циан: тот сливался/терял
                // контраст на некоторых цветах (живая жалоба пользователя).
                <>
                    <Text style={styles.title} noGlobalTint>{title}</Text>
                    {!!description && <Text style={styles.desc} noGlobalTint>{description}</Text>}
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        minHeight: 84,
        justifyContent: 'center',
        ...shadow.card,
    },
    blocked: { opacity: 0.6 },
    title: { fontSize: font.h3, fontWeight: 'bold', color: colors.textOnDark, marginBottom: spacing.xs },
    desc: { fontSize: font.small, color: 'rgba(255,255,255,0.9)' },
});