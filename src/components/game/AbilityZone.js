// src/components/game/AbilityZone.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PulseHighlight from '../ui/PulseHighlight';
import FramePanel from '../ui/FramePanel';
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
    color,
    pulseHighlight = false,
}) {
    const ref = useRef(null);
    const ability = PLAYER_ABILITIES[abilityKey];
    // Размер зоны для FramePanel (см. её докстринг) — тот же приём, что уже
    // применён в RunnerCard.js: FramePanel больше не растягивается сам через
    // StyleSheet.absoluteFill (на Android либо не рендерился вовсе, либо не
    // масштабировался — живые жалобы "рамки нет вообще"/"не в масштабе"),
    // размер приходит явно. Зона тут ПЕРЕМЕННОЙ ширины (48%), константой не
    // обойтись — берём из ТОГО ЖЕ measureInWindow, что уже есть ниже.
    const [zoneSize, setZoneSize] = useState(null);

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
                setZoneSize({ width, height });
            });
        };
        requestAnimationFrame(run);
        setTimeout(run, 150);
    }, [abilityKey, onMeasured]);

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

    return (
        <TouchableOpacity
            ref={ref}
            onLayout={measure}
            onPress={filled ? handlePress : undefined}
            activeOpacity={filled ? 0.7 : 1}
            style={[styles.zone, compact && styles.zoneCompact]}
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
            {/* borderRadius — та же величина, что у FramePanel.js#styles.wrap
                (радиус, по которому та обрезает свою заливку под скруглённой
                декоративной дугой) — без него заливка рисовалась острым
                углом ПОВЕРХ скруглённой рамки, живая жалоба пользователя
                "у контейнера и у рамки не совпадают углы по скруглённости". */}
            {overlayColor && (
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, borderRadius: 4 }]} />
            )}
            {/* borderRadius=4 — та же величина, что у FramePanel.js#styles.wrap
                (было radius.md=8, тот же рассинхрон, что и у overlayColor
                выше). */}
            <PulseHighlight
                active={pulseHighlight && !filled && hoverState == null}
                borderRadius={4}
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
            <Image source={PLAYER_ABILITY_ICONS[abilityKey]} style={[styles.icon, compact && styles.iconCompact, isAndroid && styles.iconNoHint]} resizeMode="contain" />
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
    // Увеличены (было 34/26) — заняли место убранного текстового названия
    // усиления (см. комментарий у места рендера).
    icon: { width: 44, height: 44, marginBottom: 2 },
    iconCompact: { width: 34, height: 34, marginBottom: 1 },
    // Android — под иконкой больше нет текста (см. рендер выше), лишний
    // нижний отступ иконки не нужен.
    iconNoHint: { marginBottom: 0 },
    hint: { color: colors.textOnDarkSecondary, fontSize: 10, marginTop: 1 },
});
