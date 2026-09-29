// src/components/game/PlayerInfoPanel.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import PlayerSwitcher from './PlayerSwitcher';
import DiceTray from './DiceTray';
import AbilityZones from './AbilityZones';
import RunnerCard, { RUNNER_CARD_COMPACT_PADDING_H, maxAvatarSizeScale } from './RunnerCard';
import ReaperCard from './ReaperCard';
import PulseText from '../ui/PulseText';
import PulseHighlight from '../ui/PulseHighlight';
import PersonPanel from '../ui/PersonPanel';
import FramePanel, { frameNotchRadius } from '../ui/FramePanel';
import {
    DICE_FACE_IMAGES,
    PLAYER_ABILITIES,
    PLAYER_STEP,
    RUNNER_ORDER,
    RUNNER_TYPES,
} from '../../constants/GameConstants';
import { colors, font, radius, spacing } from '../../theme';

// Ghost-превью кубика при драге — веб через legacy `Animated`
// (dragGhostPos/dragGhostValue ниже), native — через reanimated shared
// values (nativeGhostX/Y, см. их докстринг), см. `dragGhost`/`nativeDragGhost`
// за местом рендера обоих.
const DRAG_GHOST_SIZE_NORMAL = 44;
const DRAG_GHOST_SIZE_COMPACT = 34;

/**
 * Левая панель: переключатель игроков, кубики активного игрока, зоны
 * усилений (перетаскивание кубика) и карточки бегунов. Хит-тестинг
 * перетаскивания (какая зона под пальцем и подходит ли ей текущий кубик)
 * живёт здесь: зоны измеряют себя через measureInWindow и репортят сюда,
 * а DiceDie шлёт сюда координаты жеста в оконных же координатах.
 *
 * "Что назначено" панель НЕ хранит сама — читает прямо из live-данных
 * (runner.dice/player.ability/player.diceN), которые GameBoardScreen строит
 * из game (см. Фазу 2 в CLAUDE.md). Наружу панель только сообщает НАМЕРЕНИЕ
 * (onDropOnAbility/onDropOnRunner/onRunnerCardPress/onPressAbilityZone) —
 * вызывать бэк или нет решает GameBoardScreen.
 */
