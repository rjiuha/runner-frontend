// src/components/game/CellHighlight.js
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

/**
 * Подсветка доступной для тапа клетки (2026-10-14, по прямому запросу
 * пользователя — живые макеты согласованы в сессии через mcp__visualize,
 * заменяет прежнюю сплошную полупрозрачную заливку+рамку клетки целиком).
 * `kind`:
 *  - 'move' — зелёная точка-эллипс по центру клетки, пульсирует размером
 *    (растёт/уменьшается). Покрывает ВСЕ "сюда можно переместиться/
 *    встать" случаи (tapMode 'move'/'start'/'reaper' — см. GameBoardScreen,
 *    единая семантика "тапни эту клетку, чтобы куда-то переместиться").
 *  - 'shoot' — неподвижный крест в центре + квадратная рамка (tapMode
 *    'shoot'/'reaperShoot'). Статичный, одинаковый код на обеих платформах
 *    (2026-10-16, по прямому запросу пользователя — раньше рамка вращалась
 *    и схлопывалась в точку, цвет пульсировал красный↔жёлтый; теперь просто
 *    неподвижный красный прицел, см. CROSSHAIR_COLOR_GROWN).
 *
 * 'move' (единственный оставшийся анимированный kind) — та же пара путей
 * "native Animated / web CSS @keyframes", что уже используют RunnerToken.js
 * (пульсация кольца выбора) и PulseHighlight.js (цветовой пульс) — JS
 * `Animated` с `useNativeDriver:true` на Android/iOS, чистый
 * `animationKeyframes` через `StyleSheet.create()` на вебе (тот ключ
 * работает ТОЛЬКО через StyleSheet.create, см. докстринг PulseHighlight.js
 * за подтверждённым разбором).
 *
 * Форма точки — ТОТ ЖЕ приём "растянутая окружность" (scaleX на круге), что
 * и у кольца выбора в RunnerToken.js, не прямоугольник с `borderRadius:
 * height/2` — последний даёт "стадион" (плоские бока), не истинный эллипс
 * (живая жалоба пользователя на точно такую форму у кольца выбора,
 * 2026-10-14, тот же фикс применён и тут на опережение, пока не попросили
 * отдельно). Пульс — ОДИН зацикленный `timing(0→1)` + `interpolate` в
 * треугольную волну, НЕ `loop(sequence([up,down]))` — та версия давала
 * видимый "скачок" на границе цикла (тот же живой баг, см. RunnerToken.js).
 */
const DOT_SIZE = 0.2; // сторона базового круга, доля `size`
const DOT_ASPECT = 1.7; // scaleX — во сколько раз эллипс шире круга
// Скорость достижения макс/мин размера — х2 от кольца выбора под бегуном
// (2026-10-14, по прямому запросу пользователя) — RunnerToken.js#
// SELECT_PULSE_MS=900 (время одной половины цикла), тут вдвое быстрее =
// вдвое короче половина цикла. Держать синхронно при правке одной стороны.
const DOT_PULSE_MS = 450;
const DOT_PULSE_MIN = 0.78;
const DOT_PULSE_MAX = 1.22;
// 2026-10-16: прицел статичный, цвет зафиксирован на этом (раньше это была
// одна из двух крайних точек пульса — "полный размер/фиксация").
const CROSSHAIR_COLOR_GROWN = colors.danger;
// Рамка прицела — НЕ сплошная линия по периметру: у каждой из 4 сторон свой
// разрыв посередине (2026-10-14, по прямому запросу пользователя) — вместо
// одного `borderWidth`-квадрата рисуется 8 коротких закрашенных отрезков
// (по 2 на сторону), см. frameSegments() ниже. RETICLE_GAP_RATIO — доля
// длины стороны, которая остаётся разрывом (поровну с обоих концов стороны).
const RETICLE_BORDER_WIDTH = 2.5;
const RETICLE_GAP_RATIO = 0.3;

