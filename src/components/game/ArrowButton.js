// src/components/game/ArrowButton.js
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

/**
 * Кнопка-стрелка для прокрутки игрового поля.
 * На вебе зажатие крутит поле (onPressIn/onPressOut), на мобильных тап
 * листает на один блок (onPress) — конкретный набор обработчиков приходит
 * через `handlers` из useBoardScroll.
 *
 * @param {'left'|'right'} direction
 * @param {number} size
 * @param {object} handlers
 */
export default function ArrowButton({ direction, size, handlers }) {
    return (
        <TouchableOpacity style={[styles.btn, { width: size, height: size }]} activeOpacity={0.7} {...handlers}>
            <Text style={[styles.label, { fontSize: Math.floor(size * 0.5) }]}>
                {direction === 'left' ? '←' : '→'}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    btn: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    label: { fontWeight: 'bold', color: '#fff' },
});
