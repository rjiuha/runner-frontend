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
    onEndTurn,
    width,
}) {
    const activePlayer = players.find((p) => p.id === activePlayerId) ?? players[0];
    const assignments = diceAssignments[activePlayer.id] ?? {};
    const assignedIndices = useMemo(
        () => new Set(Object.values(assignments).filter((v) => v != null)),
        [assignments],
    );
    const trayDice = activePlayer.dice.map((v, i) => (assignedIndices.has(i) ? null : v));

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

    const handleDragMove = useCallback(
        (_index, x, y, value) => {
            const key = findZoneAt(x, y);
            if (!key) {
                setHover((h) => (h.key === null ? h : { key: null, valid: false }));
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
            const ability = PLAYER_ABILITIES[key];
            if (value < ability.min || value > ability.max) return; // не по правилам — дроп просто не принимается
            onAssignDice(activePlayer.id, key, index);
        },
        [findZoneAt, onAssignDice, activePlayer.id],
    );

    const trackedRunners = useMemo(
        () => RUNNER_ORDER.map((type) => activePlayer.runners.find((r) => r.type === type)).filter(Boolean),
        [activePlayer.runners],
    );
    const reaper = useMemo(
        () => activePlayer.runners.find((r) => r.type === RUNNER_TYPES.REAPER),
        [activePlayer.runners],
    );

    return (
        <View style={[styles.panel, { width }]}>
            <PlayerSwitcher
                players={players.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
                activeId={activePlayer.id}
                onSelect={onSelectPlayer}
            />

            <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

                <Text style={styles.sectionTitle}>Бегуны</Text>
                {trackedRunners.map((runner) => (
                    <RunnerCard
                        key={runner.id}
                        runner={runner}
                        color={activePlayer.color}
                        selected={runner.id === selectedRunnerId}
                        onPress={() => onSelectRunner(runner.id === selectedRunnerId ? null : runner.id)}
                    />
                ))}

                {reaper && (
                    <TouchableOpacity
                        style={styles.reaperRow}
                        activeOpacity={0.8}
                        onPress={() => onSelectRunner(reaper.id === selectedRunnerId ? null : reaper.id)}
                    >
                        <RunnerToken
                            type={RUNNER_TYPES.REAPER}
                            color={activePlayer.color}
                            size={30}
                            selected={reaper.id === selectedRunnerId}
                        />
                        <Text style={styles.reaperText}>
                            Жнец {reaper.segment != null ? '— на поле' : '— в резерве, нажми клетку'}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

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
    scrollFlex: { flex: 1 },
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
    reaperText: { color: colors.textOnDark, fontSize: font.small, marginLeft: spacing.sm, flex: 1 },
    endTurn: { marginTop: spacing.sm },
});
