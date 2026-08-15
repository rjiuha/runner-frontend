// src/components/game/DiceTray.js
import React from 'react';
import { StyleSheet, View } from 'react-native';
import DiceDie from './DiceDie';
import { spacing } from '../../theme';

// Жалоба пользователя: "на планшете не видно" — увеличено ещё раз (было
// 44, потом 56). compactColumns передаёт свой (меньший) size явно.
const DEFAULT_SIZE = 72;

/**
 * 4 кубика перемещения активного игрока. Индекс кубика (0..3) — это то же,
 * что dice1..dice4 на бэке (1-based при вызове API, см. GameBoardScreen).
 * draggable=false — не мой ход/не тот шаг: кубики видны, но не тащатся.
 * color — цвет игрока (см. PLAYER_COLOR_HEX), тело грани (DiceFace).
 */
export default function DiceTray({ dice, draggable = true, onDragMove, onDrop, size = DEFAULT_SIZE, color }) {
    return (
        <View style={styles.row}>
            {dice.map((value, index) => (
                <DiceDie
                    key={index}
                    value={value}
                    draggable={draggable}
                    onDragMove={(x, y, v) => onDragMove(index, x, y, v)}
                    onDrop={(x, y, v) => onDrop(index, x, y, v)}
                    size={size}
                    color={color}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    // flexWrap — правая колонка в compactColumns заметно уже панели целиком
    // (см. PlayerInfoPanel), 4 кубика в ряд там физически не влезают; перенос
    // в 2 ряда ничего не портит и в широких раскладках, где перенос никогда
    // не срабатывает (места хватает на один ряд).
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
    },
});
