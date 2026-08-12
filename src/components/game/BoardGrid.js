// src/components/game/BoardGrid.js
import React, { useMemo } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SEGMENT_IMAGES } from '../../constants/GameConstants';
import { indexRunnersByCell } from '../../lib/board';
import RunnerToken from './RunnerToken';

/**
 * Прокручиваемая сетка сегментов дороги. Ряды через один сдвинуты на
 * пол-ячейки (кирпичная кладка), сама прокрутка — через Animated.View
 * и xOffset, приходящий из useBoardScroll.
 *
 * Поверх ячеек рисуются токены бегунов (см. lib/board#indexRunnersByCell) —
 * если на клетке несколько бегунов, видна верхняя фишка и бейдж "+N".
 * Тап по клетке всегда сообщается наружу через onCellPress: используется и
 * для звука/фидбека, и для тап-плейсмента выбранного бегуна.
 */
export default function BoardGrid({
    gridData,
    rows,
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
                            .map((cell) => {
                                const cellRunners = runnersByCell.get(cell.id);
                                const topRunner = cellRunners?.[0];

                                return (
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

                                        {topRunner && (
                                            <View style={styles.tokenLayer} pointerEvents="none">
                                                <RunnerToken
                                                    type={topRunner.type}
                                                    color={playerColorById[topRunner.playerId]}
                                                    size={tokenSize}
                                                    selected={topRunner.id === selectedRunnerId}
                                                />
                                                {cellRunners.length > 1 && (
                                                    <View style={styles.stackBadge}>
                                                        <Text style={styles.stackBadgeText}>
                                                            +{cellRunners.length - 1}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                    </View>
                ))}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center' },
    tokenLayer: {
        ...StyleSheet.absoluteFillObject,
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
