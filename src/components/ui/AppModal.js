// src/components/ui/AppModal.js
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import { registerModalHandler } from '../../lib/notify';
import { colors, spacing, font, radius } from '../../theme';

/**
 * Единственный на всё приложение хост для notify()/confirm() (lib/notify.js)
 * — по прямому запросу пользователя, 2026-09-14: "не хочу стандартные
 * диалоги в общем" (платформенный Alert.alert/window.alert/window.confirm
 * убраны совсем). Тот же визуальный стиль, что уже был у GameFinishModal
 * (тёмная плашка+кнопки), просто общий на любые title/message/кнопки, а не
 * жёстко "победа игрока".
 *
 * Монтируется ОДИН раз в App.js (тот же приём, что и общий
 * ParallaxBackground) — notify()/confirm() остаются обычными функциями с
 * прежней сигнатурой, ни один из экранов, что их вызывает, не поменялся —
 * весь новый код только тут + внутри lib/notify.js.
 */
export default function AppModal() {
    const [state, setState] = useState(null); // {title, message, buttons} | null

    useEffect(() => {
        registerModalHandler(setState);
        return () => registerModalHandler(null);
    }, []);

    if (!state) return null;

    const close = () => setState(null);

    return (
        <Modal visible transparent animationType="fade" onRequestClose={close}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <Text style={styles.title} noGlobalTint>{state.title}</Text>
                    {!!state.message && <Text style={styles.message} noGlobalTint>{state.message}</Text>}
                    <View style={styles.buttonRow}>
                        {state.buttons.map((b, i) => (
                            <Button
                                key={i}
                                title={b.label}
                                variant={b.variant}
                                onPress={() => {
                                    close();
                                    b.onPress?.();
                                }}
                                style={styles.btn}
                            />
                        ))}
                    </View>
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
        marginBottom: spacing.sm, textAlign: 'center',
    },
    message: {
        fontSize: font.body, color: colors.textOnDarkSecondary,
        marginBottom: spacing.lg, textAlign: 'center',
    },
    buttonRow: { flexDirection: 'row', width: '100%', gap: spacing.sm },
    btn: { flex: 1 },
});
