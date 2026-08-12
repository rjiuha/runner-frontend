// src/components/game/BoardGrid.js
import React from 'react';
import { Animated, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SEGMENT_IMAGES } from '../../constants/GameConstants';

/**
 * Прокручиваемая сетка сегментов дороги. Ряды через один сдвинуты на
 * пол-ячейки (кирпичная кладка), сама прокрутка — через Animated.View
 * и xOffset, приходящий из useBoardScroll.
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
    onSegmentPress,
}) {
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
                            .map((segment) => (
                                <TouchableOpacity
                                    key={segment.id}
                                    onPress={() => onSegmentPress(segment)}
                                    style={{ width: segmentW, height: segmentH }}
                                >
                                    <Image
                                        source={SEGMENT_IMAGES[segment.type] || SEGMENT_IMAGES.danger}
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
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center' },
});
