// src/components/game/GameMenuModal.js
import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Button from '../ui/Button';
import { colors, spacing, font, radius } from '../../theme';

/**
 * Верхний уровень игрового меню (кнопка settings в seam-ряду, см.
 * GameBoardScreen.js) — ровно 2 пункта, как попросил пользователь,
 * 2026-10-04: "Покинуть игру" (ведёт к confirm()+surrender, см.
 * handleLeaveGame в GameBoardScreen) и "Настройки" (открывает
 * GameSettingsModal). Сам этот модал — просто меню выбора, никакого
 * состояния не несёт.
 */
export default function GameMenuModal({ visible, onClose, onLeave, onSettings }) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <Text style={styles.title} noGlobalTint>Меню</Text>
                    <Button title="Покинуть игру" variant="danger" onPress={onLeave} style={styles.btn} />
                    <Button title="Настройки" onPress={onSettings} style={styles.btn} />
                    <Button title="Отмена" variant="muted" onPress={onClose} style={styles.btn} />
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
    },
    title: {
        fontSize: font.h2, fontWeight: 'bold', color: colors.textOnDark,
        marginBottom: spacing.lg, textAlign: 'center',
    },
    btn: { marginBottom: spacing.sm },
});
