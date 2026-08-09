// src/components/menu/CreateLobbyModal.js
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../ui/Button';
import { colors, spacing, font, radius } from '../../theme';

const OPTIONS = [2, 3, 4];

/**
 * POST /api/lobby принимает единственное поле maxPlayers,
 * поэтому отдельный экран создания не нужен — хватает модалки.
 */
export default function CreateLobbyModal({ visible, onClose, onSubmit, busy }) {
    const [maxPlayers, setMaxPlayers] = useState(2);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <Text style={styles.title}>Новое лобби</Text>
                    <Text style={styles.label}>Сколько игроков?</Text>

                    <View style={styles.options}>
                        {OPTIONS.map((n) => {
                            const active = n === maxPlayers;
                            return (
                                <TouchableOpacity
                                    key={n}
                                    style={[styles.option, active && styles.optionActive]}
                                    onPress={() => setMaxPlayers(n)}
                                    disabled={busy}
                                >
                                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{n}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={styles.hint}>
                        Игра начнётся автоматически, когда все {maxPlayers} игроков будут готовы
                    </Text>

                    <Button title="Создать" onPress={() => onSubmit(maxPlayers)} loading={busy} />
                    <Button title="Отмена" variant="muted" onPress={onClose} disabled={busy} style={styles.cancel} />
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
    title: { fontSize: font.h2, fontWeight: 'bold', color: colors.textOnDark, marginBottom: spacing.md },
    label: { fontSize: font.body, color: colors.textOnDarkSecondary, marginBottom: spacing.sm },
    options: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
    option: {
        flex: 1, marginHorizontal: spacing.xs, height: 60,
        borderRadius: radius.md, borderWidth: 2, borderColor: '#555',
        alignItems: 'center', justifyContent: 'center',
    },
    optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryTranslucent },
    optionText: { fontSize: font.h2, color: colors.textOnDarkSecondary, fontWeight: 'bold' },
    optionTextActive: { color: colors.textOnDark },
    hint: { fontSize: font.tiny, color: colors.textOnDarkSecondary, marginBottom: spacing.md },
    cancel: { marginTop: spacing.sm },
});