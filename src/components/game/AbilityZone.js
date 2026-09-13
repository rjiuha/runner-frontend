// src/components/game/AbilityZone.js
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import PulseHighlight from '../ui/PulseHighlight';
import { PLAYER_ABILITIES } from '../../constants/GameConstants';
import { colors, font, radius, spacing } from '../../theme';

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
export default function AbilityZone({
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

    const measure = useCallback(() => {
        // requestAnimationFrame — см. тот же приём и объяснение в RunnerCard.js.
        requestAnimationFrame(() => {
            ref.current?.measureInWindow((x, y, width, height) => {
                onMeasured(abilityKey, { x, y, width, height });
            });
        });
    }, [abilityKey, onMeasured]);

    useEffect(() => {
        if (remeasureTick) measure();
    }, [remeasureTick, measure]);

    const filled = assignedDice != null;
    const highlight =
        hoverState === 'valid' ? styles.hoverValid : hoverState === 'invalid' ? styles.hoverInvalid : null;

    return (
        <TouchableOpacity
            ref={ref}
            onLayout={measure}
            onPress={filled ? onPress : undefined}
            activeOpacity={filled ? 0.7 : 1}
            style={[
                styles.zone,
                compact && styles.zoneCompact,
                // Цвет игрока, не фиксированный colors.primary — та же просьба,
                // что и для RunnerCard/RunnerDiceSlot (см. их комментарии):
                // единый цвет для всего, что относится к текущему игроку.
                filled && { borderStyle: 'solid', borderColor: color, backgroundColor: `${color}b8` },
                highlight,
            ]}
        >
            <PulseHighlight
                active={pulseHighlight && !filled && hoverState == null}
                borderRadius={radius.md}
                borderWidth={2}
            />
            <Text style={[styles.label, compact && styles.labelCompact]} noGlobalTint>{ability.label}</Text>
            <Text style={styles.hint} noGlobalTint>{compact ? ability.shortHint : ability.hint}</Text>
            {/* Число/галочка при занятой зоне убраны целиком (были — только
                для Лечения, min===max) по прямому запросу пользователя,
                2026-09-01: подсветка рамки (filled-стиль выше) уже сама по
                себе однозначно показывает занятость, а любой доп. элемент,
                появляющийся/исчезающий вместе с filled, менял высоту зоны —
                "чтобы не менять размерность области". */}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    zone: {
        width: '48%',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.textOnDarkSecondary,
        borderRadius: radius.md,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    // compact (compactColumns, портретная раскладка) — ужимаем зону усилений:
    // без подсказки (hint) и мельче шрифт заголовка, по прямому запросу
    // пользователя "ужать пространство под усиления".
    zoneCompact: { paddingVertical: 4 },
    labelCompact: { fontSize: font.tiny },
    hoverValid: { borderColor: colors.success, borderStyle: 'solid', backgroundColor: `${colors.success}33` },
    hoverInvalid: { borderColor: colors.danger, borderStyle: 'solid', backgroundColor: `${colors.danger}22` },
    label: { color: colors.textOnDark, fontSize: font.small, fontWeight: 'bold' },
    hint: { color: colors.textOnDarkSecondary, fontSize: 10, marginTop: 1 },
});
