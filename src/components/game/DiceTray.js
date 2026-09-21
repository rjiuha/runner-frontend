// src/components/game/DiceTray.js
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import DiceDie from './DiceDie';
import { spacing } from '../../theme';

// Platform.OS не меняется в течение жизни приложения — модульная константа
// (тот же приём, что isAndroid в RunnerCard.js).
const isAndroid = Platform.OS === 'android';

/**
 * 4 кубика перемещения активного игрока. Индекс кубика (0..3) — это то же,
 * что dice1..dice4 на бэке (1-based при вызове API, см. GameBoardScreen).
 * draggable=false — не мой ход/не тот шаг: кубики видны, но не тащатся.
 *
 * **Android — ЯВНО 2×2, не flexWrap** (2026-09-20, по прямому запросу
 * пользователя "сделай расположение в два ряда по два кубика"). Раньше
 * перенос в 2 ряда полагался на `flexWrap` (срабатывал сам по себе, только
 * если ширина колонки физически не вмещала все 4 кубика в один ряд) —
 * теперь трей стоит в декоративной рамке FramePanel (см. PlayerInfoPanel.js),
 * и явная 2×2-раскладка даёт компактный, предсказуемо квадратный блок под
 * рамку независимо от того, влезли бы 4 кубика в ряд по ширине или нет —
 * не приходится гадать, сработает ли flexWrap на конкретном экране. Веб/iOS
 * не тронуты — там как и раньше один ряд с переносом при нехватке места.
 */
export default function DiceTray({ dice, draggable = true, onDragStart, onDragMove, onDrop, onDragEnd, size }) {
    const renderDie = (value, index) => (
        <DiceDie
            key={index}
            value={value}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragMove={(x, y, v) => onDragMove(index, x, y, v)}
            onDrop={(x, y, v) => onDrop(index, x, y, v)}
            onDragEnd={onDragEnd}
            {...(size != null ? { size } : {})}
        />
    );

    if (isAndroid) {
        return (
            <View style={styles.grid}>
                <View style={styles.gridRow}>{dice.slice(0, 2).map((value, i) => renderDie(value, i))}</View>
                <View style={styles.gridRow}>{dice.slice(2, 4).map((value, i) => renderDie(value, i + 2))}</View>
            </View>
        );
    }

    return (
        <View style={styles.row}>
            {dice.map((value, index) => renderDie(value, index))}
        </View>
    );
}

const styles = StyleSheet.create({
    // flexWrap — правая колонка в compactColumns заметно уже панели целиком
    // (см. PlayerInfoPanel), 4 кубика в ряд там физически не влезают; перенос
    // в 2 ряда ничего не портит и в широких раскладках, где перенос никогда
    // не срабатывает (места хватает на один ряд). Только веб/iOS — см.
    // isAndroid-ветку выше.
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
    },
    // Android — явная сетка 2×2 (см. докстринг компонента).
    grid: { alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.xs },
    gridRow: { flexDirection: 'row', gap: spacing.xs },
});
