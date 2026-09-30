// src/components/game/RoadBonusPanel.js
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PersonPanel from '../ui/PersonPanel';
import { colors, font, spacing } from '../../theme';

/**
 * Панель бонуса дороги — сосед RoundPanel/"Ход"-заглушки в общем ряду (см.
 * PlayerInfoPanel#reaperNode). ДОПОЛНЕНИЕ, не замена: per-runner "+N" квадрат
 * на RunnerCard.js (roadBonusBoxCompact) остаётся как есть — та привязана к
 * конкретному бегуну (runner.trackGain===true), эта показывает значение
 * бонуса РАУНДА целиком (game.trackGain, roadBonusValue) независимо от того,
 * кто именно сейчас на треке.
 *
 * **Цифрой, не гранью кубика (2026-10-01, продолжение сессии, прямой запрос
 * пользователя "вместо кубика дороги показать цифрой значение")** — раньше
 * тут рисовалась `DicePips` (точки на грани, зелёным), теперь — просто текст
 * числа, тот же стиль, что у `RoundPanel#styles.value` (визуальное
 * единообразие ряда из одинаковых квадратов-циферок), только цвет оставлен
 * зелёным (`colors.success`) — сохраняет прежнюю "бонусную" цветовую
 * идентичность, чтобы отличаться от нейтральных Раунд/Ход рядом. `size`/
 * `DicePips`/`DIE_PADDING` убраны целиком вместе с этим — панель сама
 * квадратная (`aspectRatio:1`, как и раньше), ширина — только через
 * `panelSize`.
 *
 * ВСЕГДА видимый бокс (тот же приём, что и roadBonusBoxCompact в
 * RunnerCard.js) — прочерк вместо числа, когда бонуса сейчас нет
 * (game.trackGain<=0), чтобы панель не меняла размер от его наличия.
 */
function RoadBonusPanel({ value, panelSize = null }) {
    const [cardSize, setCardSize] = useState(null);
    const onLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setCardSize({ width, height });
    }, []);

    const hasValue = value != null && value > 0;

    return (
        <View onLayout={onLayout} style={[styles.card, panelSize != null && { width: panelSize }]}>
            <PersonPanel size={cardSize} />
            <Text style={styles.value} numberOfLines={1} noGlobalTint>
                {hasValue ? value : '—'}
            </Text>
        </View>
    );
}

// React.memo — тот же резон, что у RunnerCard/AbilityZone: без него
// декоративный 9-slice (PersonPanel) пересобирался бы на КАЖДЫЙ ре-рендер
// панели, даже когда сам roadBonusValue не менялся.
export default React.memo(RoadBonusPanel);

const styles = StyleSheet.create({
    // aspectRatio:1 (2026-10-01, прямой запрос пользователя: "рамка-панель
    // для кубика дороги должна оставаться квадратной") — ширина приходит
    // явно (panelSize-проп), высота выводится ИЗ ширины структурно.
    card: { aspectRatio: 1, padding: spacing.xs, alignItems: 'center', justifyContent: 'center' },
    // Тот же стиль, что RoundPanel#styles.value — единообразие ряда,
    // только зелёный (см. докстринг компонента).
    value: { color: colors.success, fontWeight: 'bold', fontSize: font.h2 },
});
