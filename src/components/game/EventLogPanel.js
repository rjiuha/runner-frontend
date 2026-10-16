// src/components/game/EventLogPanel.js
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Содержимое выпадающего лога — ТОЛЬКО список записей, без тоггла/позиции.
 * Вынесено отдельно (2026-10-15), чтобы GameBoardScreen.js мог переиспользовать
 * РОВНО тот же рендер/стили для mobileNav-варианта (см. её докстринг и
 * EVENT_LOG_PANEL_STYLE ниже за тем, почему тот вариант не живёт в этом файле).
 */
export function EventLogEntries({ entries }) {
    return entries.length === 0 ? (
        <Text style={styles.empty} noGlobalTint>Событий пока не было</Text>
    ) : (
        entries.map((e) => (
            <Text key={e.id} style={styles.line} noGlobalTint>
                <Text style={styles.time} noGlobalTint>{e.time}</Text> {e.text}
            </Text>
        ))
    );
}

// Общий вид плашки списка (фон/размер/паддинг) — переиспользуется GameBoardScreen.js
// для mobileNav-варианта (см. EventLogEntries выше), чтобы оба места не
// разъезжались по двум копиям одних и тех же чисел.
export const EVENT_LOG_PANEL_STYLE = {
    width: 300, maxHeight: 260,
    backgroundColor: '#000000cc', borderRadius: radius.md,
};

/**
 * Сворачиваемый отладочный лог Mercure-событий партии (см. lib/eventLog.js
 * для форматирования). Свёрнут по умолчанию — просто счётчик-кнопка, не
 * мешает основному UI. Список автоскроллится к последней записи, пока
 * панель открыта.
 *
 * `position` — 'bottom-right' (по умолчанию, альбомная раскладка): плашка в
 * правом нижнем углу, разворачивается ВВЕРХ (панель растёт от кнопки). 'top'
 * (портретная раскладка на вебе/без мобильной рамки): плашка сверху экрана,
 * разворачивается ВНИЗ.
 *
 * **mobileNav-портрет (бывший 'seam') здесь БОЛЬШЕ НЕ ЖИВЁТ (2026-10-15,
 * после серии живых багов на реальном устройстве)** — см. GameBoardScreen.js
 * за текущей реализацией и полным разбором того, почему она переехала целиком
 * туда, а не осталась тут третьим `position`:
 *   1. Первая версия ('seam' тут же, дропдаун `position:'absolute'`+
 *      `zIndex` рядом с тогглом) — список не рисовался поверх остального UI
 *      (панели/дороги). Причина: в React Native (в отличие от веба) `zIndex`
 *      сортирует ТОЛЬКО прямых соседей по одному родителю, не "пробивает"
 *      поддеревья произвольной глубины — а тоггл лежит глубоко внутри
 *      `PlayerInfoPanel`, список должен перекрыть СОВСЕМ другие поддеревья
 *      экрана.
 *   2. Вторая версия — список через системный `<Modal transparent>` (тот
 *      примитив, что и правда всегда рисуется отдельным слоем НАД всем
 *      деревом, независимо от вложенности). Это решило (1), но породило
 *      НОВЫЙ живой баг: Android `<Modal>` — это отдельное НАТИВНОЕ окно,
 *      которое перехватывает тач для всей area, которую накрывает, НА
 *      УРОВНЕ ОС — `pointerEvents="box-none"` тут бессильна (это
 *      JS-хиттестинг ВНУТРИ дерева React Native, а не между независимыми
 *      нативными окнами). Кнопка-тоггл, оставшаяся СНАРУЖИ модалки (в
 *      основном окне), физически переставала быть кликабельной, пока
 *      модалка открыта — лог переставал закрываться повторным тапом по той
 *      же кнопке. Этот класс проблемы уже был задокументирован в
 *      GameDialogModal.js ("НЕ системный RN `<Modal>` — тот
 *      затемняет/блокирует весь экран") — своё же предупреждение было
 *      проигнорировано, баг повторился.
 *   3. Финал (по прямому требованию пользователя — "не дублировать модалки,
 *      просто окошко с приоритетным порядком прорисовки") — ни `position`
 *      этого файла, ни Modal: кнопка и дропдаун оба живут в GameBoardScreen.js,
 *      кнопка — инлайн в своём ряду (как раньше), а список — ПОСЛЕДНИМ
 *      ребёнком САМОГО КОРНЯ экрана (после всего остального JSX, то же окно,
 *      без Modal) — на эту глубину зависеть от "пробивания" зависимых
 *      поддеревьев не нужно: это обычное "более поздний сосед рисуется
 *      поверх уже отрисованного" поведение RN, его не нужно подпирать
 *      экзотикой. Позиция — `measureInWindow` на тоггле (та же техника, что
 *      уже планировалась для вариантов 1-2, тут наконец пригодилась без
 *      сопутствующих проблем).
 */
export default function EventLogPanel({ entries, position = 'bottom-right' }) {
    const [open, setOpen] = useState(false);
    const scrollRef = useRef(null);
    const isTop = position === 'top';
    // GameBoardScreen сознательно без SafeAreaView (см. его шапку) — без
    // этого top:spacing.md рисовал плашку ПОД статус-баром/чёлкой телефона
    // (жалоба пользователя — лог наезжал туда же, где часы). insets.top уже
    // учитывает статус-бар, spacing.sm — дополнительный зазор от его низа.
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (open) scrollRef.current?.scrollToEnd({ animated: true });
    }, [entries, open]);

    const toggle = (
        <TouchableOpacity style={styles.toggle} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
            <Text style={styles.toggleText} noGlobalTint>{open ? 'Скрыть лог ▾' : `Лог событий (${entries.length}) ▸`}</Text>
        </TouchableOpacity>
    );

    const list = open && (
        <ScrollView
            ref={scrollRef}
            style={[styles.panel, isTop ? styles.panelTop : styles.panelBottom]}
            contentContainerStyle={styles.panelContent}
        >
            <EventLogEntries entries={entries} />
        </ScrollView>
    );

    return (
        <View
            style={[
                styles.wrapper,
                isTop ? [styles.wrapperTop, { top: insets.top + spacing.sm }] : styles.wrapperBottomRight,
            ]}
            pointerEvents="box-none"
        >
            {isTop ? (
                <>
                    {toggle}
                    {list}
                </>
            ) : (
                <>
                    {list}
                    {toggle}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapperBottomRight: {
        position: 'absolute', bottom: spacing.md, right: spacing.md, zIndex: 25, elevation: 25,
        alignItems: 'flex-end',
    },
    // top — задаётся динамически (insets.top+spacing.sm, см. компонент), тут
    // только то, что не зависит от safe-area.
    wrapperTop: {
        position: 'absolute', left: spacing.md, zIndex: 25, elevation: 25,
        alignItems: 'flex-start',
    },
    toggle: {
        backgroundColor: colors.bgLight, borderRadius: radius.pill,
        paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    },
    toggleText: { color: colors.textOnDark, fontSize: font.tiny, fontWeight: 'bold' },
    panel: EVENT_LOG_PANEL_STYLE,
    panelBottom: { marginBottom: spacing.xs },
    panelTop: { marginTop: spacing.xs },
    panelContent: { padding: spacing.sm },
    empty: { color: colors.textOnDarkSecondary, fontSize: font.tiny },
    line: { color: colors.textOnDark, fontSize: 10, marginBottom: 3, lineHeight: 14 },
    time: { color: colors.textOnDarkSecondary },
});
