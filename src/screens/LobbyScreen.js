// src/screens/LobbyScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import { lobbyApi } from '../api/lobby';
import { useAuth } from '../hooks/useAuth';
import { useMercure } from '../hooks/useMercure';
import { lobbyReducer } from '../store/lobbyReducer';
import { ROUTES } from '../navigation/routes';
import { notify } from '../lib/notify';
import { colors, spacing, font, radius } from '../theme';

const STATUS_LABEL = {
    connecting: 'Подключение…',
    syncing: 'Синхронизация…',
    live: 'В сети',
    error: 'Нет связи, переподключаемся…',
};

export default function LobbyScreen({ route, navigation }) {
    const { lobbyId } = route.params;
    const { user } = useAuth();
    const [busy, setBusy] = useState(false);
    const leftRef = useRef(false); // не дёргать API после выхода

    const fetchSnapshot = useCallback(async () => {
        const l = await lobbyApi.byId(lobbyId);
        return { state: l, version: l.version };
    }, [lobbyId]);

    const goMenu = useCallback(() => {
        navigation.reset({ index: 0, routes: [{ name: ROUTES.MAIN_MENU }] });
    }, [navigation]);

    const { state: lobby, status } = useMercure({
        topic: `lobby_${lobbyId}`,
        fetchSnapshot,
        reduce: lobbyReducer,
        onTransient: (e) => {
            if (e.event === 'lobby_closed' && !leftRef.current) {
                notify('Лобби закрыто');
                goMenu();
            }
        },
    });

    const me = lobby?.players.find((p) => p.id === user?.id);

    // Автостарт: сервер удалил лобби и создал игру
    useEffect(() => {
        if (!lobby?.gameId) return;
        navigation.reset({
            index: 0,
            routes: [{ name: ROUTES.RUNNER_GAME, params: { gameId: lobby.gameId } }],
        });
    }, [lobby?.gameId, navigation]);

    // Меня выкинули (или вышел с другого устройства)
    useEffect(() => {
        if (lobby && me === undefined && !leftRef.current) goMenu();
    }, [lobby, me, goMenu]);

    const toggleReady = async () => {
        setBusy(true);
        try {
            // Оптимистично НЕ обновляем: настоящий стейт придёт событием player_ready
            await (me.isReady ? lobbyApi.unready() : lobbyApi.ready());
        } catch (e) {
            notify('Ошибка', e.userMessage ?? e.message);
        } finally {
            setBusy(false);
        }
    };

    const leave = async () => {
        leftRef.current = true;
        setBusy(true);
        try { await lobbyApi.leave(); } catch {} // лобби могло уже исчезнуть
        goMenu();
    };

    if (!lobby) {
        return (
            <Screen contentContainerStyle={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.status}>{STATUS_LABEL[status] ?? ''}</Text>
            </Screen>
        );
    }

    const readyCount = lobby.players.filter((p) => p.isReady).length;

    return (
        <Screen scroll contentContainerStyle={styles.content}>
            <View style={styles.headRow}>
                <Text style={styles.title}>
                    {lobby.players.length}/{lobby.maxPlayers} игроков
                </Text>
                <View style={styles.statusRow}>
                    <View style={[styles.dot, status === 'live' && styles.dotLive]} />
                    <Text style={styles.status}>{STATUS_LABEL[status] ?? ''}</Text>
                </View>
            </View>

            {lobby.players.map((p) => (
                <View key={p.id} style={styles.player}>
                    <Text style={styles.playerName}>
                        {p.username}
                        {p.id === lobby.host?.id ? '  👑' : ''}
                        {p.id === user?.id ? '  (ты)' : ''}
                    </Text>
                    <Text style={[styles.badge, p.isReady && styles.badgeReady]}>
                        {p.isReady ? 'готов' : 'ждёт'}
                    </Text>
                </View>
            ))}

            {/* Свободные слоты */}
            {Array.from({ length: Math.max(0, lobby.maxPlayers - lobby.players.length) }).map((_, i) => (
                <View key={`slot${i}`} style={[styles.player, styles.slotEmpty]}>
                    <Text style={styles.slotText}>Ожидание игрока…</Text>
                </View>
            ))}

            <Text style={styles.hint}>
                Готовы {readyCount} из {lobby.maxPlayers}. Игра начнётся автоматически.
            </Text>

            <Button
                title={me?.isReady ? 'Не готов' : 'Готов'}
                variant={me?.isReady ? 'muted' : 'success'}
                onPress={toggleReady}
                loading={busy}
                disabled={!me}
                style={styles.action}
            />
            <Button title="Покинуть лобби" variant="danger" onPress={leave} disabled={busy} style={styles.action} />
        </Screen>
    );
}

const styles = StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center' },
    content: { padding: spacing.lg },
    headRow: { marginBottom: spacing.md },
    title: { fontSize: font.h2, fontWeight: 'bold', color: colors.textOnDark },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning, marginRight: spacing.xs },
    dotLive: { backgroundColor: colors.success },
    status: { fontSize: font.tiny, color: colors.textOnDarkSecondary },
    player: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.bgLight, borderRadius: radius.md,
        padding: spacing.md, marginBottom: spacing.sm,
    },
    slotEmpty: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: '#555' },
    slotText: { color: '#777', fontSize: font.small },
    playerName: { color: colors.textOnDark, fontSize: font.body },
    badge: {
        color: colors.textOnDarkSecondary, fontSize: font.tiny,
        borderWidth: 1, borderColor: colors.textOnDarkSecondary,
        borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2,
    },
    badgeReady: { color: colors.success, borderColor: colors.success },
    hint: { fontSize: font.tiny, color: colors.textOnDarkSecondary, marginVertical: spacing.md },
    action: { marginTop: spacing.sm },
});