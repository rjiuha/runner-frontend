// src/components/ui/LoadingCard.js
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import LoadingTip from './LoadingTip';
import { colors, spacing, font, radius } from '../../theme';

/**
 * Плашка под спиннер + подпись + подсказку (LoadingTip) — по прямому
 * запросу пользователя, 2026-09-13: на экранах загрузки спиннер/текст стояли
 * прямо на звёздном фоне ParallaxBackground и плохо читались, особенно после
 * того как весь текст в приложении стал циановым (тот же цвет, что и часть
 * звёзд/фона — контраст терялся). Полупрозрачная тёмная "плашка"
 * (colors.overlayPlate) поднимает контраст независимо от того, что именно
 * происходит на фоне под ней.
 *
 * Общий компонент вместо копипасты — используется на 5 экранах загрузки
 * (MainMenu/Lobby/LobbySearch/GameBoardScreen×2), которые раньше просто
 * рисовали ActivityIndicator+Text+LoadingTip напрямую, каждый чуть иначе.
 *
 * `children` — доп. контент ПОД подсказкой (например кнопка "Повторить" на
 * экране ожидания старта партии, см. GameBoardScreen).
 */
export default function LoadingCard({ label, children, style }) {
    return (
        <View style={[styles.card, style]}>
            <ActivityIndicator size="large" color={colors.primary} />
            {!!label && <Text style={styles.label} noGlobalTint>{label}</Text>}
            <LoadingTip />
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.overlayPlate,
        borderRadius: radius.lg,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        maxWidth: 360,
        width: '85%',
    },
    label: {
        fontSize: font.body,
        color: colors.textOnDark,
        textAlign: 'center',
        marginTop: spacing.md,
    },
});
