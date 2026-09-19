// src/components/ui/PulseHighlight.js
import React from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { usePulse, PULSE_HALF_MS } from '../../hooks/usePulse';
import { colors } from '../../theme';

/**
 * Абсолютный оверлей-подсветка — рамка и/или лёгкая заливка, медленно
 * "дышащие" зелёным поверх уже готового содержимого (карточка бегуна, зона
 * усиления, панель кубиков, кнопка "Пропустить усиление" — см.
 * PlayerInfoPanel/RunnerCard/AbilityZone/GameBoardScreen, 2026-09-14, по
 * прямому запросу пользователя). Родитель ОБЯЗАН быть `position:'relative'`
 * (или flex-контейнером по умолчанию — RN и так `position:'relative'` для
 * View) — тот же приём, что уже применяется в проекте для подсветки клеток
 * на доске (BoardGrid), не встраивается в style-массив самого компонента,
 * чтобы не трогать его логику ради визуального эффекта.
 *
 * `pointerEvents="none"` — оверлей никогда не перехватывает тапы/драг у
 * содержимого под собой. `active=false` — компонент рендерит null (хук
 * пульса при этом продолжает жить и корректно гасится, см. usePulse).
 *
 * `showBorder`/`showBackground` — независимые переключатели: рамка карточки/
 * зоны (заметная, но не "слишком яркая" — берём альфа-канал у зелёного, не
 * чистый colors.success) и/или лёгкая заливка панели кубиков ("панелька
 * тоже ненавязчиво мигает слегка не слишком ярко", по прямому пожеланию).
 *
 * **На вебе — чистый CSS `@keyframes` вместо `Animated.View`** (2026-09-19,
 * живая жалоба "при нажатии на кубики начинает сильно тормозить" — см.
 * usePulse.js за полным разбором причины: JS-driven color-анимация у до
 * 5-8 одновременных подсветок во время своего хода). `animationKeyframes` —
 * официальный web-only ключ StyleSheet (react-native-web 0.21+), тот же
 * приём, что уже подтверждён и работает для вращающегося ореола выбора
 * бегуна в RunnerToken.js — анимация целиком на браузерном compositor-потоке,
 * JS/React в неё вообще не вовлечён на каждый кадр.
 *
 * **ВАЖНО: `animationKeyframes` реально регистрирует `@keyframes` ТОЛЬКО у
 * стиля, прошедшего через `StyleSheet.create()`** (проверено чтением
 * `react-native-web/.../StyleSheet/compiler/index.js` — этот ключ явно
 * исключён (`_excluded`) из обычного инлайн-маппинга свойств в
 * `createReactDOMStyle`, обрабатывается ТОЛЬКО компилятором атомарных
 * классов, который вызывается из `StyleSheet.create`). Живой замер (DOM,
 * `getComputedStyle`) поймал именно эту ошибку в первой версии этого файла:
 * `animationDuration`/`animationDirection` (обычные CSS-свойства) применялись
 * из голого объекта, а `animationKeyframes` молча ИГНОРИРОВАЛСЯ —
 * `animation-name` оставался `none`, анимация физически не запускалась.
 * Отсюда — `StyleSheet.create()` ниже, не голые объекты. Цвета фиксированы
 * (всегда `colors.success`, ни один вызывающий код не передаёт другой) —
 * регистрация статическая, один раз при загрузке модуля.
 */
const webStyles = StyleSheet.create({
    border: {
        animationKeyframes: [{
            '0%': { borderColor: 'rgba(46,204,113,0)' },
            '100%': { borderColor: colors.success },
        }],
        animationDuration: `${PULSE_HALF_MS}ms`,
        animationDirection: 'alternate',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
    },
    background: {
        animationKeyframes: [{
            '0%': { backgroundColor: 'rgba(46,204,113,0)' },
            '100%': { backgroundColor: 'rgba(46,204,113,0.16)' },
        }],
        animationDuration: `${PULSE_HALF_MS}ms`,
        animationDirection: 'alternate',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
    },
});

export default function PulseHighlight({
    active,
    borderRadius = 0,
    borderWidth = 2,
    showBorder = true,
    showBackground = false,
    style,
}) {
    const pulse = usePulse(active);
    if (!active) return null;

    if (Platform.OS === 'web') {
        // Обычный View, НЕ Animated.View — на вебе тут нет никакой JS-анимации,
        // которую Animated должен был бы отслеживать (вся анимация — статика,
        // уходит браузеру через animationKeyframes выше).
        return (
            <View
                pointerEvents="none"
                style={[
                    StyleSheet.absoluteFill,
                    { borderRadius },
                    showBorder && [{ borderWidth }, webStyles.border],
                    showBackground && webStyles.background,
                    style,
                ]}
            />
        );
    }

    const borderColor = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(46,204,113,0)', colors.success],
    });
    const backgroundColor = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(46,204,113,0)', 'rgba(46,204,113,0.16)'],
    });

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                StyleSheet.absoluteFill,
                { borderRadius },
                showBorder && { borderWidth, borderColor },
                showBackground && { backgroundColor },
                style,
            ]}
        />
    );
}
