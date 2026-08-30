// src/components/game/RunnerDiceSlot.js
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../../theme';

/**
 * Один квадратный индикатор кубика на карточке бегуна — на карточку их два
 * (см. RunnerCard): "Ход" (runner.dice) и "Накат" (runner.rollDice, см.
 * StepSelectionValidator::rollValidate на бэке — доступен только когда бегун
 * уже доехал в этом раунде и остались кубики у игрока). Чисто
 * презентационный: сама зона дропа для хит-тестинга ("move:<id>") — ВСЯ
 * карточка целиком (см. RunnerCard, меряет и репортит себя сама), тип
 * (обычный ход или накат) решает canSelectRunner по состоянию бегуна, а не
 * то, в какой из двух квадратов навели кубик — оба квадрата всегда просто
 * отображают текущее значение, ничего сами не ловят.
 */
export default function RunnerDiceSlot({ label, value, size = 40, color }) {
    const filled = value != null;
    return (
        <View style={styles.wrap}>
            <View
                style={[
                    styles.square,
                    { width: size, height: size },
                    // Цвет игрока (color), не фиксированный colors.primary — та же
                    // просьба, что и для рамки выбранной карточки (см. RunnerCard):
                    // всё, что относится к "чей это ход/бегун", должно быть в одном
                    // цвете с кубиками в трее и обводкой на доске.
                    filled && { borderStyle: 'solid', borderColor: color, backgroundColor: `${color}b8` },
                ]}
            >
                <Text style={styles.value}>{filled ? value : '—'}</Text>
            </View>
            <Text style={styles.label} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center' },
    square: {
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.textOnDarkSecondary,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    value: { color: colors.textOnDark, fontSize: font.small, fontWeight: 'bold' },
    label: { color: colors.textOnDarkSecondary, fontSize: 9, marginTop: 2 },
});
