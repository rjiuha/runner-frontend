// src/screens/LobbyScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import LoadingCard from '../components/ui/LoadingCard';
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

    // Отдельный от `busy` флаг (2026-09-14, по прямому запросу пользователя) —
    // раньше "Покинуть лобби" делила один и тот же `busy` с "Готов"/"Не готов",
    // и нажатие "Покинуть лобби" во время READY заодно включало спиннер на
    // кнопке готовности, хотя её запрос никто не делал.
    const [leaving, setLeaving] = useState(false);

    const leave = async () => {
        leftRef.current = true;
        setLeaving(true);
        try { await lobbyApi.leave(); } catch {} // лобби могло уже исчезнуть
        goMenu();
    };

    if (!lobby) {
        return (
            <Screen contentContainerStyle={styles.center}>
                <LoadingCard label={STATUS_LABEL[status] ?? ''} />
            </Screen>
        );
    }

    const readyCount = lobby.players.filter((p) => p.isReady).length;

    return (
        <Screen scroll contentContainerStyle={styles.content}>
            <View style={styles.column}>
                {/* Заменяет убранную нативную шапку стека (headerShown:false в
                    RootNavigator, 2026-09-14) — та рисовалась на всю ширину
                    экрана системным шрифтом, мимо общего стиля приложения. */}
                <Text style={styles.screenTitle} noGlobalTint>Лобби #{lobbyId}</Text>

                <View style={styles.headRow}>
                    <Text style={styles.title} noGlobalTint>
                        {lobby.players.length}/{lobby.maxPlayers} игроков
                    </Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.dot, status === 'live' && styles.dotLive]} />
                        <Text style={styles.status} noGlobalTint>{STATUS_LABEL[status] ?? ''}</Text>
                    </View>
                </View>

                {lobby.players.map((p) => (
                    <View key={p.id} style={styles.player}>
                        <Text style={styles.playerName} noGlobalTint>
                            {p.username}
                            {p.id === lobby.host?.id ? '  👑' : ''}
                            {p.id === user?.id ? '  (ты)' : ''}
                        </Text>
                        <Text style={[styles.badge, p.isReady && styles.badgeReady]} noGlobalTint>
                            {p.isReady ? 'готов' : 'ждёт'}
                        </Text>
                    </View>
                ))}

                {/* Свободные слоты */}
                {Array.from({ length: Math.max(0, lobby.maxPlayers - lobby.players.length) }).map((_, i) => (
                    <View key={`slot${i}`} style={[styles.player, styles.slotEmpty]}>
                        <Text style={styles.slotText} noGlobalTint>Ожидание игрока…</Text>
                    </View>
                ))}

                <Text style={styles.hint} noGlobalTint>
                    Готовы {readyCount} из {lobby.maxPlayers}. Игра начнётся автоматически.
                </Text>

                <Button
                    title={me?.isReady ? 'Не готов' : 'Готов'}
                    variant={me?.isReady ? 'muted' : 'success'}
                    onPress={toggleReady}
                    loading={busy}
                    disabled={!me || leaving}
                    style={styles.action}
                />
                <Button
                    title="Покинуть лобби"
                    variant="danger"
                    onPress={leave}
                    loading={leaving}
                    disabled={busy}
                    style={styles.action}
                />
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center' },
    // alignItems:'center' + column.width — тот же паттерн, что уже у
    // AuthScreen (styles.content/styles.form) и MainMenuScreen, по прямому
    // запросу пользователя, 2026-09-14.
    content: { padding: spacing.lg, alignItems: 'center' },
    column: { width: '80%', maxWidth: 300 },
    screenTitle: {
        fontSize: font.h1, fontWeight: 'bold', color: colors.textOnDark,
        marginTop: spacing.md, marginBottom: spacing.lg, textAlign: 'center',
    },
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