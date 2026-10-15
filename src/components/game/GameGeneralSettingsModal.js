// src/components/game/GameGeneralSettingsModal.js
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../ui/Button';
import { colors, spacing, font, radius } from '../../theme';
import { DIALOG_ORIENTATION, setDialogOrientation } from '../../lib/dialogSettings';
import { useDialogOrientation } from '../../hooks/useDialogOrientation';

const ORIENTATION_LABELS = {
    [DIALOG_ORIENTATION.LEFT]: 'Слева',
    [DIALOG_ORIENTATION.RIGHT]: 'Справа',
};
const ORIENTATION_OPTIONS = [DIALOG_ORIENTATION.LEFT, DIALOG_ORIENTATION.RIGHT];

/**
 * 2026-10-15, по прямому запросу пользователя — раздел "Игра" настроек
 * (см. GameSettingsHubModal.js). Пока одна настройка — "Ориентация
 * диалога" (к какой грани экрана прибита ручка сворачиваемой модалки,
 * GameDialogModal.js), выпадающий список из 2 вариантов.
 *
 * В отличие от GameSettingsModal (звук) — тут НЕТ отдельного шага
 * "Сохранить"/dirty-отслеживания: выбор в списке применяется и пишется в
 * storage сразу (см. lib/dialogSettings.js#setDialogOrientation) — один
 * дискретный переключатель, а не серия слайдеров с live-preview, второй
 * шаг подтверждения тут не несёт пользы.
 *
 * Свой мини-dropdown (нет готового select-компонента в проекте, см.
 * components/ui/) — тап по текущему значению разворачивает список из 2
 * строк НИЖЕ (inline, не floating-попап — при 2 опциях всегда помещается).
 */
export default function GameGeneralSettingsModal({ visible, onClose }) {
    const orientation = useDialogOrientation();
    const [optionsOpen, setOptionsOpen] = useState(false);

    if (!visible) return null;

    const handleClose = () => {
        setOptionsOpen(false);
        onClose();
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <Text style={styles.title} noGlobalTint>Настройки игры</Text>

                    <View style={styles.row}>
                        <Text style={styles.label} noGlobalTint>Ориентация диалога</Text>
                        <TouchableOpacity
                            style={styles.selectBox}
                            onPress={() => setOptionsOpen((v) => !v)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.selectValue} noGlobalTint>{ORIENTATION_LABELS[orientation]}</Text>
                            <Text style={styles.chevron} noGlobalTint>{optionsOpen ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {optionsOpen && (
                            <View style={styles.optionsList}>
                                {ORIENTATION_OPTIONS.map((opt) => (
                                    <TouchableOpacity
                                        key={opt}
                                        style={[styles.option, opt === orientation && styles.optionActive]}
                                        onPress={() => {
                                            setDialogOrientation(opt);
                                            setOptionsOpen(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.optionText} noGlobalTint>{ORIENTATION_LABELS[opt]}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    <Button title="Назад" variant="muted" onPress={handleClose} style={styles.btn} />
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
    row: { marginBottom: spacing.lg },
    label: { fontSize: font.body, color: colors.textOnDark, marginBottom: spacing.xs },
    selectBox: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.inputBg, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.inputBorder,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    },
    selectValue: { fontSize: font.body, color: colors.textOnDark },
    chevron: { fontSize: font.small, color: colors.textOnDarkSecondary },
    optionsList: {
        marginTop: spacing.xs,
        borderRadius: radius.md,
        overflow: 'hidden',
        borderWidth: 1, borderColor: colors.inputBorder,
    },
    option: {
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
        backgroundColor: colors.inputBgAlt,
    },
    optionActive: { backgroundColor: colors.primaryTranslucent },
    optionText: { fontSize: font.body, color: colors.textOnDark },
    btn: { marginTop: spacing.sm },
});
