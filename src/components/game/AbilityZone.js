// src/components/game/AbilityZone.js
import React, { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PLAYER_ABILITIES } from '../../constants/GameConstants';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Зона-цель для перетаскивания кубика. Сама зона не решает, подходит ли ей
 * кубик, — только измеряет себя в оконных координатах (measureInWindow) и
 * подсвечивается по hoverState, который считает PlayerInfoPanel.
 * Тап по уже занятой зоне снимает с неё кубик обратно в трей.
 */
export default function AbilityZone({ abilityKey, assignedDice, hoverState, onMeasured, onPress }) {
    const ref = useRef(null);
    const ability = PLAYER_ABILITIES[abilityKey];

    const measure = () => {
        ref.current?.measureInWindow((x, y, width, height) => {
            onMeasured(abilityKey, { x, y, width, height });
        });
    };

    const filled = assignedDice != null;
    const highlight =
        hoverState === 'valid' ? styles.hoverValid : hoverState === 'invalid' ? styles.hoverInvalid : null;

    return (
        <TouchableOpacity
            ref={ref}
            onLayout={measure}
            onPress={filled ? onPress : undefined}
            activeOpacity={filled ? 0.7 : 1}
            style={[styles.zone, filled && styles.zoneFilled, highlight]}
        >
            <Text style={styles.label}>{ability.label}</Text>
            <Text style={styles.hint}>{ability.hint}</Text>
            <Text style={styles.value}>{filled ? ability.min === ability.max ? ability.min : '✓' : '—'}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    zone: {
        width: '48%',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.textOnDarkSecondary,
        borderRadius: radius.md,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    zoneFilled: {
        borderStyle: 'solid',
        borderColor: colors.primary,
        backgroundColor: colors.primaryTranslucent,
    },
    hoverValid: { borderColor: colors.success, borderStyle: 'solid', backgroundColor: `${colors.success}33` },
    hoverInvalid: { borderColor: colors.danger, borderStyle: 'solid', backgroundColor: `${colors.danger}22` },
    label: { color: colors.textOnDark, fontSize: font.small, fontWeight: 'bold' },
    hint: { color: colors.textOnDarkSecondary, fontSize: 10, marginTop: 1 },
    value: { color: colors.textOnDark, fontSize: font.small, fontWeight: 'bold', marginTop: 2 },
});