/** 8 отрезков (2 на сторону квадрата squareSize×squareSize) с разрывом RETICLE_GAP_RATIO в середине каждой стороны. */
function frameSegments(squareSize) {
    const half = (squareSize - squareSize * RETICLE_GAP_RATIO) / 2;
    const t = RETICLE_BORDER_WIDTH;
    return [
        { left: 0, top: 0, width: half, height: t },
        { left: squareSize - half, top: 0, width: half, height: t },
        { left: 0, top: squareSize - t, width: half, height: t },
        { left: squareSize - half, top: squareSize - t, width: half, height: t },
        { left: 0, top: 0, width: t, height: half },
        { left: 0, top: squareSize - half, width: t, height: half },
        { left: squareSize - t, top: 0, width: t, height: half },
        { left: squareSize - t, top: squareSize - half, width: t, height: half },
    ];
}

export default function CellHighlight({ kind, width, height }) {
    const size = Math.min(width, height);
    const dotPulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (kind !== 'move' || Platform.OS === 'web') return undefined;
        dotPulse.setValue(0);
        const anim = Animated.loop(
            Animated.timing(dotPulse, { toValue: 1, duration: DOT_PULSE_MS * 2, useNativeDriver: true }),
        );
        anim.start();
        return () => anim.stop();
    }, [kind, dotPulse]);
    const dotScale = dotPulse.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [DOT_PULSE_MIN, DOT_PULSE_MAX, DOT_PULSE_MIN],
    });

    // 2026-10-16, по прямому запросу пользователя — прицел выстрела больше
    // НЕ анимируется (ни вращение квадрата, ни схлопывание в точку, ни
    // пульсация цвета). `spin`/`colorPulse` Animated.Value убраны целиком —
    // статичный цвет (CROSSHAIR_COLOR_GROWN, тот же "полный размер/
    // фиксация", что раньше было одной из двух крайних точек пульса) и
    // неподвижный квадрат (rotate 0, scale 1).
    const reticleColor = CROSSHAIR_COLOR_GROWN;

    if (kind === 'move') {
        const dotD = size * DOT_SIZE;
        return (
            <View pointerEvents="none" style={[styles.wrap, { width, height }]}>
                {Platform.OS === 'web' ? (
                    <View style={[styles.moveDotWeb, { width: dotD, height: dotD, borderRadius: dotD / 2 }]} />
                ) : (
                    <Animated.View
                        style={{
                            width: dotD,
                            height: dotD,
                            borderRadius: dotD / 2,
                            backgroundColor: colors.success,
                            transform: [{ scaleX: DOT_ASPECT }, { scale: dotScale }],
                        }}
                    />
                )}
            </View>
        );
    }

    if (kind === 'shoot') {
        const squareSize = size * 0.52;
        const crossLen = size * 0.3;
        const segments = frameSegments(squareSize);
        return (
            <View pointerEvents="none" style={[styles.wrap, { width, height }]}>
                <View style={{ position: 'absolute', width: squareSize, height: squareSize }}>
                    {segments.map((seg, i) => (
                        <View key={i} style={[styles.reticleSegment, seg, { backgroundColor: reticleColor }]} />
                    ))}
                </View>
                <View style={{ position: 'absolute', width: crossLen, height: 2.5, backgroundColor: reticleColor }} />
                <View style={{ position: 'absolute', width: 2.5, height: crossLen, backgroundColor: reticleColor }} />
            </View>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
    moveDotWeb: {
        backgroundColor: colors.success,
        animationKeyframes: [{
            '0%': { transform: 'scale(0.78)' },
            '50%': { transform: 'scale(1.22)' },
            '100%': { transform: 'scale(0.78)' },
        }],
        animationDuration: `${DOT_PULSE_MS * 2}ms`,
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
    },
    // Один отрезок рамки прицела (см. frameSegments()) — закрашенный
    // прямоугольник, не borderWidth: по 2 коротких штриха на каждую из 4
    // сторон квадрата дают разрыв посередине вместо сплошного периметра.
    // backgroundColor задаётся инлайн (reticleColor, см. тело компонента —
    // 2026-10-16, статичный цвет, одинаковый на обеих платформах).
    reticleSegment: { position: 'absolute' },
});
