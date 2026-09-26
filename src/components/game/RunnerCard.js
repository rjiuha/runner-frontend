// src/components/game/RunnerCard.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
}) {
    const display = RUNNER_DISPLAY[runner.type];
    // Жетоны повреждения — считаются НАПРЯМУЮ от runner.status (2026-09-24, по
    // прямому запросу пользователя), не от накопленной истории событий
    // (runner.damageTokens/useRunnerDamageTokens — та инфраструктура остаётся
    // в проекте нетронутой, просто здесь больше не читается): DAMAGED — один
    // занятый (red) слот, BROKEN/DESTROYED — оба, HEALTHY — ни одного. Статус
    // синхронизируется через обычный снапшот и НИКОГДА не теряется при
    // reconnect/relaunch — в отличие от истории событий, которая теряется
    // (см. докстринг useRunnerDamageTokens.js), это гарантированно верно
    // всегда, а не только пока жив тот же живой Mercure-коннект.
    const slots = damageSlotsFromStatus(runner.status);
    const destroyed = runner.status === RUNNER_STATUS.DESTROYED;
    const zoneKey = `move:${runner.id}`;
    const cardRef = useRef(null);
    // Размер КОРПУСА карточки (для PersonPanel, см. её докстринг) — НЕ через
    // собственный onLayout PersonPanel (живая жалоба пользователя + логи
    // подтвердили: на Android onLayout абсолютно спозиционированного ребёнка
    // с auto-height родителем стабильно ловит height=0 — родитель ещё не
    // "устаканился" на момент этого конкретного measure-пути), а через УЖЕ
    // работающий здесь measureInWindow (тот самый, что годами используется
    // для drag-n-drop зоны — там реальный размер приходит верно).
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

    const measure = useCallback(() => {
        requestAnimationFrame(() => {
            cardRef.current?.measureInWindow((x, y, width, height) => {
                onMoveDiceMeasured?.(zoneKey, { x, y, width, height });
                // ВАЖНО: раньше тут вычитался spacing.sm*2 (предположение "PersonPanel
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
                // плитки", подтверждена скриншотом+замером). Теперь передаём ПОЛНЫЙ
                // border-box без вычитания — раз абсолютный потомок и так игнорирует
                // padding, это и есть корректный размер, чтобы рамка легла ровно по
                // границе карточки.
                setCardSize({ width, height });
            });
        });
    }, [zoneKey, onMoveDiceMeasured]);

    useEffect(() => {
        if (remeasureTick) measure();
    }, [remeasureTick, measure]);

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
            onLayout={measure}
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
                    <View style={styles.avatarBoxCompact}>
                        <FramePanel
                            size={AVATAR_FRAME_SIZE_COMPACT}
                            backgroundSource={FRAME_PANEL_BACKGROUND}
                            backgroundCornerSource={FRAME_PANEL_BACKGROUND_CORNER}
                            backgroundTileSize={60}
                        />
                        <RunnerToken
                            type={runner.type}
                            status={runner.status}
                            avatar
                            color={color}
                            size={AVATAR_SIZE_COMPACT}
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
                                style={[styles.damageIconCompact, i === 1 && styles.damageIconCompactGap]}
                            />
                        ))}
                    </View>
                    <View style={styles.diceBoxCompact}>
                        <FramePanel size={DICE_FRAME_SIZE_COMPACT} />
                        <Text style={styles.diceValueCompact} noGlobalTint>{diceValue != null ? diceValue : '—'}</Text>
                    </View>
                    {/* Счётчик накатов — ОТДЕЛЬНОЙ строкой ПОД слотом кубика
                        (2026-09-20, по прямому запросу пользователя "не
                        кружочком рядом с фреймом кубика, а отдельно") —
                        раньше был уголком-бейджем ПОВЕРХ diceBoxCompact. */}
                    <Text style={styles.rollCountCompact} noGlobalTint>×{rollsAvailable}</Text>
                    {/* Бонус хода — см. roadBonus проп/докстринг файла — ТОЛЬКО
                        когда данные реально пришли с бэка, иначе пусто. */}
                    {roadBonus != null && (
                        <Text style={styles.roadBonusCompact} noGlobalTint>+{roadBonus}</Text>
                    )}
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
    nameCompact: { color: colors.textOnDark, fontWeight: 'bold', fontSize: 11, marginTop: 3, maxWidth: '100%' },
    damageRowCompact: { flexDirection: 'row', marginTop: 3 },
    damageIconCompact: { width: DAMAGE_ICON_SIZE_COMPACT, height: DAMAGE_ICON_SIZE_COMPACT },
    damageIconCompactGap: { marginLeft: 4 },
    diceBoxCompact: { width: DICE_SIZE_COMPACT, height: DICE_SIZE_COMPACT, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    diceValueCompact: { color: colors.textOnDark, fontWeight: 'bold', fontSize: 12 },
    rollCountCompact: { color: colors.textOnDarkSecondary, fontWeight: 'bold', fontSize: 10, marginTop: 2 },
    roadBonusCompact: { color: colors.success, fontWeight: 'bold', fontSize: 10, marginTop: 1 },
});
