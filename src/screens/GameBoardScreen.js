// src/screens/GameBoardScreen.js
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

import ArrowButton from '../components/game/ArrowButton';
import RoadArea from '../components/game/RoadArea';
import BoardGrid from '../components/game/BoardGrid';
import ParallaxBackground from '../components/ui/ParallaxBackground';
import { useLockLandscape } from '../hooks/useLockLandscape';
import { useBoardLayout } from '../hooks/useBoardLayout';
import { useBoardScroll } from '../hooks/useBoardScroll';
import { buildGridData } from '../lib/board';
import { BOARD_LAYOUT } from '../constants/GameConstants';

export default function GameBoardScreen() {
    useLockLandscape();

    const {
        screenH,
        arrowBtnSize,
        roadContainerW,
        segmentW,
        segmentH,
        minOffset,
        rows,
        cols,
        totalBlocks,
    } = useBoardLayout();

    const { xOffset, containerHandlers, leftButtonProps, rightButtonProps } = useBoardScroll({
        minOffset,
        segmentW,
        cols,
        totalBlocks,
        webScrollSpeed: BOARD_LAYOUT.WEB_SCROLL_SPEED,
    });

    const player = useAudioPlayer(require('../assets/sounds/lazer.mp3'));

    const gridData = useMemo(() => buildGridData(totalBlocks, rows, cols), [totalBlocks, rows, cols]);

    const handleSegmentPress = useCallback(() => {
        player.seekTo(0);
        player.play();
    }, [player]);

    return (
        <View style={styles.wrapper}>
            <ParallaxBackground />

            <ArrowButton direction="left" size={arrowBtnSize} handlers={leftButtonProps} />

            <RoadArea spacing={12} backgroundColor="#3a034b00">
                <BoardGrid
                    gridData={gridData}
                    rows={rows}
                    segmentW={segmentW}
                    segmentH={segmentH}
                    xOffset={xOffset}
                    containerHandlers={containerHandlers}
                    containerWidth={roadContainerW}
                    containerHeight={screenH}
                    onSegmentPress={handleSegmentPress}
                />
            </RoadArea>

            <ArrowButton direction="right" size={arrowBtnSize} handlers={rightButtonProps} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
