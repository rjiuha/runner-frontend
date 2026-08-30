// src/hooks/useBoardLayout.js
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

        // insets.top — GameBoardScreen без SafeAreaView (см. его шапку), сам
        // добавляет paddingTop:insets.top на roadZonePortrait, чтобы верхняя
        // стрелка не рисовалась под статус-баром/вырезом камеры; здесь тот же
        // отступ нужно вычесть из бюджета, иначе геометрия (roadContainerH)
        // окажется больше реально доступного места и низ доски вылезет за
        // пределы зоны.
        const boardBudgetW = Math.max(0, screenW - ROAD_AREA_SPACING * 2);
        const boardBudgetH = Math.max(0, screenH - panelH - arrowBtnSize * 2 - ROAD_AREA_SPACING * 2 - insets.top);

        // Раньше segmentSize считался ТОЛЬКО от ширины (boardBudgetW/ROWS) — на узких
        // экранах (Android) это давало клетки крупнее, чем реально помещается по
        // высоте: BoardGrid.laneColumn сдвигает нечётные дорожки на segmentH/2 вниз
        // (кирпичная кладка, см. BoardGrid.js), поэтому реальная требуемая высота
        // контента — не COLS*segmentH, а COLS*segmentH + segmentH/2 (запас на этот
        // сдвиг). Если контейнер (roadContainerH) короче этого — BoardGrid обрезает
        // (`overflow:'hidden'`) верх сдвинутых дорожек ровно на недостающую половину
        // сегмента (жалоба пользователя: "у дорог, смещённых вперёд, половина
        // сегмента не отображается", подтверждено на Android И вебе одновременно —
        // не платформенный баг, а геометрия). Теперь segmentSize — MIN по обеим осям
        // (тот же приём, что уже работает в альбомной раскладке ниже): по ширине —
        // COLS не считаем тут, по высоте — ДЕЛИМ НЕ НА COLS, А НА COLS+0.5, чтобы сразу
        // заложить место под кирпичный запас. Гарантирует нулевую обрезку на любом
        // экране — там, где вертикального места much больше (см. живой прогон в вебе),
        // limiting-фактором становится ширина, и клетки просто крупнее.
        const segmentSize = Math.floor(Math.min(boardBudgetW / ROWS, boardBudgetH / (COLS + 0.5)));
        const segmentW = segmentSize;
        const segmentH = segmentSize;

        const roadContainerW = segmentW * ROWS;
        // Точно под контент (COLS сегментов + запас на кирпичный сдвиг), НЕ весь
        // boardBudgetH целиком — раньше контейнер был больше нужного (лишнее пустое
        // место сверху, т.к. BoardGrid прижимает контент к низу) ИЛИ (на тесных
        // экранах) МЕНЬШЕ нужного, что и резало сдвинутые дорожки. Излишек бюджета
        // по вертикали (если есть) просто не используется — центрируется по ширине
        // роль играет segmentSize, а не сам контейнер.
        const roadContainerH = segmentH * COLS + segmentH / 2;

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
            rows: ROWS,
            cols: COLS,
            totalBlocks: TOTAL_BLOCKS,
        };
    }

    const leftPanelW = Math.round(
        Math.min(LAYOUT.LEFT_PANEL_MAX_W, Math.max(LAYOUT.LEFT_PANEL_MIN_W, screenW * LAYOUT.LEFT_PANEL_RATIO)),
    );

    // Было 0.15 — с ассетом RoadNavButton (реальный рисованный глиф, не
    // абстрактный кружок ArrowButton) кнопка получалась размером с сам
    // сегмент дороги (жалоба пользователя). Тот же приём, что и в
    // портретной раскладке (arrowBtnSize там — 0.075 от ширины) — просто
    // вдвое меньше прежнего, пол в 28 для пальца/курсора.
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
    // ОДИН слот arrowBtnSize, не два — обе кнопки (назад/вперёд) теперь стоят
    // одной колонкой слева от дороги (см. GameBoardScreen), а не по краям,
    // освобождая целый arrowBtnSize вправо под саму сетку (по запросу
    // пользователя — "дать больше пространства под дорогу").
    const roadBudgetW = Math.max(0, roadZoneW - arrowBtnSize - ROAD_AREA_SPACING * 2);
    const roadBudgetH = Math.max(0, screenH - ROAD_AREA_SPACING * 2);

    // Квадратные сегменты (по запросу пользователя, 2026-08-28) — раньше
    // segmentW/segmentH считались от разных бюджетов независимо (ширина
    // делилась на COLS, высота на ROWS), что почти никогда не давало квадрат.
    // Единый размер — min по обеим осям, чтобы не вылезти ни за бюджет
    // ширины, ни за бюджет высоты; лишний бюджет на не ограничивающей оси
    // просто остаётся пустым — RoadArea.outer центрирует BoardGrid флексом
    // (alignItems:'center'), так что это не ломает раскладку.
    //
    // Делитель по ширине — COLS+0.5, не просто COLS: нечётные ряды в
    // BoardGrid сдвинуты вправо на segmentW/2 (кирпичная кладка,
    // marginLeft), поэтому им реально нужно COLS*segmentW + segmentW/2, а
    // не COLS*segmentW — без этого запаса контейнер (`overflow:'hidden'`)
    // обрезал самую правую половину сегмента именно у сдвинутых рядов
    // (жалоба пользователя со скриншотом — обведён красным правый край
    // дороги в вебе). Тот же класс бага, что уже чинили в портретной
    // раскладке (там — вертикальный сдвиг, COLS+0.5 по высоте).
    const segmentSize = Math.floor(Math.min(roadBudgetW / (COLS + 0.5), roadBudgetH / ROWS));
    const segmentW = segmentSize;
    const segmentH = segmentSize;

    return {
        orientation,
        screenW,
        screenH,
        leftPanelW,
        arrowBtnSize,
        switcherH,
        roadContainerW: segmentW * COLS + segmentW / 2, // запас на кирпичный сдвиг, см. выше
        roadContainerH: segmentH * ROWS,   // все 6 дорожек по высоте, без обрезки
        segmentW,
        segmentH,
        rows: ROWS,
        cols: COLS,
        totalBlocks: TOTAL_BLOCKS,
    };
}
