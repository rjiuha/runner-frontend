// src/components/game/PlayerSwitcher.js
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Переключатель карточек игроков — кнопки с именами (не голые стрелки),
 * активная подсвечена цветом игрока. Горизонтальный скролл — подстраховка
 * на случай длинных имён/узкой панели, а не основной способ навигации.
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
    row: { paddingBottom: spacing.xs },
    pill: {
        borderWidth: 2,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginRight: spacing.sm,
        maxWidth: 130,
    },
    label: { color: colors.textOnDark, fontSize: font.small, fontWeight: '600' },
    labelActive: { color: '#fff', fontWeight: 'bold' },
});
