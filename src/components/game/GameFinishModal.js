// src/components/game/GameFinishModal.js
import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Button from '../ui/Button';
import { colors, spacing, font, radius } from '../../theme';

/**
 * game_finish (см. GameBoardScreen — детектится по game.status === GAME_STATUS.FINISH,
 * победитель — единственный gamePlayers[].status === PLAYER_STATUS.WINNER, см.
 * GameFinishService::run() на бэке, всегда ровно один). Единственное действие —
 * "Выйти" (не "Отмена"/бэкдроп-тап — партия уже окончена, закрывать модалку без
 * выхода некуда): и кнопка, и аппаратная кнопка "назад" на Android ведут на
 * главный экран (onExit), см. onRequestClose.
 */
export default function GameFinishModal({ visible, winnerName, onExit }) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onExit}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <Text style={styles.title}>
                        {winnerName ? `Игрок ${winnerName} победил!` : 'Игра завершена'}
                    </Text>
                    <Button title="Выйти" onPress={onExit} style={styles.exitBtn} />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
    },
    sheet: {
        width: '100%', maxWidth: 360,
        backgroundColor: colors.bgLight,
        borderRadius: radius.xl, padding: spacing.lg,
        alignItems: 'center',
    },
    title: {
        fontSize: font.h2, fontWeight: 'bold', color: colors.textOnDark,
        marginBottom: spacing.lg, textAlign: 'center',
    },
    exitBtn: { width: '100%' },
});
