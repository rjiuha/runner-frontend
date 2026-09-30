// src/components/game/AbilityZone.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PulseHighlight from '../ui/PulseHighlight';
import FramePanel, { frameNotchRadius } from '../ui/FramePanel';
import {
    FRAME_PANEL_BACKGROUND,
    FRAME_PANEL_BACKGROUND_CORNER,
    PLAYER_ABILITIES,
    PLAYER_ABILITY_ICONS,
} from '../../constants/GameConstants';
import { colors, spacing } from '../../theme';

// Platform.OS не меняется в течение жизни приложения — модульная константа
// (тот же приём, что isAndroid в RunnerCard.js/DiceTray.js).
const isAndroid = Platform.OS === 'android';
// Вынесено из styles.iconCompact (2026-09-26) — нужно ЧИСЛОМ для расчёта
// sizeScale-роста (см. проп sizeScale/место рендера иконки ниже), не только
// как style-константа. Было 34 — увеличено 2026-10-01 по прямому запросу
// пользователя ("усиления сделай крупнее"), заодно с переходом кубиков хода
// на один ряд (DiceTray.js) и rightColumn на полную ширину (PlayerInfoPanel.js
// #rightScale, scaleY-only) — теперь в правой колонке появилось освободившееся
// место по высоте под более крупную иконку.
const ICON_SIZE_COMPACT = 44;
// Ширина зоны в vertical-раскладке — ТОЛЬКО ФОЛБЭК (2026-10-01, живая жалоба
// с реального устройства): раньше это была НЕЗАВИСИМАЯ константа, единственный
// источник истины. На реальном устройстве (другая ширина rightColumn, не
// такая, под которую эта константа когда-то подбиралась на эмуляторе) зона
// перестала помещаться в колонку. Теперь ширину явно считает и присылает
// PlayerInfoPanel.js пропом `zoneWidth` (от РЕАЛЬНО измеренной ширины общей
// плитки dATile, см. её докстринг) — эта константа остаётся только на
// лендскейп-раскладку (`zoneWidth` туда не передаётся) и как временное
// значение до первого измерения. Размер иконки (`iconSizeVertical` ниже)
// по-прежнему считается от РЕАЛЬНО отрендеренной ширины зоны (`zoneSize`,
// `onLayout`) — какой бы источник ни определил саму ширину зоны, эта цепочка
// не меняется.
const ABILITY_ZONE_WIDTH_COMPACT = 60;

/**
 * Зона-цель для перетаскивания кубика. Сама зона не решает, подходит ли ей
 * кубик, — только измеряет себя в оконных координатах (measureInWindow) и
 * подсвечивается по hoverState, который считает PlayerInfoPanel.
 * Тап по уже занятой зоне снимает с неё кубик обратно в трей.
 *
 * `pulseHighlight` (2026-09-14, по прямому запросу пользователя) — во время
 * ABILITY, пока игрок тащит кубик, у зон, куда ЭТОТ конкретный кубик реально
 * подходит по номиналу (min/max, см. PlayerInfoPanel), медленно "дышит"
 * зелёная рамка — гасится для уже занятых зон и для той, что под курсором
 * прямо сейчас (hoverState там уже даёт более сильную обратную связь).
 *
 * `remeasureTick` — живой прогон вскрыл реальный баг: зона лежит внутри
 * скроллящегося списка (та же ScrollView, что и карточки бегунов, см.
 * PlayerInfoPanel), а onLayout НЕ перевызывается при простой прокрутке
 * контента — после скролла закешированные оконные координаты уезжают
 * относительно реальной позиции, и подсветка/дроп попадает в СОСЕДНЮЮ зону
 * (жалоба пользователя: "перетащил на одно усиление, подсвечивается то, что
 * снизу" — ровно офсет на высоту одной зоны). Тот же паттерн, что уже был
 * починен для RunnerCard — меняющееся значение триггерит повторный measure.
 */
