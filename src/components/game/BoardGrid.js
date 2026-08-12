// src/components/game/BoardGrid.js
import React, { useMemo } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BOARD_LAYOUT, SEGMENT_IMAGES } from '../../constants/GameConstants';
import { indexRunnersByCell } from '../../lib/board';
import RunnerToken from './RunnerToken';

/**
 * Прокручиваемая сетка сегментов дороги. Ряды через один сдвинуты на
 * пол-ячейки (кирпичная кладка), сама прокрутка — через Animated.View
 * и xOffset, приходящий из useBoardScroll.
 *
 * Токены бегунов раньше рисовались как оверлей ВНУТРИ каждой ячейки-
 * TouchableOpacity, поверх её Image. На Android это иногда давало токен ПОД
 * картинкой сегмента (view-flattening/компоновка Image+TouchableOpacity —
 * не удалось стопроцентно подтвердить причину статическим чтением, только
 * симптом от пользователя), и точечный фикс zIndex/elevation внутри ячейки
 * не помог. Поэтому токены теперь рисуются ОДНИМ отдельным абсолютным слоем
 * НАД всей сеткой целиком (после всех строк в JSX, тем же родителем — тем же
 * Animated.View, чтобы ехать вместе с прокруткой), с пиксельными координатами,
 * посчитанными вручную по той же геометрии (segmentW/H + кирпичный сдвиг
 * нечётных рядов), а не вложенными в каждую ячейку — так они гарантированно
 * поверх всех сегментов независимо от компоновки конкретной ячейки.
 *
 * Тап по клетке всегда сообщается наружу через onCellPress: используется и
 * для звука/фидбека, и для тап-плейсмента выбранного бегуна.
 */
export default function BoardGrid({
    gridData,
    rows,
    cols,
    segmentW,
    segmentH,
    xOffset,
    containerHandlers,
    containerWidth,
    containerHeight,
    runners = [],
    playerColorById = {},
    selectedRunnerId = null,
    onCellPress,
}) {
    const runnersByCell = useMemo(() => indexRunnersByCell(runners), [runners]);
    const tokenSize = Math.floor(Math.min(segmentW, segmentH) * 0.72);

    // Ключ карты — "segment-row-localCol" (см. lib/board#indexRunnersByCell).
    // Переводим его в пиксельные координаты той же формулой, что уже
    // определяет визуальную позицию ячейки: глобальная колонка
    // (segment*cols + localCol) * segmentW, плюс запас в пол-ячейки на
    // нечётных рядах (кирпичная кладка, см. marginLeft у styles.row).
    const tokenOverlay = useMemo(() => {
        const items = [];
        for (const [key, cellRunners] of runnersByCell.entries()) {
            const [segStr, rowStr, colStr] = key.split('-');
            const segment = Number(segStr);
            const row = Number(rowStr);
            const localCol = Number(colStr);
            const globalCol = segment * cols + localCol;
            const x = globalCol * segmentW + (row % 2 !== 0 ? segmentW / 2 : 0);
            const y = row * segmentH;
            items.push({ key, x, y, topRunner: cellRunners[0], count: cellRunners.length });
        }
        return items;
    }, [runnersByCell, cols, segmentW, segmentH]);

    return (
        <View
            style={[styles.container, { width: containerWidth, height: containerHeight }]}
            {...containerHandlers}
        >
            <Animated.View style={{ transform: [{ translateX: xOffset }] }}>
                {Array.from({ length: rows }).map((_, rowIdx) => (
                    <View
                        key={`row-${rowIdx}`}
                        style={[styles.row, rowIdx % 2 !== 0 && { marginLeft: segmentW / 2 }]}
                    >
                        {gridData
                            .filter((seg) => seg.row === rowIdx)
                            .map((cell) => (
                                <TouchableOpacity
                                    key={cell.id}
                                    onPress={() => onCellPress?.(cell)}
                                    style={{ width: segmentW, height: segmentH }}
                                    activeOpacity={0.75}
                                >
                                    <Image
                                        source={SEGMENT_IMAGES[cell.type] || SEGMENT_IMAGES.road}
                                        style={{
                                            width: segmentW,
                                            height: segmentH,
                                            resizeMode: 'stretch',
                                            opacity: 0.9,
                                        }}
                                    />
                                </TouchableOpacity>
                            ))}
                    </View>
                ))}

                <View
                    style={[
                        styles.tokenOverlayLayer,
                        // Явные пиксельные width/height вместо inset-стретчинга
                        // (StyleSheet.absoluteFillObject: top/left/right/bottom:0):
                        // родитель (Animated.View) сам без явного размера — его
                        // ширина/высота выводятся из контента (строк), а не
                        // заданы числом. Стретч через отступы 0/0/0/0 у ребёнка
                        // рассчитывает на то, что размер родителя уже известен
                        // ДО этого прохода компоновки — на части рендеров/платформ
                        // это давало нулевой размер оверлея (токены пропадали
                        // целиком, а не просто не на своём месте). Числовой размер
                        // не зависит от этого нюанса компоновки.
                        { width: BOARD_LAYOUT.TOTAL_COLS * segmentW, height: rows * segmentH },
                    ]}
                    pointerEvents="none"
                >
                    {tokenOverlay.map(({ key, x, y, topRunner, count }) => (
                        <View
                            key={key}
                            style={[styles.tokenLayer, { left: x, top: y, width: segmentW, height: segmentH }]}
                        >
                            <RunnerToken
                                type={topRunner.type}
                                color={playerColorById[topRunner.playerId]}
                                size={tokenSize}
                                selected={topRunner.id === selectedRunnerId}
                            />
                            {count > 1 && (
                                <View style={styles.stackBadge}>
                                    <Text style={styles.stackBadgeText}>+{count - 1}</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center' },
    // Один слой на всю сетку, растянутый по размеру Animated.View (сумма
    // строк) — см. комментарий в JSX про то, почему токены больше не
    // вложены в ячейки.
    tokenOverlayLayer: { position: 'absolute', top: 0, left: 0, zIndex: 2, elevation: 2 },
    tokenLayer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stackBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 14,
        height: 14,
        borderRadius: 7,
        paddingHorizontal: 3,
        backgroundColor: '#000000cc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stackBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
});
