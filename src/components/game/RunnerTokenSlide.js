// src/components/game/RunnerTokenSlide.js
import React, { useLayoutEffect, useRef } from 'react';
import { Animated } from 'react-native';

// Длительность слайда между клетками — примерно совпадает с длительностью
// самой pose-анимации (ANIM_DURATION_MS.move в useRunnerAnimations), чтобы
// бегун и визуально доехал до новой клетки, и "движение ногами" длилось
// примерно столько же, не рассинхронизируясь. Вдвое медленнее исходных 850 —
// по прямому запросу пользователя, 2026-08-31 (держим в паре с move там же).
const SLIDE_DURATION_MS = 1700;

/**
 * Обёртка токена бегуна на доске — плавно СКОЛЬЗИТ от предыдущей позиции к
 * новой при каждом изменении x/y, вместо мгновенного "телепорта" (жалоба
 * пользователя, 2026-08-31: "хочу, чтобы он именно перемещался с помощью
 * анимаций, а не телепортировался из клетки в клетку").
 *
 * Механика: left/top — ВСЕГДА актуальная (целевая) позиция клетки, меняется
 * мгновенно вместе с рендером (никакой рассинхронизации с реальным game-
 * стейтом). Визуальное скольжение — отдельным transform (translateX/Y),
 * который на каждое изменение x/y мгновенно выставляется в "минус дельта"
 * (визуально токен остаётся на СТАРОМ месте, хотя left/top уже на новом) и
 * анимируется обратно к нулю — то есть в итоге токен едет от старой позиции
 * к новой, а базовая позиция (left/top) весь путь уже "правильная".
 *
 * КРИТИЧНО: React key в BoardGrid для этого компонента должен быть id
 * БЕГУНА, а не ключ клетки — иначе при каждом перемещении (клетка меняется)
 * компонент бы пересоздавался и Animated.ValueXY (см. ref ниже) терял бы
 * состояние, скольжение никогда бы не проигрывалось.
 *
 * useLayoutEffect, НЕ useEffect — обычный useEffect выполняется ПОСЛЕ отрисовки
 * кадра: React успевал бы отрисовать новые left/top (уже целевая клетка) ДО
 * того, как компенсирующий transform выставлялся в "минус дельта" — на один
 * кадр токен был реально виден в конечной точке, потом резко "прыгал" обратно
 * в исходную и только тогда начинал ехать (жалоба пользователя, 2026-08-31).
 * useLayoutEffect выполняется синхронно до того, как обновление уходит на
 * отрисовку — прыжка в исходную позицию никто не видит.
 */
export default function RunnerTokenSlide({ x, y, width, height, style, children }) {
    const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const prevPos = useRef(null);

    useLayoutEffect(() => {
        if (prevPos.current == null) {
            prevPos.current = { x, y };
            return; // первый рендер — ехать неоткуда
        }
        const dx = prevPos.current.x - x;
        const dy = prevPos.current.y - y;
        prevPos.current = { x, y };
        if (dx === 0 && dy === 0) return;

        translate.setValue({ x: dx, y: dy });
        Animated.timing(translate, {
            toValue: { x: 0, y: 0 },
            duration: SLIDE_DURATION_MS,
            useNativeDriver: true,
        }).start();
    }, [x, y, translate]);

    return (
        <Animated.View
            style={[
                style,
                { position: 'absolute', left: x, top: y, width, height },
                { transform: translate.getTranslateTransform() },
            ]}
        >
            {children}
        </Animated.View>
    );
}