// React.memo (2026-09-19, живая жалоба "тормозит при перетаскивании кубика
// по плиткам") — тот же приём и та же причина, что и у RunnerCard.js#
// React.memo: каждая зона — до ~114 дочерних <Image> из-за FramePanel,
// без memo все 4 зоны заново реконсилировались на КАЖДЫЙ hover/pulse-тик
// панели, даже когда их СОБСТВЕННЫЕ пропсы не менялись.
function AbilityZone({
    abilityKey,
    assignedDice,
    hoverState,
    onMeasured,
    onPress,
    remeasureTick = 0,
    compact = false,
    vertical = false,
    color,
    pulseHighlight = false,
    // zoneWidth (2026-10-01, прямой запрос пользователя — реальное
    // устройство, "усиления вышли за пределы колонки") — та же причина и тот
    // же фикс, что уже применён к рамке кубиков хода
    // (PlayerInfoPanel.js#diceTrayWidthCompact): раньше ширина зоны в
    // vertical-раскладке была НЕЗАВИСИМОЙ константой (ABILITY_ZONE_WIDTH_
    // COMPACT), настроенной под конкретный эмулятор — на реальном экране с
    // другой шириной rightColumn эта константа могла не поместиться. Теперь
    // PlayerInfoPanel.js измеряет ОБЩУЮ плитку (dATileSize) и явно считает,
    // сколько места реально остаётся усилениям ПОСЛЕ рамки кубиков — эта
    // величина прилетает сюда пропом. `null` (лендскейп-раскладка ИЛИ ещё
    // не измерено на первом кадре) — падаем на старую константу ниже.
    zoneWidth = null,
    // zoneHeight (2026-10-01, живая жалоба "усиления НЕ прижаты друг к
    // другу") — явная высота ОДНОГО слота (dATileRowHeight/4 от
    // PlayerInfoPanel.js), заменяет натуральную высоту контента (иконка+
    // паддинг) + `justifyContent:'space-between'` на gridVertical
    // (AbilityZones.js), который раньше растягивал излишек в зазоры МЕЖДУ
    // зонами. Зона теперь занимает РОВНО свою долю колонки — 4 зоны подряд
    // без зазоров. `null` — лендскейп-раскладка или ещё не измерено.
    zoneHeight = null,
    // Авто-РОСТ compact-колонки (2026-09-26, см. PlayerInfoPanel.js#rightGrow
    // за полным разбором) — >1, когда контента МЕНЬШЕ реально доступной
    // высоты правой колонки. Зона сама шириной 48% родителя (см.
    // styles.zone) — растёт ВМЕСТЕ с родителем при желании, но иконка внутри
    // неё фиксированного пиксельного размера, поэтому именно ЕЙ нужен явный
    // множитель, чтобы визуально расти вместе с высотой зоны. Клэмп по
    // ширине тут не нужен (в отличие от RunnerCard.js) — зона занимает 48%
    // ширины колонки НЕЗАВИСИМО от размера иконки, а иконка (34px в
    // compact) занимает от силы половину этой зоны — запас по ширине
    // заведомо больше, чем разумный рост от нехватки высоты.
    sizeScale = 1,
}) {
    const ref = useRef(null);
    const ability = PLAYER_ABILITIES[abilityKey];
    // Размер зоны для FramePanel (см. её докстринг) — тот же приём, что уже
    // применён в RunnerCard.js: FramePanel больше не растягивается сам через
    // StyleSheet.absoluteFill (на Android либо не рендерился вовсе, либо не
    // масштабировался — живые жалобы "рамки нет вообще"/"не в масштабе"),
    // размер приходит явно. Зона тут ПЕРЕМЕННОЙ ширины (48%), константой не
    // обойтись.
    //
    // **`onLayout`, НЕ `measureInWindow`** (2026-09-26, живая жалоба на
    // реальном устройстве после введения авто-масштабирования колонок —
    // "рамки усилений висят в воздухе, иконки вне рамок"). Причина: колонка
    // теперь может быть обёрнута в `transform:scale` (см. leftScale/rightScale
    // в PlayerInfoPanel.js) — `measureInWindow` (в отличие от `onLayout`)
    // отражает УЖЕ применённый scale родителя, а не натуральный layout-размер.
    // Раз FramePanel рисуется ВНУТРИ той же масштабируемой колонки, передача
    // ему уже уменьшенного (post-scale) `size` даёт ДВОЙНОЕ уменьшение — сама
    // рамка ужимается transform'ом ЕЩЁ РАЗ поверх уже уменьшенных пиксельных
    // размеров, а иконка (у неё фиксированный style-размер, см. styles.icon
    // ниже) уменьшается только транформом один раз — рамка и иконка
    // расходятся. `onLayout` (как и `leftContentH`/`rightContentH` в
    // PlayerInfoPanel.js) отдаёт НАТУРАЛЬНЫЙ, transform-independent размер —
    // ровно то, что нужно декоративной рамке (сама она потом корректно
    // ужимается ОДИН раз вместе со всем остальным содержимым той же
    // transform-колонки).
    const [zoneSize, setZoneSize] = useState(null);

    // Хит-тест дропа кубика (zoneLayoutsRef в PlayerInfoPanel.js) — ЕДИНСТВЕННЫЙ
    // оставшийся потребитель measureInWindow: ему НУЖНЫ реальные оконные
    // координаты (сравниваются с абсолютными координатами жеста), в том числе
    // корректно уменьшенные/сдвинутые transform'ом — тут measureInWindow ведёт
    // себя ровно так, как нужно, не трогаем.
    const measure = useCallback(() => {
        // requestAnimationFrame — см. тот же приём и объяснение в RunnerCard.js.
        // Плюс отложенный ПОВТОРНЫЙ замер (setTimeout) — узкая подстраховка
        // ТОЛЬКО для этого компонента: после добавления иконки усиления
        // (Image, см. ниже) бокс зоны стал заметно выше (была 1-2 строки
        // текста, теперь иконка + 2 строки) — живая жалоба пользователя,
        // 2026-09-19: "на Android неверно определяется момент попадания
        // кубика на плитку усиления". Гипотеза (НЕ подтверждена живьём, нет
        // доступа к устройству в этой сессии): один requestAnimationFrame
        // может не хватить Android'у, чтобы "устаканить" ВЫРОСШИЙ layout
        // (тот же класс бага уже не раз ловился в этом проекте, см. коммент
        // в RunnerCard.js) — тогда первый measureInWindow уносит координаты
        // ОТ ПРЕЖНЕГО, более низкого бокса. Второй замер безопасен в любом
        // случае — если первый уже был точным, повторный просто перезапишет
        // ТЕМ ЖЕ значением.
        const run = () => {
            ref.current?.measureInWindow((x, y, width, height) => {
                onMeasured(abilityKey, { x, y, width, height });
            });
        };
        requestAnimationFrame(run);
        setTimeout(run, 150);
    }, [abilityKey, onMeasured]);

    const handleLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setZoneSize({ width, height });
        measure();
    }, [measure]);

    useEffect(() => {
        if (remeasureTick) measure();
    }, [remeasureTick, measure]);

    const filled = assignedDice != null;
    // Раньше занятость/hover рисовались сменой цвета РАМКИ TouchableOpacity —
    // теперь саму рамку рисует декоративный FramePanel (см. ниже), так что
    // тот же сигнал переехал на полупрозрачную ЗАЛИВКУ поверх него (цвет
    // игрока при занятой зоне — тот же приём "${color}b8", что и раньше;
    // зелёная/красная для hover — та же альфа, что уже была у бордера).
    const overlayColor = filled
        ? `${color}b8`
        : hoverState === 'valid' ? `${colors.success}40`
        : hoverState === 'invalid' ? `${colors.danger}33`
        : null;

    // AbilityZone сам передаёт СВОЙ abilityKey наружу — AbilityZones.js
    // передаёт onPress СТАБИЛЬНОЙ ссылкой (не инлайн `() => onPressZone(key)`
    // на каждый рендер), см. докстринг RunnerCard.js#React.memo за полным
    // разбором того же паттерна и живой жалобы, которая его вызвала.
    const handlePress = useCallback(() => onPress?.(abilityKey), [onPress, abilityKey]);
    // Тот же targetCornerSize=8, что передан в FramePanel ниже — см.
    // frameNotchRadius() в FramePanel.js за разбором.
    const notchRadius = frameNotchRadius(zoneSize, 8);
    // Размер иконки в vertical-раскладке — от РЕАЛЬНО измеренного zoneSize
    // (2026-10-01, прямой запрос пользователя, тот же приём, что и у кубиков
    // хода — см. докстринг ABILITY_ZONE_WIDTH_COMPACT выше). Формула в два
    // слоя, ТА ЖЕ, что и у compactMoveDiceSize в PlayerInfoPanel.js: (1)
    // вычитаем РЕАЛЬНЫЙ paddingHorizontal самой зоны (`zoneVertical`,
    // spacing.sm — та же константа, что и в её стиле, не отдельное число);
    // (2) доп. запас ×0.85 конкретно под диагональное срезание у
    // скруглённого угла декоративной рамки (FramePanel, targetCornerSize=8)
    // — паддинг из шага (1) достаточен вдоль ПРЯМЫХ краёв, но не у самого
    // угла. Потолок — ICON_SIZE_COMPACT, иконка никогда не растёт крупнее
    // задуманного. До первого onLayout (zoneSize ещё null) — тот же потолок.
    // Потолок ПО ВЫСОТЕ — 2026-10-01, прямой запрос пользователя ("а для 4
    // усилений сложно сделать ту же механику масштабирования с делением
    // общей высоты на 4?") — та же формула-паттерн, что уже применена к
    // кубикам хода (PlayerInfoPanel.js#compactMoveDiceSize): `Math.min` по
    // ОБЕИМ осям, не только по ширине. Делить на 4 тут заново не нужно —
    // `zoneSize.height` УЖЕ является высотой ОДНОГО слота (PlayerInfoPanel.js
    // сама делит общую высоту дорожки на 4 и отдаёт explicit `zoneHeight`
    // каждой зоне, см. её докстринг) — это тот самый результат деления,
    // просто измеренный постфактум через `onLayout`, а не взятый как готовое
    // число. paddingVertical (`styles.zone`, spacing.xs) вычитается той же
    // логикой, что и paddingHorizontal у ширины выше.
    const iconSizeVertical = zoneSize
        ? Math.min(
            ICON_SIZE_COMPACT,
            Math.floor((zoneSize.width - spacing.sm * 2) * 0.85),
            Math.floor((zoneSize.height - spacing.xs * 2) * 0.85),
        )
        : ICON_SIZE_COMPACT;

    return (
        <TouchableOpacity
            ref={ref}
            onLayout={handleLayout}
            onPress={filled ? handlePress : undefined}
            activeOpacity={filled ? 0.7 : 1}
            style={[
                styles.zone,
                compact && styles.zoneCompact,
                vertical && styles.zoneVertical,
                vertical && zoneWidth != null && { width: zoneWidth },
                vertical && zoneHeight != null && { height: zoneHeight, justifyContent: 'center' },
            ]}
        >
            {/* targetCornerSize=8 (было 12, дефолт) — 2026-09-20, живая жалоба
                "рамка усилений/кубиков касается рамки общей плитки на
                Android" (см. PlayerInfoPanel.js#diceTrayWrap за тем же
                фиксом и полным разбором, почему тут правится толщина
                декоративной дуги, а не padding общей плитки — та не должна
                расти). Сам бокс зоны (zoneSize) не меняется.
                backgroundSource/backgroundCornerSource/backgroundTileSize —
                ЧЁРНЫЙ фон АВАТАРА бегуна (FRAME_PANEL_BACKGROUND, тот же
                override и то же backgroundTileSize=60, что и в RunnerCard.js
                для avatarBox), НЕ дефолт FramePanel (PERSON_PANEL_BACKGROUND
                — тёмно-серо-синий фон КОРПУСА карточки, был тут раньше) —
                уточнение пользователя, 2026-09-20: "фон как у аватарки
                бегунов, он у них чёрный", а не как у корпуса карточки. */}
            <FramePanel
                size={zoneSize}
                targetCornerSize={8}
                backgroundSource={FRAME_PANEL_BACKGROUND}
                backgroundCornerSource={FRAME_PANEL_BACKGROUND_CORNER}
                backgroundTileSize={60}
            />
            {/* borderRadius — frameNotchRadius(zoneSize, 8), та же величина,
                что FramePanel сам использует для своего wrap (см. её
                докстринг, 2026-09-26) — без него заливка рисовалась острым
                углом ПОВЕРХ скруглённой рамки, живая жалоба пользователя
                "у контейнера и у рамки не совпадают углы по скруглённости". */}
            {overlayColor && (
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, borderRadius: notchRadius }]} />
            )}
            <PulseHighlight
                active={pulseHighlight && !filled && hoverState == null}
                borderRadius={notchRadius}
                borderWidth={2}
            />
            {/* Иконка — фиксированный бокс + resizeMode="contain": исходные
                ассеты РАЗНОГО размера/пропорций (aid.png 77×78, speed.png
                138×105, drone.png 186×107, ghost.png 125×144) — contain в
                одинаковом боксе даёт им визуально одну и ту же "рамку"
                размера, по прямому запросу пользователя.
                Текстовое название усиления (ability.label — "БУСТ"/"ЛЕЧЕНИЕ"/
                "ЖНЕЦ"/"ПРИЗРАК") УБРАНО (2026-09-19, по прямому запросу
                пользователя — "пусть их место займут изображения") — иконка
                увеличена (см. styles.icon/iconCompact), занимает
                освободившееся место. hint (диапазон кубика) оставлен — это
                функциональная информация, не название. */}
            <Image
                source={PLAYER_ABILITY_ICONS[abilityKey]}
                style={[
                    styles.icon,
                    compact && styles.iconCompact,
                    compact && sizeScale !== 1 && {
                        width: Math.round(ICON_SIZE_COMPACT * sizeScale),
                        height: Math.round(ICON_SIZE_COMPACT * sizeScale),
                    },
                    // vertical — ПОСЛЕДНИЙ в массиве (высший приоритет),
                    // 2026-10-01: перекрывает и iconCompact, и sizeScale —
                    // размер иконки тут решает ТОЛЬКО iconSizeVertical (см.
                    // её докстринг), реально измеренный от zoneSize.
                    vertical && { width: iconSizeVertical, height: iconSizeVertical },
                    isAndroid && styles.iconNoHint,
                ]}
                resizeMode="contain"
            />
            {/* Подсказка (диапазон кубика) убрана на Android целиком, включая
                цифры (2026-09-20, по прямому запросу пользователя) — иконка
                уже даёт основную информацию, а текстовые элементы поверх
                декоративных FramePanel/PersonPanel на Android и так были
                источником нескольких живых жалоб в этом файле. Веб/iOS не
                тронуты — там подсказка остаётся. */}
            {!isAndroid && (
                <Text style={styles.hint} noGlobalTint>{compact ? ability.shortHint : ability.hint}</Text>
            )}
            {/* Число/галочка при занятой зоне убраны целиком (были — только
                для Лечения, min===max) по прямому запросу пользователя,
                2026-09-01: подсветка (заливка выше) уже сама по себе
                однозначно показывает занятость, а любой доп. элемент,
                появляющийся/исчезающий вместе с filled, менял высоту зоны —
                "чтобы не менять размерность области". */}
        </TouchableOpacity>
    );
}

