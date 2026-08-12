// src/screens/GameBoardScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

import ArrowButton from '../components/game/ArrowButton';
import RoadArea from '../components/game/RoadArea';
import BoardGrid from '../components/game/BoardGrid';
import PlayerInfoPanel from '../components/game/PlayerInfoPanel';
import GameWaitingRoom from '../components/game/GameWaitingRoom';
import ParallaxBackground from '../components/ui/ParallaxBackground';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useMercure } from '../hooks/useMercure';
import { useLockLandscape } from '../hooks/useLockLandscape';
import { ROAD_AREA_SPACING, useBoardLayout } from '../hooks/useBoardLayout';
import { useBoardScroll } from '../hooks/useBoardScroll';
import { flattenTrackSegments } from '../lib/board';
import { notify } from '../lib/notify';
import { runnerGameApi } from '../api/runnerGame';
import { runnerGameReducer } from '../store/runnerGameReducer';
import {
    BOARD_LAYOUT, GAME_STATUS, PLAYER_ABILITY_ORDER, PLAYER_COLORS,
} from '../constants/GameConstants';
import { colors, spacing, font, radius } from '../theme';

const STATUS_LABEL = {
    connecting: 'Подключение…',
    syncing: 'Синхронизация…',
    live: 'В сети',
    error: 'Нет связи, переподключаемся…',
};

// Через сколько показать кнопку ручного рефетча, если игрок-цель зависшей
// коллизии (game.extraTurnPlayer) долго не отвечает — бэк это сам не разруливает.
const COLLISION_STUCK_TIMEOUT = 18000;

/**
 * Экран игровой сессии. Фаза 1 (bootstrap): снапшот GET /api/runner_game +
 * подписка на runner_game_{id} через Mercure (см. useMercure — тот же
 * протокол буфер→снапшот→live, что и в LobbyScreen), доска отражает реальные
 * данные. Реальные вызовы select/move/collision/shoot/ability и гейтинг
 * действий по шагу хода — Фаза 2, пока это локальный UI-стейт поверх живых
 * данных (см. CLAUDE.md).
 */
