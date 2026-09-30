// src/components/game/PlayerInfoPanel.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedAnimated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import PlayerSwitcher from './PlayerSwitcher';
import DiceTray from './DiceTray';
import DicePips from './DicePips';
import AbilityZones from './AbilityZones';
import RunnerCard, { NATURAL_CONTENT_HEIGHT_COMPACT, RUNNER_CARD_COMPACT_PADDING_V } from './RunnerCard';
import RoadBonusPanel from './RoadBonusPanel';
import RoundPanel from './RoundPanel';
import PulseText from '../ui/PulseText';
import PulseHighlight from '../ui/PulseHighlight';
import PersonPanel from '../ui/PersonPanel';
import FramePanel, { frameNotchRadius } from '../ui/FramePanel';
import {
    PLAYER_ABILITIES,
    PLAYER_ABILITY_ORDER,
    PLAYER_STEP,
    RUNNER_ORDER,
} from '../../constants/GameConstants';
import { colors, font, radius, spacing } from '../../theme';

// Подписи reaperRow ("Раунд"/"Ход"/"Бонус хода") — не на Android, см. место
// использования ниже. Тот же приём/константа, что уже есть в RunnerCard.js.
const isAndroid = Platform.OS === 'android';

// Кубики хода (DiceTray) — увеличены 2026-10-01 по прямому запросу
// пользователя ("сделать чуть больше, ничего другого не менять"). Рамка
// вокруг них (diceTrayWrap/FramePanel) размер НЕ хардкодит — меряет себя от
// реального контента (`onDiceTrayLayout`/`diceTraySize`, см. место рендера
// ниже), поэтому увеличение кубиков автоматически "раздвигает" рамку под них
// же — никакой отдельной подгонки фрейма не требуется.
const MOVE_DICE_SIZE_NORMAL = 50; // было 44 (дефолт DiceDie.js, раньше явно не передавался)
const MOVE_DICE_SIZE_COMPACT = 46; // было 40 (2026-09-20) — теперь ПОТОЛОК для compactMoveDiceSize
// Ширина рамки кубика хода в compactColumns — НЕЗАВИСИМАЯ константа
// (2026-10-01, прямой запрос пользователя: "почему через процентные штуки не
// определяешь размер кубиков относительно текущего размера фрейма"). Раньше
// ширина СЧИТАЛАСЬ от размера кубика (`MOVE_DICE_SIZE_COMPACT + паддинг`) —
// та формула не "видела" ВТОРОЙ, отдельный паддинг внутри DiceTray.js#column
// (историческая причина бага "кубики вылезают за рамку", см. git-историю
// этого файла) — любая новая правка padding в ЛЮБОМ из вложенных компонентов
// могла молча рассинхронизировать эти две независимо посчитанные величины.
// Теперь наоборот: эта ширина — ЕДИНСТВЕННЫЙ источник истины (просто число,
// подобранное под текущий MOVE_DICE_SIZE_COMPACT), а сам размер кубика
// (`compactMoveDiceSize` ниже) считается ОТ реально измеренного рантайм-
// размера рамки (`diceTraySize`, `onLayout`) — процентом, не вычитанием
// конкретных паддингов. Даже если какой-то паддинг внутри изменится, доля
// просто отъест чуть больше/меньше пустого места — переполнение рамки
// кубиком структурно невозможно, делиться нечему.
const DICE_FRAME_WIDTH_COMPACT = 62;
// Кубиков хода всегда ровно 4 (dice1..dice4, см. GameBoardScreen/бэк) —
// вынесено в константу, т.к. используется дважды (потолок высоты кубика в
// compactMoveDiceSize и высота слота в diceSlotHeight, оба ниже).
const DICE_COUNT = 4;
// Ghost-превью кубика при драге — веб через legacy `Animated`
// (dragGhostPos/dragGhostValue ниже), native — через reanimated shared
// values (nativeGhostX/Y, см. их докстринг), см. `dragGhost`/`nativeDragGhost`
// за местом рендера обоих. ДОЛЖЕН совпадать с реальным размером кубика в
// трее (`dragGhostSize = compactMoveDiceSize`, см. её докстринг ниже) —
// отдельной константы под ghost больше нет, обе платформы читают ОДНО и то
// же значение.