export default React.memo(AbilityZone);

const styles = StyleSheet.create({
    // Рамку/фон теперь рисует декоративный FramePanel (absoluteFill, самый
    // нижний слой) — zone остаётся только позиционером контента, своей
    // рамки/фона больше не задаёт.
    zone: {
        width: '48%',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    // compact (compactColumns, портретная раскладка) — ужимаем зону усилений:
    // без подсказки (hint) и мельче шрифт заголовка, по прямому запросу
    // пользователя "ужать пространство под усиления".
    zoneCompact: { paddingVertical: 4 },
    // Столбик (2026-10-01, ДВА захода подряд):
    // (1) БЫЛ width:'100%' (растягивался на всю ширину столбца-контейнера,
    // см. AbilityZones.js), живая жалоба СРАЗУ после ("почему рамка
    // усиления такая широкая") — `abilitiesWrapCompact` в PlayerInfoPanel.js
    // забирает ВЕСЬ остаток ширины ряда (flex:1), а width:'100%' растягивал
    // ДЕКОРАТИВНУЮ РАМКУ зоны на всю эту ширину — рамка становилась
    // огромной, иконка терялась в её центре.
    // (2) Дал явную ширину, СЧИТАННУЮ от размера иконки (в обратную
    // сторону) — живая жалоба СРАЗУ после ("усиления выпирают за пределы
    // панели") — та формула не видела ни собственный paddingHorizontal
    // `zone` (4px, меньше толщины декоративного уголка — 8px), ни
    // диагональное срезание у самого угла. Теперь НАОБОРОТ (см.
    // ABILITY_ZONE_WIDTH_COMPACT/iconSizeVertical в компоненте выше) —
    // ширина зоны ПЕРВИЧНА, иконка считается ОТ НЕЁ. paddingHorizontal
    // здесь — spacing.sm (было spacing.xs у базового `zone`, не хватало на
    // толщину уголка) — переопределяет `zone`'s paddingHorizontal ТОЛЬКО
    // для vertical-раскладки, не трогая 2×2-сетку (`zoneCompact`).
    // marginBottom:0 — 2026-10-01, живая жалоба "нижняя рамка усиления
    // Призрак не вровень с нижней рамкой кубиков" (верх при этом уже
    // совпадал, см. предыдущий заход): БАЗОВЫЙ `zone` даёт marginBottom
    // ПОД КАЖДОЙ зоной, в т.ч. под ПОСЛЕДНЕЙ — `justifyContent:'space-
    // between'` на gridVertical (AbilityZones.js) уже сам распределяет
    // расстояние между зонами по всей высоте, а этот margin добавлялся
    // ПОВЕРХ, сдвигая нижний край последней зоны ещё немного выше
    // истинного низа контейнера. Обнулён ТОЛЬКО для vertical — 2×2-сетка
    // (`zoneCompact`) не тронута, там margin всё ещё разделяет ряды.
    zoneVertical: { width: ABILITY_ZONE_WIDTH_COMPACT, paddingHorizontal: spacing.sm, marginBottom: 0 },
    // Увеличены (было 34/26) — заняли место убранного текстового названия
    // усиления (см. комментарий у места рендера). 2026-09-26: точечная
    // попытка уменьшить (34→30) под нехватку высоты columns ОТКАЧЕНА — см.
    // тот же комментарий у DiceTray size в PlayerInfoPanel.js, масштабирует
    // теперь всю колонку целиком (leftScale/rightScale), не отдельные
    // константы.
    icon: { width: 44, height: 44, marginBottom: 2 },
    iconCompact: { width: ICON_SIZE_COMPACT, height: ICON_SIZE_COMPACT, marginBottom: 1 },
    // Android — под иконкой больше нет текста (см. рендер выше), лишний
    // нижний отступ иконки не нужен.
    iconNoHint: { marginBottom: 0 },
    hint: { color: colors.textOnDarkSecondary, fontSize: 10, marginTop: 1 },
});
