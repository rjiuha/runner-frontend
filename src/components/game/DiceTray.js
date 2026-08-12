// src/components/game/DiceTray.js
import React from 'react';
import { StyleSheet, View } from 'react-native';
import DiceDie from './DiceDie';
import { spacing } from '../../theme';

/**
 * 4 кубика перемещения активного игрока. Индекс кубика (0..3) — это то же,
 * что dice1..dice4 на бэке; используется как id при назначении на усиление.
 */
export default function DiceTray({ dice, onDragMove, onDrop }) {
    return (
        <View style={styles.row}>
            {dice.map((value, index) => (
                <DiceDie
                    key={index}
                    value={value}
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
