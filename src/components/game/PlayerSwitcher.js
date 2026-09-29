// src/components/game/PlayerSwitcher.js
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PersonPanel, { NOTCH_RADIUS } from '../ui/PersonPanel';
import { colors, font, spacing } from '../../theme';

/**
 * Один таб переключателя — вынесен в отдельный компонент (2026-09-26, по
 * прямому запросу пользователя "оформить табы в рамки аналогично панелям
 * бегунов"), а не инлайн-JSX в `.map()` ниже: PersonPanel (та же декоративная
 * рамка+фон корпуса, что и у RunnerCard/ReaperCard) меряет себя через
 * `size`, ОБЯЗАТЕЛЬНО измеренный СНАРУЖИ (см. её докстринг) — а измерение
 * требует своего state/onLayout НА КАЖДЫЙ таб отдельно (у каждого своя
 * ширина/высота), что per-компонентно организовать проще, чем через хуки
 * внутри `.map()`.
 *
 * `onLayout` (не `measureInWindow`) — у таба нет своего хит-теста/дропа
 * (не зона перетаскивания кубика), значит нет нужды в оконных координатах —
 * тот же случай, что уже решён в ReaperCard.js (см. её докстринг за полным
 * разбором того же выбора).
 */
function PlayerTab({ player, active, onSelect }) {
    const [tabSize, setTabSize] = useState(null);
    const onLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setTabSize({ width, height });
    }, []);

    return (
        <TouchableOpacity
            onPress={() => onSelect(player.id)}
            activeOpacity={0.7}
            onLayout={onLayout}
            style={styles.tab}
        >
            <PersonPanel size={tabSize} />
            {/* borderRadius — NOTCH_RADIUS, та же величина, что PersonPanel
                сам использует для своего клипа (см. её докстринг, тот же
                фикс "заливка/рамка острым углом поверх скруглённой дуги",
                что уже применён в RunnerCard.js/AbilityZone.js). */}
            {active && (
                <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, styles.activeRing, { borderColor: player.color }]}
                />
            )}
            <View style={[styles.dot, { backgroundColor: player.color }, active && styles.dotActive]} />
            <Text
                style={[styles.label, active && { color: player.color, fontWeight: 'bold' }]}
                numberOfLines={1}
                noGlobalTint
            >
                {player.name}
            </Text>
            {active && <View style={[styles.activeBar, { backgroundColor: player.color }]} />}
        </TouchableOpacity>
    );
}

/**
 * Переключатель игроков — таб-бар (кружок цвета игрока + имя, активный таб
 * подсвечен цветом игрока + полоска снизу), по образцу референса от
 * пользователя (нижняя навигация вида Alex/Jordan/Sam/Map). Максимум 4
 * игрока — ряд без скролла, каждый таб делит ширину поровну (`flex:1`).
 * Расположение (сверху панели в альбомной раскладке, снизу в портретной)
 * решает PlayerInfoPanel, сам компонент об ориентации не знает.
 */
export default function PlayerSwitcher({ players, activeId, onSelect }) {
    return (
        <View style={styles.row}>
            {players.map((p) => (
                <PlayerTab key={p.id} player={p} active={p.id === activeId} onSelect={onSelect} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.xs },
    // minWidth:0 — тот же приём, что и везде в проекте (flex:1-элемент иначе
    // не ужимается меньше естественного размера контента, см. RunnerCard.js#
    // cardCompact). paddingHorizontal — контент не должен упираться в
    // декоративную дугу PersonPanel (та же причина, что у RunnerCard.js#
    // styles.card).
    tab: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    activeRing: { borderWidth: 2, borderRadius: NOTCH_RADIUS },
    dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 2, opacity: 0.6 },
    dotActive: { opacity: 1, width: 12, height: 12, borderRadius: 6 },
    label: { color: colors.textOnDarkSecondary, fontSize: font.tiny, fontWeight: '600', maxWidth: 90 },
    activeBar: { height: 2, width: '70%', marginTop: 3, borderRadius: 1 },
});
