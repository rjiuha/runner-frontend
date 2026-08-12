// src/components/game/PlayerSwitcher.js
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Переключатель игроков — компактный горизонтальный ряд именных пилюль,
 * расположен НАД зоной информации об игроке (см. PlayerInfoPanel: switcher
 * flex:1 / infoColumn flex:4 в колоночной раскладке — панель делит высоту,
 * не ширину). Активная пилюля подсвечена цветом игрока. Горизонтальный
 * скролл — подстраховка на случай длинных имён/узкой панели.
 */
export default function PlayerSwitcher({ players, activeId, onSelect }) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
        >
            {players.map((p) => {
                const active = p.id === activeId;
                return (
                    <TouchableOpacity
                        key={p.id}
                        onPress={() => onSelect(p.id)}
                        activeOpacity={0.8}
                        style={[
                            styles.pill,
                            { borderColor: p.color },
                            active && { backgroundColor: p.color },
                        ]}
                    >
                        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                            {p.name}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    row: { alignItems: 'center', paddingBottom: 2 },
    pill: {
        borderWidth: 1.5,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        marginRight: 6,
        maxWidth: 92,
    },
    label: { color: colors.textOnDark, fontSize: font.tiny, fontWeight: '600' },
    labelActive: { color: '#fff', fontWeight: 'bold' },
});
