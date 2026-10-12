// src/components/ui/NeonGlow.js
import React from 'react';
import { View } from 'react-native';
import { colors } from '../../theme';

/**
 * Лёгкая имитация неонового свечения по краю прямоугольной плитки —
 * 2026-10-11, по прямому запросу пользователя ("по краям PersonPanel пусть
 * будет неоновое свечение", затем "и панели усилений/кубиков хода").
 *
 * Настоящий блюр-ореол (shadowColor/shadowRadius) на Android ненадёжен —
 * цветную тень RN там в большинстве случаев не рисует вообще (известное
 * ограничение, в этом проекте для "свечения" иконок/рамок всегда
 * использовался ДРУГОЙ приём — ореол запечён прямо в PNG-ассет, см.
 * CLAUDE.md "Перекраска неона под цвет игрока"/кнопки меню). Перегенерировать
 * ассеты PersonPanel/FramePanel под это было бы кардинально более тяжёлой
 * правкой — вместо этого тут чисто программная имитация: три вложенных
 * `borderWidth`-кольца одного цвета, толще/прозрачнее снаружи → тоньше/ярче
 * у самого края (яркий чёткий ободок + мягкий размытый "подсвет" перед ним).
 * `borderWidth` в RN откусывает полосу ВНУТРЬ бокса (не наружу) — поэтому
 * свечение целиком умещается в уже существующих границах `size`, никогда не
 * вылезая за них. Это важно: контейнеры-владельцы (dATile/dATileCompact в
 * PlayerInfoPanel.js) стоят с `overflow:'hidden'` (осознанная защита от
 * другого класса бага, не связанного с этим) — свечение наружу эта защита
 * бы просто обрезала, внутрь — никогда не упирается в неё.
 *
 * `size`/`radius` — те же значения, что уже передаются соседнему
 * PersonPanel/FramePanel (radius — `NOTCH_RADIUS`/`frameNotchRadius(...)`,
 * чтобы скругление свечения совпадало со скруглением самой рамки).
 */
export default function NeonGlow({ size, radius = 0, color = colors.neonCyan }) {
    if (!size) return null;
    return (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute', top: 0, left: 0,
                width: size.width, height: size.height,
                borderRadius: radius, overflow: 'hidden',
            }}
        >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, borderWidth: 8, borderColor: color, opacity: 0.18 }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, borderWidth: 4, borderColor: color, opacity: 0.35 }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, borderWidth: 1.5, borderColor: color, opacity: 0.9 }} />
        </View>
    );
}
