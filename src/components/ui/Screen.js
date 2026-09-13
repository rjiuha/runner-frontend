// src/components/ui/Screen.js
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Каркас экрана: безопасные зоны + опциональный скролл + уход от клавиатуры.
 *
 * **Свой ParallaxBackground/фон тут больше НЕ рендерится (2026-09-14)** — фон
 * теперь ОДИН на всё приложение, живёт в App.js выше NavigationContainer, не
 * пересоздаётся между экранами (см. докстринг App#App() — раньше на каждой
 * навигации анимация перезапускалась с нуля). SafeAreaView здесь ДОЛЖЕН
 * оставаться прозрачным, иначе он перекроет этот общий фон непрозрачным
 * цветом — именно так когда-то выглядел баг на экране проверки сессии в
 * MainMenuScreen (сплошной фон вместо звёзд).
 *
 * SafeAreaView берём из react-native-safe-area-context, а не из react-native:
 * встроенный устарел в RN 0.85, работает только на iOS и игнорирует
 * вырезы/навигационную полосу на Android.
 */
export default function Screen({
                                   children,
                                   scroll = false,
                                   edges,
                                   style,
                                   contentContainerStyle,
                               }) {
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
        <SafeAreaView style={[styles.flex, style]} edges={edges}>
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