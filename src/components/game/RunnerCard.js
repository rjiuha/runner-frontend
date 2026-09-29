// src/components/game/RunnerCard.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RunnerToken from './RunnerToken';
import PulseHighlight from '../ui/PulseHighlight';
import PersonPanel, { NOTCH_RADIUS } from '../ui/PersonPanel';
import FramePanel from '../ui/FramePanel';
import {
    DAMAGE_SLOT_ICONS,
    FRAME_PANEL_BACKGROUND,
    FRAME_PANEL_BACKGROUND_CORNER,
    RUNNER_DISPLAY,
    RUNNER_STATUS,
} from '../../constants/GameConstants';
import { colors, font, spacing } from '../../theme';

/**
 * Карточка одного бегуна.
 *
 * ДВЕ раскладки контента, переключаются пропом `compact` (= compactColumns,
 * портретная раскладка — см. PlayerInfoPanel.js):
 *
 * - Обычная (compact=false, альбомная раскладка) — горизонтальный ряд:
 *   аватар слева фиксированного размера (AVATAR_SIZE) → высота карточки
 *   природно определяется высотой аватара + паддингом (~80dp), имя+жетоны
 *   посередине (flex:1), слот кубика справа.
 *
 * - Компактная/ВЕРТИКАЛЬНАЯ (compact=true) — 2026-09-20, по прямому запросу
 *   пользователя: "сделать плитки бегунов вертикально ориентированными и
 *   разместить рядом" — три такие плитки в ряд занимают высоту ОДНОЙ плитки
 *   вместо трёх стопкой, что и решает исходную задачу ("чтобы все 4 плитки
 *   [Жнец+3] всегда умещались без прокрутки"), без урезания панели и без
 *   ужимания под измеренную высоту — просто другая геометрия. Аватар сверху
 *   по центру → имя (скрыто на Android, как и раньше) → жетоны повреждения
 *   в ряд → слот кубика снизу. Сама плитка — flex:1 внутри ряда (см.
 *   PlayerInfoPanel.js#runnerRow), не width:'100%'. Живой мокап-макет,
 *   утверждённый пользователем перед переносом в код:
 *   https://claude.ai/artifact/VBATd4odKsf658qyLfFtRV
 *
 * Декоративная рамка корпуса — PersonPanel (person_panel_*), аватар и слот
 * кубика — каждый в своей мини-рамке FramePanel (frame_panel_* для аватара,
 * person_panel_* — дефолт FramePanel — для слота кубика, см. её докстринг).
 *
 * `active`/`turnActive`/`pulseHighlight`/`hoverState`/`pending`/`healTarget`/
 * `remeasureTick` — работают одинаково в обеих раскладках: рамку красит
 * растровый PersonPanel, все состояния — полупрозрачная заливка/контур
 * поверх (тот же приём, что и в AbilityZone), не зависят от того, как
 * расположен контент внутри.
 *
 * Жетоны повреждения — по прямому решению пользователя, ПРОСТО занято/
 * свободно (dmg_red/dmg_green), без 5 типов/цветов/кодов, что были раньше
 * (DAMAGE_TOKENS в GameConstants.js остаётся для остального кода, тут
 * больше не импортируется).
 *
 * "Ход"/"Накат" — один слот кубика (diceSlot) показывает АКТИВНОЕ значение
 * (rollDiceValue в приоритете — во время наката runner.dice уже 0, не null,
 * `??` его не заменит). Счётчик накатов "×N" — сколько накатов ЕЩЁ доступно
 * в этом раунде (2 − runner.rollMoves, НЕ то же самое, что rollDiceValue) —
 * 2026-09-20, по прямому запросу пользователя ПЕРЕЕХАЛ из уголка-бейджа
 * ПОВЕРХ слота кубика в ОТДЕЛЬНЫЙ элемент под ним (rollCount/rollCountCompact
 * в styles) — раньше и это, и слот кубика были одним визуальным пятном,
 * пользователь попросил развести.
 *
 * Бонус хода (roadBonus проп, число|null) — 2026-09-20. С 2026-09-24 бэк
 * (коммит 59aea0f) отдаёт per-runner Runner::$trackGain в Runner::toArray()
 * (RunnerViewModel) — PlayerInfoPanel.js#hasRoadBonus теперь читает
 * runner.trackGain напрямую (видно на ЛЮБОМ бегуне с флагом, в любой момент,
 * не только во время чужого шага ROAD_BONUS) — сюда по-прежнему приходит
 * готовое число|null, сам проп/рендер не изменился.
 *
 * Текстовая строка статуса убрана — уничтоженный бегун виден через
 * `cardDestroyed` (приглушение всей карточки).
 */
