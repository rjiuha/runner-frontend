// src/components/game/DiceFace.js
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, shadow } from '../../theme';

// Позиции точек в сетке 3x3 [row, col] — стандартная раскладка граней D6.
const PIP_LAYOUT = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

/**
 * Одна грань кубика — рисуется кодом (не картинкой): тело нужного размера
 * и цвета игрока, точки поверх по стандартной раскладке 3x3. Раньше грань
 * была PNG-ассетом (dice_p2_N.png) с зашитыми в пиксели красной рамкой и
 * обводкой точек — ни цвет игрока, ни tintColor (перекрасил бы точки в тот
 * же цвет, что и тело — они непрозрачные, не маска) не могли его перекрасить.
 */
export default function DiceFace({ value, color = colors.primary, size = 44 }) {
    if (value == null) {
        return <View style={[styles.empty, { width: size, height: size, borderRadius: size * 0.22 }]} />;
    }

    const pad = size * 0.16;
    const cell = (size - pad * 2) / 3;
    const pipSize = size * 0.16;

    return (
        <View style={[styles.face, shadow.card, { width: size, height: size, borderRadius: size * 0.22, backgroundColor: color }]}>
            {PIP_LAYOUT[value].map(([row, col], i) => (
                <View
                    key={i}
                    style={[
                        styles.pip,
                        {
                            width: pipSize,
                            height: pipSize,
                            borderRadius: pipSize / 2,
                            left: pad + col * cell + cell / 2 - pipSize / 2,
                            top: pad + row * cell + cell / 2 - pipSize / 2,
                        },
                    ]}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    face: { position: 'relative' },
    pip: { position: 'absolute', backgroundColor: '#1a1a1a' },
    empty: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.25)',
        opacity: 0.4,
    },
});
