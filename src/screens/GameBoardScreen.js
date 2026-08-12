// src/screens/GameBoardScreen.js
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

import ArrowButton from '../components/game/ArrowButton';
import RoadArea from '../components/game/RoadArea';
import BoardGrid from '../components/game/BoardGrid';
import PlayerInfoPanel from '../components/game/PlayerInfoPanel';
import ParallaxBackground from '../components/ui/ParallaxBackground';
import { useLockLandscape } from '../hooks/useLockLandscape';
import { ROAD_AREA_SPACING, useBoardLayout } from '../hooks/useBoardLayout';
import { useBoardScroll } from '../hooks/useBoardScroll';
import { flattenTrackSegments } from '../lib/board';
import { notify } from '../lib/notify';
import { BOARD_LAYOUT, PLAYER_ABILITY_ORDER, PLAYER_COLORS, RUNNER_TYPES } from '../constants/GameConstants';
import { MOCK_GAME } from '../constants/mockGameData';
import { colors } from '../theme';

/**
 * Экран игровой сессии. Пока данные — мок в форме реального ответа
 * GET /api/runner_game (см. constants/mockGameData.js): когда появится
 * подключение к лобби/бэку/Mercure, `game` заменится на пропс/стейт из
 * запроса, а форма, которую читают компоненты ниже, не изменится.
 *
 * Игровые правила (кто ходит, что можно тащить куда, столкновения и т.п.)
 * сюда намеренно не заведены — только раскладка и локальные UI-заглушки
 * (перетаскивание кубика на усиление, тап-плейсмент бегуна, "завершить ход").
 */
export default function GameBoardScreen() {
    useLockLandscape();

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

    const game = MOCK_GAME;

    const [runners, setRunners] = useState(game.runners);
    const [activePlayerId, setActivePlayerId] = useState(game.gamePlayers[0].id);
    const [selectedRunnerId, setSelectedRunnerId] = useState(null);
    // { [playerId]: { boost: diceIndex|null, heal:..., reaper:..., ghost:... } }
    const [diceAssignments, setDiceAssignments] = useState({});
    // { [playerId]: { [runnerId]: diceIndex[] } } — первый индекс = ход,
    // остальные (если на бегуна брошен ещё кубик) = накат.
    const [moveAssignments, setMoveAssignments] = useState({});

    const players = useMemo(
        () =>
            game.gamePlayers.map((p, i) => ({
                id: p.id,
                name: p.user?.username ?? `Игрок ${p.id}`,
                color: PLAYER_COLORS[i % PLAYER_COLORS.length],
                dice: [p.dice1, p.dice2, p.dice3, p.dice4],
                runners: runners.filter((r) => r.playerId === p.id),
            })),
        [game.gamePlayers, runners],
    );

    const playerColorById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.color])), [players]);

    const gridData = useMemo(
        () => flattenTrackSegments([game.trackBegin, game.trackMiddle, game.trackEnd], rows, cols),
        [game.trackBegin, game.trackMiddle, game.trackEnd, rows, cols],
    );

    const shotSound = useAudioPlayer(require('../assets/sounds/lazer.mp3'));

    const handleCellPress = useCallback(
        (cell) => {
            shotSound.seekTo(0);
            shotSound.play();

            if (!selectedRunnerId) return;
            const runner = runners.find((r) => r.id === selectedRunnerId);
            if (!runner) return;

            // Уже размещённого на поле бегуна (кроме Жнеца — ему по правилам
            // можно куда угодно, см. gate на активное усиление в
            // PlayerInfoPanel) можно двигать только на одну клетку: вперёд по
            // трассе (col+1, та же дорожка) или на соседнюю дорожку (та же
            // колонка, row±1). Выход за верхнюю/нижнюю дорожку невозможен уже
            // потому, что за пределами 0..rows-1 клеток на доске просто нет —
            // тапнуть там нечего. Первое размещение из резерва (segment == null)
            // без ограничений, как и раньше.
            if (runner.segment != null && runner.type !== RUNNER_TYPES.REAPER) {
                const currentGlobalCol = runner.segment * cols + runner.positionX;
                const currentRow = runner.positionY;

                const isForward = cell.col === currentGlobalCol + 1 && cell.row === currentRow;
                const isLaneChange = cell.col === currentGlobalCol && Math.abs(cell.row - currentRow) === 1;

                if (!isForward && !isLaneChange) return; // недопустимый ход — тап просто игнорируется
            }

            setRunners((prev) =>
                prev.map((r) =>
                    r.id === selectedRunnerId
                        ? {
                              ...r,
                              segment: cell.blockIndex,
                              positionX: cell.col - cell.blockIndex * cols,
                              positionY: cell.row,
                          }
                        : r,
                ),
            );
            setSelectedRunnerId(null);
        },
        [shotSound, selectedRunnerId, runners, cols],
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

    return (
        <View style={styles.wrapper}>
            <ParallaxBackground />

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
});
