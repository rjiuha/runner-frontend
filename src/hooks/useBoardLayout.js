// src/hooks/useBoardLayout.js
import { useWindowDimensions } from 'react-native';
import { BOARD_LAYOUT, LAYOUT } from '../constants/GameConstants';

/** Отступ, который GameBoardScreen передаёт в RoadArea (spacing). Держим в одном месте,
 *  чтобы геометрия сетки и реальный визуальный отступ никогда не разъезжались. */
export const ROAD_AREA_SPACING = 12;

/**
 * Раскладка экрана сессии — панель игрока + зона дороги. Считает геометрию
 * из текущих размеров окна при каждом рендере (важно для ресайза/поворота на
 * вебе и смены ориентации на мобильных) и адаптивно переключается между
 * альбомной раскладкой (панель слева, доска скроллится по горизонтали) и
 * портретной (панель снизу, доска скроллится по вертикали) — по фактическому
 * соотношению сторон окна, а не по платформе: на любом устройстве уже, чем
 * выше, включается портретная раскладка.
 *
 * ROWS (6 дорожек) — всегда ось, которая должна поместиться ЦЕЛИКОМ без
 * скролла (высота — в альбомной, ширина — в портретной). COLS (8 ячеек одного
 * фрагмента трассы) — всегда ось скролла, под неё вьюпорт считается так,
 * чтобы один фрагмент помещался без обрезки (симметрично в обеих раскладках).
 */
export function useBoardLayout() {
    const { width: screenW, height: screenH } = useWindowDimensions();
    const { ROWS, COLS, TOTAL_BLOCKS, TOTAL_COLS } = BOARD_LAYOUT;
    const orientation = screenH >= screenW ? 'portrait' : 'landscape';

    if (orientation === 'portrait') {
        const panelH = Math.round(
            Math.min(LAYOUT.PANEL_MAX_H, Math.max(LAYOUT.PANEL_MIN_H, screenH * LAYOUT.PANEL_HEIGHT_RATIO)),
        );
        // Вдвое меньше прежнего (0.15) — по запросу пользователя, освободившееся
        // место идёт панели игрока (panelH выше), не доске: boardBudgetH ниже
        // считается ПОСЛЕ вычета panelH, так что чем панель больше — тем меньше
        // достаётся доске, а меньшие стрелки просто не отъедают лишнего сверху
        // того, что уже забрала панель. Пол в 28 — чтобы кнопка не стала
        // слишком мелкой для пальца.
        const arrowBtnSize = Math.max(28, Math.floor(screenW * 0.075));
        const switcherH = Math.floor(panelH * 0.15);

        const boardBudgetW = Math.max(0, screenW - ROAD_AREA_SPACING * 2);
        const boardBudgetH = Math.max(0, screenH - panelH - arrowBtnSize * 2 - ROAD_AREA_SPACING * 2);

        // Раньше segmentW считался от boardBudgetW (почти вся ширина экрана) ÷ ROWS(6),
        // а segmentH — от boardBudgetH (узкий остаток под доску после панели+стрелок)
        // ÷ COLS(8): широкий бюджет делённый на маленький делитель против узкого
        // бюджета делённого на большой — систематически давало segmentW ЗНАЧИТЕЛЬНО
        // больше segmentH, то есть широкие "альбомные" клетки в портретной раскладке
        // (баг "ширина и высота перепутаны", поймано на скриншоте с реального Android).
        // Теперь ОДИН размер — от ширины (единственная ось, которая ничем не делится
        // с другим UI, значит она и задаёт квадратную клетку), containerHeight/minOffset
        // просто подстраиваются под то, сколько места реально осталось по вертикали —
        // не наоборот.
        const segmentSize = Math.floor(boardBudgetW / ROWS);
        const segmentW = segmentSize;
        const segmentH = segmentSize;

        const roadContainerW = segmentW * ROWS;
        // Не ограничиваем одним фрагментом (в отличие от альбомной раскладки) —
        // берём весь оставшийся вертикальный бюджет целиком, чтобы уместить как
        // можно больше рядов трассы без скролла (было явно запрошено пользователем).
        const roadContainerH = boardBudgetH;

        // Аналог minOffset в альбомной раскладке, только по вертикали и от
        // РЕАЛЬНОГО containerHeight (roadContainerH может быть не кратен COLS
        // ячейкам, в отличие от альбомной раскладки, где вьюпорт всегда ровно
        // один фрагмент) — запас на "кирпичный" сдвиг нечётных дорожек
        // (см. BoardGrid, портретная ветка).
        const totalContentH = TOTAL_COLS * segmentH + segmentH / 2;
        const minOffset = -Math.max(0, totalContentH - roadContainerH);

        return {
            orientation,
            screenW,
            screenH,
            panelH,
            arrowBtnSize,
            switcherH,
            roadContainerW,
            roadContainerH,
            segmentW,
            segmentH,
            minOffset,
            rows: ROWS,
            cols: COLS,
            totalBlocks: TOTAL_BLOCKS,
        };
    }

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
        orientation,
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
