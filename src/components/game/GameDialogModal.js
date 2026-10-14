// src/components/game/GameDialogModal.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from '../ui/Button';
import { colors, spacing, radius, font } from '../../theme';

/**
 * 2026-10-12, по прямому запросу пользователя — "вытащить вообще все
 * уведомления/диалоги в модалку". ВРЕМЕННЫЙ ДУБЛЬ, не замена: существующая
 * инлайн-шапка панели (turnBannerInner в GameBoardScreen.js) остаётся как
 * есть, этот компонент рисует ТО ЖЕ самое состояние ПОВЕРХ экрана — задача
 * сначала убедиться, что сюда попали ВСЕ диалоги с выбором (плюс явно
 * перечисленные "ждущие" уведомления), и только потом (отдельным заходом)
 * убрать старую инлайн-шапку.
 *
 * НЕ системный RN `<Modal>` — по прямому выбору пользователя: тот
 * затемняет/блокирует весь экран, а часть диалогов (выстрел/размещение
 * Жнеца) требует тапать по доске ПОКА диалог открыт. Вместо этого —
 * полупрозрачная карточка поверх экрана: сама обёртка `pointerEvents=
 * 'box-none'` (тапы ВНЕ карточки проходят насквозь к доске), карточка —
 * обычный View, перехватывает тапы по своим кнопкам как любой другой UI.
 *
 * Один общий компонент на ВСЕ диалоги (по прямому выбору пользователя) —
 * вызывающий код (GameBoardScreen.js#dialogState) решает, какой текст и
 * какие кнопки сейчас актуальны, этот компонент только рисует их.
 *
 * @param {object|null} dialogState — null/undefined = ничего не показывать.
 *   { text: string, buttons?: Array<{ key, title, variant, onPress }> }
 *   buttons пуст/не передан — карточка с одним текстом, без кнопок (см.
 *   "Заруба! Ждём {имя}"/"Трасса смещается…" — по прямому запросу
 *   пользователя тоже дублируются сюда, хотя сами по себе ничего не
 *   решают).
 * @param {number} width/height — РЕАЛЬНЫЙ пиксельный размер дороги
 *   (roadContainerW/H из useBoardLayout, GameBoardScreen.js) — см. ниже,
 *   почему нельзя положиться на `absoluteFillObject`/`bottom:0`.
 */
export default function GameDialogModal({ dialogState, width, height }) {
    if (!dialogState) return null;
    const { text, buttons } = dialogState;

    return (
        <View style={[styles.wrapper, { width, height }]} pointerEvents="box-none">
            <View style={styles.card}>
                <Text style={styles.text} noGlobalTint>{text}</Text>
                {buttons?.length > 0 && (
                    <View style={styles.buttonRow}>
                        {buttons.map((b) => (
                            <Button key={b.key} title={b.title} variant={b.variant} onPress={b.onPress} style={styles.button} />
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Поверх дороги, прижато к ВЕРХНЕМУ краю (не центр экрана) — по прямому
    // запросу пользователя, 2026-10-12: рендерится как ребёнок roadFrameWrap
    // (GameBoardScreen.js).
    //
    // **Реальный Android-баг, найден живьём через диагностическую подсветку
    // фона** (та же категория, что уже в "Известные грабли RN/Android" —
    // "onLayout на абсолютно спозиционированном элементе внутри родителя с
    // AUTO-высотой на Android может стабильно вернуть 0", тут тот же
    // первопричинный класс, но для ПОЗИЦИОНИРОВАНИЯ, не измерения):
    // `position:'absolute'` с `top/left/right/bottom:0` (старый
    // `...StyleSheet.absoluteFillObject`) ВНУТРИ `roadFrameWrap` (`flex:1`,
    // без явного пиксельного размера) на Android растягивался НЕ на весь
    // родитель, а схлопывался в размер своего контента и прижимался к НИЗУ
    // колонки (видно было на вебе корректно, см. CLAUDE.md — платформенное
    // расхождение). Фикс — убрали зависимость от bottom/right-стретчинга,
    // задаём `width`/`height` ЯВНО, пропами из уже известного
    // `roadContainerW`/`roadContainerH` (тот же источник, которым меряется
    // сама дорога/BoardGrid) — `top:0, left:0` + явный размер вместо
    // неявного "растянись до родителя".
    wrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: spacing.lg,
    },
    card: {
        backgroundColor: colors.overlayPlate,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: colors.neonCyan,
        padding: spacing.lg,
        // Во всю ширину дороги (по прямому запросу пользователя, 2026-10-12)
        // — было maxWidth:420, кнопка иногда обрезалась/было тесно, теперь
        // ограничена только padding'ом обёртки (wrapper), не своим maxWidth.
        width: '100%',
    },
    text: {
        color: colors.textOnDark,
        fontSize: font.body,
        textAlign: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    button: { minWidth: 72 },
});
