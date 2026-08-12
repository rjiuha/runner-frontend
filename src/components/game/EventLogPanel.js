// src/components/game/EventLogPanel.js
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Сворачиваемый отладочный лог Mercure-событий партии (см. lib/eventLog.js
 * для форматирования). Свёрнут по умолчанию — просто счётчик-кнопка в углу,
 * не мешает основному UI. Список автоскроллится к последней записи, пока
 * панель открыта.
 */
export default function EventLogPanel({ entries }) {
    const [open, setOpen] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (open) scrollRef.current?.scrollToEnd({ animated: true });
    }, [entries, open]);

    return (
        <View style={styles.wrapper} pointerEvents="box-none">
            {open && (
                <ScrollView
                    ref={scrollRef}
                    style={styles.panel}
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
            )}

            <TouchableOpacity style={styles.toggle} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
                <Text style={styles.toggleText}>{open ? 'Скрыть лог ▾' : `Лог событий (${entries.length}) ▸`}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute', bottom: spacing.md, right: spacing.md, zIndex: 25, elevation: 25,
        alignItems: 'flex-end',
    },
    toggle: {
        backgroundColor: colors.bgLight, borderRadius: radius.pill,
        paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    },
    toggleText: { color: colors.textOnDark, fontSize: font.tiny, fontWeight: 'bold' },
    panel: {
        marginBottom: spacing.xs, width: 340, maxHeight: 260,
        backgroundColor: '#000000cc', borderRadius: radius.md,
    },
    panelContent: { padding: spacing.sm },
    empty: { color: colors.textOnDarkSecondary, fontSize: font.tiny },
    line: { color: colors.textOnDark, fontSize: 10, marginBottom: 3, lineHeight: 14 },
    time: { color: colors.textOnDarkSecondary },
});
