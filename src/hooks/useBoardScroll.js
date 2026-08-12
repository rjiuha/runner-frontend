// src/hooks/useBoardScroll.js
import { useCallback, useRef } from 'react';
import { Animated, Easing, PanResponder, Platform } from 'react-native';
import { useScrollAnimation } from './useScrollAnimation';

/**
 * Единый интерфейс горизонтальной прокрутки поля:
 * - веб — зажатие стрелки крутит с постоянной скоростью (useScrollAnimation);
 * - мобильные — палец тащит трек (PanResponder), а стрелки листают блоками
 *   по COLS ячеек (snapToBlock).
 *
 * Оба набора хуков вызываются безусловно (Platform.OS не меняется в течение
 * жизни приложения, но условный вызов хуков всё равно нарушает Rules of Hooks
 * и был багом в прежней версии) — ветвится только то, что возвращается наружу.
 */
export function useBoardScroll({ minOffset, segmentW, cols, totalBlocks, webScrollSpeed = 20 }) {
    const isWeb = Platform.OS === 'web';

    const webScroll = useScrollAnimation(minOffset, { scrollSpeed: webScrollSpeed });

    const mobileXOffset = useRef(new Animated.Value(0)).current;
    const minOffsetRef = useRef(minOffset);
    const segmentWRef = useRef(segmentW);
    const startXOffsetRef = useRef(0);
    const isAnimatingRef = useRef(false);

    // Обновляем на каждый рендер, чтобы обработчики жестов видели актуальные
    // границы/размеры без пересоздания PanResponder.
    minOffsetRef.current = minOffset;
    segmentWRef.current = segmentW;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_evt, gestureState) =>
                !isAnimatingRef.current && Math.abs(gestureState.dx) > 5,
            onPanResponderGrant: () => {
                startXOffsetRef.current = mobileXOffset._value;
            },
            onPanResponderMove: (_evt, gestureState) => {
                const newOffset = startXOffsetRef.current + gestureState.dx;
                const clamped = Math.max(minOffsetRef.current, Math.min(0, newOffset));
                mobileXOffset.setValue(clamped);
            },
            // Лёгкая инерция по скорости флика при отпускании — без снэпа к фрагментам,
            // палец по-прежнему двигает трек свободно, просто отпускание не обрывает
            // движение резко. Это грубая оценка "наката" по времени, а не физическая
            // симуляция, но на ощупь ближе к обычному тачскролу.
            onPanResponderRelease: (_evt, gestureState) => {
                if (Math.abs(gestureState.vx) < 0.15) return;

                const current = mobileXOffset._value;
                const projected = current + gestureState.vx * 180;
                const target = Math.max(minOffsetRef.current, Math.min(0, projected));

                Animated.timing(mobileXOffset, {
                    toValue: target,
                    duration: 280,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }).start();
            },
        }),
    ).current;

    const snapToBlock = useCallback(
        (direction) => {
            if (isAnimatingRef.current) return;

            const currentOffset = mobileXOffset._value;
            const blockWidth = cols * segmentWRef.current;
            const quotient = Math.floor(-currentOffset / blockWidth); // 0..totalBlocks-1

            const targetBlockIndex =
                direction === 'left' ? Math.max(0, quotient - 1) : Math.min(totalBlocks - 1, quotient + 1);

            if (targetBlockIndex === quotient) return; // на границе — двигаться некуда

            const targetOffset = -targetBlockIndex * blockWidth;
            isAnimatingRef.current = true;
            Animated.timing(mobileXOffset, {
                toValue: targetOffset,
                duration: 300,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start(() => {
                isAnimatingRef.current = false;
            });
        },
        [cols, totalBlocks, mobileXOffset],
    );

    if (isWeb) {
        return {
            xOffset: webScroll.xOffset,
            containerHandlers: {},
            leftButtonProps: { onPressIn: () => webScroll.startScroll(1), onPressOut: webScroll.stopScroll },
            rightButtonProps: { onPressIn: () => webScroll.startScroll(-1), onPressOut: webScroll.stopScroll },
        };
    }

    return {
        xOffset: mobileXOffset,
        containerHandlers: panResponder.panHandlers,
        leftButtonProps: { onPress: () => snapToBlock('left') },
        rightButtonProps: { onPress: () => snapToBlock('right') },
    };
}
