// src/screens/DevPlaygroundScreen.js
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ArrowButton from '../components/game/ArrowButton';
import RoadArea from '../components/game/RoadArea';
import BoardGrid from '../components/game/BoardGrid';
import PlayerInfoPanel from '../components/game/PlayerInfoPanel';
import EventLogPanel from '../components/game/EventLogPanel';
import DiceRollOverlay, { DICE_ROLL_SEQUENCE_MS } from '../components/game/DiceRollOverlay';
import ParallaxBackground from '../components/ui/ParallaxBackground';
import Button from '../components/ui/Button';
import { useAdaptiveOrientation } from '../hooks/useAdaptiveOrientation';
import { ROAD_AREA_SPACING, useBoardLayout } from '../hooks/useBoardLayout';
import { useBoardScroll } from '../hooks/useBoardScroll';
import { flattenTrackSegments } from '../lib/board';
import { describeEvent, rawEventFallback } from '../lib/eventLog';
import { runnerGameReducer } from '../store/runnerGameReducer';
import { normalizeRunnerGame } from '../api/normalize';
import { MOCK_GAME } from '../constants/mockGameData';
import { BOARD_LAYOUT, PLAYER_COLOR_HEX, PLAYER_COLORS } from '../constants/GameConstants';
import { colors, spacing, font, radius } from '../theme';

const EMPTY_SET = new Set();

/**
 * Полигон для проверки визуальных изменений экрана партии БЕЗ бэка и без
 * реальной игры (см. обсуждение в чате — не хотим каждый раз гонять 2
 * аккаунта + докер + реальные ходы ради проверки одной анимации).
 *
 * Сидируется MOCK_GAME (тот же мок, что раньше питал GameBoardScreen до
 * Фазы 1, см. constants/mockGameData.js) — панель "Mock-события" внизу
 * шлёт события ЧЕРЕЗ runnerGameReducer, ТОТ ЖЕ редьюсер, что в проде
 * (useMercure.reduce) — то, что видно тут на конкретное событие,
 * гарантированно совпадает с тем, что будет на реальном экране на то же
 * событие, потому что это буквально тот же код.
 *
 * **Чего тут НЕТ осознанно**: drag-and-drop/тапы по доске не вызывают
 * никакой логики (myStep=null, canAct=false — панель в режиме просмотра).
 * Разворачивать полноценный локальный движок правил (select/move/shoot/
 * ability со всеми валидациями) — отдельная, намного большая задача, и не
 * она тут нужна: цель полигона — смотреть, как рендерится ОДНО конкретное
 * событие в изоляции, а не играть партию. Переключение вкладок игроков
 * (PlayerSwitcher) работает как обычно — это чистый локальный UI-стейт,
 * бэк тут ни при чём.
 *
 * Только __DEV__ (см. RootNavigator — Stack.Screen зарегистрирован только
 * в дев-сборке, кнопка входа на MainMenuScreen — тоже).
 */
