// src/components/game/RoadNavButton.js
import React, { useRef, useState } from 'react';
import { Animated, TouchableOpacity } from 'react-native';
import { ROAD_NAV_BUTTON_IMAGES } from '../../constants/GameConstants';

/**
 * Кнопка навигации по дороге — ассет пользователя (road_map_button_*,
 * рамка+глиф уже нарисованы внутри) вместо старой кружочной ArrowButton.
 * Анимация нажатия — лёгкое уменьшение (scale) на onPressIn, возврат на
 * onPressOut (Animated.spring, useNativeDriver — GPU-трансформ).
 * activeOpacity={1} у TouchableOpacity — отключает его собственное
 * затемнение, чтобы не накладывалось на нашу scale-анимацию.
 *
 * 2026-10-04: пользователь заменил отдельные up/down.png на ОДИН визуальный
 * ассет ("вперёд", смотрит вверх) + pressed/unpressed — "назад" теперь
 * получается поворотом на 180°, а не отдельным файлом. `ROTATE_DEG` —
 * поворот асcета-"вперёд" под каждое из 4 направлений: 'up' — как есть,
 * 'down' — 180°, 'right'/'left' (альбомная раскладка/веб, тот же ассет, что
 * и в портрете, не отдельная кружочная ArrowButton) — 90°/270° (та же
 * семантика "up-ассет = вперёд по треку", что уже была принята раньше).
 * pressed-ассет подменяется на время удержания пальца (не завязан на
 * направление/поворот — просто другой кадр того же тайла).
 *
 * `handlers` (из useBoardScroll) несёт onPressIn/onPressOut (посегментный
 * шаг + повтор при удержании, см. useBoardScroll) — оба набора
 * обработчиков (наш scale/pressed-стейт и внешний handlers) вызываются на
 * ОДНОМ И ТОМ ЖЕ событии явно, а не через слепой спред пропсов (тот бы
 * затёр один другим).
 */
const ROTATE_DEG = { up: 0, right: 90, down: 180, left: 270 };

export default function RoadNavButton({ direction, size, width, height, handlers }) {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);
    const rotateDeg = ROTATE_DEG[direction] ?? 0;
    // width/height — ОПЦИОНАЛЬНОЕ переопределение `size` по отдельной оси
    // (2026-10-10, по прямому запросу пользователя — кнопки навигации на
    // кайме рамки дороги вдвое шире своей высоты, не квадратные). По
    // умолчанию обе равны `size` — обратная совместимость со всеми
    // существующими местами (navBtnColumnLeft и т.д.), которые как и
    // раньше передают только квадратный `size`.
    const boxW = width ?? size;
    const boxH = height ?? size;

    const animateTo = (toValue) =>
        Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

    const handlePressIn = (e) => {
        animateTo(0.88);
        setPressed(true);
        handlers?.onPressIn?.(e);
    };
    const handlePressOut = (e) => {
        animateTo(1);
        setPressed(false);
        handlers?.onPressOut?.(e);
    };

    return (
        <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.Image
                source={pressed ? ROAD_NAV_BUTTON_IMAGES.pressed : ROAD_NAV_BUTTON_IMAGES.unpressed}
                style={{ width: boxW, height: boxH, transform: [{ scale }, { rotate: `${rotateDeg}deg` }] }}
                // resizeMode="stretch" (2026-10-10, было "contain", живая жалоба
                // пользователя — "ширина не стала вдвое больше"). Ассет почти
                // квадратный (660×648) — с "contain" непропорциональный бокс
                // (boxW=2×boxH) просто центрировал квадратную иконку по высоте,
                // оставляя пустые поля по бокам, визуально ширина не менялась
                // вообще. "stretch" растягивает картинку РОВНО под заданный
                // бокс — для квадратного использования (boxW===boxH, все
                // остальные места) разница от "contain" незаметна (сам ассет
                // и так почти 1:1), а для широкого бокса (кнопки на кайме
                // рамки дороги) даёт реально широкую кнопку.
                resizeMode="stretch"
            />
        </TouchableOpacity>
    );
}
