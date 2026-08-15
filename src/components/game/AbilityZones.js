// src/components/game/AbilityZones.js
import React from 'react';
import { StyleSheet, View } from 'react-native';
import AbilityZone from './AbilityZone';
import { PLAYER_ABILITY_ORDER } from '../../constants/GameConstants';
import { spacing } from '../../theme';

/** 4 зоны усилений (Буст/Лечение/Жнец/Призрак) в сетке 2×2. */
export default function AbilityZones({ assignments, hoverKey, hoverValid, onMeasured, onPressZone, remeasureTick }) {
    return (
        <View style={styles.grid}>
            {PLAYER_ABILITY_ORDER.map((key) => (
                <AbilityZone
                    key={key}
                    abilityKey={key}
                    assignedDice={assignments[key] ?? null}
                    hoverState={hoverKey === key ? (hoverValid ? 'valid' : 'invalid') : null}
                    onMeasured={onMeasured}
                    onPress={() => onPressZone(key)}
                    remeasureTick={remeasureTick}
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