const DOUBLE_TAP_MS = 300;
const AVATAR_SIZE = 64;
const DICE_SIZE = 44;
const DAMAGE_ICON_SIZE = 22;
// Вертикальная раскладка (compact) — заметно меньше горизонтальной: три
// такие плитки должны уместиться в РЯД по ширине левой колонки, тогда как
// горизонтальная плитка рассчитана на ВСЮ ширину колонки (см. докстринг
// файла). Пропорция аватар/кубик (44/64≈0.6875) сохранена, как и в
// обычной раскладке.
const AVATAR_SIZE_COMPACT = 44;
const DICE_SIZE_COMPACT = 30;
const DAMAGE_ICON_SIZE_COMPACT = 14;
// Бонус хода — 2026-09-30, по прямому запросу пользователя: раньше это была
// голая строка "+N", рендерившаяся ТОЛЬКО когда roadBonus не null — та самая
// причина, почему натуральная высота карточки различалась между бегунами
// (нашёл сам пользователь, живьём: "вижу, что это связано с наличием у test
// скаута бонуса дороги"). Теперь — такой же ВСЕГДА видимый квадрат-фрейм,
// как у слота кубика хода (diceBoxCompact/DICE_SIZE_COMPACT), с прочерком
// вместо числа, когда бонуса нет — карточка занимает одну и ту же высоту
// независимо от того, есть сейчас бонус или нет. Размер — ТОТ ЖЕ, что и у
// фрейма кубика хода (2026-09-30, по прямому запросу пользователя), не своя
// отдельная константа — оба слота визуально одного веса.
const ROAD_BONUS_SIZE_COMPACT = DICE_SIZE_COMPACT;
const ROAD_BONUS_FRAME_SIZE_COMPACT = { width: ROAD_BONUS_SIZE_COMPACT, height: ROAD_BONUS_SIZE_COMPACT };
// Platform.OS не меняется в течение жизни приложения — модульная константа,
// не пересчитывается на каждый рендер. См. isAndroid ниже (имя бегуна
// скрыто, кружки урона вертикально — по прямому запросу пользователя,
// 2026-09-19, ТОЛЬКО на Android).
const isAndroid = Platform.OS === 'android';
// Стабильные (созданные ОДИН раз, не на каждый рендер) объекты размера для
// FramePanel — 2026-09-19, живая жалоба "тормозит при перетаскивании кубика
// по плиткам". Раньше {width:AVATAR_SIZE,height:AVATAR_SIZE}/{width:
// DICE_SIZE,height:DICE_SIZE} создавались ИНЛАЙН в JSX — НОВЫЙ объект на
// КАЖДЫЙ рендер RunnerCard, даже когда сами числа не менялись. FramePanel
// теперь обёрнут в React.memo (см. её файл) — но React.memo сравнивает
// пропсы ПО ССЫЛКЕ (shallow), и разные объекты с одинаковыми полями всё
// равно считаются "изменившимися". Вынесенные наружу константы дают ТУ ЖЕ
// ссылку на каждом рендере — memo реально пропускает пере-рендер (и вместе
// с ним — реконсиляцию ~20 дочерних `<Image>` у каждого FramePanel). Два
// набора (обычный/compact) — оба стабильны по той же причине.
const AVATAR_FRAME_SIZE = { width: AVATAR_SIZE, height: AVATAR_SIZE };
const DICE_FRAME_SIZE = { width: DICE_SIZE, height: DICE_SIZE };
const AVATAR_FRAME_SIZE_COMPACT = { width: AVATAR_SIZE_COMPACT, height: AVATAR_SIZE_COMPACT };
const DICE_FRAME_SIZE_COMPACT = { width: DICE_SIZE_COMPACT, height: DICE_SIZE_COMPACT };

// Отдаём паддинг карточки наружу (2026-09-26) — PlayerInfoPanel.js считает
// по нему безопасный `sizeScale` для авто-РОСТА (см. её докстринг
// leftScale/rightScale/maxAvatarSizeScale ниже): нужно знать, СКОЛЬКО от
// ширины карточки реально остаётся под аватар после вычета paddingHorizontal
// у cardCompact — magic-число иначе задваивалось бы в двух файлах и могло бы
// разойтись при будущей правке паддинга здесь.
export const RUNNER_CARD_COMPACT_PADDING_H = spacing.xs;

/**
 * Максимальный `sizeScale`, при котором `avatarBoxCompact` (шириной
 * AVATAR_SIZE_COMPACT*scale) ещё гарантированно помещается в СВОЮ карточку —
 * используется PlayerInfoPanel.js при авто-РОСТЕ compact-колонки (2026-09-26,
 * по прямому запросу пользователя — "растянуть контент крупнее", см. её
 * докстринг leftScale/leftGrow). Три карточки стоят плотно в ряд (`flex:1`,
 * без запаса по ширине сверх этого), а сам аватар — ФИКСИРОВАННОГО пиксельного
 * размера (не ужимается вместе с flex-родителем) — без этой проверки рост мог
 * бы вытолкнуть аватар за границы своей карточки (наезд на соседние).
 * `cardContentWidth` — ширина ОДНОЙ карточки уже БЕЗ padding (вызывающая
 * сторона сама вычитает RUNNER_CARD_COMPACT_PADDING_H*2).
 */
export function maxAvatarSizeScale(cardContentWidth) {
    if (!cardContentWidth) return 1;
    return Math.max(1, cardContentWidth / AVATAR_SIZE_COMPACT);
}

// Стабильные ссылки (тот же принцип, что и у *_FRAME_SIZE выше — React.memo
// сравнивает пропсы по ссылке, новый массив на каждый рендер сломал бы это) —
// только количество занятых слотов имеет значение (см. рендер ниже —
// `slots[i] ? filled : empty`, содержимое объекта не читается).
const DAMAGE_SLOTS_NONE = [null, null];
const DAMAGE_SLOTS_ONE = [{ filled: true }, null];
const DAMAGE_SLOTS_BOTH = [{ filled: true }, { filled: true }];
function damageSlotsFromStatus(status) {
    if (status === RUNNER_STATUS.BROKEN || status === RUNNER_STATUS.DESTROYED) return DAMAGE_SLOTS_BOTH;
    if (status === RUNNER_STATUS.DAMAGED) return DAMAGE_SLOTS_ONE;
    return DAMAGE_SLOTS_NONE;
}

