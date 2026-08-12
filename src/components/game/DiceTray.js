// src/components/game/DiceTray.js
import React from 'react';
import { StyleSheet, View } from 'react-native';
import DiceDie from './DiceDie';
import { spacing } from '../../theme';

/**
 * 4 кубика перемещения активного игрока. Индекс кубика (0..3) — это то же,
 * что dice1..dice4 на бэке (1-based при вызове API, см. GameBoardScreen).
 * draggable=false — не мой ход/не тот шаг: кубики видны, но не тащатся.
 */
export default function DiceTray({ dice, draggable = true, onDragMove, onDrop }) {
    return (
        <View style={styles.row}>
            {dice.map((value, index) => (
                <DiceDie
                    key={index}
                    value={value}
                    draggable={draggable}
                    onDragMove={(x, y, v) => onDragMove(index, x, y, v)}
                    onDrop={(x, y, v) => onDrop(index, x, y, v)}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm },
});
