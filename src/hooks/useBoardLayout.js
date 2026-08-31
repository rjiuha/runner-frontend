// src/hooks/useBoardLayout.js
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOARD_LAYOUT, LAYOUT, MOBILE_FRAME_BLEED } from '../constants/GameConstants';

/** Отступ, который GameBoardScreen передаёт в RoadArea (spacing). Держим в одном месте,
 *  чтобы геометрия сетки и реальный визуальный отступ никогда не разъезжались. */
export const ROAD_AREA_SPACING = 12;

/**
 * Геометрия самой дороги (вертикальные дорожки, скролл по вертикали) — ОДНА
 * формула на оба случая панели, см. useBoardLayout ниже. До 2026-08-31 (шестой
 * заход) дорога переключалась на отдельную "альбомную" раскладку
 * (горизонтальные дорожки) при широком окне — по прямому запросу пользователя
 * дорога теперь ВСЕГДА вертикальная, как на телефоне, независимо от формы
 * окна; меняется только расположение ПАНЕЛИ игрока (см. orientation ниже,
 * её раскладку пользователь попросил оставить как есть).
 *
 * @param {number} roadZoneW  ширина прямоугольника под дорогу (без панели)
 * @param {number} roadZoneH  высота того же прямоугольника
 * @param {number} arrowReserveH  сколько высоты уже занято кнопками вверх/вниз
 *   (0, если кнопки не в потоке — см. useMobileNavButtons в GameBoardScreen)
 */
function computeRoadGeometry(roadZoneW, roadZoneH, arrowReserveH) {
    const { ROWS, TOTAL_COLS } = BOARD_LAYOUT;

    // Полоса слева от сетки с именем текущего(их) фрагмента(ов) трассы (см.
    // FragmentLabelStrip) — вместо того чтобы центрировать сетку и оставлять
    // пустой зазор по бокам, зазор отдаётся под полезную полосу с текстом.
    const labelStripW = Math.max(22, Math.floor(roadZoneW * 0.06));
    const boardBudgetW = Math.max(0, roadZoneW - ROAD_AREA_SPACING * 2 - labelStripW);
    const boardBudgetH = Math.max(0, roadZoneH - arrowReserveH - ROAD_AREA_SPACING * 2);

    // Клетки — квадратные, размер считается ТОЛЬКО от ширины (не
    // min(ширина,высота)) — на широком экране высота почти всегда была бы
    // лимитирующей осью, из-за чего сетка получалась мельче, чем позволяла
    // ширина. Вертикальная ось (сколько КОЛОНОК трассы видно одновременно,
    // viewportCols ниже) просто подстраивается под то, что остаётся по
    // высоте — безопасно, потому что прокрутка и так посегментная (по одной
    // колонке за раз, см. useBoardScroll), не обязательно показывать ровно
    // целый фрагмент (BOARD_LAYOUT.COLS=8) одновременно.
    const segmentSize = Math.max(1, Math.floor(boardBudgetW / ROWS));
    const segmentW = segmentSize;
    const segmentH = segmentSize;

    // Сколько колонок трассы реально помещается по высоте при этом размере
    // клетки — с запасом в полклетки на кирпичный сдвиг нечётных дорожек.
    const viewportCols = Math.max(
        1,
        Math.min(TOTAL_COLS, Math.floor((boardBudgetH - segmentSize / 2) / segmentSize)),
    );

    const roadContainerW = segmentW * ROWS;
    const roadContainerH = segmentH * viewportCols + segmentH / 2;

    return { labelStripW, roadContainerW, roadContainerH, segmentW, segmentH, viewportCols };
}

/**
 * Раскладка экрана сессии — панель игрока + зона дороги. Считает геометрию
 * из текущих размеров окна при каждом рендере (важно для ресайза/поворота на
 * вебе и смены ориентации на мобильных).
 *
 * `orientation` управляет ТОЛЬКО расположением ПАНЕЛИ игрока — слева на
 * широком окне ('landscape'), снизу на узком ('portrait'), по фактическому
 * соотношению сторон. Сама дорога (см. computeRoadGeometry выше) в обоих
 * случаях — одна и та же вертикальная геометрия, просто от разного бюджета
 * (после вычета места под панель слева либо под панель снизу).
 *
 * ROWS (6 дорожек) — всегда ось, которая должна поместиться ЦЕЛИКОМ без
 * скролла (ширина зоны дороги). COLS (8 ячеек одного фрагмента трассы) —
 * всегда ось скролла (высота зоны дороги).
 */
