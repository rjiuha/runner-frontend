// src/components/game/GameDialogModal.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Button from '../ui/Button';
import PulseHighlight from '../ui/PulseHighlight';
import { colors, spacing, radius, font } from '../../theme';
import { DIALOG_ORIENTATION } from '../../lib/dialogSettings';
import { useDialogOrientation } from '../../hooks/useDialogOrientation';
import { ROAD_AREA_SPACING } from '../../hooks/useBoardLayout';
import { TURN_BANNER_MIN_HEIGHT } from '../../constants/GameConstants';

/**
 * 2026-10-12, по прямому запросу пользователя — "вытащить вообще все
 * уведомления/диалоги в модалку". ВРЕМЕННЫЙ ДУБЛЬ, не замена: существующая
 * инлайн-шапка панели (turnBannerInner в GameBoardScreen.js) остаётся как
 * есть, этот компонент рисует ТО ЖЕ самое состояние ПОВЕРХ экрана — задача
 * сначала убедиться, что сюда попали ВСЕ диалоги с выбором (плюс явно
 * перечисленные "ждущие" уведомления), и только потом (отдельным заходом)
 * убрать старую инлайн-шапку.
 *
 * НЕ системный RN `<Modal>` — по прямому выбору пользователя: тот
 * затемняет/блокирует весь экран, а часть диалогов (выстрел/размещение
 * Жнеца) требует тапать по доске ПОКА диалог открыт. Вместо этого —
 * полупрозрачная карточка поверх экрана: сама обёртка `pointerEvents=
 * 'box-none'` (тапы ВНЕ карточки проходят насквозь к доске), карточка —
 * обычный View, перехватывает тапы по своим кнопкам как любой другой UI.
 *
 * Один общий компонент на ВСЕ диалоги (по прямому выбору пользователя) —
 * вызывающий код (GameBoardScreen.js#dialogState) решает, какой текст и
 * какие кнопки сейчас актуальны, этот компонент только рисует их.
 *
 * **Сворачивание вбок (2026-10-15, по прямому запросу пользователя)** —
 * альтернатива перетаскиванию по вертикали: та давала только ЧАСТИЧНЫЙ
 * обзор доски (модалка всё равно закрывает её на всю ширину, просто в
 * другом месте), сворачивание в узкую полоску у края открывает ПОЧТИ ВСЮ
 * доску разом. Ручка — двойная стрелка во всю высоту модалки, прибитая к
 * одной грани (orientation — lib/dialogSettings.js, настраивается в
 * игровом меню). **Важно: свёрнутое состояние — НЕ дыра в доску** (первая
 * версия делала фон/рамку прозрачными при сворачивании, пользователь сразу
 * поправил по живому скриншоту) — фон+рамка (`cardOuter`, см. styles ниже)
 * ВСЕГДА видимы, тем же цветом/обводкой, что и развёрнутая карточка, просто
 * уже; анимируется ТОЛЬКО ширина этого бокса. Гаснет/проявляется — ТОЛЬКО
 * текст+кнопки (`content`, отдельный блок, contentOpacity). Разворот/сворот
 * — двухфазная анимация: сначала плавно гаснет текст/кнопки, ПОТОМ
 * схлопывается сама ширина (widthAnim) до узкого прямоугольника ручки;
 * разворот — зеркально в обратном порядке (сначала ширина растёт, ПОТОМ
 * проявляется текст) — чтобы не было видно, как текст переносится/
 * дёргается на промежуточной ширине. Сама ручка (стрелка) рисуется БЕЗ
 * своей отдельной заливки — сидит прямо на персистентном фоне `cardOuter`,
 * не нужно отдельно скрывать/показывать.
 *
 * **Закрытие безкнопочных уведомлений — РЯД ОТКАЧЕННЫХ ПОПЫТОК 2026-10-15,
 * финал: без изменений поведения.** Перебрано за один заход, по прямому
 * запросу пользователя каждый раз: (1) замена глифа ручки на ✕ для
 * безкнопочных диалогов, тап полностью скрывает карточку — откачено,
 * "не надо было менять ручку-стрелку на крестик"; (2) отдельная квадратная
 * ✕-кнопка в ряду кнопок "по аналогии с диалогами, где есть выбор" —
 * откачено, пользователь передумал; (3) глиф-стрелка остаётся, но тап по ней
 * у безкнопочных диалогов полностью скрывает карточку — живая проверка
 * показала, что это тоже не то, что ожидалось ("ты чё, блин"). **Финал —
 * ручка у ВСЕХ диалогов (кнопочных и безкнопочных) делает ОДНО и то же —
 * сворачивает/разворачивает** (`toggleCollapse`, как было до самого первого
 * из этих трёх заходов) — у безкнопочных эта возможность и так уже была
 * (см. следующий абзац), никакого отдельного "закрытия" не существует.
 * Этим же заходом (2026-10-15) `dialogState` (GameBoardScreen.js) стал
 * ПОЛНЫМ зеркалом `turnBannerInner`, включая простые безкнопочные подсказки
 * шага ("Твой ход"+текст) и "Ход игрока: X" — раньше они сюда сознательно не
 * попадали. Инлайн-дубль в `turnBanner` (зона 11 панели) убран ТОЛЬКО для
 * `useMobileNavButtons` (портрет+native) — на вебе/landscape `turnBannerInner`
 * остаётся видимым параллельно с этой модалкой (которая и так рендерится на
 * ВСЕХ платформах/раскладках, не только mobileNav).
 *
 * **Жёстко зафиксированный размер (2026-10-15, по прямому запросу
 * пользователя — "прям как панель 11")** — высота `cardOuter` (см. styles
 * ниже) больше не auto-height от контента, а константа
 * `TURN_BANNER_MIN_HEIGHT` (`constants/GameConstants.js`) — ТА ЖЕ, что
 * держит зону 11 (`styles.turnBanner`, GameBoardScreen.js), вынесена в общий
 * файл специально, чтобы оба места менялись синхронно. Длинный текст (2+
 * строки, например развёрнутый результат коллизии) теперь ОБРЕЗАЕТСЯ
 * (`overflow:'hidden'` на `cardOuter`, уже был — раньше только для анимации
 * ширины, теперь работает и по высоте), а не раздувает карточку — тот же
 * компромисс, что уже принят для зоны 11.
 *
 * `kind` на `dialogState` (GameBoardScreen.js#dialogState) — стабильный
 * идентификатор ветки/состояния диалога, НЕ сам объект (тот создаётся заново
 * каждый рендер, IIFE без memo) — только по нему понятно, ЭТО ТОТ ЖЕ диалог
 * (ре-рендер не должен сбрасывать ручное сворачивание) или УЖЕ ДРУГОЙ
 * (должен появиться развёрнутым заново, по прямому требованию пользователя
 * — "каждый диалог должен появляться развёрнутым"). Текстовые
 * безкнопочные уведомления ("Трасса смещается…" и т.п.) тоже получили kind
 * — сворачиваемы наравне с остальными, просто без пульсации (см. hasButtons
 * ниже — привлекать внимание нужно только когда есть РЕШЕНИЕ, которое можно
 * пропустить, свернув карточку).
 *
 * @param {object|null} dialogState — null/undefined = ничего не показывать.
 *   { kind: string, text: string, buttons?: Array<{ key, title, variant, onPress }> }
 * @param {number} width/height — РЕАЛЬНЫЙ пиксельный размер дороги
 *   (roadContainerW/H из useBoardLayout, GameBoardScreen.js) — см. ниже,
 *   почему нельзя положиться на `absoluteFillObject`/`bottom:0`.
 * @param {number} [bottomInset] — доп. отступ снизу СВЕРХ обычного
 *   spacing.lg (2026-10-15, по прямому запросу пользователя — "низ модалки
 *   должен совпадать с низом первой клетки дороги, без нахлёста на рамку").
 *   GameBoardScreen.js передаёт arrowBtnSize ТОЛЬКО для mobileNav-раскладки
 *   (там у дороги снизу есть декоративная кайма MobileFrameOverlay, её
 *   внутренний край — ровно на arrowBtnSize px от истинного низа) — в
 *   остальных раскладках такой каймы нет, undefined/0.
 */
