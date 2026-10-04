// src/components/game/GameSettingsModal.js
import React, { useEffect, useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Button from '../ui/Button';
import Slider from '../ui/Slider';
import { colors, spacing, font, radius } from '../../theme';
import { useAudioSettings } from '../../hooks/useAudioSettings';
import {
    AUDIO_DEFAULTS,
    commitAudioSettings,
    getSavedAudioSettings,
    revertAudioSettings,
    setAudioSettingsLive,
} from '../../lib/audioSettings';
import { confirm } from '../../lib/notify';

// Порядок строк — см. lib/audioSettings.js за разбором, что входит в каждый
// канал (voice отделён от остальных игровых звуков по прямому запросу
// пользователя, 2026-10-04).
const ROWS = [
    { key: 'music', label: 'Фоновая музыка' },
    { key: 'commentator', label: 'Комментатор' },
    { key: 'voice', label: 'Голоса бегунов' },
    { key: 'action', label: 'Игровые звуки' },
];

/**
 * Настройки громкости (открывается из GameMenuModal). Слайдеры меняют звук
 * СРАЗУ (preview через setAudioSettingsLive — см. lib/audioSettings.js),
 * но НЕ пишутся в storage, пока не нажата "Сохранить". `dirty` сравнивает
 * текущие живые значения со снимком `saved`, зафиксированным в момент
 * ОТКРЫТИЯ модалки (не на каждый рендер — иначе "Сохранить" сразу же сама
 * стирала бы свою причину быть disabled). "Выйти" при dirty спрашивает
 * подтверждение (confirm() — общий notify-модал проекта, не свой) и
 * откатывает живые значения к последним сохранённым.
 */
export default function GameSettingsModal({ visible, onClose }) {
    const settings = useAudioSettings();
    const savedSnapshotRef = useRef(getSavedAudioSettings());

    useEffect(() => {
        if (visible) savedSnapshotRef.current = getSavedAudioSettings();
    }, [visible]);

    if (!visible) return null;

    const dirty = Object.keys(AUDIO_DEFAULTS).some((k) => settings[k] !== savedSnapshotRef.current[k]);

    const handleSave = async () => {
        await commitAudioSettings();
        savedSnapshotRef.current = getSavedAudioSettings();
    };

    const handleExit = () => {
        if (!dirty) {
            onClose();
            return;
        }
        confirm('Выйти без сохранения?', 'Изменения громкости не будут сохранены.', () => {
            revertAudioSettings();
            onClose();
        }, 'Выйти');
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={handleExit}>
            {/* react-native-gesture-handler требует GestureHandlerRootView
                ПРЯМО внутри Modal — RN Modal рендерит контент в ОТДЕЛЬНОМ
                нативном окне (Android Dialog), вне того GestureHandlerRootView,
                что уже обёрнут вокруг всего приложения в App.js, так что
                Gesture.Pan у Slider ниже (как и любой другой жест gesture-
                handler внутри любой Modal) без этого молча не ловит тачи на
                Android — живой баг, 2026-10-04 (обычные TouchableOpacity typа
                кнопок ниже работают и без этого, они на старой responder-
                системе, не на gesture-handler). Официально задокументированное
                ограничение/обходной путь RNGH, не специфика этого компонента —
                see https://docs.swmansion.com/react-native-gesture-handler/docs/guides/placing-gesture-handler-in-modals */}
            <GestureHandlerRootView style={styles.gestureRoot}>
                <View style={styles.backdrop}>
                    <View style={styles.sheet}>
                        <Text style={styles.title} noGlobalTint>Настройки звука</Text>

                        {ROWS.map((row) => (
                            <View key={row.key} style={styles.row}>
                                <View style={styles.rowHeader}>
                                    <Text style={styles.label} noGlobalTint>{row.label}</Text>
                                    <Text style={styles.value} noGlobalTint>{Math.round(settings[row.key] * 100)}%</Text>
                                </View>
                                <Slider
                                    value={settings[row.key]}
                                    onValueChange={(v) => setAudioSettingsLive({ [row.key]: v })}
                                />
                            </View>
                        ))}

                        <View style={styles.buttonRow}>
                            <Button
                                title="Выйти"
                                variant="muted"
                                onPress={handleExit}
                                style={styles.btn}
                                textStyle={styles.btnText}
                            />
                            <Button
                                title="Сохранить"
                                onPress={handleSave}
                                disabled={!dirty}
                                style={styles.btn}
                                textStyle={styles.btnText}
                            />
                        </View>
                    </View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    gestureRoot: { flex: 1 },
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
    row: { marginBottom: spacing.md },
    rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    label: { fontSize: font.body, color: colors.textOnDark },
    value: { fontSize: font.small, color: colors.textOnDarkSecondary },
    buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    // paddingHorizontal уже, чем дефолт Button'а (spacing.lg=20) — на узком
    // экране (sheet maxWidth 360, 2 кнопки в ряд) "Сохранить" иначе
    // переносилось на 2 строки (живой скриншот на Android, 2026-10-04).
    btn: { flex: 1, paddingHorizontal: spacing.xs },
    btnText: { fontSize: font.small },
});
