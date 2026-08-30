// src/components/game/RoadNavButton.js
import React, { useRef } from 'react';
import { Animated, TouchableOpacity } from 'react-native';
import { ROAD_NAV_BUTTON_IMAGES } from '../../constants/GameConstants';

/**
 * Кнопка навигации по дороге — ассет пользователя (road_map_button_up/
 * down.png, рамка+глиф уже нарисованы внутри) вместо старой кружочной
 * ArrowButton. Анимация нажатия — лёгкое уменьшение (scale) на onPressIn,
 * возврат на onPressOut (Animated.spring, useNativeDriver — GPU-трансформ).
 * activeOpacity={1} у TouchableOpacity — отключает его собственное
 * затемнение, чтобы не накладывалось на нашу scale-анимацию.
 *
 * `direction` — 'up'/'down' рисуют ассеты как есть (портретная раскладка,
 * трасса идёт вертикально). 'left'/'right' (альбомная раскладка/веб, по
 * прямому запросу пользователя — те же ассеты, а не отдельная кружочная
 * ArrowButton) — отдельных файлов под них нет, переиспользуем up/down с
 * поворотом на 90°: 'right' = up повёрнутый по часовой (была вертикальная
 * стрелка вперёд — стала горизонтальная вперёд), 'left' = down повёрнутый
 * по часовой (была "назад" вниз — стала "назад" влево). Сохраняет семантику
 * "up-ассет = вперёд, down-ассет = назад", уже принятую для портрета.
 *
 * `handlers` (из useBoardScroll) несёт onPressIn/onPressOut (посегментный
 * шаг + повтор при удержании, см. useBoardScroll) — оба набора
 * обработчиков (наш scale и внешний handlers) вызываются на ОДНОМ И ТОМ ЖЕ
 * событии явно, а не через слепой спред пропсов (тот бы затёр один другим).
 */
const ROTATED_DIRECTION = {
    right: { image: 'up', rotateDeg: 90 },
    left: { image: 'down', rotateDeg: 90 },
};

export default function RoadNavButton({ direction, size, handlers }) {
    const scale = useRef(new Animated.Value(1)).current;
    const rotated = ROTATED_DIRECTION[direction];
    const imageKey = rotated ? rotated.image : direction;
    const rotateDeg = rotated ? rotated.rotateDeg : 0;

    const animateTo = (toValue) =>
        Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

    const handlePressIn = (e) => {
        animateTo(0.88);
        handlers?.onPressIn?.(e);
    };
    const handlePressOut = (e) => {
        animateTo(1);
        handlers?.onPressOut?.(e);
    };

    return (
        <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.Image
                source={ROAD_NAV_BUTTON_IMAGES[imageKey] ?? ROAD_NAV_BUTTON_IMAGES.up}
                style={{ width: size, height: size, transform: [{ scale }, { rotate: `${rotateDeg}deg` }] }}
                resizeMode="contain"
            />
        </TouchableOpacity>
    );
}
