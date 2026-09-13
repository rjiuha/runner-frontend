// src/components/menu/ProfileCard.js
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, font, radius } from '../../theme';

/**
 * Блок профиля. Пока показывает ник из JWT.
 * Сюда же добавим аватар, уровень и баланс, когда появится GET /api/me.
 */
export default function ProfileCard({ username }) {
    const initial = (username ?? '?').charAt(0).toUpperCase();

    return (
        <View style={styles.card}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText} noGlobalTint>{initial}</Text>
            </View>

            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1} noGlobalTint>{username ?? 'Игрок'}</Text>
                <Text style={styles.sub} noGlobalTint>Уровень 1</Text>
            </View>

            {/* TODO MVP-2: баланс монет, кнопка магазина */}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        // colors.bgLight — тот же приём, что уже использует LobbyScreen для
        // карточек игроков (2026-09-13, приведение к единой тёмной палитре
        // Auth/GameBoard/LobbyScreen, по прямому запросу пользователя) —
        // раньше тут был сплошной белый colors.card, рассчитанный на светлый
        // фон Screen#dark=false, который эта правка убирает.
        backgroundColor: colors.bgLight,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    avatar: {
        width: 56, height: 56, borderRadius: radius.pill,
        backgroundColor: colors.primaryTranslucent,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: colors.textOnDark, fontSize: font.h2, fontWeight: 'bold' },
    info: { marginLeft: spacing.md, flex: 1 },
    name: { fontSize: font.h3, fontWeight: 'bold', color: colors.textOnDark },
    sub: { fontSize: font.small, color: colors.textOnDarkSecondary, marginTop: 2 },
});