export default function PlayerInfoPanel({
    players,
    activePlayerId,
    onSelectPlayer,
    myPlayerId,
    currentTurnPlayerId = null,
    canAct,
    myStep,
    pendingAbility,
    pendingSelect,
    canSelectRunner,
    onDropOnAbility,
    onPressAbilityZone,
    onDropOnRunner,
    onRunnerCardPress,
    onRunnerCardDoubleTap,
    highlightSelectIdle = false,
    highlightAbilityIdle = false,
    width,
    height,
    switcherHeight,
    switcherAtBottom = false,
    headerContent = null,
    compactColumns = false,
    // Бонус хода — числовое значение бонуса этого раунда (game.trackGain,
    // с GameBoardScreen). С 2026-09-24 бэк (коммит 59aea0f) отдаёт per-runner
    // флаг Runner::$trackGain в Runner::toArray() (RunnerViewModel) и в
    // событиях step_selection/runner_<suffix>/player_reset — см. runnerCards
    // ниже, hasRoadBonus теперь читает runner.trackGain напрямую, не гейтится
    // шагом/активным бегуном.
    roadBonusValue = null,
}) {
    // compactColumns: левая колонка (бегуны) может не поместиться на маленьких
    // экранах (по прямому запросу пользователя — "не думаю, что на маленьких
    // экранах всё будет влезать", после того как один из бегунов уехал за
    // низ экрана) — даём ScrollView, но onLayout зон дропа не перевызывается
    // при простой прокрутке контента, поэтому remeasureTick (растёт на конец
    // скролла/флика) триггерит принудительный повторный measureInWindow в
    // каждой карточке (см. RunnerCard) — иначе закешированные оконные
    // координаты устареют относительно прокрутки и хит-тестинг дропа кубика
    // снова начнёт промахиваться (та же болезнь, что уже была с общим
    // ScrollView до перехода на compactColumns).
    const [remeasureTick, setRemeasureTick] = useState(0);
    const bumpRemeasure = useCallback(() => setRemeasureTick((t) => t + 1), []);

    // 2026-09-28 — точечная заплатка "бампнуть remeasureTick при смене
    // activePlayerId" (была тут) УБРАНА — заменена структурным фиксом в
    // самой RunnerCard.js (`useEffect(() => measure(), [zoneKey, measure])`,
    // см. её докстринг за полным разбором): карточка теперь сама
    // перемеряется при смене СВОЕЙ регистрации, независимо от причины, а не
    // ждёт, чтобы родитель заранее угадал каждый конкретный повод и явно
    // разослал сигнал. `remeasureTick` ниже остаётся — он всё ещё нужен
    // для PAINT-ONLY смещений (scroll/scale), где сам `zoneKey` не меняется,
    // только экранная позиция того же бегуна.

    // Авто-масштабирование колонок в compactColumns (2026-09-26, по прямому
    // запросу пользователя — "не подрезай константы, сделай масштабирование
    // панелей, чтобы структура никогда не перекрывала друг друга"). Раньше
    // при нехватке высоты columns (см. useBoardLayout — panelH тесный на
    // некоторых реальных экранах, headerContent/switcher забирают
    // фиксированную часть) правая колонка (кубики+усиления) либо обрезалась,
    // либо скроллилась — оба варианта пользователь отверг явно. Вместо
    // угадывания констант под конкретный экран — измеряем РЕАЛЬНО доступную
    // высоту (`columnsH`, onLayout на строке columns — той же высоты у
    // ОБЕИХ колонок, т.к. `columns` не задаёт alignItems и обе они по
    // умолчанию растягиваются на всю её высоту через cross-axis stretch) и
    // РЕАЛЬНУЮ природную высоту контента каждой колонки БЕЗ трансформации
    // (`leftContentH`/`rightContentH`, onLayout меряет ДО-transform layout-
    // бокс — transform на paint не влияет на layout, поэтому эти onLayout
    // продолжают честно отдавать натуральный размер, даже когда сам transform
    // уже применён на той же вьюхе). Если контент выше, чем реально доступно
    // — весь блок (не отдельные константы внутри) сжимается transform:scale
    // ровно настолько, чтобы поместиться целиком; если места достаточно —
    // scale=1, ничего визуально не меняется.
    const [columnsH, setColumnsH] = useState(null);
    const [leftContentH, setLeftContentH] = useState(null);
    const [rightContentH, setRightContentH] = useState(null);
    // Ширина — нужна ТОЛЬКО для leftGrow ниже (клэмп безопасного роста
    // карточек бегунов по ширине, см. maxAvatarSizeScale). rightContentW не
    // используется (правая колонка растёт без клэмпа, см. её докстринг ниже).
    // Ширина колонки НЕ зависит от sizeScale (растянута родителем-колонкой,
    // а не природным размером контента) — в отличие от высоты, ей не нужна
    // заморозка ниже, безопасно живая.
    const [leftContentW, setLeftContentW] = useState(null);
    const onColumnsLayout = useCallback((e) => setColumnsH(e.nativeEvent.layout.height), []);
    // **Заморозка натурального (sizeScale=1) замера высоты — 2026-09-26,
    // живой краш "Maximum update depth exceeded" + "плитки то растут, то
    // уменьшаются циклично".** Причина: рост (sizeScale, см. leftGrow ниже)
    // — это РЕАЛЬНОЕ изменение размера детей (не paint-эффект, как
    // transform:scale у сжатия) — оно меняет их фактическую высоту, значит
    // ЗАНОВО вызывает onLayout уже ПОСЛЕ роста. Если бы `leftGrow`
    // пересчитывался от этого НОВОГО (уже выросшего) значения — получался бы
    // бесконечный цикл "измерили → выросли → измерили увеличенное → выросли
    // ещё/меньше → ...", никогда не сходящийся (высота меняется на дробные
    // пиксели туда-сюда из-за элементов, не участвующих в sizeScale —
    // текст/паддинги/gap — рост НЕ строго линеен относительно scale).
    // `leftBaselineHRef`/`rightBaselineHRef` — натуральная высота, захваченная
    // РОВНО ОДИН раз (при sizeScale===1, т.е. ДО первого применения роста) и
    // замороженная — `leftGrow`/`rightGrow` считаются ТОЛЬКО от неё, больше
    // никогда не обновляемой уже выросшим значением. `appliedLeftGrowRef`/
    // `appliedRightGrowRef` — какой sizeScale был передан детям на ТЕКУЩЕМ
    // (только что закоммиченном) рендере — мутируются ПРЯМО в теле функции
    // компонента (не в эффекте), тот же приём, что и `collisionHoldsRef` в
    // BoardGrid.js (см. её докстринг) — к моменту, когда сработает onLayout
    // (строго ПОСЛЕ коммита/лейаута этого рендера), ref уже содержит верное
    // для сравнения значение. `leftContentH`/`rightContentH` (state) при этом
    // ОСТАЮТСЯ живыми (обновляются на КАЖДЫЙ onLayout, включая уже выросшие) —
    // это безопасно и НУЖНО для сжатия (`leftScale` ниже): если рост случайно
    // чуть переполнил доступную высоту (округление), transform:scale (paint-
    // эффект, НЕ триггерит повторный onLayout) просто аккуратно скомпенсирует
    // остаток — без риска зацикливания, в отличие от sizeScale.
    const leftBaselineHRef = useRef(null);
    const rightBaselineHRef = useRef(null);
    const appliedLeftGrowRef = useRef(1);
    const appliedRightGrowRef = useRef(1);
    // 2026-09-28 — ПЕРЕСМОТРЕНО по прямому запросу пользователя: `activePlayerId`
    // убран из зависимостей сброса. История вопроса: сначала (до 2026-09-26)
    // сброс был только на `columnsH` — общий масштаб на всех игроков, но
    // разная natural-высота контента (жетоны повреждений/бонус хода не у
    // всех одинаковы) давала видимую разницу масштаба между игроками ("на
    // test чуть меньше, на test1 чуть больше"). 2026-09-26 добавили
    // `activePlayerId` — каждое переключение таба пересчитывало baseline
    // ИМЕННО под нового игрока, разница пропала, НО ценой этого стал видимый
    // двухфазный "прыжок" размера карточек при КАЖДОМ переключении (сброс →
    // временно натуральный размер → замер → рост обратно) — живая жалоба
    // 2026-09-28, "переключение таба не должно перерисовывать панели, пусть
    // обновляется только контент". Пользователь явно выбрал вернуться к
    // ОБЩЕМУ масштабу (посчитанному один раз на партию, не per-игрок) —
    // разницу между игроками с разным natural-контентом теперь целиком
    // берёт на себя УЖЕ существующий "живой" `leftScale`/`rightScale` ниже
    // (paint-only `transform:scale`, читает ЖИВОЙ `leftContentH`/
    // `rightContentH`, НЕ триггерит повторный `onLayout` — то есть сжатие
    // для "более высокого" игрока применяется БЕЗ каскада ре-лейаутов,
    // визуально гладко, без прыжка). Единственный компромисс: если контент
    // РАЗНЫХ игроков заметно отличается по высоте, у кого-то из них итоговый
    // масштаб будет чуть точнее заполнять доступную высоту, чем у другого —
    // осознанно принято как меньшее зло по сравнению с прыжком размера.
    // **2026-09-28 — РЕАЛЬНЫЙ баг, найден живым прогоном на Android (не
    // связан с правкой выше про activePlayerId — был здесь и раньше, просто
    // маскировался частыми сбросами по activePlayerId, из-за которых рост
    // иногда случайно "проскакивал" в окне между сбросами).** Гонка двух
    // НЕЗАВИСИМЫХ `onLayout` (`onColumnsLayout`/`onLeftContentLayout`) —
    // при первом монтировании `columnsH` идёт `null → реальное число` РОВНО
    // ОДИН раз, и этот эффект (раньше зависел от одного `columnsH`) читал
    // это как "измени размер экрана — сбрось baseline", хотя это не ресайз,
    // а ПЕРВОЕ измерение. Если `onLeftContentLayout` успевал сработать и
    // захватить baseline РАНЬШЕ, чем коммитится этот `null→число` переход —
    // эффект сбрасывал baseline ОБРАТНО в null сразу после того, как он был
    // корректно захвачен (порядок двух независимых async onLayout не
    // гарантирован) — рост после этого не применялся НИКОГДА (baseline
    // оставался null навсегда, `leftGrow` жёстко застревал на 1). Живой лог
    // (`adb logcat`) подтвердил ровно эту последовательность: `applied:1,
    // baselineBefore:null` → успешный захват → на следующей же строке рендера
    // baseline снова `null`. Фикс — сравнивать с ПРЕДЫДУЩИМ реальным
    // значением (`prevColumnsHRef`), сбрасывать ТОЛЬКО когда оно было уже
    // ненулевым и ДЕЙСТВИТЕЛЬНО изменилось (настоящий ресайз/поворот
    // экрана) — первое измерение (`null → X`) для сброса не считается.
    const prevColumnsHRef = useRef(null);
    useEffect(() => {
        if (prevColumnsHRef.current != null && prevColumnsHRef.current !== columnsH) {
            leftBaselineHRef.current = null;
            rightBaselineHRef.current = null;
        }
        prevColumnsHRef.current = columnsH;
    }, [columnsH]);
    const onLeftContentLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setLeftContentH(height);
        setLeftContentW(width);
        // Принимаем как natural-baseline ТОЛЬКО пока рост ещё не применён
        // (см. докстринг выше) — иначе это уже ИСКАЖЁННОЕ (выросшее) значение.
        if (appliedLeftGrowRef.current === 1) leftBaselineHRef.current = height;
    }, []);
    const onRightContentLayout = useCallback((e) => {
        const height = e.nativeEvent.layout.height;
        setRightContentH(height);
        if (appliedRightGrowRef.current === 1) rightBaselineHRef.current = height;
    }, []);
    // Сжатие (transform:scale, контента БОЛЬШЕ доступной высоты) — БЕЗ
    // изменений, тот же механизм, что и раньше: масштаб <1 никогда не
    // переполняет границы колонки (paint-эффект уменьшает и без того
    // умещавшийся контент), overflow:hidden — чистая страховка, а не
    // рабочий механизм. Читает ЖИВОЙ leftContentH/rightContentH (см. докстринг
    // выше — это безопасно и корректно, в отличие от роста).
    const leftScale = (columnsH && leftContentH && leftContentH > columnsH) ? columnsH / leftContentH : 1;
    const rightScale = (columnsH && rightContentH && rightContentH > columnsH) ? columnsH / rightContentH : 1;
    // Рост (natural-высота МЕНЬШЕ доступной, 2026-09-26, по прямому запросу
    // пользователя — "растянуть контент крупнее", а не просто прижать к низу)
    // — НЕ transform:scale (тот же uniform-scale, применённый >1, растянул бы
    // ШИРИНУ настолько же, насколько и высоту, а ширина колонки УЖЕ занята
    // контентом на 100% — переполнение/обрезание по бокам, см. разбор в чате).
    // Вместо paint-трансформации — РЕАЛЬНЫЙ размер элементов (sizeScale проп,
    // см. RunnerCard.js/ReaperCard.js/DiceTray.js/AbilityZone.js): растёт
    // только высота контента (иконки/аватары становятся крупнее, раздвигая
    // СВОЙ собственный auto-height контейнер), ширина остаётся в рамках
    // родителя, т.к. каждый компонент либо не имеет запаса по ширине вообще
    // (зона усилений — 48% родителя, не меняется), либо клэмпится явно
    // (карточки бегунов — единственное место, где 3 элемента стоят плотно в
    // ряд БЕЗ запаса, см. maxAvatarSizeScale/leftGrow ниже). Считается от
    // ЗАМОРОЖЕННОГО baseline (см. докстринг рефов выше), НЕ от живого
    // leftContentH/rightContentH — иначе см. тот же докстринг за разбором
    // бесконечного цикла.
    const leftGrowRaw = (columnsH && leftBaselineHRef.current && leftBaselineHRef.current < columnsH)
        ? columnsH / leftBaselineHRef.current
        : 1;
    const rightGrowRaw = (columnsH && rightBaselineHRef.current && rightBaselineHRef.current < columnsH)
        ? columnsH / rightBaselineHRef.current
        : 1;
    // Клэмп по ширине — ТОЛЬКО для левой колонки (3 карточки бегунов плотно в
    // ряд, avatarBoxCompact фиксированного пикс. размера без запаса). Правая
    // колонка (кубики 2×2 + зоны усилений 48%) структурно безопасна без
    // клэмпа — см. докстринги AbilityZone.js#sizeScale/DiceTray.js, у обоих
    // естественный запас по ширине заведомо больше разумного роста от
    // нехватки высоты.
    //
    // leftContentW — ширина ВСЕЙ leftColumnContent (реаper+ряд бегунов), уже
    // за вычетом её собственного paddingHorizontal (см. styles.
    // leftColumnContent — onLayout возвращает border-box САМОЙ leftContentW,
    // которая уже учитывает её padding как часть общего бокса — т.е. ряд
    // бегунов (runnerRow) реально доступен на leftContentW МИНУС paddingHorizontal
    // самой leftColumnContent, дважды (левая+правая сторона)).
    const RUNNER_ROW_GAP = spacing.xs; // styles.runnerRow#gap
    const runnerCount = RUNNER_ORDER.length;
    const maxLeftGrowByWidth = (() => {
        if (!leftContentW) return 1;
        const rowWidth = leftContentW - 2 * spacing.xs; // leftColumnContent#paddingHorizontal
        const totalGap = (runnerCount - 1) * RUNNER_ROW_GAP;
        const cardOuterWidth = (rowWidth - totalGap) / runnerCount;
        const cardContentWidth = cardOuterWidth - 2 * RUNNER_CARD_COMPACT_PADDING_H;
        return maxAvatarSizeScale(cardContentWidth);
    })();
    // Небольшой безопасный потолок роста (2026-09-26) — независимо от
    // клэмпа по ширине, не даём панели раздуться до абсурдных размеров на
    // экстремально низком/широком экране (контент почти пустой относительно
    // доступной высоты) — визуально это выглядело бы страннее, чем
    // умеренный остаточный зазор снизу.
    const GROW_HARD_CAP = 1.6;
    const leftGrow = Math.min(leftGrowRaw, maxLeftGrowByWidth, GROW_HARD_CAP);
    const rightGrow = Math.min(rightGrowRaw, GROW_HARD_CAP);
    // Мутация ПРЯМО в теле рендера (не в эффекте) — см. докстринг рефов выше:
    // к моменту, когда onLayout сработает для ЭТОГО же рендера (строго после
    // коммита), ref уже должен содержать sizeScale, который реально уйдёт
    // детям в JSX ниже.
    appliedLeftGrowRef.current = leftGrow;
    appliedRightGrowRef.current = rightGrow;
    // Зоны дропа (RunnerCard/AbilityZone) сами кэшируют оконные координаты
    // через measureInWindow — та же болезнь, что и с прокруткой (см.
    // докстринг remeasureTick выше): применение НОВОГО transform:scale само
    // по себе НЕ вызывает onLayout у детей (transform — чисто paint-эффект),
    // значит без явного пинка их кэш остался бы от ПРЕДЫДУЩЕГО масштаба.
    // Раз scale меняется — форсируем тот же remeasure, что и раньше делали
    // скролл/флик. sizeScale (рост) — РЕАЛЬНОЕ изменение размера, оно и без
    // этого будит onLayout у детей естественным образом (см. handleLayout в
    // RunnerCard.js/AbilityZone.js) — но remeasureTick тут не помешает,
    // оставлен в тех же зависимостях для единообразия/на случай гонки между
    // двумя источниками ре-layout'а.
    useEffect(() => {
        if (compactColumns) bumpRemeasure();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leftScale, rightScale, leftGrow, rightGrow, compactColumns]);

    // Ghost-превью перетаскиваемого кубика — ТОЛЬКО веб. Жалоба пользователя:
    // в веб-версии сам кубик во время драга рисуется ЗА карточкой бегуна
    // (не поверх), хотя на Android рисуется поверх нормально. DiceDie уже
    // поднимает zIndex на себе при драге — на native этого достаточно, но на
    // вебе, судя по всему, карточка (внутри ScrollView) всё равно красится
    // выше по какой-то причине, связанной со стекингом (не удалось
    // стопроцентно подтвердить конкретный механизм без визуальной отладки —
    // нет рабочего браузера в этой сессии). Вместо попыток подобрать
    // правильный zIndex вслепую — надёжный обходной путь: на вебе поверх
    // ВСЕГО рисуется независимая копия кубика (`position:'fixed'`, не зависит
    // ни от какого родительского стекинга) в реальных оконных координатах
    // жеста (e.absoluteX/Y уже в этих координатах, без пересчёта). Сам
    // оригинальный DiceDie не трогаем — его временная невидимость под
    // карточкой на вебе теперь не важна, потому что поверх едет этот ghost.
    //
    // **Позиция — `Animated.ValueXY` через `.setValue()`, НЕ React state**
    // (2026-09-19, живая жалоба "при нажатии на кубики начинает сильно
    // тормозить" — усугубилось именно ПОСЛЕ переверстки карточек на
    // PersonPanel/FramePanel, подтверждено пользователем: "до доработок с
    // плитками всё работало без тормозов"). `onDragMove` стреляет на КАЖДОЕ
    // движение указателя (десятки-сотни раз за секунду драга, без троттлинга)
    // — раньше это был `setDragGhost({value,x,y})`, React-state-апдейт,
    // перерендеривавший ВСЮ `PlayerInfoPanel` (включая все карточки бегунов
    // — теперь тяжёлые, ~70+ `<Image>` на карточку из-за 9-slice рамок) на
    // каждый такой тик. `.setValue()` на `Animated.ValueXY` обновляет стиль
    // ghost-картинки НАПРЯМУЮ (imperatively), в обход React reconciliation
    // целиком — тот же приём, что уже применяется в проекте для непрерывных
    // позиций (см. `RunnerTokenSlide.js`). Сам ФАКТ значения на кубике
    // (какую грань показывать) меняется только на старте/конце драга, не на
    // каждое движение — это осталось обычным state (`dragGhostValue`),
    // безопасно, т.к. меняется редко.
    const dragGhostPos = useRef(new Animated.ValueXY({ x: -9999, y: -9999 })).current;
    const [dragGhostValue, setDragGhostValue] = useState(null); // грань кубика | null
    // Тот же size, что и у DiceTray ниже (compactColumns — 34, иначе 44) —
    // иначе ghost визуально крупнее/мельче реального кубика в трее.
    const dragGhostSize = compactColumns ? DRAG_GHOST_SIZE_COMPACT : DRAG_GHOST_SIZE_NORMAL;

    // 2026-09-28, третий заход за день — native-версия ghost'а, теперь через
    // REANIMATED shared values, не legacy `Animated`. История: (1) сначала
    // native вообще не имел ghost'а — реальный DiceDie просто поднимал
    // zIndex/elevation; сломалось, когда авто-масштабирование колонок
    // (2026-09-26) обернуло их в `overflow:'hidden'`+`transform:scale`; (2)
    // ghost на native добавили через legacy `Animated.ValueXY.setValue()`
    // внутри `runOnJS` — работало функционально, но JS-мост на КАЖДЫЙ кадр
    // драга давал заметный лаг на живом Android ("подсветка зоны не
    // поспевает за пальцем", живая жалоба); (3) попытались обойтись БЕЗ
    // ghost'а вообще — временно снимать `overflow:hidden` на время драга
    // (`scaleClipOpen`, см. её докстринг ниже) — живая проверка показала,
    // что этого НЕДОСТАТОЧНО: кубик всё равно визуально уходит "за" соседнюю
    // колонку (похоже, `transform:scale` на `leftColumnContent`/
    // `rightColumnContent` создаёт СВОЙ stacking-контекст независимо от
    // overflow, из которого elevation/zIndex не может вырваться — гипотеза
    // не была стопроцентно подтверждена статьями/документацией RN, но живой
    // тест это показал напрямую). Финально — ghost вернули, но теперь
    // позиция обновляется ЦЕЛИКОМ на UI-потоке (reanimated shared values,
    // см. `DiceDie.js#ghostX/ghostY` — worklet пишет прямо в них, БЕЗ
    // единого `runOnJS` за кадр драга) — та же визуальная идея, что и
    // legacy-версия (2), но без её цены.
    const nativeGhostX = useSharedValue(-9999);
    const nativeGhostY = useSharedValue(-9999);
    // Оконные координаты корня ЭТОЙ панели — нужны, чтобы перевести оконные
    // координаты кубика (см. DiceDie.js#native-докстринг) в координаты,
    // понятные `position:'absolute'` у ghost'а (тот рисуется ПРЯМЫМ ребёнком
    // корня панели, см. место рендера ниже). Пишутся из обычного JS
    // (`measureInWindow`-колбэк) ПРЯМО в shared value — reanimated разрешает
    // писать в `.value` из JS-потока, а читает их потом воркет DiceDie на
    // UI-потоке, без моста в обе стороны.
    const nativePanelOriginX = useSharedValue(0);
    const nativePanelOriginY = useSharedValue(0);
    const panelRootRef = useRef(null);
    const measurePanelOrigin = useCallback(() => {
        requestAnimationFrame(() => {
            panelRootRef.current?.measureInWindow((x, y) => {
                nativePanelOriginX.value = x;
                nativePanelOriginY.value = y;
            });
        });
    }, [nativePanelOriginX, nativePanelOriginY]);
    const nativeGhostAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: nativeGhostX.value - dragGhostSize / 2 },
            { translateY: nativeGhostY.value - dragGhostSize / 2 },
        ],
    }));

    // 2026-09-29, реальный живой баг — `activePlayerId` (GameBoardScreen)
    // разрешается через useEffect, который коммитится ПОСЛЕ первого рендера
    // этой панели; всё это время `activePlayerId` тут — `null`, и старый
    // фолбэк `?? players[0]` рендерил ЛЮБОГО игрока (порядок в массиве не
    // гарантирует "себя") — RunnerCard успевал смонтироваться и
    // ЗАРЕГИСТРИРОВАТЬ зоны дропа под ЧУЖИМИ id ещё до того, как
    // activePlayerId вообще определялся. Živой лог (`ZONEDBG`/`APIDDBG`)
    // поймал это напрямую: рендер с id оппонента, и только ~1с спустя —
    // переключение на настоящего "себя". Обычно достаточно быстро, чтобы
    // никто не заметил — но если бегун успевал потащить кубик в ЭТО окно
    // (или просто медленный рендер/эмулятор), зоны регистрировались под
    // чужими id, и хит-тест наведения/дропа промахивался мимо (см. CLAUDE.md).
    // `myPlayerId` — синхронный `useMemo` в GameBoardScreen (без задержки
    // эффекта), уже передаётся сюда пропом — используем его ВТОРЫМ звеном
    // фолбэка: пока activePlayerId ещё не разрешился, показываем СВОЕГО
    // игрока (если он уже известен), а не первого встречного.
    const activePlayer = players.find((p) => p.id === activePlayerId)
        ?? players.find((p) => p.id === myPlayerId)
        ?? players[0];
    const isMyPanel = canAct && activePlayer.id === myPlayerId;
    // Панель показывает игрока activePlayer (переключатель), а не обязательно
    // того, чей сейчас реальный игровой ход (game.playerOrder) — см.
    // RunnerCard#turnActive, зелёное имя бегуна должно гаснуть, как только ход
    // уходит к другому игроку, даже если player.activeRunner у ЭТОГО игрока
    // ещё не сброшен (бэк не чистит его автоматически при смене хода).
    const isActivePlayerTurn = currentTurnPlayerId != null && String(activePlayer.id) === String(currentTurnPlayerId);
    // Что можно тащить прямо сейчас: SELECT — на карточку бегуна, ABILITY — на зону усиления.
    const dragMode = isMyPanel
        ? myStep === PLAYER_STEP.SELECT
            ? 'select'
            : myStep === PLAYER_STEP.ABILITY
                ? 'ability'
                : null
        : null;

    // Кубик, зарезервированный под pending heal/reaper/select, ещё не consumed
    // бэком (реальный вызов уйдёт только после подтверждения/второго тапа) —
    // визуально прячем его из трея пораньше, чтобы не тащили дважды. Актуально
    // только для СВОЕЙ панели — pending-стейты относятся к myPlayer, не к тому,
    // чью панель сейчас листают через переключатель.
    // useMemo (2026-09-27) — без него это была бы НОВАЯ ссылка на массив
    // каждый рендер панели (обычный `.map()`), даже когда ничего из
    // зависимостей реально не менялось — сводило бы на нет `React.memo` у
    // DiceTray ниже (проп `dice` всегда "новый" по ссылке).
    const trayDice = useMemo(
        () => activePlayer.dice.map((v, i) =>
            isMyPanel && (pendingAbility?.diceIndex === i || pendingSelect?.diceIndex === i) ? null : v,
        ),
        [activePlayer.dice, isMyPanel, pendingAbility?.diceIndex, pendingSelect?.diceIndex],
    );

    // Подсказка "что делать дальше" (2026-09-14, по прямому запросу
    // пользователя) — `draggingValue` живёт ЗДЕСЬ (не в GameBoardScreen):
    // всё, что от неё зависит (заголовки/панель кубиков, рамки карточек
    // бегунов, рамки зон усилений), рендерится внутри этой же панели.
    // `null` — кубик сейчас НЕ тащат, число — значение того, что тащат
    // (см. onDragStart/onDragEnd, проброшенные в DiceTray ниже).
    const [draggingValue, setDraggingValue] = useState(null);
    const handleDieDragStart = useCallback((value) => {
        setDraggingValue(value);
        // Грань ghost-кубика — только меняется здесь (старт драга), не на
        // каждое движение, см. dragGhostPos/dragGhostValue выше — на ОБЕИХ
        // платформах (веб и native теперь оба рисуют ghost, см. докстринг
        // nativeGhostX/Y выше за историей).
        setDragGhostValue(value);
    }, []);
    const handleDieDragEnd = useCallback(() => {
        setDraggingValue(null);
        setDragGhostValue(null);
    }, []);

    // Пока кубик НЕ тащат — подсвечиваем ИСТОЧНИК (фон вокруг трея кубиков
    // внутри общей плитки, см. diceAbilitiesTile) — на SELECT и на ABILITY
    // (плюс кнопка "Пропустить усиление", см. GameBoardScreen,
    // highlightAbilityIdle туда и сюда — одно и то же условие). Как только
    // кубик взяли в драг — подсветка ПЕРЕКЛЮЧАЕТСЯ на ЦЕЛЬ (бегуны/усиления,
    // см. runnersHighlight/abilityPulseKeys ниже) — источник гаснет, там
    // уже давно всё понятно (кубик виден зажатым под пальцем).
    const diceHighlight = isMyPanel && draggingValue == null && (
        (dragMode === 'select' && highlightSelectIdle) ||
        (dragMode === 'ability' && highlightAbilityIdle)
    );
    // SELECT, кубик в драге — подсветка ВСЕХ карточек, куда его реально можно
    // бросить (любой кубик годится любому бегуну, см. handleDragMove выше —
    // конкретное ЗНАЧЕНИЕ роли не играет, только canSelectRunner(runnerId)).
    const runnersHighlight = isMyPanel && draggingValue != null && dragMode === 'select';

    const abilityAssignments = useMemo(() => {
        const map = {};
        for (const key of Object.keys(PLAYER_ABILITIES)) {
            if (isMyPanel && pendingAbility?.ability === key) map[key] = pendingAbility.diceIndex;
            else if (activePlayer.ability === key) map[key] = 'used';
            else map[key] = null;
        }
        return map;
    }, [isMyPanel, pendingAbility, activePlayer.ability]);

    // ABILITY, кубик в драге — какие зоны реально примут ИМЕННО ЭТО значение
    // (min/max, та же формула, что уже использует handleDragMove/handleDrop
    // выше) и ещё не заняты ('used') — Set ключей, AbilityZones сам решает,
    // какую из своих 4 зон подсветить.
    const abilityPulseKeys = useMemo(() => {
        if (!isMyPanel || draggingValue == null || dragMode !== 'ability') return null;
        const keys = new Set();
        for (const key of Object.keys(PLAYER_ABILITIES)) {
            const ability = PLAYER_ABILITIES[key];
            if (abilityAssignments[key] === 'used') continue;
            if (draggingValue >= ability.min && draggingValue <= ability.max) keys.add(key);
        }
        return keys;
    }, [isMyPanel, draggingValue, dragMode, abilityAssignments]);

    const zoneLayoutsRef = useRef({});
    const [hover, setHover] = useState({ key: null, valid: false });

    const findZoneAt = useCallback((x, y) => {
        for (const [key, rect] of Object.entries(zoneLayoutsRef.current)) {
            if (!rect) continue;
            if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
                return key;
            }
        }
        return null;
    }, []);

    // 2026-09-28 — `rect === null` теперь означает "удали запись" (RunnerCard
    // зовёт так для СВОЕГО СТАРОГО zoneKey перед регистрацией нового — см. её
    // докстринг за полным разбором живого бага: без удаления зона слота
    // Танка годами копила записи от КАЖДОГО игрока, когда-либо в него
    // смотревшего, и хит-тест стабильно попадал на САМУЮ СТАРУЮ, а не
    // текущую). Раньше сюда никогда не приходил `null` — просто zoneLayoutsRef
    // рос бесконечно.
    const handleMeasured = useCallback((key, rect) => {
        if (rect == null) {
            delete zoneLayoutsRef.current[key];
            return;
        }
        zoneLayoutsRef.current[key] = rect;
    }, []);

    // Зоны кубика хода на карточках бегунов ("move:<runnerId>") мерятся и
    // хит-тестятся тем же реестром, что и зоны усилений — правил на номинал
    // кубика у них нет (любой кубик годится любому бегуну), поэтому наведение
    // всегда "valid", но только пока разрешён drag-режим 'select'.
    const handleDragMove = useCallback(
        (_index, x, y, value) => {
            // .setValue() — НЕ React state, не триггерит ре-рендер панели на
            // каждое движение (см. dragGhostPos выше). Только веб — на native
            // позицию ghost'а обновляет НАПРЯМУЮ воркет самого DiceDie
            // (nativeGhostX/Y, см. её докстринг выше), этот колбэк туда
            // вообще не заходит (см. `if (IS_WEB)`/`else` в DiceDie.js) —
            // здесь запись была бы избыточным JS-мостом.
            if (Platform.OS === 'web') dragGhostPos.setValue({ x, y });
            if (!dragMode) return;
            const key = findZoneAt(x, y);
            if (!key) {
                setHover((h) => (h.key === null ? h : { key: null, valid: false }));
                return;
            }
            if (key.startsWith('move:')) {
                const runnerId = Number(key.slice('move:'.length));
                const valid = dragMode === 'select' && canSelectRunner(runnerId);
                setHover((h) => (h.key === key && h.valid === valid ? h : { key, valid }));
                return;
            }
            if (dragMode !== 'ability') {
                setHover((h) => (h.key === key && h.valid === false ? h : { key, valid: false }));
                return;
            }
            const ability = PLAYER_ABILITIES[key];
            const valid = value >= ability.min && value <= ability.max;
            setHover((h) => (h.key === key && h.valid === valid ? h : { key, valid }));
        },
        [findZoneAt, dragMode, canSelectRunner],
    );

    const handleDrop = useCallback(
        (index, x, y, value) => {
            setHover({ key: null, valid: false });
            setDragGhostValue(null);
            if (!dragMode) return;
            const key = findZoneAt(x, y);
            if (!key) return;

            if (key.startsWith('move:')) {
                if (dragMode !== 'select') return;
                const runnerId = Number(key.slice('move:'.length));
                onDropOnRunner(activePlayer.id, runnerId, index);
                return;
            }

            if (dragMode !== 'ability') return;
            const ability = PLAYER_ABILITIES[key];
            if (value < ability.min || value > ability.max) return; // не по правилам — дроп просто не принимается
            onDropOnAbility(activePlayer.id, key, index);
        },
        [findZoneAt, dragMode, onDropOnRunner, onDropOnAbility, activePlayer.id],
    );

    const trackedRunners = useMemo(
        () => RUNNER_ORDER.map((type) => activePlayer.runners.find((r) => r.type === type)).filter(Boolean),
        [activePlayer.runners],
    );
    const reaper = useMemo(
        () => activePlayer.runners.find((r) => r.type === RUNNER_TYPES.REAPER),
        [activePlayer.runners],
    );

    const switcher = (
        <View style={[styles.switcherBox, { height: switcherHeight }]}>
            <PlayerSwitcher
                players={players.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
                activeId={activePlayer.id}
                onSelect={onSelectPlayer}
            />
        </View>
    );

    // Плитка Жнеца — по аналогии с плиткой бегуна (RunnerCard, через новый
    // ReaperCard.js, см. её докстринг), по прямому запросу пользователя
    // 2026-09-20: "avatar анимация жнеца во фрейме, рядом просто текст, на
    // поле он или в резерве". Раньше тут была голая строка (маленький
    // RunnerToken без рамки + Text) — заменена целиком.
    const reaperNode = reaper && (
        <ReaperCard
            reaper={reaper}
            color={activePlayer.color}
            active={String(reaper.id) === String(activePlayer.activeRunnerId)}
            sizeScale={leftGrow}
        />
    );

    const runnerCards = trackedRunners.map((runner) => {
        const zoneKey = `move:${runner.id}`;
        const isPending = isMyPanel && pendingSelect?.runnerId === runner.id;
        // Пока выбор не подтверждён, кубик ещё не consumed бэком (runner.dice/
        // rollDice не менялись) — берём значение из трея игрока по индексу
        // pendingSelect, и кладём его в квадрат, соответствующий типу
        // (обычный ход или накат — см. handleDropOnRunner в GameBoardScreen).
        const pendingValue = isPending ? activePlayer.dice[pendingSelect.diceIndex] : null;
        const moveDiceValue = isPending && pendingSelect.type === 'DICE' ? pendingValue : runner.dice ?? null;
        const rollDiceValue = isPending && pendingSelect.type === 'ROLL' ? pendingValue : runner.rollDice ?? null;
        // Бонус хода — runner.trackGain (см. roadBonusValue выше) теперь
        // приходит с бэка напрямую на КАЖДОМ бегуне, не только во время
        // шага ROAD_BONUS активного бегуна — зеркалит бэковое условие
        // PlayerStepService::offersRoadBonus() (runner.trackGain===true &&
        // game.trackGain>0).
        const hasRoadBonus = runner.trackGain === true && roadBonusValue > 0;
        // onPress={onRunnerCardPress} — СТАБИЛЬНАЯ ссылка, НЕ инлайн-замыкание
        // (было `() => onRunnerCardPress(runner)`) — 2026-09-19, живая жалоба
        // "тормозит при перетаскивании кубика по плиткам", см. докстринг
        // RunnerCard.js#React.memo. RunnerCard сам вызывает onPress?.(runner)
        // — см. её handlePress.
        return (
            <RunnerCard
                // 2026-09-27, по прямому запросу пользователя: ключ по
                // `runner.type` (SPRINTER/ATHLETE/TANK), не по `runner.id`.
                // У разных игроков id бегунов разные — старый ключ на КАЖДОЕ
                // переключение таба переключателя игроков заставлял React
                // видеть "совсем другой список" и полностью размонтировать/
                // монтировать каждую карточку (~70+ `<Image>` из-за 9-slice
                // рамки, см. FramePanel/PersonPanel). `type` — та же "роль"
                // независимо от игрока (каждый игрок всегда имеет ровно одну
                // карточку каждого из 3 типов, см. RUNNER_ORDER/trackedRunners
                // выше) — React теперь переиспользует тот же смонтированный
                // инстанс между игроками, просто обновляя пропсы (цвет,
                // статус, кубики) через уже существующий React.memo.
                key={runner.type}
                runner={runner}
                color={activePlayer.color}
                active={String(runner.id) === String(activePlayer.activeRunnerId)}
                turnActive={isActivePlayerTurn && String(runner.id) === String(activePlayer.activeRunnerId)}
                pulseHighlight={runnersHighlight && canSelectRunner(runner.id)}
                pending={isPending}
                healTarget={isMyPanel && pendingAbility?.ability === 'heal'}
                onPress={onRunnerCardPress}
                onDoubleTap={onRunnerCardDoubleTap}
                moveDiceValue={moveDiceValue}
                rollDiceValue={rollDiceValue}
                roadBonus={hasRoadBonus ? roadBonusValue : null}
                hoverState={hover.key === zoneKey ? (hover.valid ? 'valid' : 'invalid') : null}
                onMoveDiceMeasured={handleMeasured}
                compact={compactColumns}
                remeasureTick={remeasureTick}
                sizeScale={leftGrow}
            />
        );
    });

    // Текст-заголовок ("УСИЛЕНИЯ"/"Усиления — перетащи кубик на зону") убран
    // по прямому запросу пользователя (2026-09-20), вместе с "КУБИКИ"/"Кубики
    // перемещения" (см. diceAbilitiesTile ниже) — обе секции объединены в
    // одну декоративную плитку (PersonPanel, тот же приём, что уже красит
    // корпус RunnerCard), сама плитка даёт визуальную группировку без подписей.
    const abilitiesNode = (
        <AbilityZones
            assignments={abilityAssignments}
            hoverKey={hover.key}
            hoverValid={hover.valid}
            onMeasured={handleMeasured}
            onPressZone={onPressAbilityZone}
            remeasureTick={remeasureTick}
            compact={compactColumns}
            color={activePlayer.color}
            pulseKeys={abilityPulseKeys}
            sizeScale={rightGrow}
        />
    );

    // "Кубики" и "Усиления" — теперь ОДНА плитка (декоративная рамка
    // PersonPanel), по прямому запросу пользователя "аналогично плитке
    // персонажа". Размер нужен ЧИСТО для decorативной рамки — dATile/
    // diceTrayWrap не участвуют в хит-тестинге дропа (это не зоны, а обёртки
    // вокруг них), значит оконные координаты (measureInWindow) им не нужны
    // вообще.
    //
    // **`onLayout`, НЕ `measureInWindow`** (2026-09-26, живая жалоба на
    // реальном устройстве после введения авто-масштабирования колонок —
    // "рамка кубиков/усилений висит в воздухе, картинки вне рамки"). Раньше
    // тут стоял measureInWindow+RAF+setTimeout(150) (нужен был, чтобы поймать
    // финальную ширину плитки, растянутой по родителю — Android иногда
    // досчитывает flex-ширину не с первого прохода layout'а, см. старый
    // комментарий ниже). Но measureInWindow ОТРАЖАЕТ уже применённый
    // `transform:scale` колонки (см. leftScale/rightScale выше) — а
    // FramePanel рисуется ВНУТРИ той же самой масштабируемой колонки, значит
    // получал УЖЕ уменьшенный размер и ужимался transform'ом ЕЩЁ РАЗ поверх
    // этого — рамка становилась вдвое меньше контента. `onLayout` (тот же
    // принцип, что уже используют leftContentH/rightContentH выше) отдаёт
    // НАТУРАЛЬНЫЙ, не зависящий от transform размер — плюс он и без ручного
    // RAF/setTimeout сам перевызывается на каждое реальное изменение
    // layout'а (в т.ч. тот самый "лишний проход" на Android), это даже
    // надёжнее, чем угаданная задержка.
    // `overflow:'hidden'` на styles.dATile — доп. страховка НА СЛУЧАЙ, если
    // измерение всё-таки на мгновение отстанет: контент физически не сможет
    // нарисоваться за пределами плитки, даже пока PersonPanel её ещё не
    // "догнал".
    const [dATileSize, setDATileSize] = useState(null);
    const onDATileLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setDATileSize({ width, height });
    }, []);

    // Кубики — теперь ТОЖЕ в декоративной рамке (FramePanel, тот же приём,
    // что и у КАЖДОЙ зоны усиления, см. AbilityZone.js) — по прямому запросу
    // пользователя "сделай, чтобы кубики тоже были в рамке, как усиления".
    // ОДНА рамка на ВЕСЬ трей (все 4 кубика вместе), не по рамке на кубик —
    // пользователь явно уточнил "все кубики в одной рамке". Тот же `onLayout`
    // фикс, что и у dATile выше, и по той же причине.
    const [diceTraySize, setDiceTraySize] = useState(null);
    const onDiceTrayLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setDiceTraySize({ width, height });
    }, []);

    const diceAbilitiesTile = (
        <View
            onLayout={onDATileLayout}
            style={[styles.dATile, compactColumns && styles.dATileCompact]}
        >
            <PersonPanel size={dATileSize} />
            <View onLayout={onDiceTrayLayout} style={styles.diceTrayWrap}>
                {/* targetCornerSize=8 (было 12, дефолт FramePanel) — 2026-09-20,
                    живая жалоба "рамка кубиков/усилений касается рамки общей
                    плитки на Android, на вебе норм". НЕ трогаем padding/размер
                    ОБЩЕЙ плитки (dATile) — тот прошлый вариант фикса пользователь
                    отклонил явно ("надо было менять размер фреймов, а не общей
                    плитки", "зачем увеличил высоту общей плитки"): dATile — auto-
                    height от контента, ЛЮБОЙ доп. зазор (padding на dATile ИЛИ
                    margin вокруг diceTrayWrap — геометрически одно и то же)
                    неизбежно раздувает её итоговую высоту, это не обходной путь.
                    Вместо этого — тоньше сама декоративная дуга ВНУТРЕННЕГО
                    фрейма (FramePanel.js#targetCornerSize масштабирует ВЕСЬ
                    набор угол+грани одним коэффициентом, см. её докстринг) —
                    её видимая "краска" короче, меньше заходит в тот же
                    небольшой зазор, где раньше обе рамки накладывались друг на
                    друга. Сам бокс diceTrayWrap/зоны — ТОТ ЖЕ размер, что и был,
                    высота/ширина плитки не меняется ни на пиксель.
                    Фон — ДЕФОЛТ FramePanel (PERSON_PANEL_BACKGROUND/_CORNER,
                    тайл 39) — тот же самый фон, что рисует PersonPanel у
                    самой карточки-плитки (dATile), явных backgroundSource/
                    backgroundCornerSource/backgroundTileSize больше нет
                    (2026-09-20, по прямому запросу пользователя "сделай задний
                    фон для фрейма с кубиками как у плиток" — было переопределено
                    на чёрный фон аватара чуть раньше в тот же день, решение
                    пересмотрено). */}
                <FramePanel
                    size={diceTraySize}
                    targetCornerSize={8}
                />
                {/* borderRadius — frameNotchRadius(diceTraySize, 8), та же
                    величина, что FramePanel сам использует для своего wrap
                    (см. её докстринг, 2026-09-26) — тот же фикс "рамка/заливка
                    острым углом поверх скруглённой дуги", что уже применён в
                    AbilityZone.js/RunnerCard.js. */}
                <PulseHighlight active={diceHighlight} borderRadius={frameNotchRadius(diceTraySize, 8)} showBackground showBorder={false} />
                <DiceTray
                    dice={trayDice}
                    draggable={dragMode != null}
                    onDragStart={handleDieDragStart}
                    onDragMove={handleDragMove}
                    onDrop={handleDrop}
                    onDragEnd={handleDieDragEnd}
                    ghostX={nativeGhostX}
                    ghostY={nativeGhostY}
                    panelOriginX={nativePanelOriginX}
                    panelOriginY={nativePanelOriginY}
                    // Размер кубика в compactColumns — 28→40 (2026-09-20, по
                    // прямому запросу пользователя "сделай кубики побольше",
                    // сразу после того, как они переехали в 2×2-сетку внутри
                    // общей рамки, см. DiceTray.js). 2026-09-26: точечная
                    // попытка уменьшить (40→34) под нехватку высоты columns
                    // ОТКАЧЕНА по прямому запросу пользователя — вместо
                    // подрезания конкретных размеров вся колонка теперь сама
                    // масштабируется целиком под реально доступную высоту
                    // (см. leftScale/rightScale и columns/leftColumn/
                    // rightColumn в рендере ниже) — константа тут снова
                    // "как задумано", масштаб уменьшает её только когда
                    // реально не хватает места. 2026-09-26: при РОСТЕ (rightGrow>1,
                    // содержимого меньше доступной высоты) — растим кубик
                    // РЕАЛЬНЫМ размером по той же причине, что и в
                    // AbilityZone.js/RunnerCard.js (transform:scale>1 переполнил
                    // бы ширину, см. докстринг leftGrow/rightGrow выше).
                    {...(compactColumns ? { size: Math.round(40 * rightGrow) } : {})}
                />
            </View>
            <View style={styles.abilitiesWrap}>{abilitiesNode}</View>
        </View>
    );

    return (
        <View ref={panelRootRef} onLayout={measurePanelOrigin} style={[styles.panel, { width, height }]}>
            <View style={styles.body}>
                {!switcherAtBottom && switcher}

                {/* headerContent — место баннера хода в портретной раскладке
                    (GameBoardScreen передаёт его сюда вместо отдельного
                    плавающего баннера над доской — см. GameBoardScreen). Раньше
                    тут был крупный Text с именем игрока — убран по запросу:
                    имя уже видно в кнопках переключателя, дублировать незачем. */}
                {headerContent}

                {/* Альбомная раскладка — плитка кубики+усиления закреплена НАД
                    скроллом (не внутри ScrollView), полной ширины панели, как
                    и раньше стоял отдельный трей кубиков. В compactColumns та
                    же плитка переехала в правую колонку целиком (см. ниже) —
                    по прямому запросу пользователя: левая колонка (бегуны)
                    должна начинаться сразу под шапкой, не терять место под
                    общий на всю ширину трей. */}
                {!compactColumns && diceAbilitiesTile}

                {/* compactColumns (портретная раскладка) — бегуны+жнец слева (шире,
                    основное пространство отдано им по прямому запросу
                    пользователя), плитка кубики+усиления справа. Жнец — сверху,
                    3 карточки бегунов — В РЯД, вертикально ориентированные
                    (RunnerCard#compact, см. её докстринг) — 2026-09-20, по
                    прямому запросу пользователя: высота ряда теперь равна
                    высоте ОДНОЙ плитки, а не трёх стопкой, чтобы все 4 плитки
                    (Жнец+3) помещались без прокрутки. 2026-09-26: сама
                    подстраховка на случай нехватки места сменилась со
                    скролла на масштабирование (см. leftScale/columns выше) —
                    колонка теперь ВСЕГДА показывает весь контент целиком,
                    просто может стать компактнее. Зона дропа кубика хода —
                    вся карточка целиком (см. RunnerCard, сама меряет и
                    репортит себя) — remeasureTick форсирует у неё повторный
                    measureInWindow не только после скролла (тут скролла
                    больше нет), но и после каждого изменения leftScale/
                    rightScale (новый transform не меняет layout сам по себе,
                    значит и не будит onLayout ребёнка). */}
                {compactColumns ? (
                    <View style={styles.columns} onLayout={onColumnsLayout}>
                        {/* Раньше — ScrollView (скроллить лишнее, если контент не
                            помещался). По прямому запросу пользователя, 2026-09-26,
                            заменено на transform:scale под реально измеренную
                            доступную высоту (см. leftScale выше) — панель ВСЕГДА
                            влезает целиком, без скролла и без обрезки, просто
                            становится компактнее на тесных экранах. overflow:hidden
                            — страховка на первый рендер, пока scale ещё не посчитан
                            (natural-размер контента на миг может быть больше
                            columnsH, ДО того как onLayout вернёт реальные цифры). */}
                        <View style={[styles.leftColumn, styles.scaleClip]}>
                            <View
                                onLayout={onLeftContentLayout}
                                style={[styles.leftColumnContent, { transform: [{ scale: leftScale }], transformOrigin: 'top' }]}
                            >
                                {reaperNode}
                                <View style={styles.runnerRow}>{runnerCards}</View>
                            </View>
                        </View>
                        <View style={[styles.rightColumn, styles.scaleClip]}>
                            <View
                                onLayout={onRightContentLayout}
                                style={[styles.rightColumnContent, { transform: [{ scale: rightScale }], transformOrigin: 'top' }]}
                            >
                                {diceAbilitiesTile}
                            </View>
                        </View>
                    </View>
                ) : (
                    // Живой прогон (веб) вскрыл тот же баг устаревающего measureInWindow
                    // тут — карточки бегунов лежат в СВОЁМ ScrollView (плитка кубики+
                    // усиления теперь закреплена отдельно, см. выше), но остаток
                    // (Бегуны) всё ещё может прокручиваться.
                    <ScrollView
                        style={styles.infoColumn}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        onScrollEndDrag={bumpRemeasure}
                        onMomentumScrollEnd={bumpRemeasure}
                    >
                        {reaperNode}
                        {/* Текст "— перетащи кубик хода на бегуна" убран (по прямому
                            запросу пользователя) — то же самое теперь показывает
                            подсказка-пульсация (см. runnersHighlight выше), отдельная
                            инструкция в заголовке стала избыточна. */}
                        <PulseText active={runnersHighlight} style={styles.sectionTitle}>Бегуны</PulseText>
                        {runnerCards}
                    </ScrollView>
                )}

                {switcherAtBottom && switcher}
            </View>

            {/* Ghost перетаскиваемого кубика — ВЕБ (legacy `Animated`, этот
                блок) + NATIVE (reanimated, следующий блок ниже) — см. общий
                докстринг у dragGhostPos/nativeGhostX выше за полной историей
                дня (три захода: без ghost на native → ghost через JS-мост →
                просто снять overflow без ghost → наконец ghost, но на
                reanimated). x/y — уже визуальный ЦЕНТР кубика (см. DiceDie —
                origin от measureInWindow + дельта жеста), поэтому рисуем
                ghost центрированным РОВНО на этой точке, без искусственного
                сдвига: раньше был сдвиг вверх на size+14px "чтобы не
                закрывать курсор" — из-за него видимый ghost и реальная точка
                хит-теста (та же x/y) расходились, и подсветка зоны
                срабатывала не там, где визуально был кубик.

                position:'fixed' — координаты уже оконные, пересчёт под
                какого-то родителя не нужен. `left:0,top:0` (в
                styles.dragGhost) + `translateX/Y` вместо прямых `left`/`top`
                — позиция идёт через `dragGhostPos.setValue()` (см. выше), а
                Animated умеет обновлять `transform` в обход React state,
                `left`/`top` так дёшево не обновить. */}
            {Platform.OS === 'web' && dragGhostValue != null && (
                <Animated.Image
                    source={DICE_FACE_IMAGES[dragGhostValue]}
                    pointerEvents="none"
                    resizeMode="contain"
                    style={[
                        styles.dragGhost,
                        {
                            width: dragGhostSize,
                            height: dragGhostSize,
                            transform: [
                                { translateX: Animated.subtract(dragGhostPos.x, dragGhostSize / 2) },
                                { translateY: Animated.subtract(dragGhostPos.y, dragGhostSize / 2) },
                            ],
                        },
                    ]}
                />
            )}
            {/* Native-версия — reanimated `Animated.Image` (из
                `react-native-reanimated`, импортирован как
                `ReanimatedAnimated`, чтобы не конфликтовать с legacy
                `Animated` из 'react-native' выше). `nativeGhostAnimatedStyle`
                читает `nativeGhostX/Y` — shared values, которые пишет
                НАПРЯМУЮ воркет DiceDie на UI-потоке (см. её докстринг), без
                JS-моста на кадр драга. `position:'absolute'` — этот ghost
                рисуется ПРЯМЫМ ребёнком корня панели (см. `ref={panelRootRef}`
                выше), обычный RN-View по умолчанию `position:'relative'`,
                этого достаточно без портала/доп. родителя. */}
            {Platform.OS !== 'web' && dragGhostValue != null && (
                <ReanimatedAnimated.Image
                    source={DICE_FACE_IMAGES[dragGhostValue]}
                    pointerEvents="none"
                    resizeMode="contain"
                    style={[styles.dragGhost, { width: dragGhostSize, height: dragGhostSize }, nativeGhostAnimatedStyle]}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        backgroundColor: '#00000055',
        borderRadius: radius.lg,
        padding: spacing.md,
    },
    // 'fixed' — только веб (см. dragGhost); на native этот стиль определяется,
    // но никогда не применяется (JSX за Platform.OS==='web'), 'absolute' —
    // просто безопасный фолбэк на случай ошибки в этом условии.
    dragGhost: {
        // width/height заданы инлайн (dragGhostSize зависит от compactColumns).
        // left/top:0 — точка отсчёта для translateX/Y (см. место рендера),
        // сама позиция идёт через transform, не через left/top напрямую.
        position: Platform.OS === 'web' ? 'fixed' : 'absolute',
        left: 0,
        top: 0,
        zIndex: 9999,
    },
    // Переключатель игроков остаётся НАД зоной информации (вертикальный стек
    // секций, не колонки рядом). Высота switcherBox — ФИКСИРОВАННЫЙ пиксельный
    // размер (switcherHeight, ~15% высоты окна — см. useBoardLayout.switcherH),
    // а не flex-пропорция: на вебе цепочка height:100% от корня навигатора до
    // панели рвётся (обычная проблема RN Web без явного height на каждом
    // уровне), из-за чего flex:1/flex:4 между switcherBox и infoColumn не
    // распределялся как задумано и переключатель расползался почти на пол-
    // экрана. Фиксированный пиксель не зависит от этой цепочки. infoColumn
    // забирает flex:1 — весь остаток, какой бы он ни оказался.
    body: { flex: 1, flexDirection: 'column' },
    switcherBox: { justifyContent: 'center' },
    infoColumn: { flex: 1, marginTop: spacing.xs },
    scrollContent: { paddingBottom: spacing.md },
    sectionTitle: {
        color: colors.textOnDarkSecondary,
        fontSize: font.tiny,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
    },
    // Обёртка вокруг DiceTray — теперь САМА декоративная рамка (FramePanel,
    // см. diceAbilitiesTile), не просто носитель для PulseHighlight. padding
    // — тот же приём, что у AbilityZone.js#styles.zone (иначе кубики упирались
    // бы в декоративную дугу рамки).
    //
    // БЕЗ overflow:'hidden' (2026-09-20, живая жалоба пользователя — "кубики
    // при передвижении на android заходят ЗА фрейм усиления") — раньше тут
    // стоял тот же приём, что у styles.dATile ("страховка от вылезания
    // контента за раму"), но это ТОЧКА, ИЗ КОТОРОЙ кубик перетаскивают —
    // overflow:'hidden' на источнике драга в принципе неверен: пока кубик
    // тащат, он ДОЛЖЕН визуально покидать эту рамку, чтобы долететь до
    // усиления/карточки бегуна где-то ещё в панели. На Android transform
    // (Animated, см. DiceDie.js) поверх overflow:'hidden' — известная
    // кросс-платформенная особенность RN: трансформированный потомок иногда
    // всё равно "прорывается" визуально сквозь родительский клип, но при
    // этом ТЕРЯЕТ приоритет z-порядка (elevation/zIndex считаются
    // относительно исходного, уже "обрезающего" родителя) — отсюда кубик
    // оказывался виден, но НИЖЕ декоративной рамки усилений, а не поверх
    // неё, как задумано. Сама декоративная дуга (FramePanel) не пострадает
    // — она сидит НЕ внутри diceTrayWrap как контент, который надо
    // обрезать, а сама и есть первый слой этой View, ей клип не нужен.
    diceTrayWrap: { borderRadius: 4, padding: spacing.xs },
    // Общая плитка "Кубики+Усиления" (2026-09-20, PersonPanel-рамка, см.
    // diceAbilitiesTile) — padding, чтобы контент не упирался в декоративную
    // дугу рамки (тот же приём, что и у RunnerCard.js#styles.card).
    // overflow:'hidden' — страховка на случай, если PersonPanel хоть на
    // мгновение отстанет от реальной ширины плитки (см. комментарий у
    // measureDATile) — без неё контент рисовался бы поверх/за пределами уже
    // готовой декоративной рамки, а не просто ждал бы её. В compactColumns
    // плитка — ЕДИНСТВЕННЫЙ контент своей колонки (рядом больше ничего не
    // рендерится), поэтому marginBottom не нужен; в альбомной раскладке
    // плитка стоит НАД отдельным скроллящимся списком бегунов — небольшой
    // отступ отделяет её от него.
    dATile: { padding: spacing.sm, marginBottom: spacing.sm, overflow: 'hidden' },
    // paddingHorizontal/paddingVertical РАЗДЕЛЬНО (не общий `padding`,
    // 2026-09-20) — dATile НЕ имеет своей фиксированной ширины (растянута
    // родителем — правой колонкой), поэтому paddingHorizontal просто
    // перераспределяет УЖЕ имеющуюся ширину контенту, ничего не добавляя к
    // итоговому размеру плитки — безопасно увеличен посильнее (md), чинит
    // касание рамок усилений/кубиков с рамкой плитки по бокам БЕЗ побочных
    // эффектов. paddingVertical — другое дело: высота dATile auto-считается
    // ОТ контента, любой лишний вертикальный зазор напрямую её увеличивает
    // (прошлая попытка — единый `padding: spacing.md` — так и сделала,
    // пользователь справедливо отклонил: "зачем увеличил высоту общей
    // плитки", "надо было менять размер фреймов, а не общей плитки").
    // Прирост тут — ТОЛЬКО +spacing.xs (4→8, было бы +11 при md) — и
    // СРАЗУ компенсирован уменьшением зазора кубики/усиления (см.
    // abilitiesWrap ниже, тоже −4), по прямому предложению пользователя
    // "сделать расстояние между фреймами усилений и кубиков меньше, может
    // вернуть правки без увеличения общей плитки" — чистый прирост высоты
    // ~0-4px, а не +22px, как было в откаченной версии.
    dATileCompact: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: 0, overflow: 'hidden' },
    // Зазор между треем кубиков и сеткой усилений внутри общей плитки —
    // раньше его давал marginTop у заголовка "УСИЛЕНИЯ" (убран вместе с
    // текстом, см. abilitiesNode), без него сетка липла вплотную к кубикам.
    // spacing.xs (было spacing.sm) — уменьшен на 2026-09-20, компенсирует
    // прирост paddingVertical у dATileCompact выше (см. её комментарий).
    abilitiesWrap: { marginTop: spacing.xs },
    // compactColumns (портретная раскладка) — бегуны+жнец слева (основное
    // пространство), кубики+усиления справа, заметно уже — по прямому
    // запросу пользователя "сделать зону усилений поуже, дать место плиткам
    // бегунов" (история: было 3:2, потом 2:1).
    //
    // 2026-09-26: leftColumn/rightColumn были ScrollView (скроллили лишнее,
    // если контент не помещался по высоте) — по прямому запросу пользователя
    // заменены на обычные View с transform:scale на внутреннем контенте (см.
    // leftScale/rightScale и место рендера) — колонка ВСЕГДА показывает
    // содержимое целиком, без скролла, просто компактнее, когда реальной
    // высоты не хватает. `scaleClip` (overflow:hidden) — только страховка на
    // первый кадр, пока scale ещё не посчитан.
    //
    // **Настоящая причина "не помещается имя бегуна на Android"
    // (2026-09-19)** — НЕ размер самой карточки (RunnerCard тут не трогали),
    // а то, что заявленное соотношение 2:1 у leftColumn/rightColumn фактически
    // НЕ ПРИМЕНЯЛОСЬ вообще: `ScrollView` в react-native-web несёт СОБСТВЕННЫЙ
    // базовый стиль (`commonStyle = {flexGrow:1, flexShrink:1}`,
    // node_modules/react-native-web/.../ScrollView/index.js), который на
    // вебе побеждает в CSS-каскаде над нашим `flex:2`/`flex:1` (шорткат
    // сам по себе, судя по всему, не разбирается в единый flexGrow ДО того,
    // как конкурирует с уже атомарным `flexGrow` от ScrollView — порядок
    // React-массива style тут не спасает, картина чисто CSS-специфичности).
    // Живой замер (DOM, `getComputedStyle`) подтвердил: у ОБЕИХ колонок
    // `flexGrow` фактически был `1` (не `2` у leftColumn), несмотря на
    // `flex:2` в JS-стиле — отсюда почти равные 165px/173px вместо ~2:1.
    // Фикс — задавать `flexGrow`/`flexShrink`/`flexBasis` ЯВНЫМИ длинными
    // свойствами (не через шорткат `flex`) — та же самая property-конкуренция
    // с `commonStyle`, но теперь уже точно по ИМЕНИ свойства, где наш стиль
    // однозначно позже/точнее и побеждает. Сам конфликт с ScrollView'ом
    // сейчас уже неактуален (эти колонки больше не ScrollView), оставлено
    // как объяснение, ПОЧЕМУ тут длинные свойства, а не `flex`-шорткат —
    // возвращать шорткат обратно не нужно. `minWidth:0` — тоже нужен (без
    // него `flexBasis:0` не спасёт от того, что колонка не ужмётся меньше
    // естественного размера контента, та же ловушка, что уже чинилась для
    // `infoCol` в RunnerCard.js).
    columns: { flex: 1, flexDirection: 'row', marginTop: spacing.xs },
    // 3:2 (не 2:1) — после фикса flexGrow-конкуренции с ScrollView выше 2:1
    // дало реальную ширину карточки 211px (было 157) — живая жалоба
    // пользователя "слишком широко получилось", 3:2 — более умеренный шаг.
    leftColumn: { flexGrow: 3, flexShrink: 1, flexBasis: 0, minWidth: 0, marginRight: spacing.sm },
    // Страховочный клип на первый кадр (см. комментарий у columns выше) —
    // ТОЛЬКО overflow, ширину/рост колонки не трогает. **2026-09-28,
    // промежуточный заход**: пробовал временно снимать этот clip на время
    // драга кубика (`scaleClipOpen`, `overflow:'visible'`) вместо ghost'а —
    // живая проверка показала, что этого НЕДОСТАТОЧНО (кубик всё равно
    // визуально уходит "за" соседнюю колонку, похоже `transform:scale` на
    // `leftColumnContent`/`rightColumnContent` создаёт свой stacking-контекст
    // независимо от overflow) — откачено, `scaleClipOpen` удалён, вместо
    // него — ghost на reanimated shared values (см. `nativeGhostX/Y` выше и
    // `DiceDie.js`), рисуется ВНЕ этой колонки и потому не подвержен ни
    // клипу, ни её stacking-контексту в принципе.
    scaleClip: { overflow: 'hidden' },
    // paddingHorizontal — карточки/кубики+усиления теперь НЕ растянуты
    // впритык к границам своей колонки (по прямому запросу пользователя
    // "уменьшить ширину" обеих зон) — видимый отступ с обеих сторон, сама
    // ширина колонок (2:1) не меняется.
    leftColumnContent: { paddingBottom: spacing.sm, paddingHorizontal: spacing.xs },
    // Ряд из 3 вертикальных плиток бегунов, ПОД Жнецом (2026-09-20, см.
    // RunnerCard.js#compact) — gap, тот же приём, что уже используют columns/
    // DiceTray/turnBtnRow в этом файле/проекте.
    runnerRow: { flexDirection: 'row', gap: spacing.xs },
    rightColumn: { flexGrow: 2, flexShrink: 1, flexBasis: 0, minWidth: 0, paddingHorizontal: spacing.xs },
    rightColumnContent: { paddingBottom: spacing.sm },
});
