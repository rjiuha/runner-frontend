// src/components/game/RunnerDiceSlot.js
import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Зона на карточке бегуна для перетаскивания кубика хода (шаг SELECT).
 * Значение приходит с бэка (runner.dice/rollDice) — как только SELECT
 * реально прошёл, кубик "занят" на сервере, снять его тут нельзя (в отличие
 * от зон усилий это не pending-стейт, а уже подтверждённое действие). Сама
 * зона не решает правила (любой кубик подходит любому бегуну), только
 * измеряет себя через measureInWindow для хит-тестинга в PlayerInfoPanel.
 */
export default function RunnerDiceSlot({ zoneKey, value, hoverState, onMeasured }) {
    const ref = useRef(null);

    const measure = () => {
        ref.current?.measureInWindow((x, y, width, height) => {
            onMeasured(zoneKey, { x, y, width, height });
        });
    };

    const highlight = hoverState === 'valid' ? styles.hover : null;

    return (
        <View ref={ref} onLayout={measure} style={[styles.slot, value != null && styles.slotFilled, highlight]}>
            {value == null ? (
                <Text style={styles.placeholder}>кубик хода</Text>
            ) : (
                <View style={styles.chip}>
                    <Text style={styles.chipText}>{value}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    slot: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 60,
        minHeight: 28,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.textOnDarkSecondary,
        borderRadius: radius.md,
        paddingHorizontal: 4,
    },
    slotFilled: { borderStyle: 'solid', borderColor: colors.primary },
    hover: { borderColor: colors.success, backgroundColor: `${colors.success}33` },
    placeholder: { color: colors.textOnDarkSecondary, fontSize: 9 },
    chip: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 2,
    },
    chipText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
});
