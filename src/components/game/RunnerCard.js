// src/components/game/RunnerCard.js
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RunnerToken from './RunnerToken';
import RunnerDiceSlot from './RunnerDiceSlot';
import { DAMAGE_TOKENS, RUNNER_DISPLAY, RUNNER_STATUS, RUNNER_STATUS_LABEL } from '../../constants/GameConstants';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Карточка одного бегуна (Джаггернаут/Штурмовик/Скаут) на планшете игрока:
 * иконка, статус, до 2 ячеек повреждений с типом жетона (см. предупреждение
 * про damageTokens в mockGameData.js — на бэке этого поля пока нет), и зона
 * для кубика хода (RunnerDiceSlot) — перетащи кубик из трея на карточку,
 * чтобы выбрать бегуна на этот ход (реальный POST /runner_game/select,
 * см. GameBoardScreen). `active` — это бегун, которого игрок выбрал в этом
 * ходу (player.activeRunner с бэка), `healTarget` — сейчас ждём тап по
 * карточке как цель для команды "Лечение" (pendingAbility в GameBoardScreen).
 * `pending` — на карточку брошен кубик (обычный выбор или накат), но
 * POST /select ещё не отправлен: тап по карточке отменяет, кнопка
 * "Подтвердить" в баннере хода — коммитит (см. pendingSelect в GameBoardScreen).
 */
export default function RunnerCard({
    runner,
    color,
    active,
    pending,
    healTarget,
    onPress,
    moveDiceValue = null,
    moveHoverState,
    onMoveDiceMeasured,
}) {
    const display = RUNNER_DISPLAY[runner.type];
    const slots = runner.damageTokens ?? [null, null];
    const placed = runner.segment != null;

    return (
        <TouchableOpacity
            style={[
                styles.card,
                active && styles.cardSelected,
                healTarget && styles.cardHealTarget,
                pending && styles.cardPending,
            ]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.topRow}>
                <RunnerToken type={runner.type} color={color} size={36} selected={active} />

                <View style={styles.info}>
                    <Text style={styles.name}>{display?.label ?? runner.type}</Text>
                    <Text style={[styles.status, { color: statusColor(runner.status) }]}>
                        {RUNNER_STATUS_LABEL[runner.status] ?? runner.status}
                    </Text>
                    <Text style={styles.placement}>
                        {pending ? 'выбран — тапни ещё раз для отмены' : placed ? 'на поле' : 'в резерве'}
                    </Text>
                </View>
            </View>

            {/* Кубик хода — над кружочками повреждений и на всю ширину карточки
                (не в один ряд с ними): по жалобе пользователя маленькая узкая
                зона было легко промахнуться пальцем на телефоне — драг сам
                по себе не был сломан (хит-тестинг на оконных координатах, не
                зависит от расположения), просто цель была мелкой. */}
            <RunnerDiceSlot
                zoneKey={`move:${runner.id}`}
                value={moveDiceValue}
                hoverState={moveHoverState}
                onMeasured={onMoveDiceMeasured}
                style={styles.diceSlotFull}
            />

            <View style={styles.slots}>
                {slots.map((token, i) => {
                    const meta = token ? DAMAGE_TOKENS[token.type] : null;
                    return (
                        <View
                            key={i}
                            style={[styles.slot, meta && { backgroundColor: meta.color, borderColor: meta.color }]}
                        >
                            {meta && <Text style={styles.slotText}>{meta.short}</Text>}
                        </View>
                    );
                })}
            </View>
        </TouchableOpacity>
    );
}

function statusColor(status) {
    if (status === RUNNER_STATUS.DESTROYED) return colors.danger;
    if (status === RUNNER_STATUS.BROKEN) return colors.warning;
    if (status === RUNNER_STATUS.DAMAGED) return colors.warning;
    return colors.success;
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bgLight,
        borderRadius: radius.md,
        padding: spacing.sm,
        marginBottom: spacing.xs,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    cardSelected: { borderColor: colors.primary },
    cardHealTarget: { borderColor: colors.success },
    cardPending: { borderColor: colors.warning, borderStyle: 'dashed' },
    topRow: { flexDirection: 'row', alignItems: 'center' },
    diceSlotFull: { marginTop: spacing.xs, alignSelf: 'stretch' },
    info: { flex: 1, marginLeft: spacing.sm },
    name: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.small },
    status: { fontSize: font.tiny, marginTop: 2, fontWeight: '600' },
    placement: { fontSize: 10, color: colors.textOnDarkSecondary, marginTop: 1 },
    slots: { flexDirection: 'row', marginTop: spacing.xs },
    slot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: colors.textOnDarkSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    slotText: { fontSize: 8, color: '#fff', fontWeight: 'bold' },
});
