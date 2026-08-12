// src/components/game/DiceDie.js
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { DICE_FACE_IMAGES } from '../../constants/GameConstants';
import { colors } from '../../theme';

/**
 * Один кубик перемещения — перетаскивается на зону усиления (AbilityZones).
 * Координаты жеста берём в оконных (absoluteX/Y), а не относительных: так
 * зоны-цели можно мерить один раз через measureInWindow и не пересчитывать
 * систему координат на каждый кадр.
 *
 * При неудачном дропе (мимо зоны или зона не принимает текущее значение)
 * пружиной возвращается на место — сам факт "не долетел" уже понятная
 * обратная связь, без дополнительных попапов.
 *
 * "Использованный" слот (value === null — кубик уже отдан на усиление)
 * жест не ловит и рисуется как пустое место, а не тусклая кость.
 * draggable=false — кубик виден (не отдан), но жест выключен: не мой ход
 * или не тот шаг хода (см. dragMode в PlayerInfoPanel).
 */
export default function DiceDie({ value, draggable = true, onDragMove, onDrop, size = 44 }) {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const dragging = useSharedValue(false);

    const pan = Gesture.Pan()
        .enabled(value != null && draggable)
        .onStart(() => {
            dragging.value = true;
        })
        .onUpdate((e) => {
            translateX.value = e.translationX;
            translateY.value = e.translationY;
            if (onDragMove) runOnJS(onDragMove)(e.absoluteX, e.absoluteY, value);
        })
        .onEnd((e) => {
            if (onDrop) runOnJS(onDrop)(e.absoluteX, e.absoluteY, value);
        })
        .onFinalize(() => {
            dragging.value = false;
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: dragging.value ? 1.18 : 1 },
        ],
        zIndex: dragging.value ? 10 : 1,
    }));

    if (value == null) {
        return <View style={[styles.emptySlot, { width: size, height: size, borderRadius: size / 2 }]} />;
    }

    return (
        <GestureDetector gesture={pan}>
            <Animated.View style={[styles.die, { width: size, height: size }, animatedStyle]}>
                <Image
                    source={DICE_FACE_IMAGES[value]}
                    style={{ width: size, height: size }}
                    resizeMode="contain"
                />
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    die: { alignItems: 'center', justifyContent: 'center' },
    emptySlot: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.textOnDarkSecondary,
        opacity: 0.4,
    },
});
