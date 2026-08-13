// src/hooks/useBoardScroll.js
import { useCallback, useRef } from 'react';
import { Animated, Easing, PanResponder, Platform } from 'react-native';
import { useScrollAnimation } from './useScrollAnimation';

/**
 * Единый интерфейс прокрутки поля вдоль оси скролла:
 * - веб — зажатие стрелки крутит с постоянной скоростью (useScrollAnimation);
 * - мобильные — палец тащит трек (PanResponder), а стрелки листают блоками
 *   по COLS ячеек (snapToBlock).
 *
 * `axis` ('x' | 'y') — вдоль какой оси экрана идёт скролл: 'x' в альбомной
 * раскладке (доска скроллится по горизонтали), 'y' в портретной (по
 * вертикали) — читает dy/vy жеста напрямую, БЕЗ инверсии: с BoardGrid'ом на
 * `column-reverse` (см. его шапку) знак offset'а для портрета положительный
 * (0=начало, minOffset>0=дальше по треку), и палец вниз естественно даёт
 * dy>0 → offset растёт → трасса открывается дальше — ровно то поведение,
 * которое подтвердил пользователь ("тянешь трассу к себе").
 *
 * `minOffset` может быть ОТРИЦАТЕЛЬНЫМ (альбомная раскладка, ось X) или
 * ПОЛОЖИТЕЛЬНЫМ (портретная, ось Y, см. useBoardLayout) — весь клэмпинг и
 * арифметика блоков ниже считают через `Math.sign(minOffset)`, а не жёстко
 * зашитый диапазон [minOffset, 0], чтобы не дублировать логику под два знака.
 *
 * Оба набора хуков (веб/мобильные) вызываются безусловно (Platform.OS не
 * меняется в течение жизни приложения, но условный вызов хуков всё равно
 * нарушает Rules of Hooks и был багом в прежней версии) — ветвится только то,
 * что возвращается наружу.
 */
export function useBoardScroll({ minOffset, segmentSize, cols, totalBlocks, axis = 'x', webScrollSpeed = 20 }) {
    const isWeb = Platform.OS === 'web';

    const webScroll = useScrollAnimation(minOffset, { scrollSpeed: webScrollSpeed });

    const mobileOffset = useRef(new Animated.Value(0)).current;
    const minOffsetRef = useRef(minOffset);
    const segmentSizeRef = useRef(segmentSize);
    const startOffsetRef = useRef(0);
    const isAnimatingRef = useRef(false);

    // Обновляем на каждый рендер, чтобы обработчики жестов видели актуальные
    // границы/размеры без пересоздания PanResponder.
    minOffsetRef.current = minOffset;
    segmentSizeRef.current = segmentSize;

    const delta = (gestureState) => (axis === 'y' ? gestureState.dy : gestureState.dx);
    const velocity = (gestureState) => (axis === 'y' ? gestureState.vy : gestureState.vx);

    // Диапазон допустимых значений offset'а — между 0 и minOffset, независимо
    // от того, какой из них больше (знак minOffset зависит от оси, см. шапку).
    const clamp = (v) => {
        const m = minOffsetRef.current;
        const lo = Math.min(0, m);
        const hi = Math.max(0, m);
        return Math.max(lo, Math.min(hi, v));
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_evt, gestureState) =>
                !isAnimatingRef.current && Math.abs(delta(gestureState)) > 5,
            onPanResponderGrant: () => {
                startOffsetRef.current = mobileOffset._value;
            },
            onPanResponderMove: (_evt, gestureState) => {
                mobileOffset.setValue(clamp(startOffsetRef.current + delta(gestureState)));
            },
            // Лёгкая инерция по скорости флика при отпускании — без снэпа к фрагментам,
            // палец по-прежнему двигает трек свободно, просто отпускание не обрывает
            // движение резко. Это грубая оценка "наката" по времени, а не физическая
            // симуляция, но на ощупь ближе к обычному тачскролу.
            onPanResponderRelease: (_evt, gestureState) => {
                const v = velocity(gestureState);
                if (Math.abs(v) < 0.15) return;

                const target = clamp(mobileOffset._value + v * 180);

                Animated.timing(mobileOffset, {
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

            // dir: +1 если minOffset положительный (портрет/Y), -1 если
            // отрицательный (альбомная/X, как было изначально) — переводит
            // текущий offset в "магнитуду продвижения вперёд" (всегда >=0
            // между 0 и |minOffset|), чтобы дальше считать блоки одной
            // формулой независимо от знака.
            const dir = minOffsetRef.current < 0 ? -1 : 1;
            const currentForward = dir * mobileOffset._value;
            const blockSize = cols * segmentSizeRef.current;
            const quotient = Math.floor(currentForward / blockSize); // 0..totalBlocks-1

            const targetBlockIndex =
                direction === 'back' ? Math.max(0, quotient - 1) : Math.min(totalBlocks - 1, quotient + 1);

            if (targetBlockIndex === quotient) return; // на границе — двигаться некуда

            // Последний блок — не чистое кратное blockSize: minOffset уже включает
            // запас на "кирпичный" сдвиг нечётных дорожек (см. useBoardLayout), иначе
            // самая дальняя дорожка в последнем блоке не долистывалась до конца.
            const targetOffset =
                targetBlockIndex === totalBlocks - 1 ? minOffsetRef.current : dir * targetBlockIndex * blockSize;
            isAnimatingRef.current = true;
            Animated.timing(mobileOffset, {
                toValue: targetOffset,
                duration: 300,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start(() => {
                isAnimatingRef.current = false;
            });
        },
        [cols, totalBlocks, mobileOffset],
    );

    if (isWeb) {
        // useScrollAnimation.startScroll(direction): +1 = к дальнему концу
        // (minOffset, т.е. forward), -1 = обратно к началу (0, т.е. back) —
        // знак НЕ зависит от знака самого minOffset (сам хук разбирается).
        return {
            offset: webScroll.xOffset,
            containerHandlers: {},
            backButtonProps: { onPressIn: () => webScroll.startScroll(-1), onPressOut: webScroll.stopScroll },
            forwardButtonProps: { onPressIn: () => webScroll.startScroll(1), onPressOut: webScroll.stopScroll },
        };
    }

    return {
        offset: mobileOffset,
        containerHandlers: panResponder.panHandlers,
        backButtonProps: { onPress: () => snapToBlock('back') },
        forwardButtonProps: { onPress: () => snapToBlock('forward') },
    };
}
