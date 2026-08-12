// src/hooks/useBoardLayout.js
import { useWindowDimensions } from 'react-native';
import { BOARD_LAYOUT } from '../constants/GameConstants';

/**
 * Раскладка игрового поля. Ничего не хранит — просто пересчитывает
 * геометрию из текущих размеров окна при каждом рендере (важно для
 * ресайза/поворота на вебе и переходов альбомной ориентации на мобильных).
 */
export function useBoardLayout() {
    const { width: screenW, height: screenH } = useWindowDimensions();
    const { ROWS, COLS, TOTAL_BLOCKS, TOTAL_COLS } = BOARD_LAYOUT;

    const arrowBtnSize = Math.floor(screenH * 0.15);
    const roadContainerW = Math.floor(screenW - arrowBtnSize * 2);
    const segmentW = Math.floor(roadContainerW / (COLS * 1.07));
    const segmentH = Math.floor(screenH / ROWS);
    const minOffset = -(TOTAL_COLS - COLS) * segmentW;

    return {
        screenW,
        screenH,
        arrowBtnSize,
        roadContainerW,
        segmentW,
        segmentH,
        minOffset,
        rows: ROWS,
        cols: COLS,
        totalBlocks: TOTAL_BLOCKS,
    };
}
