// src/components/game/FragmentLabelStrip.js
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../theme';
import { FRAGMENT_COLORS } from '../../constants/GameConstants';

/**
 * Узкая полоса слева от доски (портретная раскладка) — показывает имя
 * фрагмента(ов) трассы, видимых в текущем окне прокрутки (см.
 * lib/board#computeFragmentBands). Текст развёрнут на 90° — читается, если
 * повернуть телефон в альбомную ориентацию (по прямому запросу пользователя,
 * 2026-08-30). Раньше этот зазор просто пустовал (сетка центрировалась в
 * доступной ширине, оставляя одинаковые поля по бокам) — освобождён под эту
 * полосу вместо того, чтобы пропадать зря (см. useBoardLayout.labelStripW).
 *
 * Если окно прокрутки как раз пересекает стык двух фрагментов — полоса
 * делится на пропорциональные секции (высота каждой = число видимых колонок
 * этого фрагмента × размер клетки) с разделительной линией между ними — так
 * граница между фрагментами видна прямо во время скролла, а не только в
 * момент, когда экран целиком показывает один фрагмент.
 *
 * Каждая секция залита СВОИМ сплошным цветом (FRAGMENT_COLORS[blockIndex],
 * см. GameConstants) — по прямому запросу пользователя, 2026-08-30 (было:
 * одинаковый нейтральный фон + текст). Тот же цвет используется на самой
 * сетке для линии-подсветки стыка (BoardGrid#fragmentBoundaryLine) — единая
 * цветовая кодировка "этот цвет = этот фрагмент" в обоих местах.
 */
const MIN_LABEL_BAND_PX = 40; // короче — текст всё равно не влезет читаемо, просто пустая секция с разделителем

export default function FragmentLabelStrip({ bands, width, segmentSize, totalHeight }) {
    return (
        <View style={[styles.strip, { width, height: totalHeight }]}>
            {bands.map((band, idx) => {
                const heightPx = band.count * segmentSize;
                const label = band.name ? `${band.blockIndex + 1} · ${band.name}` : `Фрагмент ${band.blockIndex + 1}`;
                const bandColor = FRAGMENT_COLORS[band.blockIndex % FRAGMENT_COLORS.length];
                return (
                    <View
                        key={`${band.blockIndex}-${idx}`}
                        style={[
                            styles.band,
                            { height: heightPx, width, backgroundColor: bandColor },
                            idx > 0 && styles.bandDivider,
                        ]}
                    >
                        {heightPx >= MIN_LABEL_BAND_PX && (
                            <Text numberOfLines={1} style={[styles.label, { width: heightPx - 8 }]}>
                                {label}
                            </Text>
                        )}
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    // column-reverse: bands[0] (наименьший localCol, ближе к началу трассы/
    // панели игрока) рисуется внизу — то же направление, что и сама сетка
    // (см. BoardGrid#laneColumn).
    strip: { flexDirection: 'column-reverse', overflow: 'hidden' },
    band: { alignItems: 'center', justifyContent: 'center' },
    // Сплошная заливка (bandColor, см. JSX) сама маркирует стык — разделитель
    // нужен только чтобы граница читалась чётко, а не просто "цвет сменился".
    bandDivider: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.45)' },
    label: {
        // Сплошной белый (не textOnDarkSecondary) — нужен ровный контраст на
        // любом из FRAGMENT_COLORS, не только на нейтральном тёмном фоне.
        color: colors.textOnDark,
        fontSize: font.tiny,
        fontWeight: 'bold',
        transform: [{ rotate: '-90deg' }],
        textAlign: 'center',
    },
});
