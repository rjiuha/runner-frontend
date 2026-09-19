// src/components/game/RunnerCard.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RunnerToken from './RunnerToken';
import PulseHighlight from '../ui/PulseHighlight';
import PersonPanel from '../ui/PersonPanel';
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
 * Карточка одного бегуна — 2026-09-19, второй заход того же дня (см. первый
 * заход в git-истории: свободная абсолютно-позиционированная раскладка,
 * масштабируемая от ширины карточки — живой прогон показал "всё разъехалось"
 * и на вебе, и на Android; вдобавок карточка стала значительно ВЫШЕ старой,
 * что противоречило прямому запросу пользователя не увеличивать высоту).
 *
 * ЭТОТ заход — назад к FLEX-РЯДУ (та же структура, что была ДО всей этой
 * переверстки: аватар слева фиксированного размера → высота карточки
 * ПРИРОДНО определяется высотой аватара + паддингом, как и раньше, никакой
 * отдельной математики аспект-рейшо/ширины не нужно — по прямому запросу
 * пользователя "уместить в ширину, не увеличивая высоту плитки, которая
 * была раньше"). АВАТАР при этом заметно КРУПНЕЕ старого (AVATAR_SIZE=64,
 * было 36/30 в альбомной/компактной раскладке) — "не уменьшать размеры
 * аватарки" — рамка вокруг растёт вместе с ним, а не наоборот, и высота
 * ряда/карточки ВСЁ РАВНО остаётся в районе старой (~80dp), потому что
 * раньше высоту УЖЕ определял самый высокий элемент строки (там был
 * значок), теперь та же логика, просто с более крупным значком.
 *
 * Компактная/альбомная раскладка — ОДНА и та же (по решению пользователя
 * "везде, компактную тоже переделать") — размеры ФИКСИРОВАННЫЕ (не считаются
 * от ширины карточки), поэтому на узкой компактной колонке ничего не
 * переполняется по горизонтали: гибкая часть (имя+жетоны) — `flex:1`,
 * сжимается сама, как и в САМОЙ ПЕРВОЙ версии карточки этого проекта.
 *
 * Декоративная рамка корпуса — PersonPanel (person_panel_*), аватар и слот
 * кубика — каждый в своей мини-рамке FramePanel (frame_panel_* для аватара,
 * person_panel_* — дефолт FramePanel — для слота кубика, см. её докстринг).
 *
 * `active`/`turnActive`/`pulseHighlight`/`hoverState`/`pending`/`healTarget`/
 * `remeasureTick` — семантика не изменилась с прошлого захода (см. git-diff
 * первой версии): рамку раньше красил borderColor, теперь красит растровый
 * PersonPanel, поэтому все состояния — полупрозрачная заливка/контур поверх
 * (тот же приём, что и в AbilityZone).
 *
 * Жетоны повреждения — по прямому решению пользователя, ПРОСТО занято/
 * свободно (dmg_red/dmg_green), без 5 типов/цветов/кодов, что были раньше
 * (DAMAGE_TOKENS в GameConstants.js остаётся для остального кода, тут
 * больше не импортируется).
 *
 * "Ход"/"Накат" — один слот кубика (diceSlot) показывает АКТИВНОЕ значение
 * (rollDiceValue в приоритете — во время наката runner.dice уже 0, не null,
 * `??` его не заменит) + отдельный маленький счётчик "×N" — сколько накатов
 * ЕЩЁ доступно в этом раунде (2 − runner.rollMoves, НЕ то же самое, что
 * rollDiceValue).
 *
 * Текстовая строка статуса убрана (не было для неё места и раньше в
 * компактной раскладке) — уничтоженный бегун виден через `cardDestroyed`
 * (приглушение всей карточки), как и было в компактной раскладке до этого.
 */
