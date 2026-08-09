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
                <>
                    <Text style={styles.title}>{title}</Text>
                    {!!description && <Text style={styles.desc}>{description}</Text>}
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