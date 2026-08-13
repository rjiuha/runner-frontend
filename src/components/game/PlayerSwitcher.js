// src/components/game/PlayerSwitcher.js
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, font, spacing } from '../../theme';

/**
 * Переключатель игроков — таб-бар (кружок цвета игрока + имя, активный таб
 * подсвечен цветом игрока + полоска снизу), по образцу референса от
 * пользователя (нижняя навигация вида Alex/Jordan/Sam/Map). Максимум 4
 * игрока — ряд без скролла, каждый таб делит ширину поровну (`flex:1`).
 * Расположение (сверху панели в альбомной раскладке, снизу в портретной)
 * решает PlayerInfoPanel, сам компонент об ориентации не знает.
 */
export default function PlayerSwitcher({ players, activeId, onSelect }) {
    return (
        <View style={styles.row}>
            {players.map((p) => {
                const active = p.id === activeId;
                return (
                    <TouchableOpacity
                        key={p.id}
                        onPress={() => onSelect(p.id)}
                        activeOpacity={0.7}
                        style={styles.tab}
                    >
                        <View style={[styles.dot, { backgroundColor: p.color }, active && styles.dotActive]} />
                        <Text
                            style={[styles.label, active && { color: p.color, fontWeight: 'bold' }]}
                            numberOfLines={1}
                        >
                            {p.name}
                        </Text>
                        {active && <View style={[styles.activeBar, { backgroundColor: p.color }]} />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
    dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 2, opacity: 0.6 },
    dotActive: { opacity: 1, width: 12, height: 12, borderRadius: 6 },
    label: { color: colors.textOnDarkSecondary, fontSize: font.tiny, fontWeight: '600', maxWidth: 90 },
    activeBar: { height: 2, width: '70%', marginTop: 3, borderRadius: 1 },
});
