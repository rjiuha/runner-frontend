// src/components/game/RunnerDiceSlot.js
import React, { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Зона на карточке бегуна для перетаскивания кубика хода. Первый брошенный
 * кубик — обычное перемещение; если на уже занятого бегуна бросить ещё
 * один (лишний кубик при нехватке бегунов) — это "накат", копим оба
 * значения и просто показываем бейдж. Как и AbilityZone, сама зона не
 * решает правила (тут их и нет — любой кубик подходит любому бегуну),
 * только измеряет себя через measureInWindow для хит-тестинга в
 * PlayerInfoPanel.
 */
export default function RunnerDiceSlot({ zoneKey, values, hoverState, onMeasured, onRemove }) {
    const ref = useRef(null);

    const measure = () => {
        ref.current?.measureInWindow((x, y, width, height) => {
            onMeasured(zoneKey, { x, y, width, height });
        });
    };

    const highlight = hoverState === 'valid' ? styles.hover : null;

    return (
        <View ref={ref} onLayout={measure} style={[styles.slot, values.length > 0 && styles.slotFilled, highlight]}>
            {values.length === 0 && <Text style={styles.placeholder}>кубик хода</Text>}
            {values.map(({ diceIndex, value }) => (
                <TouchableOpacity
                    key={diceIndex}
                    onPress={() => onRemove(diceIndex)}
                    style={styles.chip}
                    activeOpacity={0.7}
                >
                    <Text style={styles.chipText}>{value}</Text>
                </TouchableOpacity>
            ))}
            {values.length > 1 && <Text style={styles.nakatBadge}>накат</Text>}
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
    nakatBadge: { color: colors.warning, fontSize: 8, fontWeight: 'bold', marginLeft: 2 },
});
