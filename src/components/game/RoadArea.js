// src/components/game/RoadArea.js
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Обёртка игрового поля: цветной фон и внутренние отступы вокруг дороги.
 */
export default function RoadArea({ children, spacing = 10, backgroundColor = '#3a034b' }) {
    return (
        <View style={styles.relative}>
            <View pointerEvents="none" style={styles.frame} />
            <View style={[styles.outer, { backgroundColor, padding: spacing }]}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    relative: { position: 'relative', flex: 1 },
    frame: { position: 'absolute', top: 20, left: 20, right: 20, bottom: 20 },
    // alignItems:'center' — BoardGrid (фиксированного размера, containerWidth/
    // containerHeight из useBoardLayout) может быть УЖЕ, чем сама RoadArea, если
    // сегмент размера ограничен высотой, а не шириной (портретная раскладка,
    // 2026-08-30) — без центрирования дефолтный flex-start прижимал бы сетку к
    // левому краю, оставляя пустую полосу только справа.
    outer: { flex: 1, alignItems: 'center' },
});
