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
 *  - 'shoot' — неподвижный крест в центре + квадратная рамка, вращающаяся
 *    вокруг него (tapMode 'shoot'/'reaperShoot'); за первую половину
 *    оборота рамка схлопывается в точку (центр перекрестия), за вторую —
 *    плавно возвращается к полному размеру (см. squareScale ниже). Цвет (и
 *    рамки, и самого креста) синхронно меняется с размером — красный на
 *    полном размере/"фиксации", жёлтый в точке (см. reticleColor).
 *
 * Та же пара путей "native Animated / web CSS @keyframes", что уже
 * используют RunnerToken.js (пульсация кольца выбора) и PulseHighlight.js
 * (цветовой пульс) — JS `Animated` с `useNativeDriver:true` на
 * Android/iOS, чистый `animationKeyframes` через `StyleSheet.create()` на
 * вебе (тот ключ работает ТОЛЬКО через StyleSheet.create, см. докстринг
 * PulseHighlight.js за подтверждённым разбором).
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
const RETICLE_SPIN_MS = 3200;
const CROSSHAIR_COLOR_GROWN = colors.danger; // полный размер/"фиксация" (spin 0 и 1)
const CROSSHAIR_COLOR_POINT = '#f1c40f'; // схлопнулся в точку (spin 0.5)
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
    const spin = useRef(new Animated.Value(0)).current;

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

    useEffect(() => {
        if (kind !== 'shoot' || Platform.OS === 'web') return undefined;
        spin.setValue(0);
        const anim = Animated.loop(
            Animated.timing(spin, { toValue: 1, duration: RETICLE_SPIN_MS, useNativeDriver: true }),
        );
        anim.start();
        return () => anim.stop();
    }, [kind, spin]);
    // Цвет (2026-10-14, по прямому запросу пользователя — красный на полном
    // размере/"фиксации", жёлтый в точке) — ОТДЕЛЬНЫЙ JS-driven Animated.Value
    // (`useNativeDriver:false`), не производная от `spin`: `spin` крутится на
    // НАТИВНОМ потоке (useNativeDriver:true выше), а backgroundColor нативным
    // драйвером не поддерживается — значение `spin._value` на JS-стороне не
    // обновляется вообще, пока анимация идёт нативно (та же причина, почему
    // PulseHighlight.js использует отдельный JS-driven `usePulse`, не делит
    // Animated.Value с transform-анимациями). Тот же период/фаза
    // (RETICLE_SPIN_MS, старт в 0 синхронно с spin в эффекте выше) — на глаз
    // не расходится, хотя это два независимых таймера.
    const colorPulse = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (kind !== 'shoot' || Platform.OS === 'web') return undefined;
        colorPulse.setValue(0);
        const anim = Animated.loop(
            Animated.timing(colorPulse, { toValue: 1, duration: RETICLE_SPIN_MS, useNativeDriver: false }),
        );
        anim.start();
        return () => anim.stop();
    }, [kind, colorPulse]);
    const reticleColor = colorPulse.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [CROSSHAIR_COLOR_GROWN, CROSSHAIR_COLOR_POINT, CROSSHAIR_COLOR_GROWN],
    });

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
        const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
        // Размер квадрата — от ТОГО ЖЕ spin (0→1 = один оборот), по прямому
        // запросу пользователя: за первую половину оборота схлопывается в
        // точку (центр перекрестия), за вторую — плавно возвращается к
        // полному размеру. Один общий driver — вращение и масштаб всегда
        // синхронны (не два независимых цикла, которые могли бы разъехаться
        // по фазе).
        const squareScale = spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 1] });
        const segments = frameSegments(squareSize);
        return (
            <View pointerEvents="none" style={[styles.wrap, { width, height }]}>
                {Platform.OS === 'web' ? (
                    <View style={[styles.reticleSquareWeb, { width: squareSize, height: squareSize }]}>
                        {segments.map((seg, i) => (
                            <View key={i} style={[styles.reticleSegment, styles.reticleColorWeb, seg]} />
                        ))}
                    </View>
                ) : (
                    <Animated.View
                        style={{
                            position: 'absolute',
                            width: squareSize,
                            height: squareSize,
                            transform: [{ rotate }, { scale: squareScale }],
                        }}
                    >
                        {segments.map((seg, i) => (
                            <Animated.View key={i} style={[styles.reticleSegment, seg, { backgroundColor: reticleColor }]} />
                        ))}
                    </Animated.View>
                )}
                {Platform.OS === 'web' ? (
                    <>
                        <View style={[styles.reticleColorWeb, { position: 'absolute', width: crossLen, height: 2.5 }]} />
                        <View style={[styles.reticleColorWeb, { position: 'absolute', width: 2.5, height: crossLen }]} />
                    </>
                ) : (
                    <>
                        <Animated.View style={{ position: 'absolute', width: crossLen, height: 2.5, backgroundColor: reticleColor }} />
                        <Animated.View style={{ position: 'absolute', width: 2.5, height: crossLen, backgroundColor: reticleColor }} />
                    </>
                )}
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
    reticleSquareWeb: {
        // position:'relative' — ОБЯЗАТЕЛЕН на вебе (react-native-web
        // компилирует в настоящий CSS): без него абсолютные reticleSegment-
        // дети анкерились бы к следующему реально позиционированному
        // предку выше по дереву (styles.wrap), а не к этому квадрату.
        // На native лишний (RN сам резолвит absolute-детей к прямому
        // родителю независимо от его position), но не мешает.
        position: 'relative',
        // rotate линейно весь оборот, scale — та же треугольная волна
        // 1→0→1, что и на native (см. squareScale выше) — один keyframes,
        // чтобы вращение и схлопывание в точку оставались синхронными.
        animationKeyframes: [{
            '0%': { transform: 'rotate(0deg) scale(1)' },
            '50%': { transform: 'rotate(180deg) scale(0)' },
            '100%': { transform: 'rotate(360deg) scale(1)' },
        }],
        animationDuration: `${RETICLE_SPIN_MS}ms`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
    },
    // Один отрезок рамки прицела (см. frameSegments()) — закрашенный
    // прямоугольник, не borderWidth: по 2 коротких штриха на каждую из 4
    // сторон квадрата дают разрыв посередине вместо сплошного периметра.
    // backgroundColor НЕ тут — анимированный (см. reticleColorWeb/
    // reticleColor), эта запись задаёт только форму/позицию.
    reticleSegment: { position: 'absolute' },
    // Цвет (красный на полном размере/"фиксации", жёлтый в точке) — ТЕ ЖЕ
    // 3 контрольные точки (0/0.5/1), что и у squareScale/rotate выше, но
    // своим keyframes: на вебе CSS сам интерполирует backgroundColor,
    // отдельный JS-driven Animated.Value (см. colorPulse) тут не нужен —
    // то ограничение специфично для native (backgroundColor не поддержан
    // native-драйвером). Общий стиль — используется и сегментами рамки, и
    // двумя полосками перекрестия ("перекрестие тоже" — прямой запрос).
    reticleColorWeb: {
        animationKeyframes: [{
            '0%': { backgroundColor: CROSSHAIR_COLOR_GROWN },
            '50%': { backgroundColor: CROSSHAIR_COLOR_POINT },
            '100%': { backgroundColor: CROSSHAIR_COLOR_GROWN },
        }],
        animationDuration: `${RETICLE_SPIN_MS}ms`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
    },
});
