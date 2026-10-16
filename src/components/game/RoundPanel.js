// src/components/game/RoundPanel.js
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PersonPanel from '../ui/PersonPanel';
import { colors, font, spacing } from '../../theme';

/**
 * Панель номера раунда — третий сосед ReaperCard/RoadBonusPanel в общем ряду
 * над карточками бегунов (см. PlayerInfoPanel#reaperNode), по прямому
 * запросу пользователя 2026-10-01: "над атлетом сделай новую панель, там
 * покажи номер раунда". Квадрат шириной `panelSize` (та же величина
 * `cardWidth`, что и у соседних двух панелей — все три встают РОВНО над
 * Танком/Атлетом/Скаутом, см. reaperRow), тот же декоративный корпус
 * (PersonPanel), что и у RoadBonusPanel/ReaperCard — визуальное семейство
 * одного ряда.
 *
 * `round` — УЖЕ отформатированное для показа значение (не сырой `game.round`
 * с бэка — тот 0-индексный, +1 прибавляет ВЫЗЫВАЮЩИЙ код на границе рендера,
 * см. `PlayerInfoPanel.js#displayRound`/`turnsLabel`), число ИЛИ строка —
 * этот же компонент переиспользуется и под "Ход" (с 2026-10-16 там строка
 * вида "2/3", см. `turnsLabel`), название проп не меняли, т.к. семантика
 * "квадрат с подписью сверху" одна и та же для обоих случаев. `null`/
 * `undefined` (снэпшот до первого события хода) — прочерк вместо значения,
 * тот же приём, что и у RoadBonusPanel, чтобы панель не меняла размер/не
 * пустовала визуально.
 */
function RoundPanel({ round, panelSize = null }) {
    const [cardSize, setCardSize] = useState(null);
    const onLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setCardSize({ width, height });
    }, []);

    // '-' (обычный дефис) — фолбэк на случай, если раунд ещё не пришёл
    // (null/undefined, снэпшот до первого события хода). ВАЖНО (2026-10-01,
    // живой тест на реальном устройстве): "0" в шрифте игры (Xolonium)
    // визуально рисуется ПОЛЫМ КВАДРАТОМ (не перечёркнутый овал, как в
    // большинстве шрифтов) — на глаз легко принять за "пропавший глиф", это
    // НЕ баг рендера. Раунды на бэке реально нумеруются С НУЛЯ (round===0 в
    // первом раунде партии, подтверждено живым логом `game.round`), не с 1.
    const hasValue = round != null;

    return (
        <View onLayout={onLayout} style={[styles.card, panelSize != null && { width: panelSize }]}>
            <PersonPanel size={cardSize} />
            <Text style={styles.value} numberOfLines={1} noGlobalTint>
                {hasValue ? round : '-'}
            </Text>
        </View>
    );
}

// React.memo — тот же резон, что у RoadBonusPanel/ReaperCard/RunnerCard: без
// него декоративный 9-slice (PersonPanel) пересобирался бы на КАЖДЫЙ
// ре-рендер панели, даже когда сам раунд не менялся.
export default React.memo(RoundPanel);

const styles = StyleSheet.create({
    // aspectRatio:1 — та же структурная гарантия квадрата, что и в
    // RoadBonusPanel.js (см. её докстринг за разбором, почему НЕ отдельная
    // параллельная формула высоты).
    card: { aspectRatio: 1, padding: spacing.xs, alignItems: 'center', justifyContent: 'center' },
    value: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.h2 },
});
