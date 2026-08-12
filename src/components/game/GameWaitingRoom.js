// src/components/game/GameWaitingRoom.js
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from '../ui/Button';
import { runnerGameApi } from '../../api/runnerGame';
import { useAuth } from '../../hooks/useAuth';
import { notify } from '../../lib/notify';
import { PLAYER_STATUS } from '../../constants/GameConstants';
import { colors, spacing, font, radius } from '../../theme';

/**
 * Партия создана (game.status === waiting), но ещё не все игроки подтвердили
 * готовность через POST /runner_game/start (отдельный гейт от лобби-ready).
 * Как только все готовы — бэк шлёт game_active, и GameBoardScreen сам
 * переключится на доску (реактивно, никакой навигации отсюда не нужно).
 * Портретный <Screen> не используется: экран игры весь в landscape-локе.
 */
export default function GameWaitingRoom({ gamePlayers }) {
    const { user } = useAuth();
    const [busy, setBusy] = useState(false);

    const me = gamePlayers.find((p) => p.user?.id === user?.id);
    const readyCount = gamePlayers.filter((p) => p.status === PLAYER_STATUS.ACTIVE).length;
    const iAmReady = me?.status === PLAYER_STATUS.ACTIVE;

    const handleStart = async () => {
        setBusy(true);
        try {
            await runnerGameApi.start();
            // Оптимистично не обновляем — реальный статус придёт событием player_active
        } catch (e) {
            notify('Ошибка', e.userMessage ?? e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={styles.wrapper}>
            <View style={styles.card}>
                <Text style={styles.title}>Ожидание игроков</Text>
                <Text style={styles.subtitle}>
                    Готовы {readyCount} из {gamePlayers.length}
                </Text>

                {gamePlayers.map((p) => (
                    <View key={p.id} style={styles.player}>
                        <Text style={styles.playerName}>
                            {p.user?.username ?? `Игрок ${p.id}`}
                            {p.user?.id === user?.id ? '  (ты)' : ''}
                        </Text>
                        <Text style={[styles.badge, p.status === PLAYER_STATUS.ACTIVE && styles.badgeReady]}>
                            {p.status === PLAYER_STATUS.ACTIVE ? 'готов' : 'ждёт'}
                        </Text>
                    </View>
                ))}

                <Button
                    title={iAmReady ? 'Ты готов, ждём остальных' : 'Готов'}
                    variant={iAmReady ? 'muted' : 'success'}
                    onPress={handleStart}
                    loading={busy}
                    disabled={!me || iAmReady}
                    style={styles.action}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
        width: 420,
        maxWidth: '90%',
        backgroundColor: colors.bgLight,
        borderRadius: radius.lg,
        padding: spacing.lg,
    },
    title: { fontSize: font.h2, fontWeight: 'bold', color: colors.textOnDark, textAlign: 'center' },
    subtitle: {
        fontSize: font.small, color: colors.textOnDarkSecondary,
        textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.md,
    },
    player: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.bg, borderRadius: radius.md,
        padding: spacing.md, marginBottom: spacing.sm,
    },
    playerName: { color: colors.textOnDark, fontSize: font.body },
    badge: {
        color: colors.textOnDarkSecondary, fontSize: font.tiny,
        borderWidth: 1, borderColor: colors.textOnDarkSecondary,
        borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2,
    },
    badgeReady: { color: colors.success, borderColor: colors.success },
    action: { marginTop: spacing.sm },
});
