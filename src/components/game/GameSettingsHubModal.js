// src/components/game/GameSettingsHubModal.js
import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Button from '../ui/Button';
import { colors, spacing, font, radius } from '../../theme';

/**
 * 2026-10-15, по прямому запросу пользователя — промежуточный уровень между
 * GameMenuModal ("Настройки") и двумя разными настроечными экранами:
 * "Звук" (тот же GameSettingsModal — громкость, без изменений) и "Игра"
 * (новый GameGeneralSettingsModal — пока только ориентация сворачиваемой
 * модалки, см. lib/dialogSettings.js). Раньше "Настройки" вела СРАЗУ в
 * звук — пользователь явно попросил разделить, "чтобы можно было
 * настраивать короче" (быстрее переключаться между разделами).
 *
 * Чисто навигационный — никакого состояния не несёт, тот же визуальный
 * стиль sheet/backdrop, что у GameMenuModal.js.
 */
export default function GameSettingsHubModal({ visible, onClose, onSound, onGeneral }) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <Text style={styles.title} noGlobalTint>Настройки</Text>
                    <Button title="Игра" onPress={onGeneral} style={styles.btn} />
                    <Button title="Звук" onPress={onSound} style={styles.btn} />
                    <Button title="Назад" variant="muted" onPress={onClose} style={styles.btn} />
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
