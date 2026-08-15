// src/components/game/DiceDie.js
import React, { useCallback, useRef } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { DICE_FACE_IMAGES } from '../../constants/GameConstants';
import { colors } from '../../theme';

/**
 * Один кубик перемещения — перетаскивается на зону усиления (AbilityZones).
 * Во время драга кубик визуально "прилипает" ЦЕНТРОМ ровно к текущей точке
 * курсора/пальца (e.absoluteX/Y), а не сохраняет смещение точки хвата —
 * специально, чтобы то, что видно, и то, что хит-тестится (та же
 * e.absoluteX/Y, см. onDragMove/onDrop), было ГАРАНТИРОВАННО одной и той же
 * точкой по построению, без отдельного вычисления смещения. Раньше кубик
 * двигался через e.translationX/Y от точки хвата — если схватить его не
 * строго по центру, видимая позиция расходилась с хит-тестом (жалоба
 * пользователя "подсветка зоны срабатывает не там, где кубик"). Смещение
 * для transform считаем как (текущий absoluteX/Y − origin в состоянии
 * покоя, измеренный через measureInWindow), а НЕ через e.translationX/Y —
 * последний оказался ненадёжен при быстром программном вводе (проверено
 * живым прогоном: translationX/Y застревало в 0, хотя absoluteX/Y исправно
 * отражал реальную позицию).
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
    const originX = useSharedValue(0);
    const originY = useSharedValue(0);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const dragging = useSharedValue(false);
    const dieRef = useRef(null);

    const measure = useCallback(() => {
        dieRef.current?.measureInWindow((x, y, width, height) => {
            originX.value = x + width / 2;
            originY.value = y + height / 2;
        });
    }, [originX, originY]);

    const pan = Gesture.Pan()
        .enabled(value != null && draggable)
        .onStart(() => {
            dragging.value = true;
        })
        .onUpdate((e) => {
            translateX.value = e.absoluteX - originX.value;
            translateY.value = e.absoluteY - originY.value;
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
        // На вебе поверх едет независимый "призрак" кубика (см. dragGhost в
        // PlayerInfoPanel) — без этого во время драга были видны ДВА кубика
        // одновременно (этот, застрявший под карточкой по стекингу, и призрак
        // поверх неё). На native призрака нет — там сам кубик и есть обратная
        // связь, прятать нечего.
        opacity: Platform.OS === 'web' && dragging.value ? 0 : 1,
    }));

    if (value == null) {
        return <View style={[styles.emptySlot, { width: size, height: size, borderRadius: size / 2 }]} />;
    }

    return (
        <GestureDetector gesture={pan}>
            <Animated.View ref={dieRef} onLayout={measure} style={[styles.die, { width: size, height: size }, animatedStyle]}>
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
