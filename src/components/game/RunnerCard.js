// src/components/game/RunnerCard.js
import React, { useCallback, useEffect, useRef } from 'react';
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
 * POST /select ещё не отправлен: тап по карточке ЕЩЁ РАЗ отменяет — это уже
 * работает (см. GameBoardScreen.handleRunnerCardPress), просто раньше до
 * него не удавалось дойти из-за бага с хит-тестингом дропа ниже.
 *
 * Зону дропа кубика хода ("move:<runnerId>") мерит и репортит ВСЯ карточка
 * (сам TouchableOpacity, через onLayout+measureInWindow), а не вложенный
 * RunnerDiceSlot — по прямому запросу пользователя "сделай чувствительным
 * всё пространство плитки персонажа". `remeasureTick` — если карточка внутри
 * ScrollView (см. compactColumns в PlayerInfoPanel), меняющееся значение
 * (обычно — момент окончания скролла) триггерит повторный measureInWindow:
 * onLayout сам по себе не перевызывается при скролле контента, только при
 * реальном изменении размера/позиции В РОДИТЕЛЕ, так что без этого
 * закешированные оконные координаты зоны устаревают относительно текущей
 * прокрутки и хит-тестинг дропа начинает промахиваться мимо уже видимой
 * карточки.
 *
 * Обратная связь "сюда можно бросить кубик" — рамка ВСЕЙ карточки
 * (`hoverState`), а не маленький квадрат: раньше единственная пунктирная
 * зона с надписью "перетащи сюда кубик хода" визуально выглядела как
 * единственная цель, хотя технически ловилась вся карточка — это путало
 * (по прямому запросу пользователя квадраты стали чисто отображением
 * значения, см. RunnerDiceSlot). Два квадрата — "Ход" (moveDiceValue,
 * runner.dice) и "Накат" (rollDiceValue, runner.rollDice, см.
 * StepSelectionValidator::rollValidate на бэке) — оба всегда видны, какой
 * из них реально можно заполнить сейчас, решает canSelectRunner в
 * GameBoardScreen, не то, в какой квадрат навели кубик (зона дропа одна —
 * вся карточка).
 */
export default function RunnerCard({
    runner,
    color,
    active,
    pending,
    healTarget,
    onPress,
    moveDiceValue = null,
    rollDiceValue = null,
    hoverState,
    onMoveDiceMeasured,
    compact = false,
    remeasureTick = 0,
}) {
    const display = RUNNER_DISPLAY[runner.type];
    const slots = runner.damageTokens ?? [null, null];
    const placed = runner.segment != null;
    const zoneKey = `move:${runner.id}`;
    const cardRef = useRef(null);

    const measure = useCallback(() => {
        cardRef.current?.measureInWindow((x, y, width, height) => {
            onMoveDiceMeasured?.(zoneKey, { x, y, width, height });
        });
    }, [zoneKey, onMoveDiceMeasured]);

    useEffect(() => {
        if (remeasureTick) measure();
    }, [remeasureTick, measure]);

    const damageSlots = (
        <View style={[styles.slots, compact && styles.slotsCompact]}>
            {slots.map((token, i) => {
                const meta = token ? DAMAGE_TOKENS[token.type] : null;
                return (
                    <View
                        key={i}
                        style={[
                            styles.slot,
                            compact && styles.slotCompact,
                            meta && { backgroundColor: meta.color, borderColor: meta.color },
                        ]}
                    >
                        {meta && <Text style={styles.slotText}>{meta.short}</Text>}
                    </View>
                );
            })}
        </View>
    );

    return (
        <TouchableOpacity
            ref={cardRef}
            onLayout={measure}
            style={[
                styles.card,
                compact && styles.cardCompact,
                active && styles.cardSelected,
                healTarget && styles.cardHealTarget,
                pending && styles.cardPending,
                hoverState === 'valid' && styles.cardHoverValid,
                hoverState === 'invalid' && styles.cardHoverInvalid,
            ]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.topRow}>
                <RunnerToken type={runner.type} color={color} size={compact ? 24 : 36} selected={active} />

                <View style={styles.info}>
                    <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
                        {display?.label ?? runner.type}
                    </Text>
                    <Text style={[styles.status, { color: statusColor(runner.status) }]}>
                        {RUNNER_STATUS_LABEL[runner.status] ?? runner.status}
                    </Text>
                    {/* В компактном режиме (портретная раскладка, всё должно поместиться
                        без прокрутки) эта строка — лишняя трата вертикального места,
                        статус выше уже даёт достаточно контекста. */}
                    {!compact && (
                        <Text style={styles.placement}>
                            {pending ? 'выбран — тапни ещё раз для отмены' : placed ? 'на поле' : 'в резерве'}
                        </Text>
                    )}
                </View>

                {/* compact — метки повреждений справа на плитке (в одном ряду с
                    иконкой/именем), а не отдельной строкой снизу: сокращает
                    высоту карточки (по прямому запросу пользователя). В
                    альбомной раскладке — без изменений, своя строка ниже. */}
                {compact && damageSlots}
            </View>

            {/* Два квадрата — "Ход" и "Накат", чисто отображение (см. шапку
                файла и RunnerDiceSlot) — зона дропа не они, а вся карточка. */}
            <View style={[styles.diceRow, compact && styles.diceRowCompact]}>
                <RunnerDiceSlot label="Ход" value={moveDiceValue} size={compact ? 32 : 40} />
                <RunnerDiceSlot label="Накат" value={rollDiceValue} size={compact ? 32 : 40} />
            </View>

            {!compact && damageSlots}
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
    // Подсветка "сюда можно бросить кубик" (см. hoverState) — рамка ВСЕЙ
    // карточки, не квадратов внутри (см. шапку файла).
    cardHoverValid: { borderColor: colors.success, borderStyle: 'solid' },
    cardHoverInvalid: { borderColor: colors.danger, borderStyle: 'solid' },
    // compact — портретная раскладка, двухколоночная (бегуны слева, усиления
    // справа), карточки должны все поместиться без прокрутки (см. запрос
    // пользователя) — меньше отступы, мельче иконка/шрифты/зоны, чем в
    // альбомной раскладке (там места достаточно, компактность не нужна).
    cardCompact: { padding: spacing.xs, marginBottom: 4 },
    topRow: { flexDirection: 'row', alignItems: 'center' },
    diceRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xs, gap: spacing.md },
    diceRowCompact: { marginTop: 3, gap: spacing.sm },
    info: { flex: 1, marginLeft: spacing.sm },
    name: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.small },
    nameCompact: { fontSize: font.tiny },
    status: { fontSize: font.tiny, marginTop: 2, fontWeight: '600' },
    placement: { fontSize: 10, color: colors.textOnDarkSecondary, marginTop: 1 },
    slots: { flexDirection: 'row', marginTop: spacing.xs },
    slotsCompact: { marginTop: 0, marginLeft: spacing.xs },
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
    slotCompact: { width: 16, height: 16, borderRadius: 8, marginLeft: 3 },
    slotText: { fontSize: 8, color: '#fff', fontWeight: 'bold' },
});
