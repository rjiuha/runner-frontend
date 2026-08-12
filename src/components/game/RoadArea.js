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
    outer: { flex: 1 },
});