const DOUBLE_TAP_MS = 300;
const AVATAR_SIZE = 64;
const DICE_SIZE = 44;
const DAMAGE_ICON_SIZE = 22;
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
// с ним — реконсиляцию ~20 дочерних `<Image>` у каждого FramePanel).
const AVATAR_FRAME_SIZE = { width: AVATAR_SIZE, height: AVATAR_SIZE };
const DICE_FRAME_SIZE = { width: DICE_SIZE, height: DICE_SIZE };

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
    // eslint-disable-next-line no-unused-vars -- сохранён для совместимости вызывающего кода, см. шапку файла
    compact = false,
    remeasureTick = 0,
}) {
    const display = RUNNER_DISPLAY[runner.type];
    const slots = runner.damageTokens ?? [null, null];
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
    // Ширина СРЕДНЕЙ зоны (имя+жетоны, между аватаром и кубиком) — живая
    // жалоба пользователя: в узкой компактной колонке на 2 жетона физически
    // не хватает места (avatar 64 + dice ~48 почти не оставляют места), а
    // `infoCol` без явного `minWidth:0` не ужимается меньше "естественного"
    // размера контента (классический баг RN/CSS flexbox) — жетоны визуально
    // вылезали в зону кубика ("кружки ушли под рамку для кубика"). Вместо
    // клиппинга — реальное масштабирование: меряем зону через ЕЁ СОБСТВЕННЫЙ
    // onLayout (обычный, НЕ абсолютно спозиционированный flex-ребёнок — тот
    // самый путь измерения, что уже надёжно работает везде в проекте, в
    // отличие от бага PersonPanel.js выше) и ужимаем иконки жетонов под
    // реально доступную ширину.
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

    // Иконка жетона — родной DAMAGE_ICON_SIZE, если помещается; иначе жмётся
    // под реально измеренную ширину infoCol (минимум 10px, чтобы совсем не
    // пропасть на экстремально узких экранах). DAMAGE_ICON_GAP — зазор МЕЖДУ
    // двумя иконками, тоже ужимается вместе с ними, а не остаётся фиксированным.
    // На Android (см. isAndroid/damageRowVertical ниже) кружки стоят ДРУГ ПОД
    // ДРУГОМ, а не бок о бок — делить доступную ширину на 2 больше не нужно,
    // каждый кружок может занимать её почти целиком.
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
            style={[styles.card, destroyed && styles.cardDestroyed]}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            <PersonPanel size={cardSize} />
            {/* borderRadius — та же величина, что у PersonPanel.js#styles.wrap
                (радиус, по которому та обрезает свою заливку под скруглённой
                декоративной дугой) — та же причина/фикс, что и в
                AbilityZone.js: без него заливка/рамка рисовались острым
                углом поверх скруглённой рамки. */}
            {tintColor && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `${tintColor}40`, borderRadius: 6 }]} />}
            {active && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.activeRing, { borderColor: color }]} />}
            <PulseHighlight active={pulseHighlight && hoverState == null} borderRadius={6} borderWidth={2} />

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
                        {/* Счётчик накатов — уголок-бейдж ПОВЕРХ слота кубика
                            (не отдельная строка под ним) — иначе колонка кубика
                            становится ВЫШЕ, чем аватар (64+badge), и снова
                            тянет вверх высоту всей карточки, чего пользователь
                            как раз попросил избежать. */}
                        <View style={styles.rollBadge} pointerEvents="none">
                            <Text style={styles.rollBadgeText} noGlobalTint>×{rollsAvailable}</Text>
                        </View>
                    </View>
                </View>
            </View>
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
    cardDestroyed: { opacity: 0.45 },
    // borderRadius=6 — та же величина, что у PersonPanel.js#styles.wrap
    // (было 8, минорный, но заметный при близком сравнении рассинхрон).
    activeRing: { borderWidth: 3, borderRadius: 6 },
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
    // Бейдж накатов — уголок ПОВЕРХ diceBox (см. коммент у места рендера),
    // не отдельная строка снизу — держит diceCol в пределах DICE_SIZE, не
    // выше аватара.
    rollBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 3,
        borderRadius: 8,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.textOnDarkSecondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rollBadgeText: { color: colors.textOnDark, fontWeight: 'bold', fontSize: 9 },
});
