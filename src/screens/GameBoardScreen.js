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
import { forwardNeighbors, cellKey } from '../lib/hexDirection';
import { notify } from '../lib/notify';
import { runnerGameApi } from '../api/runnerGame';
import { runnerGameReducer } from '../store/runnerGameReducer';
import {
    BOARD_LAYOUT, GAME_STATUS, PLAYER_COLORS, PLAYER_STEP, RUNNER_STATUS, RUNNER_TYPES,
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

const DEAD_STATUSES = [RUNNER_STATUS.BROKEN, RUNNER_STATUS.DESTROYED];
const SEGMENT_KEYS = ['trackBegin', 'trackMiddle', 'trackEnd'];

function findRunnerAt(runners, pos) {
    return runners.find(
        (r) => r.segment === pos.segment && r.positionX === pos.positionX && r.positionY === pos.positionY,
    );
}

/** Сырой RoadType клетки прямо из game.trackBegin/Middle/End — grid[positionX][positionY]. */
function rawCellType(game, segment, positionX, positionY) {
    return game?.[SEGMENT_KEYS[segment]]?.grid?.[positionX]?.[positionY] ?? null;
}

/**
 * Экран игровой сессии. Фаза 2: реальная стейт-машина хода — select/ability/
 * move/shoot/collision дёргают бэк, а не локальный UI-стейт. Источник правды
 * для "что назначено" — сам live-`game` (runner.dice/rollDice, player.ability,
 * player.dice1..4): как только SELECT/ABILITY реально проходят на бэке, эти
 * поля обновляются событиями (runnerGameReducer, Фаза 1), и локальному
 * дублирующему стейту просто нечего было бы хранить.
 *
 * Единственный "переходный" локальный стейт — pendingAbility: heal/reaper
 * требуют второй тап (по карточке бегуна / по клетке доски) ПОСЛЕ дропа
 * кубика на зону, потому что бэк ждёт runnerId/positionX/positionY/segment
 * одним вызовом /ability, а не двумя отдельными шагами.
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
    // { ability: 'heal'|'reaper', diceIndex } — ждём второй тап (карточка/клетка), см. шапку файла
    const [pendingAbility, setPendingAbility] = useState(null);
    const [busy, setBusy] = useState(false);

    // По умолчанию — свой игрок, как только придут данные. Один раз (пока не выбран вручную).
    useEffect(() => {
        if (activePlayerId != null || gamePlayers.length === 0) return;
        const me = gamePlayers.find((p) => p.user?.id === user?.id);
        setActivePlayerId(me?.id ?? gamePlayers[0].id);
    }, [gamePlayers, user, activePlayerId]);

    const myPlayer = useMemo(() => gamePlayers.find((p) => p.user?.id === user?.id) ?? null, [gamePlayers, user]);
    const myTurn = !!myPlayer && game != null && String(game.playerOrder) === String(myPlayer.id);
    const myStep = myPlayer?.step;
    const myCollision = !!myPlayer && game?.extraTurnPlayer != null
        && String(game.extraTurnPlayer) === String(myPlayer.id);

    const activeRunner = useMemo(
        () => (myPlayer?.activeRunner != null ? runners.find((r) => r.id === myPlayer.activeRunner) : null),
        [runners, myPlayer?.activeRunner],
    );

    const players = useMemo(
        () =>
            gamePlayers.map((p, i) => ({
                id: p.id,
                name: p.user?.username ?? `Игрок ${p.id}`,
                color: PLAYER_COLORS[i % PLAYER_COLORS.length],
                dice: [p.dice1, p.dice2, p.dice3, p.dice4],
                ability: p.ability,
                activeRunnerId: p.activeRunner ?? null,
                runners: runners.filter((r) => r.playerId === p.id),
            })),
        [gamePlayers, runners],
    );

    const playerColorById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.color])), [players]);

    const gridData = useMemo(
        () => flattenTrackSegments([game?.trackBegin, game?.trackMiddle, game?.trackEnd], rows, cols),
        [game?.trackBegin, game?.trackMiddle, game?.trackEnd, rows, cols],
    );

    // Легальные клетки для тапа прямо сейчас — зависит от того, какой шаг идёт.
    // Одна и та же подсветка используется для MOVE/SHOOT/reaper-размещения/
    // первого выхода на трассу — GameBoardScreen решает, что означает тап,
    // handleCellPress ниже.
    const { highlightedCells, tapMode } = useMemo(() => {
        if (!myTurn || busy) return { highlightedCells: new Set(), tapMode: null };

        if (myStep === PLAYER_STEP.MOVE && activeRunner) {
            if (activeRunner.segment == null) {
                // Ещё не на трассе — любая клетка заднего края trackBegin (positionX=0)
                const cells = new Set();
                for (let positionY = 0; positionY <= 5; positionY++) {
                    cells.add(cellKey({ segment: 0, positionX: 0, positionY }));
                }
                return { highlightedCells: cells, tapMode: 'start' };
            }
            const neighbors = forwardNeighbors(activeRunner);
            return {
                highlightedCells: new Set(neighbors.map(cellKey)),
                tapMode: 'move',
            };
        }

        if (myStep === PLAYER_STEP.SHOOT && activeRunner) {
            const targets = forwardNeighbors(activeRunner).filter((pos) => {
                const occupant = findRunnerAt(runners, pos);
                return occupant && occupant.type !== RUNNER_TYPES.REAPER && !DEAD_STATUSES.includes(occupant.status);
            });
            return { highlightedCells: new Set(targets.map(cellKey)), tapMode: 'shoot' };
        }

        if (pendingAbility?.ability === 'reaper') {
            // Любая пустая проходимая клетка на всех трёх загруженных сегментах —
            // бэк это не проверяет (см. CLAUDE.md про ReaperService::validateCell),
            // так что и занятость, и проходимость (не wall/anomaly) считаем сами.
            const cells = new Set();
            for (let segment = 0; segment < totalBlocks; segment++) {
                for (let positionX = 0; positionX <= 7; positionX++) {
                    for (let positionY = 0; positionY <= 5; positionY++) {
                        const pos = { segment, positionX, positionY };
                        const type = rawCellType(game, segment, positionX, positionY);
                        if (type === 'wall' || type === 'anomaly') continue;
                        if (findRunnerAt(runners, pos)) continue;
                        cells.add(cellKey(pos));
                    }
                }
            }
            return { highlightedCells: cells, tapMode: 'reaper' };
        }

        return { highlightedCells: new Set(), tapMode: null };
    }, [myTurn, myStep, activeRunner, busy, pendingAbility, runners, totalBlocks, game]);

    const shotSound = useAudioPlayer(require('../assets/sounds/lazer.mp3'));

    const runAction = useCallback(async (fn) => {
        setBusy(true);
        try {
            await fn();
        } catch (e) {
            notify('Не удалось выполнить действие', e.userMessage ?? e.message);
        } finally {
            setBusy(false);
        }
    }, []);

    const handleCellPress = useCallback(
        (cell) => {
            shotSound.seekTo(0);
            shotSound.play();

            if (!tapMode) return;
            const key = cell.id; // "segment-row-col" = "segment-positionY-positionX", см. lib/board.js
            if (!highlightedCells.has(key)) return;

            if (tapMode === 'start') {
                runAction(() => runnerGameApi.move(cell.row, null));
                return;
            }
            if (tapMode === 'move') {
                const target = { segment: cell.blockIndex, positionX: cell.col - cell.blockIndex * cols, positionY: cell.row };
                const neighbor = forwardNeighbors(activeRunner).find((n) => cellKey(n) === cellKey(target));
                if (!neighbor) return;
                runAction(() => runnerGameApi.move(null, neighbor.direction));
                return;
            }
            if (tapMode === 'shoot') {
                const target = { segment: cell.blockIndex, positionX: cell.col - cell.blockIndex * cols, positionY: cell.row };
                const neighbor = forwardNeighbors(activeRunner).find((n) => cellKey(n) === cellKey(target));
                if (!neighbor) return;
                runAction(() => runnerGameApi.shoot(true, neighbor.direction));
                return;
            }
            if (tapMode === 'reaper' && pendingAbility) {
                const { diceIndex } = pendingAbility;
                const positionX = cell.col - cell.blockIndex * cols;
                const positionY = cell.row;
                runAction(() =>
                    runnerGameApi
                        .ability(true, {
                            ability: 'reaper',
                            dice: diceIndex + 1,
                            positionX,
                            positionY,
                            segment: cell.blockIndex,
                        })
                        .then(() => setPendingAbility(null)),
                );
            }
        },
        [shotSound, tapMode, highlightedCells, activeRunner, cols, pendingAbility, runAction],
    );

    // Дроп кубика на карточку бегуна — шаг SELECT.
    const handleDropOnRunner = useCallback(
        (playerId, runnerId, diceIndex) => {
            if (!myTurn || myStep !== PLAYER_STEP.SELECT || playerId !== myPlayer?.id) return;
            const runner = runners.find((r) => r.id === runnerId);
            if (!runner || runner.dice != null || DEAD_STATUSES.includes(runner.status)) return;
            runAction(() => runnerGameApi.select(runnerId, diceIndex + 1, 'DICE'));
        },
        [myTurn, myStep, myPlayer?.id, runners, runAction],
    );

    // Дроп кубика на зону усиления — шаг ABILITY. boost/ghost зовут API сразу
    // (бэк сам берёт activeRunner), heal/reaper ждут второй тап — см. handleCellPress
    // и handleHealTarget.
    const handleDropOnAbility = useCallback(
        (playerId, abilityKey, diceIndex) => {
            if (!myTurn || myStep !== PLAYER_STEP.ABILITY || playerId !== myPlayer?.id) return;
            if (abilityKey === 'heal' || abilityKey === 'reaper') {
                setPendingAbility({ ability: abilityKey, diceIndex });
                return;
            }
            runAction(() => runnerGameApi.ability(true, { ability: abilityKey, dice: diceIndex + 1 }));
        },
        [myTurn, myStep, myPlayer?.id, runAction],
    );

    // Тап по зоне усиления: во время pending — отмена, иначе (уже применена) — ничего не делаем.
    const handlePressAbilityZone = useCallback(
        (abilityKey) => {
            if (pendingAbility?.ability === abilityKey) setPendingAbility(null);
        },
        [pendingAbility],
    );

    // Тап по карточке бегуна: единственное значимое действие сейчас — выбор
    // цели для pending heal. Вне этого тап по карточке ничего не делает —
    // сам выбор бегуна для перемещения происходит дропом кубика (SELECT).
    const handleRunnerCardPress = useCallback(
        (runner) => {
            if (pendingAbility?.ability !== 'heal') return;
            if (runner.playerId !== myPlayer?.id) return; // лечить можно только своих бегунов
            // Лечение чинит НЕИСПРАВНОГО (broken) бегуна — это как раз его смысл (см. правила
            // "Если этот бегун был неисправен, он становится исправным"). Нельзя вылечить
            // только уничтоженного (destroyed) — этот статус необратим.
            if (runner.status === RUNNER_STATUS.DESTROYED) return;
            const { diceIndex } = pendingAbility;
            runAction(() =>
                runnerGameApi
                    .ability(true, { ability: 'heal', dice: diceIndex + 1, runnerId: runner.id })
                    .then(() => setPendingAbility(null)),
            );
        },
        [pendingAbility, runAction],
    );

    const handleShootSkip = useCallback(() => {
        runAction(() => runnerGameApi.shoot(false));
    }, [runAction]);

    const handleAbilitySkip = useCallback(() => {
        setPendingAbility(null);
        runAction(() => runnerGameApi.ability(false));
    }, [runAction]);

    const handleCollision = useCallback(
        (accept) => {
            runAction(() => runnerGameApi.collision(accept));
        },
        [runAction],
    );

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

    const showShootSkip = myTurn && myStep === PLAYER_STEP.SHOOT && !busy;
    const showAbilitySkip = myTurn && myStep === PLAYER_STEP.ABILITY && !busy && !pendingAbility;

    return (
        <View style={styles.wrapper}>
            <ParallaxBackground />

            {game.extraTurnPlayer != null && (
                <View style={styles.collisionBanner}>
                    <Text style={styles.collisionText}>
                        {myCollision ? 'Столкновение! Принять?' : 'Ожидаем реакцию игрока на столкновение…'}
                    </Text>
                    {myCollision && !busy && (
                        <>
                            <Button title="Принять" variant="success" onPress={() => handleCollision(true)} style={styles.collisionBtn} />
                            <Button title="Отклонить" variant="danger" onPress={() => handleCollision(false)} style={styles.collisionBtn} />
                        </>
                    )}
                    {!myCollision && showStuckRefresh && (
                        <Button title="Обновить состояние" variant="info" onPress={resync} style={styles.collisionBtn} />
                    )}
                </View>
            )}

            <PlayerInfoPanel
                players={players}
                activePlayerId={activePlayerId}
                onSelectPlayer={setActivePlayerId}
                myPlayerId={myPlayer?.id ?? null}
                canAct={myTurn && !busy}
                myStep={myStep}
                pendingAbility={pendingAbility}
                onDropOnAbility={handleDropOnAbility}
                onPressAbilityZone={handlePressAbilityZone}
                onDropOnRunner={handleDropOnRunner}
                onRunnerCardPress={handleRunnerCardPress}
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
                        selectedRunnerId={activeRunner?.id ?? null}
                        highlightedCells={highlightedCells}
                        onCellPress={handleCellPress}
                    />
                </RoadArea>

                <ArrowButton direction="right" size={arrowBtnSize} handlers={rightButtonProps} />
            </View>

            {showShootSkip && (
                <Button
                    title="Пропустить выстрел"
                    variant="muted"
                    onPress={handleShootSkip}
                    style={styles.shootSkip}
                />
            )}

            {showAbilitySkip && (
                <Button
                    title="Пропустить усиление"
                    variant="muted"
                    onPress={handleAbilitySkip}
                    style={styles.shootSkip}
                />
            )}
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
    shootSkip: {
        position: 'absolute', bottom: spacing.md, alignSelf: 'center', zIndex: 20, elevation: 20,
        minHeight: 40, paddingHorizontal: spacing.lg,
    },
});
