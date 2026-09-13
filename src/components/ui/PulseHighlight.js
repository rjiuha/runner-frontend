// src/components/ui/PulseHighlight.js
import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { usePulse } from '../../hooks/usePulse';
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
 */
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
