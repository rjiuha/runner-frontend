// src/components/ui/LoadingTip.js
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, font, spacing } from '../../theme';
import { pickRandomTip } from '../../constants/gameplayTips';

const ROTATE_INTERVAL_MS = 5000;

/**
 * Строка случайной игровой подсказки под спиннером (создание/ожидание
 * лобби, ожидание старта партии, любая ре-синхронизация/переподключение) —
 * по прямому запросу пользователя, 2026-09-12. Текст сменяется на новый
 * случайный раз в ROTATE_INTERVAL_MS, без повтора того же варианта подряд
 * (см. pickRandomTip). Один инстанс — свой независимый цикл ротации
 * (не общий таймер на всё приложение), не мешает соседним экранам.
 *
 * @param {boolean} [dark=true] — фон экрана: true (по умолчанию, как у
 *   Screen.js, теперь используется ВЕЗДЕ — 2026-09-13, приведение MainMenu/
 *   LobbySearch к единой тёмной палитре) — светлый текст для тёмного фона
 *   (colors.bg); false — тёмный текст для светлого фона (colors.surface),
 *   на случай если какой-то экран снова станет светлым.
 */
export default function LoadingTip({ dark = true, style }) {
    const [tip, setTip] = useState(() => pickRandomTip());
    const tipRef = useRef(tip);
    tipRef.current = tip;

    useEffect(() => {
        const id = setInterval(() => {
            setTip(pickRandomTip(tipRef.current));
        }, ROTATE_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);

    return <Text style={[styles.tip, dark ? styles.tipOnDark : styles.tipOnLight, style]} noGlobalTint>{tip}</Text>;
}

const styles = StyleSheet.create({
    tip: {
        fontSize: font.tiny,
        textAlign: 'center',
        marginTop: spacing.lg,
        paddingHorizontal: spacing.xl,
    },
    tipOnDark: { color: colors.textOnDarkSecondary },
    tipOnLight: { color: colors.textSecondary },
});
