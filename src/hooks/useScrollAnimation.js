// src/hooks/useScrollAnimation.js
import { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Непрерывная прокрутка «пока зажата кнопка» — нужна на вебе, где нет
 * тач-жеста перетаскивания. На границах даёт лёгкий перехлёст и пружинный откат.
 *
 * `minOffset` — "дальний" конец диапазона, `0` — "ближний" (начало трассы).
 * Может быть ОТРИЦАТЕЛЬНЫМ (альбомная раскладка, скролл по X) или
 * ПОЛОЖИТЕЛЬНЫМ (портретная, по Y — см. useBoardLayout) — direction в
 * startScroll(direction) всегда означает "+1 = к дальнему концу (в сторону
 * minOffset), -1 = обратно к началу (в сторону 0)" НЕЗАВИСИМО от знака
 * minOffset; фактический знак смещения на кадр домножается на dirSign.
 *
 * @param {number} minOffset  дальний конец диапазона (см. выше)
 * @param {object} [options]
 * @param {number} [options.scrollSpeed]
 */
export function useScrollAnimation(minOffset, options = {}) {
    const { scrollSpeed = 20 } = options;
    const xOffset = useRef(new Animated.Value(0)).current;
    const isScrollingRef = useRef(0);
    const rafIdRef = useRef(null);
    const minOffsetRef = useRef(minOffset);
    minOffsetRef.current = minOffset;

    const stopScroll = useCallback(() => {
        isScrollingRef.current = 0;
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    }, []);

    const animateStep = useCallback(() => {
        if (!isScrollingRef.current) return;

        const m = minOffsetRef.current;
        const dirSign = m < 0 ? -1 : 1; // знак движения "к дальнему концу"
        const nearBound = 0;
        const farBound = m;

        const currentValue = xOffset._value ?? 0;
        const nextValue = currentValue + isScrollingRef.current * dirSign * scrollSpeed;

        const isAtFarBoundary = isScrollingRef.current > 0 && dirSign > 0 && currentValue >= farBound - 1;
        const isAtFarBoundaryNeg = isScrollingRef.current > 0 && dirSign < 0 && currentValue <= farBound + 1;
        const isAtNearBoundary = isScrollingRef.current < 0 && dirSign > 0 && currentValue <= nearBound + 1;
        const isAtNearBoundaryNeg = isScrollingRef.current < 0 && dirSign < 0 && currentValue >= nearBound - 1;

        const atFar = isAtFarBoundary || isAtFarBoundaryNeg;
        const atNear = isAtNearBoundary || isAtNearBoundaryNeg;

        if (atFar || atNear) {
            stopScroll();
            const restValue = atFar ? farBound : nearBound;
            const overshoot = restValue + (atFar ? dirSign : -dirSign) * 20;

            Animated.sequence([
                Animated.timing(xOffset, { toValue: overshoot, duration: 150, useNativeDriver: true }),
                Animated.spring(xOffset, { toValue: restValue, friction: 8, tension: 40, useNativeDriver: true }),
            ]).start();
        } else {
            xOffset.setValue(nextValue);
            rafIdRef.current = requestAnimationFrame(animateStep);
        }
    }, [scrollSpeed, stopScroll, xOffset]);

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
