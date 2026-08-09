// src/components/menu/ProfileCard.js
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, font, radius, shadow } from '../../theme';

/**
 * Блок профиля. Пока показывает ник из JWT.
 * Сюда же добавим аватар, уровень и баланс, когда появится GET /api/me.
 */
export default function ProfileCard({ username }) {
    const initial = (username ?? '?').charAt(0).toUpperCase();

    return (
        <View style={styles.card}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
            </View>

            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{username ?? 'Игрок'}</Text>
                <Text style={styles.sub}>Уровень 1</Text>
            </View>

            {/* TODO MVP-2: баланс монет, кнопка магазина */}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
        ...shadow.card,
    },
    avatar: {
        width: 56, height: 56, borderRadius: radius.pill,
        backgroundColor: colors.primaryTranslucent,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: colors.textOnDark, fontSize: font.h2, fontWeight: 'bold' },
    info: { marginLeft: spacing.md, flex: 1 },
    name: { fontSize: font.h3, fontWeight: 'bold', color: colors.text },
    sub: { fontSize: font.small, color: colors.textSecondary, marginTop: 2 },
});