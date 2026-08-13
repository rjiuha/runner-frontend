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
export default function RunnerDiceSlot({ zoneKey, value, hoverState, onMeasured, style }) {
    const ref = useRef(null);

    const measure = () => {
        ref.current?.measureInWindow((x, y, width, height) => {
            onMeasured(zoneKey, { x, y, width, height });
        });
    };

    const highlight = hoverState === 'valid' ? styles.hover : null;

    return (
        <View ref={ref} onLayout={measure} style={[styles.slot, value != null && styles.slotFilled, highlight, style]}>
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
    // minHeight 44 — не 28: маленькая цель было легко промахнуться пальцем на
    // телефоне (жалоба пользователя "не работает перетаскивание на кубик
    // хода") — сам хит-тестинг не был сломан (оконные координаты,
    // measureInWindow), просто зона была мелкой и узкой.
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
