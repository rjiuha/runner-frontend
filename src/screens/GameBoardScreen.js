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
import { BOARD_LAYOUT, PLAYER_COLORS } from '../constants/GameConstants';
import { MOCK_GAME } from '../constants/mockGameData';

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
        [shotSound, selectedRunnerId, cols],
    );

    const handleAssignDice = useCallback((playerId, abilityKey, diceIndex) => {
        setDiceAssignments((prev) => ({
            ...prev,
            [playerId]: { ...prev[playerId], [abilityKey]: diceIndex },
        }));
    }, []);

    const handleUnassignDice = useCallback((playerId, abilityKey) => {
        setDiceAssignments((prev) => {
            if (prev[playerId]?.[abilityKey] == null) return prev;
            return { ...prev, [playerId]: { ...prev[playerId], [abilityKey]: null } };
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
                onEndTurn={handleEndTurn}
                width={leftPanelW}
            />

            <View style={styles.roadZone}>
                <ArrowButton direction="left" size={arrowBtnSize} handlers={leftButtonProps} />

                <RoadArea spacing={ROAD_AREA_SPACING} backgroundColor="#3a034b00">
                    <BoardGrid
                        gridData={gridData}
                        rows={rows}
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
    wrapper: { flex: 1, flexDirection: 'row' },
    roadZone: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
