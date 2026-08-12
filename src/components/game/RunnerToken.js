// src/components/game/RunnerToken.js
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { RUNNER_DISPLAY } from '../../constants/GameConstants';

/**
 * Иконка бегуна в цветном кольце владельца. Один и тот же компонент рисует
 * бегуна и на доске (BoardGrid), и в панели игрока (RunnerCard) — так фишки
 * на поле и карточки в панели выглядят одинаково и легко узнаются.
 */
export default function RunnerToken({ type, color = '#fff', size = 32, selected = false, style }) {
    const display = RUNNER_DISPLAY[type];
    if (!display) return null;

    return (
        <View
            style={[
                styles.ring,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderColor: color,
                    backgroundColor: `${color}33`,
                },
                selected && styles.selected,
                style,
            ]}
        >
            <Image source={display.icon} style={{ width: size * 0.68, height: size * 0.68 }} resizeMode="contain" />
        </View>
    );
}

const styles = StyleSheet.create({
    ring: {
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selected: {
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#fff',
        shadowOpacity: 0.9,
        shadowRadius: 4,
        elevation: 4,
    },
});