// Размер квадрата reaperRow в compactColumns, пока `cardWidth` не измерен
// (первый кадр до onLayout) — некогда общая формула с landscape-фолбэком
// (см. REAPER_ROW_SIZE_LANDSCAPE ниже), разъединены 2026-10-01 (продолжение
// сессии), когда сам ряд перестал быть про Жнеца/кубик дороги конкретно (см.
// докстринг reaperNode ниже) — имя константы оставлено (единственная
// оставшаяся точка, где фигурирует размер грани кубика бонуса дороги в
// compact-раскладке).
const ROAD_BONUS_DIE_SIZE_COMPACT = 32;
// Размер ряда "Раунд/Ход/Бонус дороги" в landscape (веб), когда `cardWidth`
// не измерен (там он не измеряется НИКОГДА — см. докстринг у места
// использования ниже) — 2026-10-01 (продолжение сессии), прямой запрос
// пользователя "как высота карточки бегуна" после живой жалобы на
// непропорционально маленькую панель. Дублирует формулу RunnerCard.js#
// styles.card (AVATAR_SIZE=64 + padding spacing.sm×2 = 80) — та константа не
// экспортирована оттуда, пришлось продублировать число явно (тот же
// компромисс, что уже принят для MOVE_DICE_SIZE_NORMAL выше). Подтверждено
// живым DOM-замером (строки Танк/Атлет/Скаут в landscape — ровно 80px).
const REAPER_ROW_SIZE_LANDSCAPE = 80;

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
    // gameRound — game.round с GameBoardScreen (2026-10-01, прямой запрос
    // пользователя "над атлетом сделай новую панель, там покажи номер
    // раунда") — см. RoundPanel.js за докстрингом этого поля на бэке.
    gameRound = null,
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

    // Высота columns-ряда (2026-10-01) — измеряется один раз, используется
    // ОБЕИМИ колонками (leftColumn/rightColumn) как явная `height`, вместо
    // paint-only `transform:scale`, который тут стоял раньше (сначала для
    // левой, потом для правой колонки — обе истории привели к одному и тому
    // же выводу: растягивать саму коробку явным числом надёжнее и проще, чем
    // растягивать/сжимать её отрисовку трансформом, см. докстринги обеих
    // колонок в месте рендера ниже).
    const [columnsH, setColumnsH] = useState(null);
    const onColumnsLayout = useCallback((e) => setColumnsH(e.nativeEvent.layout.height), []);

    // ЛЕВАЯ колонка (Жнец+кубик бонуса дороги+карточки бегунов) — НЕ
    // `transform:scale` (был реализован и ОТКАЧЕН в этой же сессии, см. git
    // history этого файла за 2026-10-01 — сразу выявился реальный конфликт:
    // каждая из 3 карточек бегунов — `flex:1` по ширине ровно поровну
    // (RunnerCard.js#cardCompact), натуральная ширина ряда УЖЕ РОВНО равна
    // ширине колонки без запаса — единый 2D-коэффициент, применённый НА
    // РОСТ, неизбежно растягивает и ширину настолько же, вылезая за колонку
    // (`overflow:hidden` тогда бы просто молча обрезал сбоку). Пользователь
    // прямо уточнил: "плитки бегунов никогда не должны быть откреплены от
    // нижней части панели" — про ПОЗИЦИЮ/высоту, не про то, что кубики/
    // аватары должны стать физически КРУПНЕЕ. Финал (по прямому запросу
    // пользователя): "плитки растянуты, содержимое (аватарки, боксы кол-ва
    // ходов) центрировано" — ТОЧНО тот же приём, что уже применён к
    // ReaperCard/RoadBonusPanel этой же сессией (`height:'100%'` на внешнем
    // боксе + `alignItems:'center'` на внутреннем контенте) — только сама
    // ВЫСОТА коробки растёт (через flex:1 в родительской колонке
    // фиксированной высоты), контент внутри остаётся натурального
    // константного размера и просто центрируется. Ширина этим вообще не
    // затронута — растёт только высота отдельных боксов, не общий 2D-скейл.
    // `runnerRow`/`RunnerCard.js#cardCompact` — flex:1 по высоте (см. стили
    // ниже и в RunnerCard.js).
    //
    // **`runnerRowH`/`cardHeight` (2026-10-01, живая жалоба СРАЗУ после:
    // "в вебе отмасштабировал и расположил как надо, а в Android нет")** —
    // `cardCompact#height:'100%'` читает высоту от `runnerRow`, а ТА сама
    // получает свою высоту не явным числом, а через `flex:1` (вычисляется
    // Yoga на лету) — комбинация "процентная высота ребёнка от РОДИТЕЛЯ,
    // высота которого САМА вычислена через flex, а не задана явно" — именно
    // та категория рассинхрона между RN Web (полноценный CSS-движок,
    // терпимее к процентам) и Yoga на native (историчски менее надёжен
    // именно в этой комбинации), что уже дважды всплывала в этой сессии
    // (leftColumn/switcherHeight). Вместо процента — измеряем `runnerRow`
    // через `onLayout` и прокидываем РЕАЛЬНОЕ число вниз в RunnerCard.js
    // явным пропом `cardHeight` (та же тактика, что уже успешно сработала
    // для `columnsH`/`reaperCardWrap#height` этой же сессией) — простое
    // число как высота работает одинаково надёжно на обеих платформах,
    // никакого процента в цепочке больше нет.
    const [runnerRowH, setRunnerRowH] = useState(null);
    // runnerRowW — 2026-10-01, прямой запрос пользователя (точная геометрия
    // левой колонки: высота плитки Жнеца = ширина плитки бегуна, плитка
    // Жнеца впритык к ДВУМ плиткам бегунов, кубик бонуса дороги квадратный
    // и стоит ровно НАД третьей плиткой). Тот же onLayout, что уже даёт
    // высоту — width достаётся БЕСПЛАТНО из того же nativeEvent.layout, новый
    // measure-проход не нужен. См. cardWidth ниже — единственный источник
    // истины для геометрии ВСЕГО ряда "Жнец+бонус", вместо независимого
    // flex-приближения (которое и давало "почти так, но не совсем" —
    // reaperRow/runnerRow считали свои flex-доли раздельно, с РАЗНЫМ числом
    // gap'ов на строку, поэтому их границы НЕ СОВПАДАЛИ математически точно).
    const [runnerRowW, setRunnerRowW] = useState(null);
    const onRunnerRowLayout = useCallback((e) => {
        setRunnerRowH(e.nativeEvent.layout.height);
        setRunnerRowW(e.nativeEvent.layout.width);
    }, []);
    // cardWidth — ширина ОДНОЙ плитки бегуна, выведенная из РЕАЛЬНО
    // измеренной ширины runnerRow (3 плитки + 2 зазора spacing.xs, та же
    // константа, что и в стиле runnerRow ниже — не отдельное магическое
    // число). null до первого onLayout — reaperNode в этом кадре использует
    // свой прежний (константный) фолбэк, см. её докстринг.
    const cardWidth = runnerRowW != null ? Math.floor((runnerRowW - spacing.xs * 2) / 3) : null;

    // sizeScale карточки бегуна в compactColumns — 2026-10-01, см. докстринг
    // NATURAL_CONTENT_HEIGHT_COMPACT/RUNNER_CARD_COMPACT_PADDING_V в
    // RunnerCard.js за полным разбором, почему это ПРАВИЛЬНОЕ направление
    // (ужимать контент, не раздувать коробку). `Math.min(1, ...)` — ТОЛЬКО
    // уменьшает контент, никогда не увеличивает его сверх натурального
    // размера (растягивание контента крупнее уже отдельно отвергалось
    // пользователем 2026-09-30, тут этот прецедент намеренно не трогаем).
    const runnerCardSizeScale = useMemo(() => {
        if (!compactColumns || !runnerRowH) return 1;
        const availableContentHeight = runnerRowH - RUNNER_CARD_COMPACT_PADDING_V * 2;
        return Math.min(1, availableContentHeight / NATURAL_CONTENT_HEIGHT_COMPACT);
    }, [compactColumns, runnerRowH]);

    // 2026-09-28 — точечная заплатка "бампнуть remeasureTick при смене
    // activePlayerId" (была тут) УБРАНА — заменена структурным фиксом в
    // самой RunnerCard.js (`useEffect(() => measure(), [zoneKey, measure])`,
    // см. её докстринг за полным разбором): карточка теперь сама
    // перемеряется при смене СВОЕЙ регистрации, независимо от причины, а не
    // ждёт, чтобы родитель заранее угадал каждый конкретный повод и явно
    // разослал сигнал. `remeasureTick` ниже остаётся — он всё ещё нужен
    // для PAINT-ONLY смещений (scroll/scale), где сам `zoneKey` не меняется,
    // только экранная позиция того же бегуна.

    // Авто-масштабирование колонок в compactColumns — **2026-09-30, ПОЛНОСТЬЮ
    // УБРАНО по прямому запросу пользователя, ЧАСТИЧНО ВОЗВРАЩЕНО 2026-10-01
    // (см. leftScale/rightScale выше, конец того же дня) — ДРУГИМ механизмом,
    // не тем, что отвергнут здесь.** История ниже оставлена целиком — она всё
    // ещё объясняет, ПОЧЕМУ отвергнуты два конкретных варианта (real-resize
    // sizeScale и "тянуть только высоту, не ширину"); вернувшийся 2026-10-01
    // uniform paint-only `transform:scale` — третий вариант, который тут не
    // рассматривался и не отвергался, см. его докстринг у leftScale/
    // rightScale. Хронология этого захода (2026-09-30): рост
    // сначала был реальным resize детей (`sizeScale`, до сегодня) с
    // заморозкой baseline — баг оказался в том, что баланс замораживался под
    // натуральную высоту ОДНОГО конкретного игрока и не подходил остальным
    // (живая жалоба "высота плиток отличается между игроками"). Первая
    // попытка фикса — перевести рост на paint-only `transform:scale`, единой
    // формулой со сжатием — пользователь ЯВНО отверг: "масштабирование во
    // все стороны, не только в высоту" (uniform scale растягивал и ширину) и
    // подтвердил, что даже после этого масштаб между игроками расходился
    // (клэмпы по ширине резались по-разному для разного контента — тот же
    // класс проблемы в новом месте). На прямой вопрос "resize элементов или
    // transform по Y" пользователь ответил ТРЕТьим вариантом, отвергающим
    // оба: **"меняться должна только высота самой панели, а не элементов
    // внутри"** — и отдельно потребовал вернуть ширину плиток бегунов "как
    // было до правок". Итог — никакого масштабирования контента (карточек
    // бегунов/Жнеца/кубиков/усилений) больше нет ВООБЩЕ, ни через resize, ни
    // через transform: RunnerCard/ReaperCard/DiceTray/AbilityZone рендерятся
    // ВСЕГДА в свой натуральный константный размер (`sizeScale` им больше не
    // передаётся, дефолт 1 — сам проп и вся связанная с ним арифметика в
    // этих файлах пока оставлены нетронутыми, просто никогда не используются
    // отсюда). Это заодно и тривиально решает исходную жалобу — раз ничего
    // не вычисляется от натуральной высоты контента, у разных игроков просто
    // физически нечему отличаться, карточки одного константного размера у
    // всех — это верно и для нового leftScale (2026-10-01): один и тот же
    // множитель на весь блок, не независимые расчёты по игроку.
    // `overflow:hidden` на колонках (styles.scaleClip) — раньше была чистой
    // страховкой (масштабирования не было вовсе), теперь (после leftScale/
    // rightScale) действительно может сработать на РОСТЕ, если контент
    // выйдет за ширину колонки — активного скролла пользователь по-прежнему
    // не хочет, так что это осознанный компромисс на редкий крайний случай.

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

    // abilitiesWrapSize — 2026-10-01, живая жалоба "нижняя рамка фрейма
    // кубиков не вровень с нижней рамкой усиления Призрак": ПЕРВАЯ попытка
    // фикса вычитала `abilitiesWrap`'s marginTop из dATileRowHeight косвенно
    // — стало ЕЩЁ ХУЖЕ, и причина нашлась: в compactColumns фактически
    // применяется `abilitiesWrapCompact` (marginTop:0), а НЕ базовый
    // `abilitiesWrap` (marginTop:spacing.xs) — я вычитал отступ, которого в
    // этом режиме вообще нет, искусственно занижая слоты. Вместо того чтобы
    // в третий раз гадать про margin/flex-арифметику Yoga — просто МЕРЯЕМ
    // `abilitiesWrap` её СОБСТВЕННЫМ onLayout, тем же приёмом, что уже есть
    // у `diceTraySize`/`dATileSize` ниже — высота слота считается от
    // РЕАЛЬНОГО измерения, не от выведенного числа.
    const [abilitiesWrapSize, setAbilitiesWrapSize] = useState(null);
    const onAbilitiesWrapLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setAbilitiesWrapSize({ width, height });
    }, []);

    // Размер трея кубиков (диceTrayWrap) измеряется его СОБСТВЕННЫМ onLayout —
    // нужен декоративной рамке FramePanel вокруг трея (см. место рендера).
    const [diceTraySize, setDiceTraySize] = useState(null);
    const onDiceTrayLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setDiceTraySize({ width, height });
    }, []);

    // Размер кубика хода в compactColumns — от РЕАЛЬНО измеренной ширины
    // рамки (2026-10-01, прямой запрос пользователя — см. докстринг
    // DICE_FRAME_WIDTH_COMPACT выше за разбором, почему раньше было наоборот,
    // и чем это кончилось). `diceTraySize.width` — border-box самой
    // diceTrayWrap — ЕДИНСТВЕННЫЙ источник истины о размере рамки.
    //
    // Формула в два слоя (2026-10-01, живая жалоба со скрином-зумом СРАЗУ
    // после первой версии — "кубики всё равно выпирают", но теперь именно у
    // СКРУГЛЁННОГО УГЛА рамки, не вдоль прямого края): (1) сперва вычитаем
    // РЕАЛЬНЫЙ паддинг diceTrayWrap (`spacing.sm`, та же константа, что и в
    // её стиле — не отдельное магическое число, синхронизация гарантирована
    // тем, что это буквально одна и та же ссылка) — даёт точную ширину
    // content-box вдоль ПРЯМЫХ краёв; (2) ДОПОЛНИТЕЛЬНО умножаем на
    // DICE_SIZE_SAFETY (0.85) — декоративный уголок рамки (FramePanel,
    // targetCornerSize=8) срезает площадь по ДИАГОНАЛИ глубже, чем его
    // толщина по прямой, и паддинг из шага (1), рассчитанный на прямой край,
    // не даёт достаточного запаса именно в углу, где начинается/заканчивается
    // столбик кубиков. Итог — кубик заведомо МЕНЬШЕ, чем "впритык" к
    // content-box, с полем прямо под этот диагональный случай, а не только
    // под прямые края. Math.min(..., MOVE_DICE_SIZE_COMPACT) — потолок,
    // кубик никогда не растёт крупнее задуманного. До первого onLayout
    // (diceTraySize ещё null) — тот же потолок как временное значение.
    // 0.85 → 0.92 (2026-10-01, живая жалоба "кубики мелковаты") — ширина
    // сейчас и есть узкое место (меньше, чем потолок по высоте, см. ниже), её
    // и поднимаем ощутимее. НЕ 1.0 — запас всё ещё нужен специально под
    // скруглённый угол декоративной рамки (FramePanel, targetCornerSize=8) —
    // тот самый диагональный срез, из-за которого эта константа изначально
    // и появилась (живая жалоба со скрином-зумом, кубик вылезал именно у
    // угла, не вдоль прямого края) — см. запас до 1.0 как сознательную
    // страховку, не забытую мелочь.
    const DICE_SIZE_SAFETY = 0.92;
    // Потолок ПО ВЫСОТЕ — 2026-10-01, прямой запрос пользователя ("раздели
    // фрейм на 4 ровных куска, кубик — 90% высоты каждого куска, это же и
    // есть адаптивное масштабирование?"), процент поднят до 0.95 тем же
    // заходом, что и DICE_SIZE_SAFETY выше ("кубики мелковаты"). Раньше
    // кубик считался ТОЛЬКО от ширины рамки — на узкой-но-высокой рамке он
    // мог остаться маленьким, хотя по высоте слота было куда расти. Теперь
    // `Math.min` берёт МЕНЬШЕЕ из двух independent пределов (ширина рамки И
    // высота слота) — кубик никогда не перельётся ни по одной из осей, при
    // этом использует максимум того, что реально позволяют ОБА измерения.
    // `DICE_COUNT` — то же самое количество, на которое делится рамка для
    // слотов (`diceSlotHeight` ниже) — 4 кубика хода всегда, dice1..dice4.
    const compactMoveDiceSize = !compactColumns
        ? MOVE_DICE_SIZE_NORMAL
        : diceTraySize
            ? Math.min(
                MOVE_DICE_SIZE_COMPACT,
                Math.floor((diceTraySize.width - spacing.sm * 2) * DICE_SIZE_SAFETY),
                Math.floor(((diceTraySize.height - spacing.sm * 2) / DICE_COUNT) * 0.95),
            )
            : MOVE_DICE_SIZE_COMPACT;

    // Ghost при драге — ДОЛЖЕН совпадать с реальным размером кубика в трее.
    const dragGhostSize = compactMoveDiceSize;

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
    const switcher = (
        <View style={[styles.switcherBox, { height: switcherHeight }]}>
            <PlayerSwitcher
                players={players.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
                activeId={activePlayer.id}
                onSelect={onSelectPlayer}
            />
        </View>
    );

    // Ряд "Раунд/Ход/Бонус дороги" над карточками бегунов — 2026-10-01
    // (продолжение сессии), ПОЛНАЯ ПЕРЕДЕЛКА по прямому запросу пользователя:
    // раньше первый квадрат ряда был плиткой Жнеца (ReaperCard, аватар +
    // мигание PulseHighlight, пока Жнец на поле — вся эта история, включая
    // сегодняшний фикс её геометрии, см. CLAUDE_DONE_TASKS.md) — пользователь
    // явно попросил "вместо жнеца в панели жнеца показать раунд". Токен Жнеца
    // на самой доске (BoardGrid) никуда не делся, только дубль в этой панели
    // убран. `ReaperCard.js` больше НИГДЕ в проекте не импортируется —
    // намеренно НЕ удалён (могла понадобиться правка позже), просто мёртвый
    // код, оставлен как есть по аналогии с другими неиспользуемыми файлами в
    // этом проекте (см. CLAUDE.md).
    // Итоговые три квадрата: [Раунд] [Ход] [Бонус дороги], у каждого подпись
    // НАД квадратом — та же идея, что подпись типа бегуна у RunnerCard
    // (`styles.name`, та — сбоку, тут — сверху, по прямому запросу
    // пользователя "тайтлы пусть будут над панельками ходов и раундов", было
    // под квадратом первой версией этого же захода). "Ход" временно ВСЕГДА
    // заглушка
    // ("—", RoundPanel с round=null) — по признанию самого пользователя,
    // точного счётчика "X из 3 ходов за раунд" бэк пока не отдаёт (только 4
    // кубика на раунд, dice1..4, без разметки, сколько из них на движение, а
    // сколько на усиление, см. запрос бэкендеру в отдельном файле) — как
    // только бэк пришлёт нужное поле, заменить `round={null}` на реальное
    // значение (TODO в CLAUDE.md).
    const roadBonusPanelSize = cardWidth != null
        ? cardWidth
        : compactColumns
            ? Math.min(ROAD_BONUS_DIE_SIZE_COMPACT, MOVE_DICE_SIZE_COMPACT)
            : REAPER_ROW_SIZE_LANDSCAPE;
    const reaperNode = (
        <View style={styles.reaperRow}>
            <View style={styles.reaperCell}>
                {/* Подписи — НЕ на Android, по прямому запросу пользователя
                    2026-10-01 (продолжение сессии, сразу тем же вечером, что
                    и добавил их) — веб не тронут. */}
                {!isAndroid && (
                    <Text style={styles.reaperCellLabel} numberOfLines={1} noGlobalTint>Раунд</Text>
                )}
                <RoundPanel round={gameRound} panelSize={roadBonusPanelSize} />
            </View>
            <View style={styles.reaperCell}>
                {!isAndroid && (
                    <Text style={styles.reaperCellLabel} numberOfLines={1} noGlobalTint>Ход</Text>
                )}
                {/* Заглушка до ответа бэкендера — см. докстринг выше. */}
                <RoundPanel round={null} panelSize={roadBonusPanelSize} />
            </View>
            <View style={styles.reaperCell}>
                {!isAndroid && (
                    <Text style={styles.reaperCellLabel} numberOfLines={1} noGlobalTint>Бонус хода</Text>
                )}
                <RoadBonusPanel value={roadBonusValue} panelSize={roadBonusPanelSize} />
            </View>
        </View>
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
                // cardHeight — БЕЗ Math.max/порога (2026-10-01, второй заход
                // за вечер): первая версия этого фикса форсировала минимум
                // на КОРОБКУ — пользователь это явно отверг ("ты вернул
                // большой размер панелей, ровно то, что я просил убрать —
                // размер панели был правильный, туда просто не масштабировался
                // контент"). Коробка — РОВНО runnerRowH, как измерено;
                // контент внутри вместо этого сам ужимается под неё через
                // `sizeScale` (см. её докстринг ниже).
                cardHeight={compactColumns ? runnerRowH : null}
                sizeScale={runnerCardSizeScale}
                remeasureTick={remeasureTick}
            />
        );
    });

    // Текст-заголовок ("УСИЛЕНИЯ"/"Усиления — перетащи кубик на зону") убран
    // по прямому запросу пользователя (2026-09-20), вместе с "КУБИКИ"/"Кубики
    // перемещения" (см. diceAbilitiesTile ниже) — обе секции объединены в
    // одну декоративную плитку (PersonPanel, тот же приём, что уже красит
    // корпус RunnerCard), сама плитка даёт визуальную группировку без подписей.
    // abilitiesNode — определён НИЖЕ (после dATileSize/abilitiesTrayWidthCompact,
    // см. их докстринг) не здесь, где раньше стоял: нужна их измеренная
    // ширина для zoneWidth-пропа, JS-объявления читаются по порядку
    // выполнения, а не по месту в файле.

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
    // комментарий ниже). Но measureInWindow тогда отражал уже применённый
    // `transform:scale` колонки (авто-масштабирование, с 2026-09-30 убрано
    // целиком, см. докстринг у styles.columns/`compactColumns` ниже) — а
    // FramePanel рисуется ВНУТРИ той же самой колонки, значит получал УЖЕ
    // уменьшенный размер и ужимался transform'ом ЕЩЁ РАЗ поверх этого —
    // рамка становилась вдвое меньше контента. `onLayout` отдаёт
    // НАТУРАЛЬНЫЙ, не зависящий от transform размер — плюс он и без ручного
    // RAF/setTimeout сам перевызывается на каждое реальное изменение
    // layout'а (в т.ч. тот самый "лишний проход" на Android), это даже
    // надёжнее, чем угаданная задержка.
    // `overflow:'hidden'` на styles.dATile — доп. страховка НА СЛУЧАЙ, если
    // измерение всё-таки на мгновение отстанет: контент физически не сможет
    // нарисоваться за пределами плитки, даже пока PersonPanel её ещё не
    // "догнал".
    const [dATileSize, setDATileSize] = useState(null);
    const dATileRef = useRef(null);
    // requestAnimationFrame + setTimeout(150) — 2026-10-01, живая жалоба со
    // скриншотом: "dATile стала уже, фреймы усилений висят в воздухе"
    // (декоративный фон PersonPanel не доходит до места, где реально стоят
    // иконки усилений). Гипотеза (подтверждена только логикой, не живым
    // прогоном): `dATile` только что перешла на `flexDirection:'row'`
    // (кубики фикс. ширины + усиления `flex:1`, см. `dATileRow`) — на
    // Android НЕ исключено, что первый проход `onLayout` этого контейнера
    // ловит размер ДО того, как `flex:1`-ребёнок досчитан (та же болезнь,
    // что уже explicitly задокументирована в AbilityZone.js#measure для
    // ОДНОЙ зоны — тут тот же приём, только для всей плитки целиком, раз
    // плитка сама стала сложнее устроена). Повторный замер безопасен, даже
    // если первый уже был точным — просто перезапишет тем же значением.
    const onDATileLayout = useCallback(() => {
        const measure = () => {
            dATileRef.current?.measure((x, y, width, height) => {
                if (width && height) setDATileSize({ width, height });
            });
        };
        requestAnimationFrame(measure);
        setTimeout(measure, 150);
    }, []);

    // Кубики — теперь ТОЖЕ в декоративной рамке (FramePanel, тот же приём,
    // что и у КАЖДОЙ зоны усиления, см. AbilityZone.js) — по прямому запросу
    // пользователя "сделай, чтобы кубики тоже были в рамке, как усиления".
    // ОДНА рамка на ВЕСЬ трей (все 4 кубика вместе), не по рамке на кубик —
    // пользователь явно уточнил "все кубики в одной рамке". Тот же `onLayout`
    // фикс, что и у dATile выше, и по той же причине. `diceTraySize`/
    // `onDiceTrayLayout` объявлены ВЫШЕ (см. compactMoveDiceSize) — тому же
    // измерению теперь нужен и размер FramePanel-рамки тут, и адаптивный
    // размер кубика, поэтому состояние общее, объявление одно.

    // Ширина рамки кубиков в compactColumns — АДАПТИВНАЯ, не константа
    // (2026-10-01, живая жалоба с РЕАЛЬНОГО устройства через USB: жёсткая
    // DICE_FRAME_WIDTH_COMPACT не поместилась в rightColumn — та же ширина,
    // что была настроена под эмулятор, оказалась шире, чем реально доступно
    // на другом экране; "усиления тоже вышли за пределы колонки" — тот же
    // класс бага у ABILITY_ZONE_WIDTH_COMPACT в AbilityZone.js). Вместо двух
    // независимых констант — считаем ОБЕ ширины от РЕАЛЬНО измеренной ширины
    // dATile (`dATileSize`, см. выше), тем же приёмом, что уже применён к
    // размеру кубика ВНУТРИ рамки (compactMoveDiceSize чуть выше) — теперь и
    // сама рамка встроена в ту же измеренную-от-контейнера цепочку.
    //
    // DICE_TRAY_WIDTH_IDEAL — ширина рамки, при которой кубик гарантированно
    // достигает своего потолка (MOVE_DICE_SIZE_COMPACT) — решение ТОГО ЖЕ
    // уравнения, что и DICE_SIZE_SAFETY в compactMoveDiceSize выше, просто в
    // обратную сторону. Пока места достаточно (типичный экран, в т.ч. этот
    // эмулятор) — кубик всегда МАКСИМАЛЬНОГО задуманного размера, а не
    // случайно меньше только потому, что рамке не докинули пару dp (живая
    // жалоба "кубики слишком мелкие, а вокруг полно свободного места").
    // DICE_COLUMN_MAX_SHARE — страховка на узкий экран: рамка кубиков
    // никогда не отъедает больше половины ряда, даже если
    // DICE_TRAY_WIDTH_IDEAL технически просит больше — усиления справа не
    // должны схлопнуться в ноль.
    const DICE_TRAY_WIDTH_IDEAL = Math.ceil(MOVE_DICE_SIZE_COMPACT / DICE_SIZE_SAFETY) + spacing.sm * 2;
    const DICE_COLUMN_MAX_SHARE = 0.5;
    // dATileCompact#paddingHorizontal (spacing.md) вычитается явно — то, что
    // измеряет onLayout/measure() — border-box ВСЕЙ плитки, а не content-box,
    // доступный ряду "кубики+усиления" (dATileRow) внутри нeё.
    const dATileInnerRowWidth = dATileSize ? dATileSize.width - spacing.md * 2 : null;
    const diceTrayWidthCompact = dATileInnerRowWidth != null
        ? Math.min(DICE_TRAY_WIDTH_IDEAL, Math.round(dATileInnerRowWidth * DICE_COLUMN_MAX_SHARE))
        : DICE_FRAME_WIDTH_COMPACT;
    // abilitiesTrayWidthCompact — остаток ряда ПОСЛЕ рамки кубиков и зазора
    // между ними (dATileRow#gap, spacing.sm) — передаётся КАЖДОЙ зоне
    // усиления явным числом (AbilityZones/AbilityZone.js#zoneWidth), заменяя
    // их собственную независимую константу ABILITY_ZONE_WIDTH_COMPACT — та
    // же причина, что и у кубиков: своя фиксированная ширина не знает о
    // реальном месте в rightColumn на конкретном устройстве.
    const abilitiesTrayWidthCompact = dATileInnerRowWidth != null
        ? Math.max(0, Math.round(dATileInnerRowWidth - diceTrayWidthCompact - spacing.sm))
        : null;
    // Высота ОДНОГО слота (кубика/зоны усиления) — 2026-10-01, живая жалоба
    // "кубики/усиления не оптимально распределены по фрейму, усиления НЕ
    // прижаты друг к другу": `justifyContent:'space-between'` в DiceTray.js#
    // column/AbilityZones.js#gridVertical (изначально введён, чтобы первый/
    // последний элемент стабильно касался верха/низа рамки) ПОБОЧНО
    // распределяет ЛЮБОЙ излишек высоты как зазоры МЕЖДУ элементами. Фикс —
    // не полагаться на justifyContent вообще, а явно посчитать высоту ОДНОГО
    // слота от РЕАЛЬНО измеренной высоты СВОЕГО контейнера и отдать её
    // каждому элементу числом — 4 слота СУММАРНО заполняют высоту без
    // остатка, зазорам взяться неоткуда.
    //
    // Каждый слот считается от ИЗМЕРЕНИЯ СВОЕГО НЕПОСРЕДСТВЕННОГО контейнера
    // (diceTraySize/abilitiesWrapSize), а НЕ от общей dATileSize с вычетом
    // предполагаемых паддингов/margin — два подряд захода (сначала не
    // учли собственный padding diceTrayWrap, потом ошибочно вычли marginTop,
    // которого в compactColumns на самом деле нет — там побеждает
    // `abilitiesWrapCompact#marginTop:0`, не базовый `abilitiesWrap`) наглядно
    // показали, что выводить чужую высоту через margin/padding-арифметику
    // Yoga — ненадёжно. Прямое измерение снимает вопрос целиком.
    const diceSlotHeight = diceTraySize
        ? Math.floor((diceTraySize.height - spacing.sm * 2) / DICE_COUNT)
        : null;
    const abilitiesNode = (
        <AbilityZones
            assignments={abilityAssignments}
            hoverKey={hover.key}
            hoverValid={hover.valid}
            onMeasured={handleMeasured}
            onPressZone={onPressAbilityZone}
            remeasureTick={remeasureTick}
            compact={compactColumns}
            vertical={compactColumns}
            color={activePlayer.color}
            pulseKeys={abilityPulseKeys}
            zoneWidth={compactColumns ? abilitiesTrayWidthCompact : null}
            // columnHeight — ЦЕЛЫЙ измеренный контейнер (НЕ уже поделенный на
            // 4), 2026-10-01, живая жалоба "нижняя рамка кубиков не вровень с
            // нижней рамкой усиления Призрак", фикс №4 подряд по этой теме:
            // первые три (margin-арифметика от dATileRowHeight, минус margin,
            // прямое измерение) не помогли, потому что ни один не был
            // причиной — реальная причина в том, что `Math.floor(H/4)`,
            // применённый одинаково ко всем 4 зонам, каждый раз теряет
            // дробный остаток (206.857/4=51.714, не 51) — 4 потери
            // накапливаются в ~2.857dp (~7px), и это пустое место оседает
            // ПОСЛЕ последней зоны (у неё СВОЯ отдельная декоративная рамка,
            // в отличие от кубиков, где рамка ОДНА на весь трей — там та же
            // потеря просто прячется ВНУТРИ уже единой рамки, снаружи не
            // видна). Раздел на слоты теперь делает AbilityZones.js —
            // `Math.round(H*(i+1)/4) - Math.round(H*i/4)` на каждый индекс —
            // сумма ВСЕХ 4 высот гарантированно точно равна округлённому H,
            // без потерянного остатка.
            columnHeight={compactColumns ? abilitiesWrapSize?.height : null}
        />
    );

    const diceAbilitiesTile = (
        <View
            ref={dATileRef}
            onLayout={onDATileLayout}
            style={[styles.dATile, compactColumns && styles.dATileCompact, compactColumns && styles.dATileRow]}
        >
            <PersonPanel size={dATileSize} />
            <View
                onLayout={onDiceTrayLayout}
                style={[
                    styles.diceTrayWrap,
                    compactColumns && styles.diceTrayWrapCompact,
                    compactColumns && { width: diceTrayWidthCompact },
                ]}
            >
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
                    // vertical — см. докстринг DiceTray.js (2026-10-01): в
                    // compactColumns кубики столбиком (diceTrayWrap слева от
                    // abilitiesWrap, не над ним), в landscape — как раньше, в
                    // ряд. size=compactMoveDiceSize — уже сам решает
                    // компактный/обычный случай (см. её докстринг выше), ОДНО
                    // число всегда на ОБЕ грани (width=height в DiceDie.js) —
                    // кубик структурно не может стать прямоугольником, только
                    // меньше/больше квадратом.
                    vertical={compactColumns}
                    size={compactMoveDiceSize}
                    // color — 2026-10-01, прямой запрос пользователя "кубики
                    // хода под цвет бегунов игрока" — та же activePlayer.color,
                    // что уже красит аватар/активную рамку карточки бегуна.
                    color={activePlayer.color}
                    // slotHeight — см. докстринг dATileRowHeight выше: явная
                    // высота ОДНОГО слота кубика вместо justifyContent:
                    // 'space-between', чтобы 4 кубика были распределены РОВНО,
                    // без разномастных зазоров.
                    slotHeight={compactColumns ? diceSlotHeight : null}
                />
            </View>
            <View
                onLayout={onAbilitiesWrapLayout}
                style={[styles.abilitiesWrap, compactColumns && styles.abilitiesWrapCompact]}
            >
                {abilitiesNode}
            </View>
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
                    (Жнец+3) помещались без прокрутки. **2026-09-30 — авто-
                    масштабирование ЛЕВОЙ колонки (и до него, resize-версия
                    роста) убрано целиком по прямому запросу пользователя** —
                    карточки бегунов всегда своего натурального константного
                    размера, никакого transform/resize. Зона дропа кубика хода
                    — вся карточка целиком (см. RunnerCard, сама меряет и
                    репортит себя). **2026-10-01 — ПРАВАЯ колонка (кубики+
                    усиления) получила узкий shrink-only `rightScale`
                    обратно** (см. её докстринг у объявления выше) — после
                    того, как кубики хода стали физически крупнее
                    (MOVE_DICE_SIZE_*), панель без этого заползала за нижние
                    элементы; левой колонки эта правка не касается. */}
                {compactColumns ? (
                    <View style={styles.columns} onLayout={onColumnsLayout}>
                        {/* `height: columnsH` — явный (2026-10-01): раньше
                            высота колонки полагалась ТОЛЬКО на cross-axis
                            stretch ряда `columns` (без явного height) — живой
                            замер на вебе показал, что stretch без явного числа
                            не жёстко ограничивает высоту на RN Web (та же
                            категория проблемы, что уже задокументирована для
                            switcherHeight). Та же величина, что мерится для
                            rightScale ниже. */}
                        <View style={[styles.leftColumn, styles.scaleClip, columnsH != null && { height: columnsH }]}>
                            {/* leftColumnContent — flex:1 (см. её докстринг
                                выше, "ЛЕВАЯ колонка"): заполняет уже явно
                                заданную высоту leftColumn целиком.
                                `reaperNode` внутри — натурального размера (её
                                высоту задаёт квадратная RoadBonusPanel, см.
                                её докстринг), `runnerRow` — flex:1, забирает
                                ВЕСЬ остаток, каждая карточка внутри тянется
                                по высоте (RunnerCard.js#cardCompact), низ ряда
                                бегунов теперь ВСЕГДА ровно у низа columnsH. */}
                            <View style={styles.leftColumnContent}>
                                {reaperNode}
                                <View style={styles.runnerRow} onLayout={onRunnerRowLayout}>{runnerCards}</View>
                            </View>
                        </View>
                        {/* `height: columnsH` — та же явная высота, тем же
                            приёмом, что и у leftColumn выше (2026-10-01,
                            живая жалоба "dATile не растянута по высоте до
                            панели табов"). Весь механизм `rightScale`
                            (paint-only transform, три захода подряд в этот же
                            вечер — то огромный зазор по бокам, то расплющенные
                            квадраты) УБРАН целиком: та же болезнь, что уже
                            была у leftColumn (2026-09-30) — "не растягивай
                            через transform, растягивай саму коробку" — теперь
                            применена и тут, симметрично. */}
                        <View style={[styles.rightColumn, styles.scaleClip, columnsH != null && { height: columnsH }]}>
                            {/* rightColumnContent — flex:1, заполняет явно
                                заданную высоту rightColumn целиком (тот же
                                приём, что leftColumnContent у соседней
                                колонки). dATile сама — тоже flex:1 внутри неё
                                (см. dATileCompact/compactColumns-ветку стилей
                                ниже) — её декоративный фон (PersonPanel,
                                dATileSize) растягивается вместе с коробкой,
                                достаёт до низа колонки (= до панели табов).
                                Контент внутри (кубики/усиления) остаётся
                                натурального размера и центрируется по высоте
                                (DiceTray.js#column/AbilityZones.js#gridVertical
                                — `justifyContent:'center'`), а не растягивается
                                сам — тот же принцип, что уже применён к
                                карточкам бегунов (растёт коробка, не контент). */}
                            <View style={styles.rightColumnContent}>
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
                        {/* baseColor — явно (2026-10-01, продолжение сессии): PulseText
                            сам дефолтит на `colors.textOnDarkSecondary` (см. её
                            докстринг) и накладывает его ПОСЛЕ styles.sectionTitle в
                            массиве стилей — просто перекрасить sectionTitle.color
                            было недостаточно, компонент всё равно перебивал его
                            своим дефолтом, пока не active. */}
                        <PulseText active={runnersHighlight} baseColor={colors.textOnDark} style={styles.sectionTitle}>
                            Бегуны
                        </PulseText>
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
                <Animated.View
                    pointerEvents="none"
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
                >
                    {/* DicePips (2026-10-01, см. её докстринг/DiceDie.js) —
                        PNG-ассет грани удалён целиком, ghost должен совпадать
                        с видом реального кубика в трее. */}
                    <DicePips value={dragGhostValue} size={dragGhostSize} color={activePlayer.color} />
                </Animated.View>
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
                <ReanimatedAnimated.View
                    pointerEvents="none"
                    style={[styles.dragGhost, { width: dragGhostSize, height: dragGhostSize }, nativeGhostAnimatedStyle]}
                >
                    <DicePips value={dragGhostValue} size={dragGhostSize} color={activePlayer.color} />
                </ReanimatedAnimated.View>
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
    // Раньше — приглушённый (`colors.textOnDarkSecondary`, uppercase,
    // letterSpacing) декоративный стиль подписи секции. 2026-10-01
    // (продолжение сессии) — по прямому запросу пользователя приведён к
    // тому же яркому стилю, что и новые подписи "Раунд"/"Ход"/"Бонус хода"
    // (`reaperCellLabel`) — бросался в глаза контраст между новыми яркими
    // тайтлами и этим приглушённым, когда они оказались рядом в одной
    // панели.
    sectionTitle: {
        color: colors.textOnDark,
        fontWeight: 'bold',
        fontSize: font.tiny,
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
    // padding — spacing.sm, ровно толщина декоративного уголка
    // (targetCornerSize=8, см. diceAbilitiesTile) — устраняет наползание
    // вдоль ПРЯМЫХ краёв рамки. Доп. запас именно под сам угол (дуга срезает
    // площадь по диагонали глубже, чем её толщина по прямой) — теперь в
    // формуле compactMoveDiceSize (см. её докстринг), не здесь: увеличивать
    // ЭТОТ padding пришлось бы синхронно пересчитывать долю там же, чтобы не
    // вызвать переполнение по прямым краям — два независимых источника
    // истины снова разъехались бы, ровно та ошибка, которую и просил
    // устранить пользователь этим же заходом.
    diceTrayWrap: { borderRadius: 4, padding: spacing.sm },
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
    // flex:1 (2026-10-01, живая жалоба "dATile не растянута по высоте до
    // панели табов") — заполняет явно заданную высоту rightColumnContent
    // целиком (та же роль, что flex:1 у leftColumnContent для соседней
    // колонки) — декоративный фон (PersonPanel, dATileSize) растёт вместе с
    // коробкой, а не остаётся короткой плиткой с пустотой под ней.
    dATileCompact: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: 0, overflow: 'hidden', flex: 1 },
    // Кубики слева / усиления справа, В РЯД (2026-10-01, прямой запрос
    // пользователя "diceTrayWrap вертикально слева, усиления вертикально
    // справа") — раньше diceTrayWrap стоял НАД abilitiesWrap (column, дефолт),
    // теперь оба — родные дети dATile В РЯД. alignItems не задан — дефолтный
    // stretch по кросс-оси (высоте) даёт обеим половинам одинаковую высоту,
    // не мешает ни одной из них (у обеих контент сам себя центрирует/
    // раскладывает внутри, см. DiceTray.js#column/AbilityZones.js#
    // gridVertical).
    dATileRow: { flexDirection: 'row', gap: spacing.sm },
    // ЯВНАЯ ширина, НЕЗАВИСИМАЯ константа (DICE_FRAME_WIDTH_COMPACT, см. её
    // докстринг вверху файла за полной хронологией: сначала flex-доля от
    // ряда — либо сжимала кубик, либо раздувала рамку; потом ширина СЧИТАЛАСЬ
    // от размера кубика — не видела второй, отдельный паддинг DiceTray.js#
    // column, кубик вылезал за рамку; теперь ширина рамки — ПЕРВИЧНА, а
    // размер кубика (compactMoveDiceSize) считается процентом уже ОТ НЕЁ,
    // реально измеренной, см. её докстринг). БЕЗ justifyContent:'center'
    // (был тут, убран 2026-10-01, живая жалоба "верхняя рамка усиления не
    // вровень с рамкой кубиков" — см. докстринг DiceTray.js#column за полным
    // разбором): сама колонка кубиков (DiceTray.js#column) теперь flex:1 +
    // space-between, растягивается на всю высоту diceTrayWrap САМА, этой
    // обёртке дополнительный justifyContent больше не нужен.
    diceTrayWrapCompact: { width: DICE_FRAME_WIDTH_COMPACT },
    // Зазор между треем кубиков и сеткой усилений внутри общей плитки —
    // раньше его давал marginTop у заголовка "УСИЛЕНИЯ" (убран вместе с
    // текстом, см. abilitiesNode), без него сетка липла вплотную к кубикам.
    // spacing.xs (было spacing.sm) — уменьшен на 2026-09-20, компенсирует
    // прирост paddingVertical у dATileCompact выше (см. её комментарий).
    // В compactColumns (abilitiesWrapCompact) marginTop больше не нужен —
    // зазор между кубиками и усилениями теперь ГОРИЗОНТАЛЬНЫЙ (`gap` на
    // dATileRow), а не вертикальный (усиления стоят РЯДОМ, не под кубиками).
    abilitiesWrap: { marginTop: spacing.xs },
    // flex:1 — раз diceTrayWrapCompact теперь ЯВНОЙ (не flex-) ширины,
    // усиления просто забирают ВЕСЬ остаток ряда — на типичном экране это
    // заметно больше ширины кубиков (естественно выполняет "усиления —
    // колонка пошире"), без отдельной пропорции, которую пришлось бы
    // подгонять под конкретное значение ширины кубика вручную.
    // БЕЗ justifyContent:'center' (был тут, убран 2026-10-01, живая жалоба
    // "верхняя рамка усиления не вровень с рамкой кубиков" — см. докстринг
    // DiceTray.js#column за полным разбором: центрирование выравнивает
    // только центр, не края, а натуральная высота стопки усилений отличается
    // от стопки кубиков). Сама сетка усилений (AbilityZones.js#gridVertical)
    // теперь сама flex:1 + space-between — растягивается на всю высоту этой
    // обёртки, этой обёртке дополнительный justifyContent больше не нужен.
    abilitiesWrapCompact: { flex: 1, marginTop: 0 },
    // compactColumns (портретная раскладка) — бегуны+жнец слева (основное
    // пространство), кубики+усиления справа, заметно уже — по прямому
    // запросу пользователя "сделать зону усилений поуже, дать место плиткам
    // бегунов" (история: было 3:2, потом 2:1).
    //
    // 2026-09-26: leftColumn/rightColumn были ScrollView (скроллили лишнее,
    // если контент не помещался по высоте) — по прямому запросу пользователя
    // заменены на обычные View, недостаток места компенсировался
    // transform:scale контента. **2026-09-30 — само масштабирование убрано
    // целиком** (см. докстринг у compactColumns-ветки рендера выше) —
    // карточки всегда натурального размера, `scaleClip` (overflow:hidden)
    // остался чистой страховкой на случай нехватки места, не рабочим
    // механизмом.
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
    // marginBottom: 0 (2026-10-01, прямой запрос пользователя — впритык к
    // переключателю игроков). Раньше тут стоял `spacing.lg` (20px) — тем же
    // способом, каким `columnsH` (измеренная высота ЭТОГО ряда, `onLayout`
    // отдаёт border-box без margin) прокидывается в leftColumn/rightColumn
    // как явный `height`, этот margin вычитался flexbox'ом из доступного
    // `columns` пространства и симметрично укорачивал ОБЕ колонки — отсюда
    // и был видимый зазор перед табами. Убрали совсем — колонки снова
    // упираются в switcher вплотную.
    columns: { flex: 1, flexDirection: 'row', marginTop: spacing.xs, marginBottom: 0 },
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
    //
    // `flex:1` (2026-10-01) — заполняет ЯВНО заданную высоту leftColumn
    // целиком (см. её докстринг выше, "ЛЕВАЯ колонка"): `reaperNode` внутри
    // остаётся натурального размера (высоту держит квадратная
    // RoadBonusPanel), а `runnerRow` (тоже flex:1, см. ниже) забирает ВЕСЬ
    // остаток — низ ряда бегунов гарантированно у низа колонки. Раньше
    // (2026-09-30 — начало 2026-10-01) тут был `justifyContent:'space-between'`
    // (растягивал только ПУСТОЙ зазор между Жнецом и рядом, сами карточки
    // оставались натурального размера) — заменён, когда пользователь прямо
    // попросил, чтобы растягивались САМИ ПЛИТКИ, а не зазор между ними.
    leftColumnContent: { flex: 1, paddingBottom: spacing.xs, paddingHorizontal: spacing.xs },
    // Ряд "Раунд/Ход/Бонус дороги" (2026-10-01, см. reaperNode) — НЕ flex:1
    // (в отличие от leftColumnContent/runnerRow) — намеренно натуральной
    // высоты, её держат сами квадраты (aspectRatio:1 у RoundPanel/
    // RoadBonusPanel) + подпись под каждым. gap — тот же приём, что и у
    // runnerRow ниже. marginBottom — даёт зазор перед runnerRow.
    reaperRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: 2 },
    // Один квадрат ряда + подпись под ним ("Раунд"/"Ход"/"Бонус хода") — та
    // же идея, что подпись типа бегуна под RunnerCard (`styles.name`), по
    // прямому запросу пользователя "по аналогии с тайтлом для бегуна сделать
    // тайтлы". flex:1 — все три ячейки делят ширину ряда поровну (тот же
    // эффект, что раньше давал явный `panelSize` каждой панели по
    // отдельности — теперь это делает сама ячейка, панели внутри уже сами
    // квадратные через aspectRatio:1).
    reaperCell: { flex: 1, alignItems: 'center' },
    reaperCellLabel: {
        color: colors.textOnDark,
        fontWeight: 'bold',
        fontSize: font.tiny,
        marginBottom: 2,
    },
    // Ряд из 3 вертикальных плиток бегунов, ПОД Жнецом (2026-09-20, см.
    // RunnerCard.js#compact) — gap, тот же приём, что уже используют columns/
    // DiceTray/turnBtnRow в этом файле/проекте. flex:1 (2026-10-01, см.
    // leftColumnContent выше) — забирает весь остаток высоты колонки после
    // reaperRow; каждая карточка внутри тянется по высоте отдельно (см.
    // RunnerCard.js#cardCompact#height:'100%').
    runnerRow: { flexDirection: 'row', gap: spacing.xs, flex: 1 },
    // paddingRight (было paddingHorizontal — отступ с ОБЕИХ сторон) —
    // 2026-10-01, прямой запрос пользователя: "расширь панель кубиков и
    // усилений влево до края колонки" + явный запрет трогать позицию правой
    // рамки. Левый инсет убран целиком (paddingLeft отсутствует — панель
    // (rightColumnContent/dATile) теперь начинается ровно от левого края
    // rightColumn, а не отступает от него ещё на xs). Правый инсет (xs)
    // оставлен БЕЗ изменений — та же величина, что и раньше, правая рамка
    // панели не сдвигается ни на пиксель. Зазор МЕЖДУ leftColumn и
    // rightColumn (marginRight у leftColumn) этим не тронут — отдельный,
    // не запрошенный элемент.
    rightColumn: { flexGrow: 2, flexShrink: 1, flexBasis: 0, minWidth: 0, paddingRight: spacing.xs },
    // flex:1 (2026-10-01) — заполняет ЯВНО заданную высоту rightColumn
    // целиком (тот же приём, что leftColumnContent у соседней колонки) —
    // dATile внутри (тоже flex:1, см. dATileCompact) растягивается вместе с
    // ней, декоративный фон плитки достаёт до низа колонки.
    rightColumnContent: { paddingBottom: spacing.sm, flex: 1 },
});
