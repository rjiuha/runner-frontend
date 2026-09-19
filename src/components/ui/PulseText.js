// src/components/ui/PulseText.js
import React, { useMemo } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import { usePulse, PULSE_HALF_MS } from '../../hooks/usePulse';
import { colors, fontFamily } from '../../theme';

/**
 * Текст, медленно "дышащий" зелёным — подсказка "сюда сейчас нужно
 * взаимодействовать" (заголовки "Кубики"/"Бегуны" и т.п., см.
 * PlayerInfoPanel, 2026-09-14, по прямому запросу пользователя).
 *
 * `Animated.Text`, а не обычный `Text` — вручную проставляем `fontFamily`
 * (см. ниже), т.к. `Text`/`Animated.Text` — РАЗНЫЕ компоненты по ссылке, и
 * глобальный jsx-патч в App.js, форсящий кастомный шрифт на каждый `<Text>`,
 * матчит именно по ссылке (`type === Text`) — сам `<Animated.Text>` он не
 * видит. **Это касается ТОЛЬКО native-ветки ниже** — на вебе используется
 * обычный `<Text>`, см. следующий абзац.
 *
 * **На вебе — чистый CSS `@keyframes` вместо `Animated.Text`** (2026-09-19,
 * живая жалоба "при нажатии на кубики начинает сильно тормозить" — см.
 * usePulse.js за полным разбором причины). Раз глобальный форсинг цвета в
 * App.js убран ещё 2026-09-14 ("циан ТОЛЬКО в паре мест"), `noGlobalTint`
 * стал мёртвым пропом и обычный `<Text>` на вебе больше не нужно обходить
 * через `Animated.Text` — патч всё равно не трогает цвет ни у кого.
 * `baseColor`/`toColor` — пропы, разные у разных вызовов (см. GameBoardScreen
 * — "Твой ход" использует другие цвета, чем "Кубики"/"Бегуны" в
 * PlayerInfoPanel), поэтому `StyleSheet.create()` (см. следующий абзац)
 * вызывается ЗДЕСЬ, внутри компонента через `useMemo`, а не статикой модуля
 * (в отличие от PulseHighlight, где цвет всегда один и тот же) —
 * пересоздаётся, только если сами цвета реально меняются (в подавляющем
 * большинстве вызовов — никогда за жизнь компонента, они передаются
 * константой).
 *
 * **`animationKeyframes` реально регистрирует `@keyframes` ТОЛЬКО у стиля,
 * прошедшего через `StyleSheet.create()`** (см. подробный разбор в
 * PulseHighlight.js — та же ошибка была поймана живым замером и тут: голый
 * объект с `animationKeyframes` молча НЕ создаёт CSS-анимацию, хотя соседние
 * `animationDuration`/`animationDirection` из того же объекта применяются
 * как обычные свойства — вводит в заблуждение, что "почти работает").
 * `StyleSheet.create`, вызванный внутри рендера — штатно (сам react-native-web
 * дедуплицирует итоговое CSS-правило по контенту через `createIdentifier`,
 * см. `compiler/index.js` — повторный вызов с ТЕМИ ЖЕ цветами не плодит
 * новых правил), `useMemo` — просто чтобы не звать его каждый рендер
 * впустую.
 *
 * `active=false` — рендерится как обычный статичный текст цвета `baseColor`
 * (хук всё равно вызывается безусловно, см. usePulse — не роняет правило
 * хуков и не пересоздаёт цикл при каждом переключении active).
 */
export default function PulseText({ active, baseColor = colors.textOnDarkSecondary, toColor = colors.success, style, numberOfLines, children }) {
    const pulse = usePulse(active);
    const webAnimStyle = useMemo(() => StyleSheet.create({
        s: {
            animationKeyframes: [{ '0%': { color: baseColor }, '100%': { color: toColor } }],
            animationDuration: `${PULSE_HALF_MS}ms`,
            animationDirection: 'alternate',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
        },
    }).s, [baseColor, toColor]);

    if (Platform.OS === 'web') {
        const webStyle = active ? webAnimStyle : { color: baseColor };
        return (
            <Text numberOfLines={numberOfLines} style={[style, { fontFamily, fontWeight: 'normal' }, webStyle]}>
                {children}
            </Text>
        );
    }

    const color = active
        ? pulse.interpolate({ inputRange: [0, 1], outputRange: [baseColor, toColor] })
        : baseColor;

    return (
        <Animated.Text
            numberOfLines={numberOfLines}
            noGlobalTint
            style={[style, { fontFamily, fontWeight: 'normal' }, { color }]}
        >
            {children}
        </Animated.Text>
    );
}
