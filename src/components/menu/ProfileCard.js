// src/components/menu/ProfileCard.js
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../../hooks/useI18n';
import { colors, spacing, font, radius } from '../../theme';

/**
 * Блок профиля. Пока показывает ник из JWT. Нажатие (2026-10-22, по прямому
 * запросу пользователя) открывает ProfileModal — подтверждение email,
 * сброс пароля, удаление аккаунта (см. MainMenuScreen).
 * Сюда же добавим аватар, уровень и баланс, когда появится GET /api/me.
 */
export default function ProfileCard({ username, onPress }) {
    const { t } = useI18n();
    const initial = (username ?? '?').charAt(0).toUpperCase();

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText} noGlobalTint>{initial}</Text>
            </View>

            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1} noGlobalTint>{username ?? t('menu.profileCard.defaultName')}</Text>
                <Text style={styles.sub} noGlobalTint>{t('menu.profileCard.level')}</Text>
            </View>

            {/* TODO MVP-2: баланс монет, кнопка магазина */}
        </TouchableOpacity>
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