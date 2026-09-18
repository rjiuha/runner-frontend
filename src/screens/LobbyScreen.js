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

    // Автостарт: сервер удалил лобби и создал игру. 2026-09-18: партия на
    // бэке теперь активируется СИНХРОННО с созданием (GameFactory::create()
    // сам вызывает RunnerGameFactory::start(), см. read-only коммит "remove
    // api/runner_game/start") — к моменту, когда GameBoardScreen впервые
    // запросит снапшот, игра УЖЕ активна, никакого отдельного шага "готов"
    // с этого экрана делать не нужно. `justStarted` — единственный надёжный
    // сигнал для GameBoardScreen'а "это ТОЧНО самое начало партии для этого
    // игрока" (не reconnect к уже идущей игре, см. gameStartSoundPlayedRef
    // там) — раньше это выводилось из наблюдения game.status
    // WAITING→ACTIVE, но WAITING теперь физически невидим фронту (переход
    // происходит на бэке ДО того, как хоть один клиент успевает
    // подписаться). MainMenuScreen (резюм активной игры через GET /me)
    // этот параметр НЕ передаёт — там это заведомо НЕ первый заход.
    useEffect(() => {
        if (!lobby?.gameId) return;
        navigation.reset({
            index: 0,
            routes: [{ name: ROUTES.RUNNER_GAME, params: { gameId: lobby.gameId, justStarted: true } }],
        });
    }, [lobby?.gameId, navigation]);

    // Меня выкинули (или вышел с другого устройства) — сам факт "меня нет в
    // players" не говорит, кик это был или уход с другого устройства
    // (useMercure не даёт колбэк на КАЖДОЕ применённое версионное событие,
    // только на транзиентные, см. onTransient выше и его докстринг) — текст
    // намеренно нейтральный, верен для обоих случаев.
    useEffect(() => {
        if (lobby && me === undefined && !leftRef.current) {
            notify('Ты больше не в этом лобби');
            goMenu();
        }
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

    const isHost = !!user && lobby?.host?.id === user.id;
    // Отдельный от busy/leaving флаг, ХРАНИТ id конкретного игрока — блокирует
    // именно ЕГО кнопку "✕" (не все разом), тот же принцип разделения флагов,
    // что уже применён для leaving/busy выше (2026-09-14).
    const [kickingId, setKickingId] = useState(null);

    const kick = async (playerId) => {
        setKickingId(playerId);
        try {
            // Оптимистично НЕ убираем из списка — настоящий стейт придёт
            // событием player_kicked (тот же принцип, что и у toggleReady).
            await lobbyApi.kick(playerId);
        } catch (e) {
            notify('Ошибка', e.userMessage ?? e.message);
        } finally {
            setKickingId(null);
        }
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
                        <View style={styles.playerMain}>
                            <Text style={styles.playerName} noGlobalTint>
                                {p.username}
                                {p.id === lobby.host?.id ? '  👑' : ''}
                                {p.id === user?.id ? '  (ты)' : ''}
                            </Text>
                            <Text style={[styles.badge, p.isReady && styles.badgeReady]} noGlobalTint>
                                {p.isReady ? 'готов' : 'ждёт'}
                            </Text>
                        </View>
                        {/* Кик — только у хоста, и не над самим собой (бэк
                            и так отклонит cannotKickSelf, но кнопка не
                            должна даже предлагать это). */}
                        {isHost && p.id !== user?.id && (
                            <Button
                                title="✕"
                                variant="danger"
                                onPress={() => kick(p.id)}
                                loading={kickingId === p.id}
                                disabled={(kickingId != null && kickingId !== p.id) || busy || leaving}
                                style={styles.kickBtn}
                                textStyle={styles.kickBtnText}
                            />
                        )}
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
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.bgLight, borderRadius: radius.md,
        padding: spacing.md, marginBottom: spacing.sm,
    },
    // Имя+бейдж сгруппированы отдельно от кнопки кика (2026-09-18) — раньше
    // это были прямые дети `player` со `justifyContent:'space-between'` на
    // нём самом; кнопка кика — третий сосед, который должен просто прижаться
    // к правому краю, не расталкивая имя/бейдж дальше друг от друга.
    playerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    slotEmpty: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: '#555' },
    slotText: { color: '#777', fontSize: font.small },
    playerName: { color: colors.textOnDark, fontSize: font.body },
    badge: {
        color: colors.textOnDarkSecondary, fontSize: font.tiny,
        borderWidth: 1, borderColor: colors.textOnDarkSecondary,
        borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2,
    },
    badgeReady: { color: colors.success, borderColor: colors.success },
    // Компактная кнопка вместо дефолтного Button (minHeight:52) — тот же
    // приём, что уже применён у collisionBtn в GameBoardScreen.js.
    kickBtn: { minHeight: 28, paddingVertical: 4, paddingHorizontal: 10, marginLeft: spacing.sm },
    kickBtnText: { fontSize: font.small, fontWeight: 'bold' },
    hint: { fontSize: font.tiny, color: colors.textOnDarkSecondary, marginVertical: spacing.md },
    action: { marginTop: spacing.sm },
});