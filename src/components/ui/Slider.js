// src/components/ui/Slider.js
import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { colors, radius } from '../../theme';

const THUMB_SIZE = 20;
const TRACK_HEIGHT = 6;

/**
 * Горизонтальный слайдер 0..1 (громкость, см. GameSettingsModal.js).
 * `Gesture.Pan` + reanimated shared values — НЕ `PanResponder` (см. CLAUDE.md,
 * "известные грабли RN/Android": legacy PanResponder ненадёжен внутри
 * `GestureHandlerRootView`, который в этом проекте обязателен в App.js —
 * тот же класс бага уже ловили на свайпе дороги). `.minDistance(0)` — жест
 * активируется сразу на onBegin, так что обычный тап по треку (без
 * протаскивания) тоже переставляет позицию, не только drag.
 *
 * Трек меряется через onLayout (ширина зависит от раскладки экрана, не
 * константа) — позиция в долях [0,1] переводится в проценты только внутри
 * useAnimatedStyle, сам трек/заливка/бегунок двигаются на UI-потоке, JS-мост
 * пересекает только commit (runOnJS) — для апдейта стора громкости (не
 * критично к частоте кадров, в отличие от позиции во время драга).
 */
export default function Slider({ value, onValueChange, disabled = false }) {
    const trackWidth = useSharedValue(0);
    const dragX = useSharedValue(value ?? 0);

    // Внешнее value (из стора) — источник истины, пока слайдер НЕ тащат.
    // useEffect, а НЕ прямая мутация в теле рендера — reanimated strict mode
    // ругается варном ("Writing to `value` during component render") на
    // запись в shared value вне эффекта/воркета, живой лог подтвердил
    // (2026-10-04). Запись ПОСЛЕ коммита, не во время рендера, тот же
    // результат (тело рендера само по себе ничего не анимирует — на экран
    // влияет только useAnimatedStyle ниже).
    useEffect(() => {
        dragX.value = value ?? 0;
    }, [value, dragX]);

    const commit = useCallback(
        (v) => {
            if (onValueChange) onValueChange(v);
        },
        [onValueChange],
    );

    const onLayout = (e) => {
        trackWidth.value = e.nativeEvent.layout.width;
    };

    const setFromX = (x) => {
        'worklet';
        if (trackWidth.value <= 0) return;
        const next = Math.max(0, Math.min(1, x / trackWidth.value));
        dragX.value = next;
        runOnJS(commit)(next);
    };

    const pan = Gesture.Pan()
        .enabled(!disabled)
        .minDistance(0)
        .onBegin((e) => setFromX(e.x))
        .onUpdate((e) => setFromX(e.x));

    const fillStyle = useAnimatedStyle(() => ({ width: `${dragX.value * 100}%` }));
    const thumbStyle = useAnimatedStyle(() => ({
        left: `${dragX.value * 100}%`,
        transform: [{ translateX: -THUMB_SIZE / 2 }],
    }));

    return (
        <GestureDetector gesture={pan}>
            <View style={[styles.hitArea, disabled && styles.disabled]}>
                <View style={styles.track} onLayout={onLayout}>
                    <Animated.View style={[styles.fill, fillStyle]} />
                    <Animated.View style={[styles.thumb, thumbStyle]} />
                </View>
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    // Хит-зона жеста выше самого трека (палец часто промахивается по
    // тонкой 6px полосе) — трек визуально тонкий, но ловит касания по всей
    // высоте этой обёртки.
    hitArea: { height: 32, justifyContent: 'center' },
    disabled: { opacity: 0.4 },
    track: {
        height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2,
        backgroundColor: colors.inputBg,
    },
    fill: {
        position: 'absolute', left: 0, top: 0, bottom: 0,
        borderRadius: TRACK_HEIGHT / 2, backgroundColor: colors.primary,
    },
    thumb: {
        position: 'absolute', top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
        width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
        backgroundColor: colors.textOnDark, borderWidth: 2, borderColor: colors.primary,
    },
});
