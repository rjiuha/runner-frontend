// src/components/game/RunnerCard.js
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RunnerToken from './RunnerToken';
import RunnerDiceSlot from './RunnerDiceSlot';
import { DAMAGE_TOKENS, RUNNER_DISPLAY } from '../../constants/GameConstants';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Карточка одного бегуна (Атлет/Солдат/Скаут) на планшете игрока:
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
 *
 * Планировка (по прямому запросу пользователя, чтобы карточка была уже):
 * иконка+имя/статус слева, под именем — кружки повреждений; квадраты
 * "Ход"/"Накат" — отдельная колонка справа, друг под другом (Ход сверху,
 * Накат под ним), а не отдельная строка на всю ширину карточки, как было
 * раньше.
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
        // requestAnimationFrame — measureInWindow вызванный СРАЗУ в onLayout на
        // Android иногда возвращает координаты ДО того, как реальный layout-
        // проход (особенно после смены шрифта/картинок/родительского флекса)
        // до конца устаканился, из-за чего зарегистрированный прямоугольник
        // зоны слегка расходится с тем, что видно на экране. Один кадр задержки
        // достаточно, чтобы измерение попало уже на стабильный layout.
        requestAnimationFrame(() => {
            cardRef.current?.measureInWindow((x, y, width, height) => {
                onMoveDiceMeasured?.(zoneKey, { x, y, width, height });
            });
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
                // Рамка выбранного бегуна — цвет ИГРОКА (color), не фиксированный
                // фиолетовый colors.primary: по прямому запросу пользователя вся
                // "принадлежность игроку" (кубики в трее, обводка на доске,
                // пилюля переключателя) должна быть в одном цвете, а не вперемешку
                // с отдельной темой акцента.
                active && { borderColor: color },
                healTarget && styles.cardHealTarget,
                pending && styles.cardPending,
                hoverState === 'valid' && styles.cardHoverValid,
                hoverState === 'invalid' && styles.cardHoverInvalid,
            ]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.cardRow}>
                <View style={styles.leftArea}>
                    <View style={styles.headRow}>
                        <RunnerToken type={runner.type} color={color} size={compact ? 30 : 36} selected={active} />

                        <View style={styles.info}>
                            <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
                                {display?.label ?? runner.type}
                            </Text>
                            {/* Статус текстом ("Исправен"/"Повреждён"...) убран — кружки
                                повреждений ниже уже однозначно показывают то же самое
                                (0/1/2 занятых кружка), отдельная строка избыточна (по
                                прямому запросу пользователя). */}
                            {!compact && (
                                <Text style={styles.placement}>
                                    {pending ? 'выбран — тапни ещё раз для отмены' : placed ? 'на поле' : 'в резерве'}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Кружки повреждений — под именем (по прямому запросу
                        пользователя, статус текстом больше не занимает эту строку). */}
                    {damageSlots}
                </View>

                {/* Квадраты "Ход"/"Накат" — рядом друг с другом (по прямому запросу
                    пользователя, было друг под другом), своя колонка справа от
                    иконки+имени. */}
                <View style={styles.diceCol}>
                    <RunnerDiceSlot label="Ход" value={moveDiceValue} size={compact ? 30 : 40} color={color} />
                    <RunnerDiceSlot label="Накат" value={rollDiceValue} size={compact ? 30 : 40} color={color} />
                </View>
            </View>
        </TouchableOpacity>
    );
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
    // cardRow — вся карточка в две колонки: leftArea (иконка+имя+повреждения,
    // тянется на весь остаток) и diceCol (Ход/Накат бок о бок, фиксированная
    // колонка справа).
    cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
    leftArea: { flex: 1, marginRight: spacing.xs },
    headRow: { flexDirection: 'row', alignItems: 'center' },
    // Ход/Накат теперь РЯДОМ (row), не друг под другом — по прямому запросу
    // пользователя.
    diceCol: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    info: { flex: 1, marginLeft: spacing.sm },
    name: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.small },
    nameCompact: { fontSize: font.tiny },
    placement: { fontSize: 10, color: colors.textOnDarkSecondary, marginTop: 1 },
    slots: { flexDirection: 'row', marginTop: spacing.xs },
    slotsCompact: { marginTop: 3, marginLeft: 0 },
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