// 31 ≈ 44*0.7 (2026-10-15, по прямому запросу пользователя — "уже процентов
// на 30"). Ниже стандартного минимального тач-таргета ~44pt (iOS/Android
// HIG) — осознанный компромисс по прямому запросу, не забытая деталь.
const COLLAPSED_WIDTH = 31;
const FADE_MS = 150;
const SLIDE_MS = 220;

export default function GameDialogModal({ dialogState, width, height, bottomInset }) {
    const orientation = useDialogOrientation();
    const isLeft = orientation !== DIALOG_ORIENTATION.RIGHT;
    // 2026-10-17, по прямому запросу пользователя, ТОЛЬКО для веба: модалка
    // прибита к ВЕРХНЕМУ краю дороги (не к нижнему, как везде остальное, см.
    // wrapper/wrapperBottom ниже), и кнопки стоят ПЕРЕД текстом (слева), а не
    // после (справа). Native (Android) это не трогает — там якорь/порядок
    // остаются как были (низ + кнопки справа).
    const isTop = Platform.OS === 'web';
    const buttonsOnLeft = Platform.OS === 'web';

    const fullWidth = width != null ? Math.max(COLLAPSED_WIDTH, width - spacing.lg * 2) : COLLAPSED_WIDTH;

    const [collapsed, setCollapsed] = useState(false);
    const [animating, setAnimating] = useState(false);
    const widthAnim = useRef(new Animated.Value(fullWidth)).current;
    const contentOpacity = useRef(new Animated.Value(1)).current;
    // Предыдущий kind — НЕ состояние (не должен сам по себе триггерить
    // ре-рендер), только для сравнения внутри эффекта ниже.
    const prevKindRef = useRef(null);

    // Новый диалог (другой kind) — всегда разворачивается заново, мгновенно
    // (без анимации — это не ручное действие игрока, это новое появление).
    useEffect(() => {
        const kind = dialogState?.kind ?? null;
        if (kind != null && kind !== prevKindRef.current) {
            // stopAnimation — на случай, если новый диалог (другой kind)
            // подоспел ПОКА ещё доигрывала анимация сворачивания/разворота
            // ПРЕЖНЕГО (например, игрок тапнул "свернуть", а за эти 370мс
            // состояние партии уже сменилось) — без остановки отложенный
            // колбэк старой Animated.sequence(...).start() позже перезаписал
            // бы collapsed/animating уже ПОСЛЕ принудительного сброса здесь.
            widthAnim.stopAnimation();
            contentOpacity.stopAnimation();
            setCollapsed(false);
            setAnimating(false);
            contentOpacity.setValue(1);
            widthAnim.setValue(fullWidth);
        }
        prevKindRef.current = kind;
        // fullWidth намеренно не в deps — нужно значение АКТУАЛЬНОГО рендера
        // в момент смены kind, не триггерить этот эффект на каждый ресайз.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogState?.kind]);

    // Ресайз дороги (поворот/ресайз окна) пока РАЗВЁРНУТО — ширина карточки
    // следует за новым fullWidth без анимации сворачивания/разворота (это
    // не действие игрока). Пока СВЁРНУТО — ширина не зависит от дороги
    // вообще (COLLAPSED_WIDTH константа), трогать нечего.
    useEffect(() => {
        if (!collapsed && !animating) {
            widthAnim.setValue(fullWidth);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullWidth]);

    const toggleCollapse = useCallback(() => {
        if (animating) return;
        setAnimating(true);
        if (collapsed) {
            // Разворот — СНАЧАЛА растёт ширина, ПОТОМ проявляется хром
            // (текст/кнопки/фон), зеркально сворачиванию ниже.
            setCollapsed(false);
            Animated.sequence([
                Animated.timing(widthAnim, { toValue: fullWidth, duration: SLIDE_MS, useNativeDriver: false }),
                Animated.timing(contentOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
            ]).start(() => setAnimating(false));
        } else {
            // Сворачивание — СНАЧАЛА гаснет хром, ПОТОМ схлопывается ширина
            // (по прямому запросу пользователя — порядок важен, иначе виден
            // перенос текста на промежуточной ширине).
            Animated.sequence([
                Animated.timing(contentOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
                Animated.timing(widthAnim, { toValue: COLLAPSED_WIDTH, duration: SLIDE_MS, useNativeDriver: false }),
            ]).start(() => {
                setCollapsed(true);
                setAnimating(false);
            });
        }
    }, [animating, collapsed, fullWidth, widthAnim, contentOpacity]);

    if (!dialogState) return null;
    const { text, buttons } = dialogState;
    const hasButtons = buttons?.length > 0;
    // Мерцание ручки, пока свёрнуто — ТОЛЬКО если есть решение (кнопки),
    // которое можно пропустить, свернув карточку (по прямому запросу
    // пользователя). Безкнопочные уведомления ("Жду результат…", сдвиг
    // трассы) ничего не требуют от игрока прямо сейчас — не мерцают.
    const pulseWhileCollapsed = collapsed && hasButtons;
    // Стрелка смотрит К грани, пока развёрнуто (туда же, куда сворачивается),
    // и ОТ грани, пока свёрнуто (туда, куда развернётся) — см. докстринг.
    const arrowGlyph = collapsed
        ? (isLeft ? '»' : '«')
        : (isLeft ? '«' : '»');
    // bottomInset (GameBoardScreen.js) — ТОЛЬКО для mobileNav, где у дороги
    // есть декоративная кайма снизу (см. её докстринг у пропа выше) — её
    // переданное значение (arrowBtnSize) ВСЕГДА больше ROAD_AREA_SPACING,
    // так что перекрывать/занижать его тут не нужно, просто fallback на
    // ROAD_AREA_SPACING для раскладок без такой каймы (веб/landscape).
    const resolvedBottomInset = bottomInset ?? ROAD_AREA_SPACING;

    return (
        <View
            style={[
                styles.wrapper,
                isTop ? styles.wrapperTop : [styles.wrapperBottom, { paddingBottom: resolvedBottomInset }],
                { width, height },
                isLeft ? styles.wrapperLeft : styles.wrapperRight,
            ]}
            pointerEvents="box-none"
        >
            {/* cardOuter несёт фон+рамку ВСЕГДА, и развёрнутый, и свёрнутый —
                по прямому запросу пользователя: свёрнутое состояние должно
                выглядеть как узкая полоска В ТОМ ЖЕ СТИЛЕ модалки (видимый
                фон+рамка), не прозрачная пустота. Сжимается/растёт САМА
                ширина этого бокса (widthAnim) — цвет/рамка остаются
                постоянными на всём протяжении анимации, никогда не гаснут. */}
            <Animated.View style={[styles.cardOuter, { width: widthAnim }]}>
                {/* content — ФИКСИРОВАННАЯ ширина (fullWidth, не 'widthAnim'/
                    100%) и alignSelf под ту же грань, что и у cardOuter —
                    принципиально: пока cardOuter анимированно сжимается,
                    текст/кнопки не должны ПЕРЕЖИВАТЬ reflow (перенос строк
                    из-за сужения) — к моменту начала сжатия ширины они уже
                    невидимы (contentOpacity=0), но если бы их собственная
                    ширина тоже сжималась вместе с cardOuter, их АВТО-ВЫСОТА
                    выросла бы (многострочный перенос на 44px) и утащила бы
                    за собой auto-height ВСЕГО cardOuter — узкая полоска стала
                    бы неожиданно высокой. Фиксированная ширина делает высоту
                    content (и, значит, auto-height cardOuter) НЕЗАВИСИМОЙ от
                    текущей анимируемой ширины — сжатие просто обрезает
                    content по overflow:hidden (styles.cardOuter), визуально
                    ничего не ломая, т.к. в этот момент текст и так уже
                    невидим (в отличие от фона/рамки САМОГО cardOuter, те не
                    анимируются и видны всегда, см. выше). */}
                <Animated.View
                    style={[styles.content, { width: fullWidth, alignSelf: isLeft ? 'flex-start' : 'flex-end', opacity: contentOpacity }]}
                    pointerEvents={collapsed ? 'none' : 'auto'}
                >
                    {/* Текст слева + кнопки справа, ОДНОЙ строкой (2026-10-15,
                        по прямому запросу пользователя — "как в панельке
                        Твой ход", см. turnBannerInner/turnHintRow в
                        GameBoardScreen.js, тот же приём скопирован сюда, не
                        переизобретён). Текст — flex:1 (забирает всю ширину,
                        оставшуюся ПОСЛЕ кнопок, те не сжимаются), по центру
                        ТОЛЬКО если кнопок нет (безкнопочные уведомления вроде
                        "Трасса смещается…" — там нет соседа справа, от
                        выключки слева было бы криво). */}
                    <View style={isLeft ? styles.chromeInsetLeft : styles.chromeInsetRight}>
                        {/* buttonsOnLeft (веб-only, см. её докстринг выше) —
                            тот же buttonsNode рендерится ДО текста вместо
                            после, margin переезжает на противоположную
                            сторону (buttonRowLeft), чтобы зазор остался
                            МЕЖДУ кнопками и текстом, а не на внешнем крае. */}
                        {buttonsOnLeft && hasButtons && (
                            <View style={[styles.buttonRow, styles.buttonRowLeft]}>
                                {buttons.map((b) => (
                                    <Button
                                        key={b.key}
                                        title={b.title}
                                        variant={b.variant}
                                        onPress={b.onPress}
                                        style={styles.button}
                                        textStyle={styles.buttonText}
                                    />
                                ))}
                            </View>
                        )}
                        <Text style={[styles.text, !hasButtons && styles.textCenter]} noGlobalTint>{text}</Text>
                        {!buttonsOnLeft && hasButtons && (
                            <View style={styles.buttonRow}>
                                {buttons.map((b) => (
                                    <Button
                                        key={b.key}
                                        title={b.title}
                                        variant={b.variant}
                                        onPress={b.onPress}
                                        style={styles.button}
                                        textStyle={styles.buttonText}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                </Animated.View>
                <TouchableOpacity
                    onPress={toggleCollapse}
                    activeOpacity={0.6}
                    style={[styles.handle, isLeft ? styles.handleLeft : styles.handleRight]}
                >
                    {/* showBorder={false} ЯВНО (2026-10-15, по прямому запросу
                        пользователя) — именно рамка PulseHighlight и была тем,
                        что визуально "не совпадало" с истинным контуром
                        cardOuter (см. анализ в cardOuter/handle выше, борьба
                        с containing-block сдвигом откачена целиком) — проще
                        и безопаснее убрать рамку у самого мигания, чем снова
                        лезть в позиционирование handle/cardOuter. **Грабли
                        первой попытки**: просто убрать проп из вызова не
                        работает — у PulseHighlight#showBorder дефолт `true`
                        (PulseHighlight.js), значит нужно именно `={false}`,
                        не отсутствие прописи. Осталась только заливка
                        (showBackground) — мигает фон, рамка статична
                        (только постоянная рамка cardOuter, не гаснет). */}
                    <PulseHighlight active={pulseWhileCollapsed} borderRadius={radius.lg} showBorder={false} showBackground />
                    <Text style={styles.arrow} noGlobalTint>{arrowGlyph}</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Поверх дороги, прижато к НИЖНЕМУ краю (не центр экрана) — по прямому
    // запросу пользователя (2026-10-12 — изначально было к верхнему краю;
    // 2026-10-15 — перенесено вниз, см. justifyContent ниже): рендерится
    // как ребёнок roadFrameWrap (GameBoardScreen.js).
    //
    // **Реальный Android-баг, найден живьём через диагностическую подсветку
    // фона** (та же категория, что уже в "Известные грабли RN/Android" —
    // "onLayout на абсолютно спозиционированном элементе внутри родителя с
    // AUTO-высотой на Android может стабильно вернуть 0", тут тот же
    // первопричинный класс, но для ПОЗИЦИОНИРОВАНИЯ, не измерения):
    // `position:'absolute'` с `top/left/right/bottom:0` (старый
    // `...StyleSheet.absoluteFillObject`) ВНУТРИ `roadFrameWrap` (`flex:1`,
    // без явного пиксельного размера) на Android растягивался НЕ на весь
    // родитель, а схлопывался в размер своего контента и прижимался к НИЗУ
    // колонки (видно было на вебе корректно, см. CLAUDE.md — платформенное
    // расхождение). Фикс — убрали зависимость от bottom/right-стретчинга,
    // задаём `width`/`height` ЯВНО, пропами из уже известного
    // `roadContainerW`/`roadContainerH` (тот же источник, которым меряется
    // сама дорога/BoardGrid) — `top:0, left:0` + явный размер вместо
    // неявного "растянись до родителя".
    wrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        paddingTop: spacing.lg,
        paddingLeft: spacing.lg,
        paddingRight: spacing.lg,
        // paddingBottom — НЕ здесь, см. wrapperBottom/`bottomInset`-проп и их
        // применение в месте рендера: нижний инсет зависит от раскладки (своя
        // декоративная кайма дороги есть только у mobileNav), статика тут не
        // подходит. Попытка №1 (zIndex:12, рисовать МОДАЛКУ ПОВЕРХ рамки) —
        // ОТКЛОНЕНА пользователем по прямому ответу: "рисовать надо не
        // поверх рамки, надо рисовать ВЫШЕ границы рамки, чтобы нахлёста не
        // было" — убрана целиком, см. git-историю.
    },
    // Якорь по вертикали (2026-10-17) — РАЗДЕЛЁН на два стиля, раньше был
    // один жёсткий `justifyContent:'flex-end'` в wrapper (см. git-историю,
    // 2026-10-15 — "с верхней части дороги на нижнюю"). По прямому запросу
    // пользователя веб вернулся к верхнему краю (см. isTop выше), native
    // (Android) остался как было — на нижнем, с тем же bottomInset.
    wrapperTop: { justifyContent: 'flex-start' },
    wrapperBottom: { justifyContent: 'flex-end' },
    // Ориентация (2026-10-15) — карточка хугается к той же грани, к которой
    // прибита ручка (см. docstring). alignItems на wrapper — единственное,
    // что меняется между 'left'/'right', сама карточка/ручка внутри всегда
    // позиционируется "как для left", геометрия зеркалится через isLeft-
    // развилки в JSX/стилях ниже.
    wrapperLeft: { alignItems: 'flex-start' },
    wrapperRight: { alignItems: 'flex-end' },
    // Внешний контейнер — ТОЛЬКО ширина анимируется (widthAnim), сам прозрачный
    // и без декора (рамка/фон — на content ниже, гаснет ВМЕСТЕ с текстом, не
    // остаётся "сжимающимся цветным ящиком" при сворачивании). position:
    // 'relative' (дефолт View) — handle внутри позиционируется абсолютно
    // относительно этого бокса.
    cardOuter: {
        position: 'relative',
        overflow: 'hidden',
        // height, НЕ auto (2026-10-15, по прямому запросу пользователя —
        // "модалка 5 жёстко зафиксирована прям как панель 11") — ТА ЖЕ
        // константа, что и у зоны 11 (styles.turnBanner, GameBoardScreen.js),
        // вынесена в constants/GameConstants.js специально, чтобы не
        // завести два магических числа одного смысла. justifyContent:
        // 'center' — короткий текст (без выбора) центрируется по высоте;
        // длинный (2+ строки, например результат коллизии) обрезается
        // overflow:hidden СВЕРХУ И СНИЗУ поровну, не раздувая карточку —
        // тот же компромисс, что уже принят для зоны 11.
        height: TURN_BANNER_MIN_HEIGHT,
        justifyContent: 'center',
        // Фон/рамка — ПОСТОЯННЫЕ, не анимируются и не гаснут (см. docstring
        // у JSX выше) — свёрнутое состояние выглядит как узкая полоска В ТОМ
        // ЖЕ стиле модалки, не прозрачная пустота.
        //
        // ПОПЫТКА 2026-10-15 вынести рамку в отдельный absoluteFill-оверлей
        // (чтобы handle позиционировался строго по истинному внешнему краю,
        // не по padding-краю за вычетом рамки) — ОТКАЧЕНА тем же заходом:
        // живая проверка на телефоне показала, что после этого исчезал ВЕСЬ
        // контент модалки целиком (и развёрнутой, и свёрнутой) — настоящая
        // причина не установлена, вероятно что-то в связке overflow:hidden+
        // absoluteFillObject-сосед на Android, не выяснялось подробно, чтобы
        // не блокировать тестирование пользователя. Рамка временно снова
        // здесь, ПРЯМО на cardOuter — известный побочный эффект: мигающая
        // область ручки (PulseHighlight) на 2px меньше истинного видимого
        // контура (borderWidth сдвигает containing-block для position:
        // absolute потомков на свою толщину) — отложено, не блокирует
        // функциональность, просто на 2px неточно по контуру.
        backgroundColor: colors.overlayPlate,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: colors.neonCyan,
    },
    content: {},
    // Внутренний отступ со стороны ручки (COLLAPSED_WIDTH) — чтобы текст/
    // кнопки не заезжали под неё, пока развёрнуто; с противоположной стороны
    // — обычный горизонтальный паддинг. flexDirection:'row' (2026-10-15, по
    // прямому запросу пользователя — "текст слева, кнопки справа, как в
    // панельке Твой ход") — было column (текст сверху по центру, кнопки
    // рядом ниже).
    // paddingVertical: spacing.xs, НЕ spacing.lg (2026-10-15, живая жалоба
    // пользователя — "текст не помещается, вторая строка обрезается") —
    // после фикса высоты cardOuter на константу (TURN_BANNER_MIN_HEIGHT,
    // 64/78px) старый вертикальный паддинг в spacing.lg (20+20=40px) съедал
    // БОЛЬШЕ ПОЛОВИНЫ бокса, оставляя контенту всего ~24px на native — туда
    // не помещалась даже ОДНА кнопка (minHeight:40 у styles.button), не то
    // что текст в 2 строки. Горизонтальный паддинг (spacing.lg/COLLAPSED_WIDTH)
    // не трогали — он не конкурирует с высотой.
    chromeInsetLeft: { paddingVertical: spacing.xs, paddingRight: spacing.lg, paddingLeft: spacing.lg + COLLAPSED_WIDTH, flexDirection: 'row', alignItems: 'center' },
    chromeInsetRight: { paddingVertical: spacing.xs, paddingLeft: spacing.lg, paddingRight: spacing.lg + COLLAPSED_WIDTH, flexDirection: 'row', alignItems: 'center' },
    // flex:1 — текст забирает всю ширину строки, ОСТАВШУЮСЯ после кнопок
    // (те не сжимаются, см. buttonRow/button ниже) — тот же приём, что у
    // turnHintFlex в GameBoardScreen.js. textCenter — ТОЛЬКО для безкнопочных
    // уведомлений (см. место применения в JSX выше).
    // fontSize — чуть меньше дефолтного font.body (2026-10-15, по прямому
    // запросу пользователя), но не вплоть до font.tiny(12) панели "Твой
    // ход" — та держит ОДНУ короткую строку-подсказку, тут текст бывает
    // целым предложением (например, результат коллизии), font.tiny читался
    // бы слишком мелко для такой длины.
    text: {
        color: colors.textOnDark,
        fontSize: font.small,
        flex: 1,
    },
    textCenter: { textAlign: 'center' },
    // Кнопки — ТОЧНО тот же размер, что уже использует компактный вариант
    // кнопок в панели "Твой ход" (turnSkipBtnCompact/collisionBtnText,
    // GameBoardScreen.js) — ТОЛЬКО как стартовая точка, дальше по прямому
    // запросу пользователя увеличена высота: "сейчас они прямоугольные,
    // сделай квадратными" — minHeight/minWidth сравнялись (40), короткие
    // ✓/✕/↻ теперь честный квадрат; длинные текстовые ("Скип", "Бонус +N")
    // по-прежнему шире квадрата (текст тянет минимум ширины дальше) — это
    // ожидаемо, строка одна, не переносится, квадрат имел смысл только как
    // целевая форма для однознаковых кнопок.
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginLeft: spacing.sm,
    },
    // 2026-10-17, веб-only (buttonsOnLeft) — кнопки рендерятся ДО текста,
    // значит зазор нужен с ПРОТИВОПОЛОЖНОЙ стороны (между кнопками и
    // текстом, который теперь справа), а не marginLeft от buttonRow выше
    // (тот создавал бы зазор со стороны ручки, а не со стороны текста).
    buttonRowLeft: { marginLeft: 0, marginRight: spacing.sm },
    button: { minHeight: 40, minWidth: 40, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
    buttonText: { fontSize: font.tiny, fontWeight: '600' },
    // Ручка — БЕЗ своей отдельной заливки (видна и развёрнутой, и свёрнутой
    // — в обоих случаях сидит на персистентном фоне cardOuter, см. выше, не
    // прозрачная дыра в доску). top:0+bottom:0 тянет её на всю высоту
    // cardOuter — та теперь ЖЁСТКАЯ (TURN_BANNER_MIN_HEIGHT, см. cardOuter
    // выше, 2026-10-15), раньше была auto-height от содержимого. Более
    // ранняя попытка (тот же день) заменить stretch на явную измеренную
    // высоту через onLayout/contentHeight-state — откачена, живая проверка
    // показала исчезновение всего контента модалки (та попытка совпала с
    // выносом рамки в отдельный слой, см. cardOuter выше) — ЭТА правка
    // (просто статичная константа в height, без onLayout и без выноса
    // рамки) технически другая и ожидаемо безопаснее, но саму попытку
    // (другого рода) в прошлый раз уже один раз откатывали — проверить
    // живьём первым делом. Известный побочный эффект — мигающая область
    // (PulseHighlight) на 2px меньше истинного контура карточки (border
    // сдвигает containing-block) — не блокирует функциональность, отложено.
    handle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: COLLAPSED_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
    },
    handleLeft: { left: 0 },
    handleRight: { right: 0 },
    arrow: {
        color: colors.neonCyan,
        fontSize: font.h3,
        fontWeight: 'bold',
    },
});
