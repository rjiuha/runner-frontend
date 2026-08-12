// src/components/ui/Screen.js
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ParallaxBackground from './ParallaxBackground';
import { colors } from '../../theme';

/**
 * Каркас экрана: безопасные зоны + общий Parallax-фон + опциональный скролл +
 * уход от клавиатуры. Фон один на все экраны — рендерится здесь, а не в
 * каждом экране по отдельности, чтобы не разъезжались version'ы и не было
 * дублей (как раньше было только на AuthScreen).
 *
 * SafeAreaView берём из react-native-safe-area-context, а не из react-native:
 * встроенный устарел в RN 0.85, работает только на iOS и игнорирует
 * вырезы/навигационную полосу на Android.
 */
export default function Screen({
                                   children,
                                   scroll = false,
                                   dark = true,
                                   edges,
                                   style,
                                   contentContainerStyle,
                               }) {
    const bg = dark ? colors.bg : colors.surface;

    const body = scroll ? (
        <ScrollView
            contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            {children}
        </ScrollView>
    ) : (
        <View style={[styles.flex, contentContainerStyle]}>{children}</View>
    );

    return (
        <SafeAreaView style={[styles.flex, { backgroundColor: bg }, style]} edges={edges}>
            <ParallaxBackground />
            <KeyboardAvoidingView
                style={styles.flex}
                // На iOS клавиатура наезжает на контент — сдвигаем всё вверх.
                // На Android этим занимается система (windowSoftInputMode).
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {body}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    scrollContent: { flexGrow: 1 },
});