export function useBoardLayout() {
    const { width: screenW, height: screenH } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { ROWS, COLS, TOTAL_BLOCKS } = BOARD_LAYOUT;
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
        // Было 0.15 — по запросу пользователя ужать переключатель игроков ещё
        // сильнее, отдать освободившееся место списку карточек бегунов (тот же
        // приём, что уже применялся к arrowBtnSize/panelH в четырнадцатом-
        // пятнадцатом заходах). Пол в 36 — переключателю (кружок+подпись+
        // полоска) физически нужно немного места, ниже уже обрежет текст.
        const switcherH = Math.max(36, Math.floor(panelH * 0.09));

        // mobileNav — то же условие, что GameBoardScreen.useMobileNavButtons
        // (портрет+native): там верхняя/нижняя стрелка не рисуются в потоке
        // вообще (кнопки — в абсолютном seamRow на стыке рамок, см. экран),
        // поэтому для этого случая НЕ нужно резервировать под них никакой
        // высоты.
        const mobileNav = Platform.OS !== 'web';
        const reservedArrowsH = mobileNav ? 0 : arrowBtnSize * 2;

        // Мобильная sci-fi рамка (MobileFrameOverlay, только mobileNav-случай)
        // рисует декоративную кайму толщиной arrowBtnSize (borderDp), выступающую
        // НАРУЖУ за истинный правый край экрана на MOBILE_FRAME_BLEED (см.
        // GameBoardScreen — bleed.right) — значит её ВНУТРЕННИЙ край (там, где
        // кайма начинает перекрывать контент) находится на (arrowBtnSize -
        // MOBILE_FRAME_BLEED) px от истинного края, а не на 0.
        const frameEdgeClearance = mobileNav
            ? Math.max(0, arrowBtnSize - MOBILE_FRAME_BLEED - ROAD_AREA_SPACING)
            : 0;

        const roadZoneW = Math.max(0, screenW - frameEdgeClearance);
        // insets.top — GameBoardScreen без SafeAreaView (см. его шапку), сам
        // добавляет paddingTop:insets.top на roadZone, чтобы верхняя
        // стрелка/сетка не рисовалась под статус-баром/вырезом камеры; здесь
        // тот же отступ нужно вычесть из бюджета, иначе низ доски вылезет за
        // пределы зоны.
        const roadZoneH = Math.max(0, screenH - panelH - insets.top);
        const road = computeRoadGeometry(roadZoneW, roadZoneH, reservedArrowsH);

        return {
            orientation,
            screenW,
            screenH,
            panelH,
            arrowBtnSize,
            switcherH,
            ...road,
            rows: ROWS,
            cols: COLS,
            totalBlocks: TOTAL_BLOCKS,
        };
    }

    // Панель слева ("как сейчас", по прямому запросу пользователя) — сама
    // дорога справа от неё всё равно вертикальная (computeRoadGeometry),
    // кнопки вверх/вниз теперь занимают высоту (arrowBtnSize*2), а не ширину
    // сбоку, как было до 2026-08-31 (шестой заход) — освобождает ширину под
    // дорогу, вместо неё раньше стояла отдельная колонка кнопок сбоку.
    const leftPanelW = Math.round(
        Math.min(LAYOUT.LEFT_PANEL_MAX_W, Math.max(LAYOUT.LEFT_PANEL_MIN_W, screenW * LAYOUT.LEFT_PANEL_RATIO)),
    );

    const arrowBtnSize = Math.max(28, Math.floor(screenH * 0.075));

    // Высота зоны переключателя игроков в левой панели — считаем от реальных
    // пикселей окна (как arrowBtnSize), а не долей flex (flex:1/flex:4 внутри
    // панели): на вебе цепочка flex-высот от корня навигатора до панели не
    // всегда даёт панели реальную высоту экрана (нет чёткого height:100% на
    // каждом уровне), из-за чего flex-пропорция переключателя не соблюдалась
    // и он визуально расползался почти на пол-экрана. Фиксированный пиксельный
    // размер не зависит от этой цепочки.
    const switcherH = Math.floor(screenH * 0.15);

    const roadZoneW = Math.max(0, screenW - leftPanelW);
    const roadZoneH = Math.max(0, screenH - insets.top);
    const road = computeRoadGeometry(roadZoneW, roadZoneH, arrowBtnSize * 2);

    return {
        orientation,
        screenW,
        screenH,
        leftPanelW,
        arrowBtnSize,
        switcherH,
        ...road,
        rows: ROWS,
        cols: COLS,
        totalBlocks: TOTAL_BLOCKS,
    };
}
