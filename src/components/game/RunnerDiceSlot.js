// src/components/game/RunnerDiceSlot.js
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Визуальный индикатор зоны кубика хода на карточке бегуна (шаг SELECT).
 * Значение приходит с бэка (runner.dice/rollDice) — как только SELECT
 * реально прошёл, кубик "занят" на сервере, снять его тут нельзя (в отличие
 * от зон усилий это не pending-стейт, а уже подтверждённое действие).
 *
 * Чисто презентационный — сама зона дропа для хит-тестинга ("move:<id>") это
 * теперь ВСЯ карточка бегуна целиком (см. RunnerCard, измеряет и репортит
 * себя сам), не этот вложенный элемент — по запросу пользователя "сделай
 * чувствительным всё пространство плитки персонажа к перетаскиванию кубика".
 */
export default function RunnerDiceSlot({ value, hoverState, style }) {
    const highlight = hoverState === 'valid' ? styles.hover : null;

    return (
        <View style={[styles.slot, value != null && styles.slotFilled, highlight, style]}>
            {value == null ? (
                <Text style={styles.placeholder}>перетащи сюда кубик хода</Text>
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
        justifyContent: 'center',
        minHeight: 44,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.textOnDarkSecondary,
        borderRadius: radius.md,
        paddingHorizontal: 4,
    },
    slotFilled: { borderStyle: 'solid', borderColor: colors.primary },
    hover: { borderColor: colors.success, backgroundColor: `${colors.success}33` },
    placeholder: { color: colors.textOnDarkSecondary, fontSize: font.tiny },
    chip: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
