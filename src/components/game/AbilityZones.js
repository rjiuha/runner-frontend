// src/components/game/AbilityZones.js
import React from 'react';
import { StyleSheet, View } from 'react-native';
import AbilityZone from './AbilityZone';
import { PLAYER_ABILITY_ORDER } from '../../constants/GameConstants';
import { spacing } from '../../theme';

/**
 * 4 зоны усилений (Буст/Лечение/Жнец/Призрак) в сетке 2×2.
 *
 * `pulseKeys` (2026-09-14, по прямому запросу пользователя) — Set ключей
 * усилений, которые нужно подсветить "дышащей" рамкой ПРЯМО СЕЙЧАС (см.
 * AbilityZone#pulseHighlight) — PlayerInfoPanel сам решает, пуст он или нет
 * (пока не тащат кубик — пуст, во время драга — ключи, чей min/max подходит
 * под конкретное перетаскиваемое значение).
 */
export default function AbilityZones({
    assignments,
    hoverKey,
    hoverValid,
    onMeasured,
    onPressZone,
    remeasureTick,
    compact = false,
    color,
    pulseKeys = null,
}) {
    return (
        <View style={styles.grid}>
            {PLAYER_ABILITY_ORDER.map((key) => (
                <AbilityZone
                    key={key}
                    abilityKey={key}
                    assignedDice={assignments[key] ?? null}
                    hoverState={hoverKey === key ? (hoverValid ? 'valid' : 'invalid') : null}
                    onMeasured={onMeasured}
                    // Стабильная ссылка, НЕ инлайн-замыкание — 2026-09-19,
                    // см. докстринг RunnerCard.js#React.memo. AbilityZone
                    // сам передаёт свой abilityKey наружу (см. её handlePress).
                    onPress={onPressZone}
                    remeasureTick={remeasureTick}
                    compact={compact}
                    color={color}
                    pulseHighlight={!!pulseKeys?.has(key)}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: spacing.xs,
    },
});
