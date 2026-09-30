// src/components/game/DicePips.js
import React from 'react';
import { View } from 'react-native';
import { colors } from '../../theme';

/**
 * Грань игрового кубика (1-6), нарисованная ЧИСТО из View (точки в стандартной
 * 3×3-сетке позиций игральной кости) — БЕЗ картинки (2026-10-01, прямой
 * запрос пользователя "нахуй эти ассеты", после нескольких неудачных заходов
 * подогнать resizeMode под не-квадратный исходный PNG dice_p2_N.png, см.
 * историю в DiceDie.js/git). Бокс ВСЕГДА `size×size` (передаётся явно,
 * снаружи), поэтому кубик структурно НЕ МОЖЕТ стать прямоугольником — нет
 * никакого исходного изображения с собственными пропорциями, которое надо
 * было бы вписывать/обрезать.
 *
 * `color`/`dotColor` — по умолчанию тот же красный (colors.danger) + белые
 * точки, что был у растрового ассета на скриншотах игры (не выдумано, снято
 * визуально с существующих кубиков). Используется и в трее (DiceDie.js), и
 * в ghost-превью при драге (PlayerInfoPanel.js) — те же пропы, тот же вид,
 * не расходится между собой.
 */
const PIP_LAYOUTS = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

export default function DicePips({ value, size, color = colors.danger, dotColor = '#fff' }) {
    const positions = PIP_LAYOUTS[value] || [];
    const dotSize = Math.max(3, Math.round(size * 0.16));
    const borderWidth = Math.max(1, Math.round(size * 0.06));
    const borderRadius = Math.round(size * 0.18);
    // Сетка 3×3 считается от ВНУТРЕННЕЙ области (за вычетом borderWidth), а
    // НЕ от полного `size` — 2026-10-01, живая жалоба "верхние точки со
    // смещением, нижние наезжают на край". Причина: `position:'absolute'` у
    // точек позиционируется RN ОТНОСИТЕЛЬНО padding-box родителя (внутрь от
    // рамки, `borderWidth` у самого бокса не в счёт) — раньше `cellSize`
    // считался от полного `size`, будто рамки нет вообще. У верхних/левых
    // точек (маленькие top/left) это почти не заметно, а у нижних/правых
    // (большие top/left, близко к краю) не хватало ровно `borderWidth` — они
    // визуально наезжали на саму рамку. `innerSize` — реальная доступная
    // область для сетки, что и требуется.
    const innerSize = size - borderWidth * 2;
    const cellSize = innerSize / 3;

    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius,
                borderWidth,
                borderColor: color,
                backgroundColor: `${color}26`,
                overflow: 'hidden',
            }}
        >
            {positions.map(([row, col], i) => (
                <View
                    key={i}
                    style={{
                        position: 'absolute',
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: dotColor,
                        left: Math.round(col * cellSize + cellSize / 2 - dotSize / 2),
                        top: Math.round(row * cellSize + cellSize / 2 - dotSize / 2),
                    }}
                />
            ))}
        </View>
    );
}
