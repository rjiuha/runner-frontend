// src/hooks/useBoardLayout.js
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOARD_LAYOUT, LAYOUT, MOBILE_FRAME_BLEED } from '../constants/GameConstants';

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
        // Было 0.15 — по запросу пользователя ужать переключатель игроков ещё
        // сильнее, отдать освободившееся место списку карточек бегунов (тот же
        // приём, что уже применялся к arrowBtnSize/panelH в четырнадцатом-
        // пятнадцатом заходах). Пол в 36 — переключателю (кружок+подпись+
        // полоска) физически нужно немного места, ниже уже обрежет текст.
        const switcherH = Math.max(36, Math.floor(panelH * 0.09));

        // Полоса слева от доски с именем текущего(их) фрагмента(ов) трассы (см.
        // FragmentLabelStrip/GameBoardScreen) — по прямому запросу пользователя
        // 2026-08-30: вместо того чтобы центрировать сетку и оставлять пустой
        // зазор по бокам (когда высота — лимитирующая ось, см. ниже), зазор
        // отдаётся под полезную полосу с текстом.
        const labelStripW = Math.max(22, Math.floor(screenW * 0.06));

        // mobileNav — то же условие, что GameBoardScreen.useMobileNavButtons
        // (портрет+native): там верхняя/нижняя стрелка не рисуются в потоке
        // вообще (кнопки — в абсолютном seamRow на стыке рамок, см. экран),
        // поэтому для этого случая НЕ нужно резервировать под них никакой
        // высоты. Раньше боджет всегда вычитал arrowBtnSize*2 (место под
        // верхнюю И нижнюю кнопку), даже когда в потоке реально стояла только
        // одна пустая распорка (верхняя) — то самое "невидимое место сверху",
        // которое заметил пользователь. Веб-портрет по-прежнему рисует обе
        // ArrowButton в потоке (см. GameBoardScreen) — там резерв нужен как и
        // раньше.
        const mobileNav = Platform.OS !== 'web';
        const reservedArrowsH = mobileNav ? 0 : arrowBtnSize * 2;

        // insets.top — GameBoardScreen без SafeAreaView (см. его шапку), сам
        // добавляет paddingTop:insets.top на roadZonePortrait, чтобы верхняя
        // стрелка/сетка не рисовалась под статус-баром/вырезом камеры; здесь
        // тот же отступ нужно вычесть из бюджета, иначе геометрия
        // (roadContainerH) окажется больше реально доступного места и низ
        // доски вылезет за пределы зоны.
        // Мобильная sci-fi рамка (MobileFrameOverlay, только mobileNav-случай)
        // рисует декоративную кайму толщиной arrowBtnSize (borderDp), выступающую
        // НАРУЖУ за истинный правый край экрана на MOBILE_FRAME_BLEED (см.
        // GameBoardScreen — bleed.right) — значит её ВНУТРЕННИЙ край (там, где
        // кайма начинает перекрывать контент) находится на (arrowBtnSize -
        // MOBILE_FRAME_BLEED) px от истинного края, а не на 0. Без этой поправки
        // сетка считалась вплотную до ROAD_AREA_SPACING от края — декоративная
        // кайма рамки перекрывала/пряталa под собой правый столбец клеток
        // (жалоба пользователя, 2026-08-30: "дорога уходит за рамку"). Резерв
        // нужен только там, где рамка вообще рисуется (mobileNav); веб-портрет
        // её не рисует.
        const frameEdgeClearance = mobileNav
            ? Math.max(0, arrowBtnSize - MOBILE_FRAME_BLEED - ROAD_AREA_SPACING)
            : 0;
        const boardBudgetW = Math.max(0, screenW - ROAD_AREA_SPACING * 2 - labelStripW - frameEdgeClearance);
        const boardBudgetH = Math.max(0, screenH - panelH - reservedArrowsH - ROAD_AREA_SPACING * 2 - insets.top);

        // Клетки — квадратные, размер теперь считается ТОЛЬКО от ширины (не
        // min(ширина,высота), как раньше) — по прямому запросу пользователя:
        // раньше высота почти всегда была лимитирующей осью (кирпичный запас
        // COLS+0.5), из-за чего сетка получалась мельче, чем позволяла ширина,
        // и центрирование оставляло пустые полосы по бокам. Теперь ширина
        // используется целиком (без остатка, кроме floor-погрешности <ROWS px),
        // а вертикальная ось (сколько КОЛОНОК трассы реально видно
        // одновременно, viewportCols ниже) просто подстраивается под то, что
        // остаётся по высоте — это безопасно, потому что прокрутка и так идёт
        // ПОСЕГМЕНТНО (по одной колонке), а не блоками по 8 (см.
        // useBoardScroll) — не обязательно показывать ровно целый фрагмент
        // (BOARD_LAYOUT.COLS=8) одновременно.
        const segmentSize = Math.max(1, Math.floor(boardBudgetW / ROWS));
        const segmentW = segmentSize;
        const segmentH = segmentSize;

        // Сколько колонок трассы реально помещается по высоте при этом
        // размере клетки — с запасом в полклетки на кирпичный сдвиг нечётных
        // дорожек (тот же смысл, что раньше был в делителе COLS+0.5). Не
        // привязано к BOARD_LAYOUT.COLS (8, размер ОДНОГО фрагмента в данных
        // с бэка) — это отдельная величина ("сколько видно на экране прямо
        // сейчас"), см. viewportCols в возвращаемом объекте и его использование
        // в BoardGrid/useBoardScroll (НЕ в lib/board#flattenTrackSegments —
        // там структура данных по-прежнему 8 колонок на фрагмент).
        const viewportCols = Math.max(
            1,
            Math.min(TOTAL_COLS, Math.floor((boardBudgetH - segmentSize / 2) / segmentSize)),
        );

        const roadContainerW = segmentW * ROWS;
        const roadContainerH = segmentH * viewportCols + segmentH / 2;

        return {
            orientation,
            screenW,
            screenH,
            panelH,
            arrowBtnSize,
            switcherH,
            labelStripW,
            roadContainerW,
            roadContainerH,
            segmentW,
            segmentH,
            rows: ROWS,
            cols: COLS,
            viewportCols,
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
        labelStripW: 0, // полоса фрагментов — только портретная раскладка, см. её ветку выше
        roadContainerW: segmentW * COLS + segmentW / 2, // запас на кирпичный сдвиг, см. выше
        roadContainerH: segmentH * ROWS,   // все 6 дорожек по высоте, без обрезки
        segmentW,
        segmentH,
        rows: ROWS,
        cols: COLS,
        viewportCols: COLS, // альбомная раскладка не тронута — всегда целый фрагмент (8) одновременно
        totalBlocks: TOTAL_BLOCKS,
    };
}
