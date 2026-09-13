// src/components/ui/PulseText.js
import React from 'react';
import { Animated } from 'react-native';
import { usePulse } from '../../hooks/usePulse';
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
 * видит.
 *
 * **`noGlobalTint` ОБЯЗАТЕЛЕН здесь** (живой баг, найден 2026-09-14 —
 * "Кубики" на Android оставался плоским циан, не пульсировал) — вопреки
 * первому впечатлению, `Animated.Text` НЕ обходит патч целиком:
 * `createAnimatedComponent` (RN, `Libraries/Animated/createAnimatedComponent.js`)
 * рендерит настоящий `<Text {...reducedProps} style={mergedStyle} />` ВНУТРИ
 * себя — та же самая JSX-конструкция, транспилируемая ТЕМ ЖЕ автоматическим
 * jsx-рантаймом (Metro транформирует и node_modules), так что патч ловит
 * именно этот ВНУТРЕННИЙ вызов (`type` там — реальный `Text`, импортированный
 * из react-native, тот же самый модуль/ссылка, что и в App.js). Без
 * `noGlobalTint` патч дописывал бы `color: colors.neonCyan` ПОСЛЕДНИМ
 * элементом объединённого style-массива, статично перекрывая нашу
 * анимированную интерполяцию цвета. `noGlobalTint` — обычный React-проп,
 * `createAnimatedComponent` копирует ВСЕ незнакомые пропы как есть
 * (`{...staticProps}` в `AnimatedProps.__getValueWithStaticProps`), так что
 * он доезжает до внутреннего `<Text>` и там же считывается патчем.
 *
 * `active=false` — рендерится как обычный статичный текст цвета `baseColor`
 * (хук всё равно вызывается безусловно, см. usePulse — не роняет правило
 * хуков и не пересоздаёт цикл при каждом переключении active).
 */
export default function PulseText({ active, baseColor = colors.textOnDarkSecondary, toColor = colors.success, style, numberOfLines, children }) {
    const pulse = usePulse(active);
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
