// src/components/game/PlayerInfoPanel.js
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PlayerSwitcher from './PlayerSwitcher';
import DiceTray from './DiceTray';
import AbilityZones from './AbilityZones';
import RunnerCard from './RunnerCard';
import RunnerToken from './RunnerToken';
import Button from '../ui/Button';
import { PLAYER_ABILITIES, RUNNER_ORDER, RUNNER_TYPES } from '../../constants/GameConstants';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Левая панель: переключатель игроков, кубики активного игрока, зоны
 * усилений (перетаскивание кубика) и карточки бегунов. Хит-тестинг
 * перетаскивания (какая зона под пальцем и подходит ли ей текущий кубик)
 * живёт здесь: зоны измеряют себя через measureInWindow и репортят сюда,
 * а DiceDie шлёт сюда координаты жеста в оконных же координатах.
 *
 * Наружу панель только сообщает о результате (onAssignDice/onUnassignDice/
 * onSelectRunner/onEndTurn) — какое состояние из этого следует, решает
 * GameBoardScreen.
 */
export default function PlayerInfoPanel({
    players,
    activePlayerId,
    onSelectPlayer,
    selectedRunnerId,
    onSelectRunner,
    diceAssignments,
    onAssignDice,
    onUnassignDice,
    moveAssignments,
    onAssignMove,
    onUnassignMove,
    onEndTurn,
    width,
    switcherHeight,
}) {
    const activePlayer = players.find((p) => p.id === activePlayerId) ?? players[0];
    const assignments = diceAssignments[activePlayer.id] ?? {};
    const playerMoves = moveAssignments[activePlayer.id] ?? {};
    const assignedIndices = useMemo(
        () => new Set(Object.values(assignments).filter((v) => v != null)),
        [assignments],
    );
    const assignedMoveIndices = useMemo(() => new Set(Object.values(playerMoves).flat()), [playerMoves]);
    const trayDice = activePlayer.dice.map((v, i) =>
        assignedIndices.has(i) || assignedMoveIndices.has(i) ? null : v,
    );

    const zoneLayoutsRef = useRef({});
    const [hover, setHover] = useState({ key: null, valid: false });

    const findZoneAt = useCallback((x, y) => {
        for (const [key, rect] of Object.entries(zoneLayoutsRef.current)) {
            if (!rect) continue;
            if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
                return key;
            }
        }
        return null;
    }, []);

    const handleMeasured = useCallback((key, rect) => {
        zoneLayoutsRef.current[key] = rect;
    }, []);

    // Зоны кубика хода на карточках бегунов ("move:<runnerId>") мерятся и
    // хит-тестятся тем же реестром, что и зоны усилений — правил на номинал
    // кубика у них нет (любой кубик годится любому бегуну), поэтому наведение
    // всегда "valid".
    const handleDragMove = useCallback(
        (_index, x, y, value) => {
            const key = findZoneAt(x, y);
            if (!key) {
                setHover((h) => (h.key === null ? h : { key: null, valid: false }));
                return;
            }
            if (key.startsWith('move:')) {
                setHover((h) => (h.key === key && h.valid ? h : { key, valid: true }));
                return;
            }
            const ability = PLAYER_ABILITIES[key];
            const valid = value >= ability.min && value <= ability.max;
            setHover((h) => (h.key === key && h.valid === valid ? h : { key, valid }));
        },
        [findZoneAt],
    );

    const handleDrop = useCallback(
        (index, x, y, value) => {
            setHover({ key: null, valid: false });
            const key = findZoneAt(x, y);
            if (!key) return;

            if (key.startsWith('move:')) {
                const runnerId = Number(key.slice('move:'.length));
                onAssignMove(activePlayer.id, runnerId, index);
                return;
            }

            const ability = PLAYER_ABILITIES[key];
            if (value < ability.min || value > ability.max) return; // не по правилам — дроп просто не принимается
            onAssignDice(activePlayer.id, key, index);
        },
        [findZoneAt, onAssignDice, onAssignMove, activePlayer.id],
    );

    const trackedRunners = useMemo(
        () => RUNNER_ORDER.map((type) => activePlayer.runners.find((r) => r.type === type)).filter(Boolean),
        [activePlayer.runners],
    );
    const reaper = useMemo(
        () => activePlayer.runners.find((r) => r.type === RUNNER_TYPES.REAPER),
        [activePlayer.runners],
    );
    // Жнеца можно размещать на любую клетку поля, но само это действие
    // доступно только пока на усилении активирован Жнец (кубик лежит в
    // зоне "reaper") — иначе выбор бегуна для тап-плейсмента заблокирован.
    const reaperActive = assignments.reaper != null;

    return (
        <View style={[styles.panel, { width }]}>
            <View style={styles.body}>
                <View style={[styles.switcherBox, { height: switcherHeight }]}>
                    <PlayerSwitcher
                        players={players.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
                        activeId={activePlayer.id}
                        onSelect={onSelectPlayer}
                    />
                </View>

                <ScrollView
                    style={styles.infoColumn}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.name}>{activePlayer.name}</Text>

                    <Text style={styles.sectionTitle}>Кубики перемещения</Text>
                    <DiceTray dice={trayDice} onDragMove={handleDragMove} onDrop={handleDrop} />

                    <Text style={styles.sectionTitle}>Усиления — перетащи кубик на зону</Text>
                    <AbilityZones
                        assignments={assignments}
                        hoverKey={hover.key}
                        hoverValid={hover.valid}
                        onMeasured={handleMeasured}
                        onPressZone={(key) => onUnassignDice(activePlayer.id, key)}
                    />

                    <Text style={styles.sectionTitle}>Бегуны — перетащи кубик хода на бегуна (лишний кубик = накат)</Text>
                    {trackedRunners.map((runner) => {
                        const moveIndices = playerMoves[runner.id] ?? [];
                        const moveDiceValues = moveIndices.map((diceIndex) => ({
                            diceIndex,
                            value: activePlayer.dice[diceIndex],
                        }));
                        const zoneKey = `move:${runner.id}`;
                        return (
                            <RunnerCard
                                key={runner.id}
                                runner={runner}
                                color={activePlayer.color}
                                selected={runner.id === selectedRunnerId}
                                onPress={() => onSelectRunner(runner.id === selectedRunnerId ? null : runner.id)}
                                moveDiceValues={moveDiceValues}
                                moveHoverState={hover.key === zoneKey ? (hover.valid ? 'valid' : 'invalid') : null}
                                onMoveDiceMeasured={handleMeasured}
                                onRemoveMoveDice={(diceIndex) => onUnassignMove(activePlayer.id, runner.id, diceIndex)}
                            />
                        );
                    })}

                    {reaper && (
                        <TouchableOpacity
                            style={[styles.reaperRow, !reaperActive && styles.reaperRowDisabled]}
                            activeOpacity={reaperActive ? 0.8 : 1}
                            disabled={!reaperActive}
                            onPress={() => onSelectRunner(reaper.id === selectedRunnerId ? null : reaper.id)}
                        >
                            <RunnerToken
                                type={RUNNER_TYPES.REAPER}
                                color={activePlayer.color}
                                size={30}
                                selected={reaper.id === selectedRunnerId}
                            />
                            <Text style={styles.reaperText}>
                                {reaperActive
                                    ? `Жнец ${reaper.segment != null ? '— на поле, нажми клетку для переноса' : '— нажми любую клетку поля'}`
                                    : 'Жнец — сначала перетащи кубик на усиление «Жнец»'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </View>

            <Button title="Завершить ход" onPress={onEndTurn} style={styles.endTurn} />
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        backgroundColor: '#00000055',
        borderRadius: radius.lg,
        padding: spacing.md,
    },
    // Переключатель игроков остаётся НАД зоной информации (вертикальный стек
    // секций, не колонки рядом). Высота switcherBox — ФИКСИРОВАННЫЙ пиксельный
    // размер (switcherHeight, ~15% высоты окна — см. useBoardLayout.switcherH),
    // а не flex-пропорция: на вебе цепочка height:100% от корня навигатора до
    // панели рвётся (обычная проблема RN Web без явного height на каждом
    // уровне), из-за чего flex:1/flex:4 между switcherBox и infoColumn не
    // распределялся как задумано и переключатель расползался почти на пол-
    // экрана. Фиксированный пиксель не зависит от этой цепочки. infoColumn
    // забирает flex:1 — весь остаток, какой бы он ни оказался.
    body: { flex: 1, flexDirection: 'column' },
    switcherBox: { justifyContent: 'center' },
    infoColumn: { flex: 1, marginTop: spacing.xs },
    scrollContent: { paddingBottom: spacing.md },
    name: { color: colors.textOnDark, fontSize: font.h3, fontWeight: 'bold', marginTop: spacing.sm },
    sectionTitle: {
        color: colors.textOnDarkSecondary,
        fontSize: font.tiny,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
    },
    reaperRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
    reaperRowDisabled: { opacity: 0.45 },
    reaperText: { color: colors.textOnDark, fontSize: font.small, marginLeft: spacing.sm, flex: 1 },
    endTurn: { marginTop: spacing.sm },
});
