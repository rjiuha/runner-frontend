// src/components/ui/Screen.js
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';

/**
 * Каркас экрана: безопасные зоны + опциональный скролл + уход от клавиатуры.
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