export default function DevPlaygroundScreen() {
    useAdaptiveOrientation();
    const insets = useSafeAreaInsets();

    const [game, setGame] = useState(() => normalizeRunnerGame(MOCK_GAME));
    const [eventLog, setEventLog] = useState([]);

    // Триггер DiceRollOverlay (крупное окошко броска) + точка прилёта в трей
    // текущего игрока (см. PlayerInfoPanel.onDiceTrayMeasured).
    const [rollTrigger, setRollTrigger] = useState(null);
    const [diceTrayRect, setDiceTrayRect] = useState(null);
    const [rollingAll, setRollingAll] = useState(false);
    const rollNonceRef = useRef(0);

    const dispatch = useCallback((e) => {
        const text = describeEvent(e) ?? rawEventFallback(e);
        const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: new Date().toLocaleTimeString(), text };
        setEventLog((log) => (log.length >= 200 ? [...log.slice(1), entry] : [...log, entry]));
        setGame((g) => runnerGameReducer(g, e));
    }, []);

    const {
        orientation, leftPanelW, panelH, arrowBtnSize, switcherH,
        roadContainerW, roadContainerH, segmentW, segmentH, minOffset, rows, cols, totalBlocks,
    } = useBoardLayout();
    const isPortrait = orientation === 'portrait';

    const { offset, containerHandlers, backButtonProps, forwardButtonProps } = useBoardScroll({
        minOffset,
        segmentSize: isPortrait ? segmentH : segmentW,
        axis: isPortrait ? 'y' : 'x',
        cols,
        totalBlocks,
        webScrollSpeed: BOARD_LAYOUT.WEB_SCROLL_SPEED,
    });

    const runners = game?.runners ?? [];
    const gamePlayers = game?.gamePlayers ?? [];

    const [activePlayerId, setActivePlayerId] = useState(gamePlayers[0]?.id ?? null);

    const players = useMemo(
        () =>
            gamePlayers.map((p, i) => ({
                id: p.id,
                name: p.user?.username ?? `Игрок ${p.id}`,
                color: PLAYER_COLOR_HEX[p.color] ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
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

    const noop = useCallback(() => {}, []);
    const alwaysFalse = useCallback(() => false, []);

    const activePlayer = players.find((p) => p.id === activePlayerId) ?? null;

    // Общий шаг для одной кнопки и для последовательности "все по очереди" —
    // собирает и диспатчит player_roll_move_dice + взводит DiceRollOverlay
    // для КОНКРЕТНОГО игрока (не обязательно текущей вкладки).
    const rollForPlayer = useCallback(
        (player) => {
            const color = players.find((p) => p.id === player.id)?.color;
            const values = [
                1 + Math.floor(Math.random() * 6),
                1 + Math.floor(Math.random() * 6),
                1 + Math.floor(Math.random() * 6),
                1 + Math.floor(Math.random() * 6),
            ];
            rollNonceRef.current += 1;
            dispatch({
                event: 'player_roll_move_dice',
                version: rollNonceRef.current,
                player: { id: player.id, dice_1: values[0], dice_2: values[1], dice_3: values[2], dice_4: values[3] },
            });
            setRollTrigger({ nonce: rollNonceRef.current, values, color });
        },
        [players, dispatch],
    );

    // "Все по очереди" — переключает вкладку на каждого игрока и запускает
    // его бросок, дожидаясь DICE_ROLL_SEQUENCE_MS (полный цикл окошка,
    // экспортирован из DiceRollOverlay, не подобран на глаз) перед
    // следующим — имитирует, как будто Mercure-события идут одно за другим,
    // а не сваливаются все разом.
    const rollAllInOrder = useCallback(async () => {
        if (rollingAll) return;
        setRollingAll(true);
        for (const player of gamePlayers) {
            setActivePlayerId(player.id);
            rollForPlayer(player);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, DICE_ROLL_SEQUENCE_MS));
        }
        setRollingAll(false);
    }, [rollingAll, gamePlayers, rollForPlayer]);

    // Кнопки полигона. Добавлять новое одиночное mock-событие — новая
    // запись здесь, ничего больше трогать не нужно.
    const mockActions = useMemo(
        () => [
            {
                label: '🎲 Бросить кубики текущему игроку',
                run: () => activePlayer && rollForPlayer(activePlayer),
                disabled: rollingAll,
            },
            {
                label: '🎲 Бросить всем по очереди',
                run: rollAllInOrder,
                loading: rollingAll,
            },
        ],
        [activePlayer, rollForPlayer, rollAllInOrder, rollingAll],
    );

    if (!game) return null;

    return (
        <View style={[styles.wrapper, isPortrait && styles.wrapperPortrait]}>
            <ParallaxBackground />

            <View style={[styles.devBadge, { top: insets.top + spacing.sm }]}>
                <Text style={styles.devBadgeText}>🧪 ПОЛИГОН — мок-данные, без бэка</Text>
            </View>

            {!isPortrait && (
                <PlayerInfoPanel
                    players={players}
                    activePlayerId={activePlayerId}
                    onSelectPlayer={setActivePlayerId}
                    myPlayerId={null}
                    canAct={false}
                    myStep={null}
                    pendingAbility={null}
                    pendingSelect={null}
                    canSelectRunner={alwaysFalse}
                    onDropOnAbility={noop}
                    onPressAbilityZone={noop}
                    onDropOnRunner={noop}
                    onRunnerCardPress={noop}
                    width={leftPanelW}
                    switcherHeight={switcherH}
                    onDiceTrayMeasured={setDiceTrayRect}
                />
            )}

            <View
                style={[
                    isPortrait ? styles.roadZonePortrait : styles.roadZone,
                    isPortrait && { paddingTop: insets.top },
                ]}
            >
                <ArrowButton
                    direction={isPortrait ? 'up' : 'left'}
                    size={arrowBtnSize}
                    handlers={isPortrait ? forwardButtonProps : backButtonProps}
                />

                <RoadArea spacing={ROAD_AREA_SPACING} backgroundColor="#3a034b00">
                    <BoardGrid
                        gridData={gridData}
                        rows={rows}
                        cols={cols}
                        segmentW={segmentW}
                        segmentH={segmentH}
                        offset={offset}
                        orientation={orientation}
                        containerHandlers={containerHandlers}
                        containerWidth={roadContainerW}
                        containerHeight={roadContainerH}
                        runners={runners}
                        playerColorById={playerColorById}
                        selectedRunnerId={null}
                        highlightedCells={EMPTY_SET}
                        onCellPress={noop}
                    />
                </RoadArea>

                <ArrowButton
                    direction={isPortrait ? 'down' : 'right'}
                    size={arrowBtnSize}
                    handlers={isPortrait ? backButtonProps : forwardButtonProps}
                />
            </View>

            {isPortrait && (
                <PlayerInfoPanel
                    players={players}
                    activePlayerId={activePlayerId}
                    onSelectPlayer={setActivePlayerId}
                    myPlayerId={null}
                    canAct={false}
                    myStep={null}
                    pendingAbility={null}
                    pendingSelect={null}
                    canSelectRunner={alwaysFalse}
                    onDropOnAbility={noop}
                    onPressAbilityZone={noop}
                    onDropOnRunner={noop}
                    onRunnerCardPress={noop}
                    height={panelH}
                    switcherHeight={switcherH}
                    switcherAtBottom
                    compactColumns
                    onDiceTrayMeasured={setDiceTrayRect}
                />
            )}

            <View style={[styles.controlPanel, { top: insets.top + spacing.sm }]}>
                {mockActions.map((a) => (
                    <Button
                        key={a.label}
                        title={a.label}
                        variant="info"
                        onPress={a.run}
                        disabled={a.disabled}
                        loading={a.loading}
                        style={styles.controlBtn}
                    />
                ))}
            </View>

            <EventLogPanel entries={eventLog} position={isPortrait ? 'top' : 'bottom-right'} />

            <DiceRollOverlay
                trigger={rollTrigger}
                destRect={diceTrayRect}
                onDone={() => setRollTrigger(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
    wrapperPortrait: { flexDirection: 'column' },
    roadZone: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    roadZonePortrait: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' },
    devBadge: {
        position: 'absolute', left: spacing.md, zIndex: 20, elevation: 20,
        backgroundColor: colors.danger, borderRadius: radius.pill,
        paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    },
    devBadgeText: { color: colors.textOnDark, fontSize: font.tiny, fontWeight: 'bold' },
    controlPanel: {
        position: 'absolute', right: spacing.md, zIndex: 20, elevation: 20, gap: spacing.xs, maxWidth: 260,
    },
    controlBtn: { minHeight: 36, paddingHorizontal: spacing.md },
});
