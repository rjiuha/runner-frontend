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

    // Высота зоны переключателя игроков в левой панели — считаем от реальных
    // пикселей окна (как arrowBtnSize), а не долей flex (flex:1/flex:4 внутри
    // панели): на вебе цепочка flex-высот от корня навигатора до панели не
    // всегда даёт панели реальную высоту экрана (нет чёткого height:100% на
    // каждом уровне), из-за чего flex-пропорция переключателя не соблюдалась
    // и он визуально расползался почти на пол-экрана. Фиксированный пиксельный
    // размер не зависит от этой цепочки.
    const switcherH = Math.floor(screenH * 0.15);
    const roadZoneW = Math.max(0, screenW - leftPanelW);
    const roadBudgetW = Math.max(0, roadZoneW - arrowBtnSize * 2 - ROAD_AREA_SPACING * 2);
    const roadBudgetH = Math.max(0, screenH - ROAD_AREA_SPACING * 2);

    const segmentW = Math.floor(roadBudgetW / COLS);
    const segmentH = Math.floor(roadBudgetH / ROWS);

    // Нечётные ряды в BoardGrid сдвинуты вправо на segmentW/2 (кирпичная кладка),
    // поэтому их правый край дальше, чем у чётных — без запаса на пол-ячейки
    // прокрутка упиралась в границу раньше, чем последняя колонка нечётных
    // рядов успевала полностью появиться на экране (баг: обрезанный
    // крайний правый фрагмент на нечётных дорожках).
    const minOffset = -((TOTAL_COLS - COLS) * segmentW + segmentW / 2);

    return {
        screenW,
        screenH,
        leftPanelW,
        arrowBtnSize,
        switcherH,
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
