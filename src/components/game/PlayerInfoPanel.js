// src/components/game/PlayerInfoPanel.js
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import PlayerSwitcher from './PlayerSwitcher';
import DiceTray from './DiceTray';
import AbilityZones from './AbilityZones';
import RunnerCard from './RunnerCard';
import RunnerToken from './RunnerToken';
import { PLAYER_ABILITIES, PLAYER_STEP, RUNNER_ORDER, RUNNER_TYPES } from '../../constants/GameConstants';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Левая панель: переключатель игроков, кубики активного игрока, зоны
 * усилений (перетаскивание кубика) и карточки бегунов. Хит-тестинг
 * перетаскивания (какая зона под пальцем и подходит ли ей текущий кубик)
 * живёт здесь: зоны измеряют себя через measureInWindow и репортят сюда,
 * а DiceDie шлёт сюда координаты жеста в оконных же координатах.
 *
 * "Что назначено" панель НЕ хранит сама — читает прямо из live-данных
 * (runner.dice/player.ability/player.diceN), которые GameBoardScreen строит
 * из game (см. Фазу 2 в CLAUDE.md). Наружу панель только сообщает НАМЕРЕНИЕ
 * (onDropOnAbility/onDropOnRunner/onRunnerCardPress/onPressAbilityZone) —
 * вызывать бэк или нет решает GameBoardScreen.
 */
export default function PlayerInfoPanel({
    players,
    activePlayerId,
    onSelectPlayer,
    myPlayerId,
    canAct,
    myStep,
    pendingAbility,
    pendingSelect,
    canSelectRunner,
    onDropOnAbility,
    onPressAbilityZone,
    onDropOnRunner,
    onRunnerCardPress,
    width,
    switcherHeight,
}) {
    const activePlayer = players.find((p) => p.id === activePlayerId) ?? players[0];
    const isMyPanel = canAct && activePlayer.id === myPlayerId;
    // Что можно тащить прямо сейчас: SELECT — на карточку бегуна, ABILITY — на зону усиления.
    const dragMode = isMyPanel
        ? myStep === PLAYER_STEP.SELECT
            ? 'select'
            : myStep === PLAYER_STEP.ABILITY
                ? 'ability'
                : null
        : null;

    // Кубик, зарезервированный под pending heal/reaper/select, ещё не consumed
    // бэком (реальный вызов уйдёт только после подтверждения/второго тапа) —
    // визуально прячем его из трея пораньше, чтобы не тащили дважды. Актуально
    // только для СВОЕЙ панели — pending-стейты относятся к myPlayer, не к тому,
    // чью панель сейчас листают через переключатель.
    const trayDice = activePlayer.dice.map((v, i) =>
        isMyPanel && (pendingAbility?.diceIndex === i || pendingSelect?.diceIndex === i) ? null : v,
    );

    const abilityAssignments = useMemo(() => {
        const map = {};
        for (const key of Object.keys(PLAYER_ABILITIES)) {
            if (isMyPanel && pendingAbility?.ability === key) map[key] = pendingAbility.diceIndex;
            else if (activePlayer.ability === key) map[key] = 'used';
            else map[key] = null;
        }
        return map;
    }, [isMyPanel, pendingAbility, activePlayer.ability]);

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
    // всегда "valid", но только пока разрешён drag-режим 'select'.
    const handleDragMove = useCallback(
        (_index, x, y, value) => {
            if (!dragMode) return;
            const key = findZoneAt(x, y);
            if (!key) {
                setHover((h) => (h.key === null ? h : { key: null, valid: false }));
                return;
            }
            if (key.startsWith('move:')) {
                const runnerId = Number(key.slice('move:'.length));
                const valid = dragMode === 'select' && canSelectRunner(runnerId);
                setHover((h) => (h.key === key && h.valid === valid ? h : { key, valid }));
                return;
            }
            if (dragMode !== 'ability') {
                setHover((h) => (h.key === key && h.valid === false ? h : { key, valid: false }));
                return;
            }
            const ability = PLAYER_ABILITIES[key];
            const valid = value >= ability.min && value <= ability.max;
            setHover((h) => (h.key === key && h.valid === valid ? h : { key, valid }));
        },
        [findZoneAt, dragMode, canSelectRunner],
    );

    const handleDrop = useCallback(
        (index, x, y, value) => {
            setHover({ key: null, valid: false });
            if (!dragMode) return;
            const key = findZoneAt(x, y);
            if (!key) return;

            if (key.startsWith('move:')) {
                if (dragMode !== 'select') return;
                const runnerId = Number(key.slice('move:'.length));
                onDropOnRunner(activePlayer.id, runnerId, index);
                return;
            }

            if (dragMode !== 'ability') return;
            const ability = PLAYER_ABILITIES[key];
            if (value < ability.min || value > ability.max) return; // не по правилам — дроп просто не принимается
            onDropOnAbility(activePlayer.id, key, index);
        },
        [findZoneAt, dragMode, onDropOnRunner, onDropOnAbility, activePlayer.id],
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
                    <DiceTray
                        dice={trayDice}
                        draggable={dragMode != null}
                        onDragMove={handleDragMove}
                        onDrop={handleDrop}
                    />

                    <Text style={styles.sectionTitle}>Усиления — перетащи кубик на зону</Text>
                    <AbilityZones
                        assignments={abilityAssignments}
                        hoverKey={hover.key}
                        hoverValid={hover.valid}
                        onMeasured={handleMeasured}
                        onPressZone={onPressAbilityZone}
                    />

                    <Text style={styles.sectionTitle}>Бегуны — перетащи кубик хода на бегуна</Text>
                    {trackedRunners.map((runner) => {
                        const zoneKey = `move:${runner.id}`;
                        const isPending = isMyPanel && pendingSelect?.runnerId === runner.id;
                        // Пока выбор не подтверждён, кубик ещё не consumed бэком (runner.dice
                        // не менялся) — берём значение из трея игрока по индексу pendingSelect.
                        const dice = isPending
                            ? activePlayer.dice[pendingSelect.diceIndex]
                            : runner.dice ?? runner.rollDice ?? null;
                        return (
                            <RunnerCard
                                key={runner.id}
                                runner={runner}
                                color={activePlayer.color}
                                active={runner.id === activePlayer.activeRunnerId}
                                pending={isPending}
                                healTarget={isMyPanel && pendingAbility?.ability === 'heal'}
                                onPress={() => onRunnerCardPress(runner)}
                                moveDiceValue={dice}
                                moveHoverState={hover.key === zoneKey ? (hover.valid ? 'valid' : 'invalid') : null}
                                onMoveDiceMeasured={handleMeasured}
                            />
                        );
                    })}

                    {reaper && (
                        <View style={styles.reaperRow}>
                            <RunnerToken
                                type={RUNNER_TYPES.REAPER}
                                color={activePlayer.color}
                                size={30}
                                selected={reaper.id === activePlayer.activeRunnerId}
                            />
                            <Text style={styles.reaperText}>
                                {reaper.segment != null ? 'Жнец — на поле' : 'Жнец — в резерве'}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </View>
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
    reaperText: { color: colors.textOnDark, fontSize: font.small, marginLeft: spacing.sm, flex: 1 },
});
