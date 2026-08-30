// src/components/game/EventLogPanel.js
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Сворачиваемый отладочный лог Mercure-событий партии (см. lib/eventLog.js
 * для форматирования). Свёрнут по умолчанию — просто счётчик-кнопка, не
 * мешает основному UI. Список автоскроллится к последней записи, пока
 * панель открыта.
 *
 * `position` — 'bottom-right' (по умолчанию, альбомная раскладка): плашка в
 * правом нижнем углу, разворачивается ВВЕРХ (панель растёт от кнопки).
 * 'top' (портретная раскладка на вебе/без мобильной рамки): плашка сверху
 * экрана, разворачивается ВНИЗ. 'seam' (мобильная рамка, портрет) — тоггл
 * рендерится БЕЗ своего абсолютного wrapper'а (никакого position:absolute
 * на себе, обычный inline-элемент) — вызывающий код (GameBoardScreen)
 * кладёт его инлайн в общий ряд с кнопками навигации, отцентрированный на
 * стыке рамок; список при открытии — абсолютный дропдаун НАД тогглом
 * (`bottom:'100%'`), не раздувает высоту самого ряда.
 */
export default function EventLogPanel({ entries, position = 'bottom-right' }) {
    const [open, setOpen] = useState(false);
    const scrollRef = useRef(null);
    const isTop = position === 'top';
    const isSeam = position === 'seam';
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
            <Text style={styles.toggleText}>{open ? 'Скрыть лог ▾' : `Лог событий (${entries.length}) ▸`}</Text>
        </TouchableOpacity>
    );

    const list = open && (
        <ScrollView
            ref={scrollRef}
            style={[styles.panel, isSeam ? null : isTop ? styles.panelTop : styles.panelBottom]}
            contentContainerStyle={styles.panelContent}
        >
            {entries.length === 0 ? (
                <Text style={styles.empty}>Событий пока не было</Text>
            ) : (
                entries.map((e) => (
                    <Text key={e.id} style={styles.line}>
                        <Text style={styles.time}>{e.time}</Text> {e.text}
                    </Text>
                ))
            )}
        </ScrollView>
    );

    if (isSeam) {
        return (
            <View style={styles.seamWrapper} pointerEvents="box-none">
                {list && <View style={styles.seamListWrap}>{list}</View>}
                {toggle}
            </View>
        );
    }

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
    // 'seam' — БЕЗ position:'absolute' на себе: это обычный inline-элемент,
    // кладётся вызывающим кодом в свой собственный flex-ряд (GameBoardScreen,
    // seamRow). position:'relative' тут только чтобы список (seamListWrap)
    // мог позиционироваться АБСОЛЮТНО относительно тоггла, не влияя на высоту
    // ряда, в котором он лежит.
    seamWrapper: { position: 'relative', alignItems: 'center' },
    // bottom:'100%' — сразу над тогглом, поверх дорожной сетки. left:'50%' +
    // translateX(-150) — центрирует фиксированную ширину панели (300, см.
    // ниже) под тогглом независимо от его собственной ширины (та зависит от
    // текста и не известна заранее без onLayout).
    seamListWrap: {
        position: 'absolute', bottom: '100%', left: '50%',
        transform: [{ translateX: -150 }], marginBottom: spacing.xs,
    },
    toggle: {
        backgroundColor: colors.bgLight, borderRadius: radius.pill,
        paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    },
    toggleText: { color: colors.textOnDark, fontSize: font.tiny, fontWeight: 'bold' },
    panel: {
        // 300, не 340 — с учётом left/right margin (spacing.md с обеих сторон)
        // должно помещаться и на узких телефонах (~360-380dp шириной), не
        // только на широких экранах, где было 340 изначально.
        width: 300, maxHeight: 260,
        backgroundColor: '#000000cc', borderRadius: radius.md,
    },
    panelBottom: { marginBottom: spacing.xs },
    panelTop: { marginTop: spacing.xs },
    panelContent: { padding: spacing.sm },
    empty: { color: colors.textOnDarkSecondary, fontSize: font.tiny },
    line: { color: colors.textOnDark, fontSize: 10, marginBottom: 3, lineHeight: 14 },
    time: { color: colors.textOnDarkSecondary },
});