// React.memo (2026-09-19, живая жалоба "тормозит именно когда двигаешь
// кубиком по плиткам") — БЕЗ этого КАЖДЫЙ рендер PlayerInfoPanel (включая
// те, что вызваны сменой hoverState/pulse ТОЛЬКО у ОДНОЙ карточки во время
// драга) заново прогонял React-сверку ВСЕХ карточек разом (каждая — до 140
// дочерних <Image> из-за 9-slice PersonPanel/FramePanel, см. их докстринги),
// хотя пропсы большинства карточек не менялись вообще. shallow-сравнение
// пропсов работает корректно только если сами пропсы стабильны — см.
// AVATAR_FRAME_SIZE/DICE_FRAME_SIZE выше и правку onPress (стабильная
// ссылка вместо инлайн-замыкания на вызывающей стороне, см. PlayerInfoPanel.js).
function RunnerCard({
    runner,
    color,
    active,
    turnActive = false,
    pulseHighlight = false,
    pending,
    healTarget,
    onPress,
    onDoubleTap,
    moveDiceValue = null,
    rollDiceValue = null,
    hoverState,
    onMoveDiceMeasured,
    compact = false,
    remeasureTick = 0,
    roadBonus = null,
    // Авто-РОСТ compact-колонки (2026-09-26, см. maxAvatarSizeScale выше и
    // PlayerInfoPanel.js#leftGrow) — >1, когда контента МЕНЬШЕ, чем реально
    // доступная высота колонки, уже прошедший клэмп по безопасной ширине.
    // 1 (по умолчанию) — обычная раскладка/без роста, размеры как раньше.
    sizeScale = 1,
}) {
    // useMemo — та же причина, что и у AVATAR_FRAME_SIZE_COMPACT (стабильная
    // ссылка объекта для React.memo у FramePanel, см. её докстринг) — но
    // размер теперь не всегда одна и та же module-level константа, а
    // ПЕРЕСЧИТЫВАЕТСЯ от sizeScale. Меняется редко (только когда PlayerInfoPanel
    // пересчитывает leftGrow — при изменении высоты колонки/контента, НЕ на
    // каждый рендер), useMemo с [sizeScale] отдаёт ТУ ЖЕ ссылку между
    // рендерами, пока sizeScale не изменился — свойство React.memo не рушится.
    const avatarSizeCompact = Math.round(AVATAR_SIZE_COMPACT * sizeScale);
    const diceSizeCompact = Math.round(DICE_SIZE_COMPACT * sizeScale);
    const damageIconSizeCompact = Math.round(DAMAGE_ICON_SIZE_COMPACT * sizeScale);
    const avatarFrameSizeCompact = useMemo(
        () => (sizeScale === 1 ? AVATAR_FRAME_SIZE_COMPACT : { width: avatarSizeCompact, height: avatarSizeCompact }),
        [sizeScale, avatarSizeCompact],
    );
    const diceFrameSizeCompact = useMemo(
        () => (sizeScale === 1 ? DICE_FRAME_SIZE_COMPACT : { width: diceSizeCompact, height: diceSizeCompact }),
        [sizeScale, diceSizeCompact],
    );
    const display = RUNNER_DISPLAY[runner.type];
    // Жетоны повреждения — считаются НАПРЯМУЮ от runner.status (2026-09-24, по
    // прямому запросу пользователя), не от накопленной истории событий:
    // DAMAGED — один занятый (red) слот, BROKEN/DESTROYED — оба, HEALTHY —
    // ни одного. Статус синхронизируется через обычный снапшот и НИКОГДА не
    // теряется при reconnect/relaunch — в отличие от истории событий, которая
    // теряется, это гарантированно верно всегда, а не только пока жив тот же
    // живой Mercure-коннект. Старая инфраструктура накопления по истории
    // событий (`lib/runnerDamageTokens.js`/`hooks/useRunnerDamageTokens.js`,
    // её вывод никто больше не читал) удалена 2026-09-28 как мёртвый код.
    const slots = damageSlotsFromStatus(runner.status);
    const destroyed = runner.status === RUNNER_STATUS.DESTROYED;
    const zoneKey = `move:${runner.id}`;
    const cardRef = useRef(null);
    // Размер КОРПУСА карточки (для PersonPanel, см. её докстринг) — НЕ через
    // собственный onLayout PersonPanel (живая жалоба пользователя + логи
    // подтвердили: на Android onLayout абсолютно спозиционированного ребёнка
    // с auto-height родителем стабильно ловит height=0 — родитель ещё не
    // "устаканился" на момент этого конкретного measure-пути) — это ДРУГОЙ
    // случай, чем ниже: тут речь про onLayout САМОГО PersonPanel (абсолютно
    // спозиционированный потомок).
    //
    // **Но НЕ через measureInWindow тоже** (2026-09-26, симметричный фикс к
    // тому же живому багу в AbilityZone.js/PlayerInfoPanel.js — "рамки
    // усилений висят в воздухе" после введения авто-масштабирования колонок
    // leftScale/rightScale, см. их докстринги за полным разбором). Card
    // (TouchableOpacity, обычный flex-ребёнок, НЕ абсолютно спозиционирован)
    // теперь может оказаться внутри `transform:scale`-колонки — measureInWindow
    // отражает УЖЕ применённый scale, PersonPanel рисуется ВНУТРИ той же
    // масштабируемой колонки и получал бы уже уменьшенный размер, ужимаясь
    // transform'ом ЕЩЁ РАЗ поверх этого (двойное уменьшение). Используем
    // onLayout САМОЙ карточки (`cardRef`, обычный flow-элемент — тот путь,
    // что и так надёжно работает в проекте, см. infoWidth ниже) — он отдаёт
    // НАТУРАЛЬНЫЙ, transform-independent размер, ровно то, что нужно
    // декоративной рамке.
    const [cardSize, setCardSize] = useState(null);
    // Ширина СРЕДНЕЙ зоны (имя+жетоны, между аватаром и кубиком) — ТОЛЬКО
    // горизонтальная раскладка (см. infoCol в её JSX-ветке ниже); живая
    // жалоба пользователя: в узкой компактной колонке на 2 жетона физически
    // не хватало места, а `infoCol` без явного `minWidth:0` не ужимается
    // меньше "естественного" размера контента (классический баг RN/CSS
    // flexbox) — жетоны визуально вылезали в зону кубика. Вместо клиппинга —
    // реальное масштабирование: меряем зону через ЕЁ СОБСТВЕННЫЙ onLayout
    // (обычный, НЕ абсолютно спозиционированный flex-ребёнок — тот самый
    // путь измерения, что уже надёжно работает везде в проекте, в отличие от
    // бага PersonPanel.js выше) и ужимаем иконки жетонов под реально
    // доступную ширину. Вертикальная раскладка (compact) в этом не
    // нуждается — там жетоны в своём фиксированном компактном размере
    // (DAMAGE_ICON_SIZE_COMPACT), ширина плитки и так узкая по построению.
    const [infoWidth, setInfoWidth] = useState(null);

    const lastTapAtRef = useRef(0);
    // onPress?.(runner) — передаём runner ЗДЕСЬ, а не через инлайн-замыкание
    // на вызывающей стороне (`onPress={() => onRunnerCardPress(runner)}` в
    // PlayerInfoPanel.js) — та создавала НОВУЮ функцию на КАЖДЫЙ рендер
    // панели для КАЖДОЙ карточки, что срывало React.memo ниже (см. докстринг
    // файла — 2026-09-19, живая жалоба "тормозит именно когда двигаешь
    // кубиком по плиткам"): PlayerInfoPanel теперь передаёт `onPress`
    // СТАБИЛЬНОЙ ссылкой (сам handleRunnerCardPress в GameBoardScreen уже
    // принимает runner первым аргументом).
    const handlePress = useCallback(() => {
        const now = Date.now();
        if (onDoubleTap && now - lastTapAtRef.current < DOUBLE_TAP_MS) {
            lastTapAtRef.current = 0;
            onDoubleTap(runner);
            return;
        }
        lastTapAtRef.current = now;
        onPress?.(runner);
    }, [onPress, onDoubleTap, runner]);

    // ВАЖНО (контекст для cardSize, читается через onLayout, см. handleLayout
    // ниже): раньше тут вычитался spacing.sm*2 (предположение "PersonPanel
    // рисуется ВНУТРИ паддинга, значит размер нужно ужать") — живая проверка
    // (замер реального DOM на вебе) это опровергла: `PersonPanel.wrap`
    // (`position:'absolute', top:0, left:0`) позиционируется относительно
    // ГРАНИЦЫ card, а не его content-box — паддинг родителя АБСОЛЮТНО
    // спозиционированный потомок в RN/RN-web не учитывает вообще (та же
    // семантика, что и в обычном CSS: offset absolute-элемента отсчитывается
    // от padding-box предка, что здесь равно border-box, т.к. paddingBox
    // включает padding). Из-за двойного вычитания рамка оставалась размером
    // 323×64 при реальной карточке 339×80 — прижатой к левому верхнему углу,
    // с ЛИШНЕЙ пустой полосой 16px справа/снизу, где сквозь дыру просто был
    // виден фон экрана (ровно жалоба пользователя "рамка значительно меньше
    // плитки", подтверждена скриншотом+замером). Передаём ПОЛНЫЙ border-box
    // без вычитания — раз абсолютный потомок и так игнорирует padding, это и
    // есть корректный размер, чтобы рамка легла ровно по границе карточки.
    const measure = useCallback(() => {
        requestAnimationFrame(() => {
            cardRef.current?.measureInWindow((x, y, width, height) => {
                onMoveDiceMeasured?.(zoneKey, { x, y, width, height });
            });
        });
    }, [zoneKey, onMoveDiceMeasured]);

    const handleLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setCardSize({ width, height });
        measure();
    }, [measure]);

    useEffect(() => {
        if (remeasureTick) measure();
    }, [remeasureTick, measure]);

    // 2026-09-28 — СТРУКТУРНЫЙ фикс класса бага "зона дропа устарела после
    // смены игрока", вместо точечной заплатки в PlayerInfoPanel.js (которая
    // теперь убрана, см. её докстринг рядом с местом, где она раньше стояла).
    // Раньше починка держалась на том, что РОДИТЕЛЬ (PlayerInfoPanel) явно
    // знал о каждой причине "зона могла сместиться/принадлежать другому
    // бегуну" и бампал общий remeasureTick под КАЖДУЮ из них по отдельности
    // (скролл, масштаб, переключение таба...) — хрупко: любая НОВАЯ причина
    // в будущем (ещё не придуманная фича) требовала бы вспомнить добавить
    // ЕЩЁ один такой триггер, иначе кэш зоны снова незаметно устареет (ровно
    // так уже дважды ломалось — 2026-09-26 auto-scale и 2026-09-27 стабильный
    // key). Вместо этого — карточка сама отвечает за свежесть СВОЕЙ
    // регистрации: как только меняется `zoneKey` (т.е. `runner.id`, который
    // реально попадёт в `zoneLayoutsRef` и уйдёт бэку при дропе) — неважно,
    // ПОЧЕМУ он поменялся (смена таба, будущая фича, что угодно ещё) — сразу
    // перемеряется. Это не отменяет remeasureTick выше (тот всё ещё нужен
    // для PAINT-ONLY смещения — scale/scroll, где `zoneKey` не меняется
    // вообще, а меняется только ЭКРАННАЯ позиция того же бегуна), но
    // закрывает КЛАСС "сменилась личность бегуна за тем же слотом" раз и
    // навсегда, а не конкретный сегодняшний случай.
    //
    // **2026-09-28, дополнено ТЕМ ЖЕ вечером — реальный баг, найден живым
    // логом (`zoneLayoutsRef` целиком напечатан в консоль на дропе)**: этот
    // `useEffect` перемерял и РЕГИСТРИРОВАЛ новый `zoneKey`, но никогда не
    // УДАЛЯЛ старый — `zoneLayoutsRef.current` в PlayerInfoPanel.js только
    // ДОБАВЛЯЛ записи, никогда не чистил. У слота с той же экранной
    // позицией (Танк — первый в RUNNER_ORDER, всегда крайний слот) после
    // нескольких переключений игрока накопилось ПО ДВЕ записи с ОДИНАКОВЫМ
    // прямоугольником, но РАЗНЫМИ `runner.id` (старого и нового игрока) —
    // `findZoneAt` (простой перебор `Object.entries`, первое совпадение
    // побеждает) стабильно попадал на ПЕРВУЮ когда-либо вставленную (значит
    // самую старую, уже недействительную) — отсюда "не наводится на Танка"
    // и "подсветка не совпадает ни с чем" (hover.key всегда был устаревшим
    // id, с которым текущий рендер уже не сравнивал себя).
    //
    // **2026-09-29, живой лог (`DROPDBG2`) показал: фикс выше (ручной
    // `prevZoneKeyRef`) НЕ закрывал класс бага целиком** — он удаляет старую
    // запись ТОЛЬКО когда `zoneKey` меняется у ЖИВОГО (не размонтированного)
    // компонента. Если карточка хоть раз реально РАЗМОНТИРУЕТСЯ (а не просто
    // получает новый `runner`-проп под тем же `key={runner.type}`) — этот
    // `useEffect` никогда не успевает вызваться с новым `zoneKey`, и старая
    // регистрация остаётся в `zoneLayoutsRef` НАВСЕГДА, без вариантов её
    // когда-либо удалить. Живой лог поймал ровно это: зоны ОБОИХ игроков
    // партии (id одного и id другого) одновременно висели в реестре с
    // ПОПИКСЕЛЬНО одинаковыми прямоугольниками — хит-тест наведения ПОЛНОСТЬЮ
    // переставал совпадать с текущими карточками (ни подсветки, ни успешного
    // дропа: `findZoneAt` матчил древний id, бэк отвечал 404 "Runner not
    // found"). Фикс — обычный React-идиом "зарегистрировался на маунт/апдейт,
    // снялся с регистрации в cleanup" вместо ручного `prevZoneKeyRef`:
    // `useEffect` со cleanup-функцией вызывается ПЕРЕД каждым повторным
    // запуском эффекта (значит и при смене `zoneKey` тоже — там она удаляет
    // СТАРЫЙ zoneKey из замыкания ПРЕДЫДУЩЕГО рендера, эффект следом
    // регистрирует новый) И при настоящем размонтировании компонента —
    // закрывает оба случая одним и тем же механизмом, без самодельного
    // отслеживания "предыдущего" значения.
    useEffect(() => {
        measure();
        return () => {
            onMoveDiceMeasured?.(zoneKey, null);
        };
    }, [zoneKey, measure, onMoveDiceMeasured]);

    const tintColor =
        hoverState === 'invalid' ? colors.danger
        : hoverState === 'valid' ? colors.success
        : pending ? colors.warning
        : healTarget ? colors.success
        : null;

    // См. докстринг файла — rollDiceValue ИМЕЕТ ПРИОРИТЕТ: во время наката
    // runner.dice уже 0 (не null), moveDiceValue тоже будет 0 — без явного
    // приоритета накат-значение было бы не видно.
    const diceValue = rollDiceValue ?? moveDiceValue;
    const rollsAvailable = Math.max(0, 2 - (runner.rollMoves ?? 0));

    // Иконка жетона (горизонтальная раскладка) — родной DAMAGE_ICON_SIZE,
    // если помещается; иначе жмётся под реально измеренную ширину infoCol
    // (минимум 10px, чтобы совсем не пропасть на экстремально узких
    // экранах). DAMAGE_ICON_GAP — зазор МЕЖДУ двумя иконками, тоже ужимается
    // вместе с ними. На Android (см. isAndroid/damageRowVertical ниже)
    // кружки стоят ДРУГ ПОД ДРУГОМ, не бок о бок — делить доступную ширину
    // на 2 больше не нужно, каждый кружок может занимать её почти целиком.
    const DAMAGE_ICON_GAP = 4;
    const damageIconSize = infoWidth != null
        ? isAndroid
            ? Math.max(10, Math.min(DAMAGE_ICON_SIZE, infoWidth))
            : Math.max(10, Math.min(DAMAGE_ICON_SIZE, (infoWidth - DAMAGE_ICON_GAP) / 2))
        : DAMAGE_ICON_SIZE;

    return (
        <TouchableOpacity
            ref={cardRef}
            onLayout={handleLayout}
            style={[compact ? styles.cardCompact : styles.card, destroyed && styles.cardDestroyed]}
            onPress={handlePress}
            activeOpacity={0.8}
            // hitSlop — ТОЛЬКО вертикальная раскладка (2026-09-20, живая
            // жалоба пользователя: "раньше при выборе бегуна автоматом был
            // переход [двойной тап]" — перестал надёжно ловиться). Плитка
            // теперь flex:1 в ряду из трёх (см. cardCompact) — заметно уже,
            // чем прежняя полноширинная горизонтальная карточка, а двойной
            // тап (handlePress/lastTapAtRef выше) требует попасть ВТОРЫМ
            // тапом в ТУ ЖЕ область за 300мс — на узкой плитке промахнуться
            // стало заметно легче. Горизонтально — совсем немного (половина
            // gap между плитками, runnerRow в PlayerInfoPanel.js), чтобы не
            // перекрыть зону соседней плитки; вертикально — больше, там
            // соседей нет.
            hitSlop={compact ? { top: 6, bottom: 6, left: 2, right: 2 } : undefined}
        >
            <PersonPanel size={cardSize} />
            {/* borderRadius — та же величина, что у PersonPanel.js#styles.wrap
                (радиус, по которому та обрезает свою заливку под скруглённой
                декоративной дугой) — та же причина/фикс, что и в
                AbilityZone.js: без него заливка/рамка рисовались острым
                углом поверх скруглённой рамки. */}
            {tintColor && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `${tintColor}40`, borderRadius: NOTCH_RADIUS }]} />}
            {active && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.activeRing, { borderColor: color }]} />}
            <PulseHighlight active={pulseHighlight && hoverState == null} borderRadius={NOTCH_RADIUS} borderWidth={2} />

            {compact ? (
                // ВЕРТИКАЛЬНАЯ раскладка — см. докстринг файла. Аватар сверху
                // по центру → имя (скрыто на Android) → жетоны в ряд → слот
                // кубика снизу.
                <View style={styles.colInner}>
                    <View style={[styles.avatarBoxCompact, sizeScale !== 1 && { width: avatarSizeCompact, height: avatarSizeCompact }]}>
                        <FramePanel
                            size={avatarFrameSizeCompact}
                            backgroundSource={FRAME_PANEL_BACKGROUND}
                            backgroundCornerSource={FRAME_PANEL_BACKGROUND_CORNER}
                            backgroundTileSize={60}
                        />
                        <RunnerToken
                            type={runner.type}
                            status={runner.status}
                            avatar
                            color={color}
                            size={avatarSizeCompact}
                            imageScale={0.85}
                            selected={active}
                            showRing={false}
                        />
                    </View>
                    {!isAndroid && (
                        <Text style={[styles.nameCompact, turnActive && styles.nameTurnActive]} numberOfLines={1} noGlobalTint>
                            {display?.label ?? runner.type}
                        </Text>
                    )}
                    <View style={styles.damageRowCompact}>
                        {[0, 1].map((i) => (
                            <Image
                                key={i}
                                source={slots[i] ? DAMAGE_SLOT_ICONS.filled : DAMAGE_SLOT_ICONS.empty}
                                resizeMode="contain"
                                style={[
                                    styles.damageIconCompact,
                                    sizeScale !== 1 && { width: damageIconSizeCompact, height: damageIconSizeCompact },
                                    i === 1 && styles.damageIconCompactGap,
                                ]}
                            />
                        ))}
                    </View>
                    {/* Счётчик накатов — ОТДЕЛЬНОЙ строкой НАД слотом кубика
                        хода (2026-09-20, по прямому запросу пользователя "не
                        кружочком рядом с фреймом кубика, а отдельно" — раньше
                        был уголком-бейджем ПОВЕРХ diceBoxCompact; 2026-09-30,
                        по прямому запросу пользователя, переставлен ВЫШЕ
                        самого фрейма, было под ним). "Накаты:N" вместо "×N" —
                        тоже 2026-09-30, для ясности подписи. */}
                    <Text style={styles.rollCountCompact} noGlobalTint>Накаты:{rollsAvailable}</Text>
                    <View style={[styles.diceBoxCompact, sizeScale !== 1 && { width: diceSizeCompact, height: diceSizeCompact }]}>
                        <FramePanel size={diceFrameSizeCompact} />
                        <Text style={styles.diceValueCompact} noGlobalTint>{diceValue != null ? diceValue : '—'}</Text>
                    </View>
                    {/* Бонус хода — см. roadBonus проп/докстринг файла и
                        ROAD_BONUS_SIZE_COMPACT выше — ВСЕГДА видимый квадрат-
                        фрейм (аналогично слоту кубика хода), не голая строка:
                        прочерк вместо значения, когда бонуса сейчас нет,
                        чтобы карточка не меняла высоту от его наличия. */}
                    <View style={styles.roadBonusBoxCompact}>
                        <FramePanel size={ROAD_BONUS_FRAME_SIZE_COMPACT} />
                        <Text style={styles.roadBonusValueCompact} noGlobalTint>
                            {roadBonus != null ? `+${roadBonus}` : '—'}
                        </Text>
                    </View>
                </View>
            ) : (
                // Горизонтальная раскладка (альбомная) — аватар слева, имя+
                // жетоны посередине, слот кубика справа. Не тронута этим
                // заходом.
                <View style={styles.row}>
                    <View style={styles.avatarBox}>
                        {/* Единственное место, где заливка рамки — FRAME_PANEL_
                            BACKGROUND (не дефолтный PERSON_PANEL_BACKGROUND у
                            FramePanel) — по прямому запросу пользователя:
                            "frame_background и frame_background_corner это чисто
                            для аватарки бегуна". */}
                        <FramePanel
                            size={AVATAR_FRAME_SIZE}
                            backgroundSource={FRAME_PANEL_BACKGROUND}
                            backgroundCornerSource={FRAME_PANEL_BACKGROUND_CORNER}
                            backgroundTileSize={60}
                        />
                        {/* size=AVATAR_SIZE + imageScale=0.85 — по прямому запросу пользователя
                            "растяни бегунов внутри фрейма для аватарки по размеру фрейма"
                            (2026-09-19): раньше size был AVATAR_SIZE*0.72, а imageScale
                            (см. RunnerToken.js — доля size, которую реально занимает
                            картинка) брал дефолт 0.68 — итоговый бокс картинки был
                            46*0.68≈31px внутри 64px рамки, заметно мельче кадра.
                            imgBoxStyle в RunnerToken.js = size*imageScale, resizeMode
                            "contain" — картинка не будет искажена (если ассет не
                            квадратный, letterbox по короткой стороне). imageScale=1 (в
                            точности размер рамки) → уменьшили на ~10% (0.9) → ещё на 5% (0.85). */}
                        <RunnerToken
                            type={runner.type}
                            status={runner.status}
                            avatar
                            color={color}
                            size={AVATAR_SIZE}
                            imageScale={0.85}
                            selected={active}
                            showRing={false}
                        />
                    </View>

                    <View
                        style={styles.infoCol}
                        onLayout={(e) => setInfoWidth(e.nativeEvent.layout.width)}
                    >
                        {/* Имя бегуна ("Танк"/"Атлет"/"Скаут") — скрыто ТОЛЬКО на
                            Android (2026-09-19, по прямому запросу пользователя).
                            Веб/iOS не тронуты — там имя остаётся как было. Побочный
                            эффект: `nameTurnActive` (подсветка зелёным на своём ходу)
                            на Android теперь визуально не видна вообще — отдельного
                            замещающего сигнала не заводили, пользователь просил
                            именно "убрать", не "заменить чем-то ещё". */}
                        {!isAndroid && (
                            <Text style={[styles.name, turnActive && styles.nameTurnActive]} numberOfLines={1} noGlobalTint>
                                {display?.label ?? runner.type}
                            </Text>
                        )}
                        {/* Кружки урона — на Android СТОЛБИКОМ (друг под другом),
                            не в ряд, по прямому запросу пользователя ("кружки урона
                            размести вертикально") — на освободившееся от имени место. */}
                        <View style={[styles.damageRow, isAndroid && styles.damageRowVertical]}>
                            {[0, 1].map((i) => (
                                <Image
                                    key={i}
                                    source={slots[i] ? DAMAGE_SLOT_ICONS.filled : DAMAGE_SLOT_ICONS.empty}
                                    resizeMode="contain"
                                    style={
                                        isAndroid
                                            ? { width: damageIconSize, height: damageIconSize, marginBottom: i === 0 ? DAMAGE_ICON_GAP : 0 }
                                            : { width: damageIconSize, height: damageIconSize, marginRight: i === 0 ? DAMAGE_ICON_GAP : 0 }
                                    }
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.diceCol}>
                        <View style={styles.diceBox}>
                            <FramePanel size={DICE_FRAME_SIZE} />
                            <Text style={styles.diceValue} noGlobalTint>{diceValue != null ? diceValue : '—'}</Text>
                        </View>
                        {/* Счётчик накатов — ОТДЕЛЬНОЙ строкой ПОД слотом кубика
                            (2026-09-20, по прямому запросу пользователя "не
                            кружочком рядом с фреймом кубика, а отдельно") —
                            раньше был уголком-бейджем ПОВЕРХ diceBox (тот
                            приём держал diceCol в пределах высоты аватара —
                            теперь колонка кубика немного выше него, пользователь
                            явно попросил переезд, это осознанный компромисс). */}
                        <Text style={styles.rollCount} noGlobalTint>×{rollsAvailable}</Text>
                        {/* Бонус хода — см. roadBonus проп/докстринг файла — ТОЛЬКО
                            когда данные реально пришли с бэка, иначе пусто. */}
                        {roadBonus != null && (
                            <Text style={styles.roadBonus} noGlobalTint>+{roadBonus}</Text>
                        )}
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );
}

export default React.memo(RunnerCard);

const styles = StyleSheet.create({
    card: {
        width: '100%',
        padding: spacing.sm,
        marginBottom: spacing.xs,
    },
    // Вертикальная раскладка — flex:1 внутри ряда (см. PlayerInfoPanel.js#
    // runnerRow), НЕ width:'100%' — три такие плитки должны разделить
    // ширину колонки поровну. minWidth:0 — та же классическая ловушка
    // flexbox, что и у infoCol ниже (без него flex-элемент не ужимается
    // меньше "естественного" размера контента).
    cardCompact: {
        flex: 1,
        minWidth: 0,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    cardDestroyed: { opacity: 0.45 },
    // borderRadius — та же величина, что у PersonPanel.js#styles.wrap
    // (NOTCH_RADIUS, см. её докстринг 2026-09-26 — глубина диагональной
    // фаски декоративного уголка, не весь размер его бокса).
    activeRing: { borderWidth: 3, borderRadius: NOTCH_RADIUS },
    row: { flexDirection: 'row', alignItems: 'center' },
    avatarBox: { width: AVATAR_SIZE, height: AVATAR_SIZE, alignItems: 'center', justifyContent: 'flex-end' },
    // minWidth:0 — критично: БЕЗ него flex:1-элемент в RN (как и в обычном
    // CSS) не ужимается меньше "естественного" размера своего контента —
    // жетоны повреждения (фиксированного размера Image) просто вылезали за
    // границы infoCol визуально, а не заставляли его сжаться. overflow:
    // 'hidden' — подстраховка на случай, если даже ужатые до damageIconSize
    // (см. место рендера) иконки всё равно не влезут тютелька-в-тютельку.
    infoCol: { flex: 1, minWidth: 0, overflow: 'hidden', marginLeft: spacing.sm, marginRight: spacing.xs },
    name: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.small },
    nameTurnActive: { color: colors.success },
    damageRow: { flexDirection: 'row', marginTop: spacing.xs },
    // Android — имя скрыто (см. место рендера), damageRow остаётся
    // единственным содержимым infoCol, поэтому свой marginTop (раньше отделял
    // кружки ОТ имени) убран — `row`'s alignItems:'center' сам вертикально
    // центрирует этот теперь-единственный блок относительно аватара.
    damageRowVertical: { flexDirection: 'column', alignItems: 'flex-start', marginTop: 0 },
    diceCol: { alignItems: 'center', justifyContent: 'center', width: DICE_SIZE + spacing.xs },
    diceBox: { width: DICE_SIZE, height: DICE_SIZE, alignItems: 'center', justifyContent: 'center' },
    diceValue: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.small },
    // Счётчик накатов — отдельной строкой ПОД слотом кубика (см. коммент у
    // места рендера), не бейджем поверх него.
    rollCount: { color: colors.textOnDarkSecondary, fontWeight: 'bold', fontSize: 11, marginTop: 2 },
    // Бонус хода — зелёный (colors.success), тот же язык, что уже красит
    // кнопку "Бонус +N" в баннере хода (GameBoardScreen.js) — отличает его
    // от нейтрального накат-счётчика рядом.
    roadBonus: { color: colors.success, fontWeight: 'bold', fontSize: 11, marginTop: 1 },

    // --- Вертикальная раскладка (compact) ---
    colInner: { alignItems: 'center', width: '100%' },
    avatarBoxCompact: { width: AVATAR_SIZE_COMPACT, height: AVATAR_SIZE_COMPACT, alignItems: 'center', justifyContent: 'flex-end' },
    // marginTop у всей цепочки ниже (name/damageRow/diceBox/roadBonusBox) —
    // ужата 2026-09-30 (см. докстринг у cardCompact#paddingVertical выше) под
    // выросший на весь размер кубика roadBonus-квадрат.
    nameCompact: { color: colors.textOnDark, fontWeight: 'bold', fontSize: 11, marginTop: 0, maxWidth: '100%' },
    damageRowCompact: { flexDirection: 'row', marginTop: 1 },
    damageIconCompact: { width: DAMAGE_ICON_SIZE_COMPACT, height: DAMAGE_ICON_SIZE_COMPACT },
    damageIconCompactGap: { marginLeft: 4 },
    diceBoxCompact: { width: DICE_SIZE_COMPACT, height: DICE_SIZE_COMPACT, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    diceValueCompact: { color: colors.textOnDark, fontWeight: 'bold', fontSize: 12 },
    rollCountCompact: { color: colors.textOnDarkSecondary, fontWeight: 'bold', fontSize: 9, marginTop: 0 },
    roadBonusBoxCompact: {
        width: ROAD_BONUS_SIZE_COMPACT,
        height: ROAD_BONUS_SIZE_COMPACT,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 0,
    },
    roadBonusValueCompact: { color: colors.success, fontWeight: 'bold', fontSize: 10 },
});
