// src/hooks/useScrollAnimation.js
import { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

const MAX_OFFSET = 0;

/**
 * Непрерывная прокрутка «пока зажата кнопка» — нужна на вебе, где нет
 * тач-жеста перетаскивания. На границах даёт лёгкий перехлёст и пружинный откат.
 *
 * @param {number} minOffset  крайнее левое положение (отрицательное число)
 * @param {object} [options]
 * @param {number} [options.scrollSpeed]
 */
export function useScrollAnimation(minOffset, options = {}) {
    const { scrollSpeed = 20 } = options;
    const xOffset = useRef(new Animated.Value(0)).current;
    const isScrollingRef = useRef(0);
    const rafIdRef = useRef(null);

    const stopScroll = useCallback(() => {
        isScrollingRef.current = 0;
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    }, []);

    const animateStep = useCallback(() => {
        if (!isScrollingRef.current) return;

        const currentValue = xOffset._value ?? 0;
        const nextValue = currentValue + isScrollingRef.current * scrollSpeed;

        const isAtRightBoundary = isScrollingRef.current > 0 && currentValue >= MAX_OFFSET - 1;
        const isAtLeftBoundary = isScrollingRef.current < 0 && currentValue <= minOffset + 1;

        if (isAtRightBoundary || isAtLeftBoundary) {
            stopScroll();

            Animated.sequence([
                Animated.timing(xOffset, {
                    toValue: isAtRightBoundary ? MAX_OFFSET + 20 : minOffset - 20,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.spring(xOffset, {
                    toValue: isAtRightBoundary ? MAX_OFFSET : minOffset,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            xOffset.setValue(nextValue);
            rafIdRef.current = requestAnimationFrame(animateStep);
        }
    }, [scrollSpeed, minOffset, stopScroll, xOffset]);

    const startScroll = useCallback(
        (direction) => {
            if (isScrollingRef.current === direction) return;
            isScrollingRef.current = direction;
            rafIdRef.current = requestAnimationFrame(animateStep);
        },
        [animateStep],
    );

    useEffect(() => () => stopScroll(), [stopScroll]);

    return { xOffset, startScroll, stopScroll };
}
