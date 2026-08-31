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
 * @param {number} [minViewportCols]  если задано, размер клетки ограничивается
 *   ещё и высотой так, чтобы влезло НЕ МЕНЬШЕ этого числа колонок (см. вызов
 *   для широкого окна ниже) — без этого клетка считается только от ширины
 *   (см. комментарий у segmentSize) и на широком/невысоком окне видно всего
 *   1-2 колонки трассы (жалоба пользователя, 2026-08-31, третий заход: "в
 *   веб-браузерной версии отображается только по 2 сегмента, сделай 8").
 * @param {boolean} [reserveNavColumn]  зарезервировать ли ширину под колонку
 *   кнопок навигации СЛЕВА от дороги (см. GameBoardScreen — RoadNavButton
 *   размером navBtnSize, ВСЕГДА половина сегмента, по прямому запросу
 *   пользователя 2026-08-31, третий заход). false только для mobileNav-
 *   случая (кнопки там в абсолютном seamRow, ширину/высоту потока не
 *   занимают вообще).
 */
function computeRoadGeometry(roadZoneW, roadZoneH, minViewportCols = null, reserveNavColumn = false) {
    const { ROWS, TOTAL_COLS } = BOARD_LAYOUT;

    // Полоса слева от сетки с именем текущего(их) фрагмента(ов) трассы (см.
    // FragmentLabelStrip) — вместо того чтобы центрировать сетку и оставлять
    // пустой зазор по бокам, зазор отдаётся под полезную полосу с текстом. На
    // вебе — вдвое уже (0.03 вместо 0.06), по прямому запросу пользователя,
    // 2026-08-31, третий заход; на native (телефон) — как было.
    const labelStripRatio = Platform.OS === 'web' ? 0.03 : 0.06;
    const labelStripW = Math.max(22, Math.floor(roadZoneW * labelStripRatio));
    const boardBudgetW = Math.max(0, roadZoneW - ROAD_AREA_SPACING * 2 - labelStripW);
    const boardBudgetH = Math.max(0, roadZoneH - ROAD_AREA_SPACING * 2);

    // Клетки — квадратные, размер по умолчанию считается ТОЛЬКО от ширины (не
    // min(ширина,высота)) — на узком экране (телефон) высота почти всегда
    // была бы лимитирующей осью, из-за чего сетка получалась мельче, чем
    // позволяла ширина. Вертикальная ось (сколько КОЛОНОК трассы видно
    // одновременно, viewportCols ниже) просто подстраивается под то, что
    // остаётся по высоте — безопасно, потому что прокрутка и так посегментная
    // (по одной колонке за раз, см. useBoardScroll), не обязательно
    // показывать ровно целый фрагмент (BOARD_LAYOUT.COLS=8) одновременно. На
    // широком окне (см. minViewportCols) это давало слишком крупные клетки и
    // всего 1-2 видимые колонки — там размер клетки ограничивается ЕЩЁ и
    // высотой, с тем же запасом в половину клетки на кирпичный сдвиг, что и
    // у viewportCols ниже, просто применённым заранее к самому сегменту.
    //
    // reserveNavColumn: колонка кнопок слева от дороги — ШИРИНОЙ в половину
    // сегмента (navBtnSize = segmentSize/2, см. GameBoardScreen), которая
    // сама зависит от segmentSize — циклическая зависимость решается в
    // замкнутой форме: boardBudgetW = segmentSize*ROWS + segmentSize*0.5 =
    // segmentSize*(ROWS+0.5), то есть просто делим на (ROWS+0.5), а не ROWS.
    // Без этого колонка кнопок «отъедала» ширину уже ПОСЛЕ того, как сетка
    // посчитала себя на всю доступную ширину — сетка залезала под кнопки
    // либо между ними и сеткой оставался лишний зазор (RoadArea центрирует
    // контент внутри своей зоны, а зона была шире, чем сетка+кнопки вместе).
    const widthDivisor = ROWS + (reserveNavColumn ? 0.5 : 0);
    let segmentSize = Math.max(1, Math.floor(boardBudgetW / widthDivisor));
    if (minViewportCols) {
        const heightDerived = Math.max(1, Math.floor(boardBudgetH / (minViewportCols + 0.5)));
        segmentSize = Math.min(segmentSize, heightDerived);
    }
    const segmentW = segmentSize;
    const segmentH = segmentSize;
    const navBtnSize = Math.max(1, Math.floor(segmentSize / 2));

    // Сколько колонок трассы реально помещается по высоте при этом размере
    // клетки — с запасом в полклетки на кирпичный сдвиг нечётных дорожек.
    const viewportCols = Math.max(
        1,
        Math.min(TOTAL_COLS, Math.floor((boardBudgetH - segmentSize / 2) / segmentSize)),
    );

    const roadContainerW = segmentW * ROWS;
    const roadContainerH = segmentH * viewportCols + segmentH / 2;

    return { labelStripW, roadContainerW, roadContainerH, segmentW, segmentH, viewportCols, navBtnSize };
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
 * (после вычета места под панель слева либо под панель снизу). Кнопки
 * навигации — колонкой СЛЕВА от дороги в обоих случаях, кроме mobileNav
 * (родное приложение, портрет — свои кнопки в seamRow, см. GameBoardScreen).
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
        const arrowBtnSize = Math.max(28, Math.floor(screenW * 0.075));
        // Было 0.15 — по запросу пользователя ужать переключатель игроков ещё
        // сильнее, отдать освободившееся место списку карточек бегунов (тот же
        // приём, что уже применялся к arrowBtnSize/panelH в четырнадцатом-
        // пятнадцатом заходах). Пол в 36 — переключателю (кружок+подпись+
        // полоска) физически нужно немного места, ниже уже обрежет текст.
        const switcherH = Math.max(36, Math.floor(panelH * 0.09));

        // mobileNav — то же условие, что GameBoardScreen.useMobileNavButtons
        // (портрет+native): там кнопки — в абсолютном seamRow на стыке рамок,
        // ширину в потоке не резервируют вообще (см. reserveNavColumn ниже).
        const mobileNav = Platform.OS !== 'web';

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
        // добавляет paddingTop:insets.top на roadZone, чтобы верхний край
        // (кнопки/сетка) не рисовался под статус-баром/вырезом камеры; здесь
        // тот же отступ нужно вычесть из бюджета, иначе низ доски вылезет за
        // пределы зоны.
        const roadZoneH = Math.max(0, screenH - panelH - insets.top);
        const road = computeRoadGeometry(roadZoneW, roadZoneH, null, !mobileNav);

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
    // кнопки навигации — колонкой слева от дороги (reserveNavColumn=true,
    // эта раскладка никогда не бывает mobileNav — та только в портретной
    // ветке выше).
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
    // minViewportCols=COLS (8) — по прямому запросу пользователя, широкое окно
    // должно показывать целый фрагмент трассы (8 колонок), не 1-2 (см.
    // комментарий у computeRoadGeometry). Портретная ветка (панель снизу,
    // узкий экран/телефон) этот параметр НЕ передаёт — там сознательно
    // оставлена динамическая viewportCols (более ранний фикс, см. CLAUDE.md).
    const road = computeRoadGeometry(roadZoneW, roadZoneH, COLS, true);

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
