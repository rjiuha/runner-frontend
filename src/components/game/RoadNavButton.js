// src/components/game/RoadNavButton.js
import React, { useRef } from 'react';
import { Animated, TouchableOpacity } from 'react-native';
import { ROAD_NAV_BUTTON_IMAGES } from '../../constants/GameConstants';

/**
 * Кнопка навигации по дороге для мобильного приложения (портретная
 * раскладка) — ассет пользователя (road_map_button_up/down.png, рамка+глиф
 * уже нарисованы внутри) вместо старой кружочной ArrowButton. Анимация
 * нажатия — лёгкое уменьшение (scale) на onPressIn, возврат на onPressOut
 * (Animated.spring, useNativeDriver — GPU-трансформ). activeOpacity={1} у
 * TouchableOpacity — отключает его собственное затемнение, чтобы не
 * накладывалось на нашу scale-анимацию.
 */
export default function RoadNavButton({ direction, size, handlers }) {
    const scale = useRef(new Animated.Value(1)).current;

    const animateTo = (toValue) =>
        Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

    return (
        <TouchableOpacity
            activeOpacity={1}
            onPressIn={() => animateTo(0.88)}
            onPressOut={() => animateTo(1)}
            {...handlers}
        >
            <Animated.Image
                source={ROAD_NAV_BUTTON_IMAGES[direction] ?? ROAD_NAV_BUTTON_IMAGES.up}
                style={{ width: size, height: size, transform: [{ scale }] }}
                resizeMode="contain"
            />
        </TouchableOpacity>
    );
}