export default function GameBoardScreen({ route }) {
    useLockLandscape();
    const { user } = useAuth();
    const gameId = route?.params?.gameId ?? null;

    const fetchSnapshot = useCallback(async () => {
        const g = await runnerGameApi.get();
        return { state: g, version: g.version };
    }, []);

    const { state: game, status, resync } = useMercure({
        topic: gameId ? `runner_game_${gameId}` : null,
        fetchSnapshot,
        reduce: runnerGameReducer,
        // step_*/orchestrator-события без version — пригодятся для анимации в Фазе 3
        onTransient: () => {},
    });

    const {
        leftPanelW,
        arrowBtnSize,
        switcherH,
        roadContainerW,
        roadContainerH,
        segmentW,
        segmentH,
        minOffset,
        rows,
        cols,
        totalBlocks,
    } = useBoardLayout();

    const { xOffset, containerHandlers, leftButtonProps, rightButtonProps } = useBoardScroll({
        minOffset,
        segmentW,
        cols,
        totalBlocks,
        webScrollSpeed: BOARD_LAYOUT.WEB_SCROLL_SPEED,
    });

    const runners = game?.runners ?? [];
    const gamePlayers = game?.gamePlayers ?? [];

    const [activePlayerId, setActivePlayerId] = useState(null);
    const [selectedRunnerId, setSelectedRunnerId] = useState(null);
    // { [playerId]: { boost: diceIndex|null, heal:..., reaper:..., ghost:... } }
    const [diceAssignments, setDiceAssignments] = useState({});
    // { [playerId]: { [runnerId]: diceIndex[] } } — первый индекс = ход,
    // остальные (если на бегуна брошен ещё кубик) = накат.
    const [moveAssignments, setMoveAssignments] = useState({});

    // По умолчанию — свой игрок, как только придут данные. Один раз (пока не выбран вручную).
    useEffect(() => {
        if (activePlayerId != null || gamePlayers.length === 0) return;
        const me = gamePlayers.find((p) => p.user?.id === user?.id);
        setActivePlayerId(me?.id ?? gamePlayers[0].id);
    }, [gamePlayers, user, activePlayerId]);

    const players = useMemo(
        () =>
            gamePlayers.map((p, i) => ({
                id: p.id,
                name: p.user?.username ?? `Игрок ${p.id}`,
                color: PLAYER_COLORS[i % PLAYER_COLORS.length],
                dice: [p.dice1, p.dice2, p.dice3, p.dice4],
                runners: runners.filter((r) => r.playerId === p.id),
            })),
        [gamePlayers, runners],
    );

    const playerColorById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.color])), [players]);

    const gridData = useMemo(
        () => flattenTrackSegments([game?.trackBegin, game?.trackMiddle, game?.trackEnd], rows, cols),
        [game?.trackBegin, game?.trackMiddle, game?.trackEnd, rows, cols],
    );

    const shotSound = useAudioPlayer(require('../assets/sounds/lazer.mp3'));

    const handleCellPress = useCallback(
        (cell) => {
            shotSound.seekTo(0);
            shotSound.play();

            if (!selectedRunnerId) return;
            const runner = runners.find((r) => r.id === selectedRunnerId);
            if (!runner) return;

            // Реальный ход (POST /runner_game/move, по клетке за вызов) — Фаза 2.
            // Пока просто снимаем выбор, ничего не пишем поверх live-позиций,
            // чтобы не расходиться с тем, что реально пришлёт сервер.
            notify('Перемещение', 'Пока не подключено к серверу — это Фаза 2');
            setSelectedRunnerId(null);
        },
        [shotSound, selectedRunnerId, runners],
    );

    const handleAssignDice = useCallback((playerId, abilityKey, diceIndex) => {
        setDiceAssignments((prev) => {
            // По правилам за ход активно только одно усиление — назначение
            // нового кубика сбрасывает остальные зоны этого игрока, а не
            // добавляется к ним.
            const cleared = Object.fromEntries(PLAYER_ABILITY_ORDER.map((key) => [key, null]));
            return { ...prev, [playerId]: { ...cleared, [abilityKey]: diceIndex } };
        });
    }, []);

    const handleUnassignDice = useCallback((playerId, abilityKey) => {
        setDiceAssignments((prev) => {
            if (prev[playerId]?.[abilityKey] == null) return prev;
            return { ...prev, [playerId]: { ...prev[playerId], [abilityKey]: null } };
        });
    }, []);

    const handleAssignMove = useCallback((playerId, runnerId, diceIndex) => {
        setMoveAssignments((prev) => {
            const playerMoves = prev[playerId] ?? {};
            const current = playerMoves[runnerId] ?? [];
            if (current.includes(diceIndex)) return prev; // уже назначен этот кубик — повторный дроп игнорируем
            return { ...prev, [playerId]: { ...playerMoves, [runnerId]: [...current, diceIndex] } };
        });
    }, []);

    const handleUnassignMove = useCallback((playerId, runnerId, diceIndex) => {
        setMoveAssignments((prev) => {
            const playerMoves = prev[playerId] ?? {};
            const current = playerMoves[runnerId] ?? [];
            if (!current.length) return prev;
            const next = current.filter((i) => i !== diceIndex);
            return { ...prev, [playerId]: { ...playerMoves, [runnerId]: next } };
        });
    }, []);

    const handleEndTurn = useCallback(() => {
        notify('Ход завершён', 'Демо-режим: пока это не отправляется на бэкенд');
    }, []);

    // Зависшая коллизия: бэк не резолвит сам, если игрок-цель не ответит на
    // /collision — вся игра стоит. Через COLLISION_STUCK_TIMEOUT даём ручной
    // рефетч снапшота вместо бесконечного ожидания вслепую.
    const [showStuckRefresh, setShowStuckRefresh] = useState(false);
    useEffect(() => {
        setShowStuckRefresh(false);
        if (game?.extraTurnPlayer == null) return undefined;
        const t = setTimeout(() => setShowStuckRefresh(true), COLLISION_STUCK_TIMEOUT);
        return () => clearTimeout(t);
    }, [game?.extraTurnPlayer]);

    if (!game) {
        return (
            <View style={styles.wrapper}>
                <ParallaxBackground />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.statusText}>{STATUS_LABEL[status] ?? ''}</Text>
                </View>
            </View>
        );
    }

    if (game.status === GAME_STATUS.WAITING) {
        return (
            <View style={styles.wrapper}>
                <ParallaxBackground />
                <GameWaitingRoom gamePlayers={gamePlayers} />
            </View>
        );
    }

    return (
        <View style={styles.wrapper}>
            <ParallaxBackground />

            {game.extraTurnPlayer != null && (
                <View style={styles.collisionBanner}>
                    <Text style={styles.collisionText}>Ожидаем реакцию игрока на столкновение…</Text>
                    {showStuckRefresh && (
                        <Button title="Обновить состояние" variant="info" onPress={resync} style={styles.collisionBtn} />
                    )}
                </View>
            )}

            <PlayerInfoPanel
                players={players}
                activePlayerId={activePlayerId}
                onSelectPlayer={setActivePlayerId}
                selectedRunnerId={selectedRunnerId}
                onSelectRunner={setSelectedRunnerId}
                diceAssignments={diceAssignments}
                onAssignDice={handleAssignDice}
                onUnassignDice={handleUnassignDice}
                moveAssignments={moveAssignments}
                onAssignMove={handleAssignMove}
                onUnassignMove={handleUnassignMove}
                onEndTurn={handleEndTurn}
                width={leftPanelW}
                switcherHeight={switcherH}
            />

            <View style={styles.roadZone}>
                <ArrowButton direction="left" size={arrowBtnSize} handlers={leftButtonProps} />

                <RoadArea spacing={ROAD_AREA_SPACING} backgroundColor="#3a034b00">
                    <BoardGrid
                        gridData={gridData}
                        rows={rows}
                        cols={cols}
                        segmentW={segmentW}
                        segmentH={segmentH}
                        xOffset={xOffset}
                        containerHandlers={containerHandlers}
                        containerWidth={roadContainerW}
                        containerHeight={roadContainerH}
                        runners={runners}
                        playerColorById={playerColorById}
                        selectedRunnerId={selectedRunnerId}
                        onCellPress={handleCellPress}
                    />
                </RoadArea>

                <ArrowButton direction="right" size={arrowBtnSize} handlers={rightButtonProps} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // backgroundColor — та же тёмная тема, что Screen.js подставляет под
    // ParallaxBackground на всех остальных экранах (SafeAreaView с
    // {backgroundColor: bg}). У GameBoardScreen своего Screen-каркаса нет
    // (полноэкранный альбомный экран, фон вставляет вручную), и без этого
    // фолбэка, если Animated.Image парallax-фона не успевает/не может
    // отрисоваться (тяжёлый экран, много одновременных картинок, смена
    // ориентации на Android через useLockLandscape), из-под него на Android
    // просвечивает белый фон Activity по умолчанию — раньше сквозь пустоту
    // ничего не было видно, кроме белого.
    wrapper: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
    roadZone: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    statusText: { fontSize: font.small, color: colors.textOnDarkSecondary, marginTop: spacing.sm },
    collisionBanner: {
        position: 'absolute', top: spacing.md, alignSelf: 'center', zIndex: 20, elevation: 20,
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.bgLight, borderRadius: radius.pill,
        paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    },
    collisionText: { color: colors.textOnDark, fontSize: font.tiny },
    collisionBtn: { minHeight: 32, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
});
