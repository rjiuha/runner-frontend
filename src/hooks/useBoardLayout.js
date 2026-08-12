// src/hooks/useBoardLayout.js
import { useWindowDimensions } from 'react-native';
import { BOARD_LAYOUT, LAYOUT } from '../constants/GameConstants';

/** Отступ, который GameBoardScreen передаёт в RoadArea (spacing). Держим в одном месте,
 *  чтобы геометрия сетки и реальный визуальный отступ никогда не разъезжались. */
export const ROAD_AREA_SPACING = 12;

/**
 * Раскладка экрана сессии: левая панель игрока + правая зона дороги.
 * Ничего не хранит — пересчитывает геометрию из текущих размеров окна при
 * каждом рендере (важно для ресайза/поворота на вебе и альбомной ориентации
 * на мобильных).
 *
 * Сначала считаем segmentW/H от бюджета зоны, и УЖЕ ИЗ НИХ выводим точные
 * containerWidth/Height (segmentW*cols, segmentH*rows) — так фрагмент 6×8
 * помещается в зону дороги без обрезки и без щели в один пиксель, а не
 * борется с padding RoadArea за лишнее место.
 */
export function useBoardLayout() {
    const { width: screenW, height: screenH } = useWindowDimensions();
    const { ROWS, COLS, TOTAL_BLOCKS, TOTAL_COLS } = BOARD_LAYOUT;

    const leftPanelW = Math.round(
        Math.min(LAYOUT.LEFT_PANEL_MAX_W, Math.max(LAYOUT.LEFT_PANEL_MIN_W, screenW * LAYOUT.LEFT_PANEL_RATIO)),
    );

    const arrowBtnSize = Math.floor(screenH * 0.15);
    const roadZoneW = Math.max(0, screenW - leftPanelW);
    const roadBudgetW = Math.max(0, roadZoneW - arrowBtnSize * 2 - ROAD_AREA_SPACING * 2);
    const roadBudgetH = Math.max(0, screenH - ROAD_AREA_SPACING * 2);

    const segmentW = Math.floor(roadBudgetW / COLS);
    const segmentH = Math.floor(roadBudgetH / ROWS);

    const minOffset = -(TOTAL_COLS - COLS) * segmentW;

    return {
        screenW,
        screenH,
        leftPanelW,
        arrowBtnSize,
        roadContainerW: segmentW * COLS,   // ровно один фрагмент 8 колонок в ширину
        roadContainerH: segmentH * ROWS,   // все 6 дорожек по высоте, без обрезки
        segmentW,
        segmentH,
        minOffset,
        rows: ROWS,
        cols: COLS,
        totalBlocks: TOTAL_BLOCKS,
    };
}
