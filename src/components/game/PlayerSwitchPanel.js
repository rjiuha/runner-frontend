// src/components/game/PlayerSwitchPanel.js
import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PersonPanel from '../ui/PersonPanel';
import { SWITCH_OFF_BLOCKED, SWITCH_OFF_CYAN, SWITCH_ON } from '../../constants/GameConstants';
import { colors, font, spacing } from '../../theme';

// Родной пиксельный размер ассетов (337×537, см. GameConstants.js —
// одинаковый для всех вариантов switch_*) — используется только для
// аспекта (width/height), чтобы переключатель не искажался при масштабе
// под высоту ряда.
// Экспортируется — GameBoardScreen.js считает по нему ширину ЭТОГО ряда
// заранее (без onLayout), чтобы подогнать соседний блок (имя+раунд/ход/
// бонус+настройки/лог) под оставшееся место, см. её докстринг.
export const SWITCH_ASPECT = 337 / 537;
// Максимум слотов — зеркалит бэковый RunnerGame (всегда 2-4 игрока,
// Enum/PlayerColor.php отдаёт ровно 4 цвета) — переключатель всегда
// показывает все 4 возможных слота, даже если в партии игроков меньше
// (2026-10-10, по прямому запросу пользователя).
const MAX_SLOTS = 4;

/**
 * Один переключатель-слот. `player` — null для слота без игрока в этой
 * партии (switch_off_blocked, недоступен для тапа). `active` — слот
 * ТЕКУЩЕГО ВЫБРАННОГО (activeId в PlayerInfoPanel — то, чья панель сейчас
 * показана, НЕ обязательно чей ход) игрока.
 *
 * Для занятого слота (`player` есть) — ОБА ассета (`switch_off_cyan` и
 * `switch_on_<цвет>`) смонтированы ОДНОВРЕМЕННО, друг над другом, и
 * переключаются `opacity`, а не подменой `source` одного `<Image>` — живая
 * жалоба пользователя 2026-10-10: "когда кнопки Switch переключаются, они
 * исчезают" (на Android при смене `source` — пауза декодирования нового
 * кадра, та же категория бага, что уже чинили для анимаций бегунов
 * кроссфейдом, см. `RunnerToken.js`/CLAUDE.md "Кроссфейд между анимациями").
 * Тут даже проще — у switch-слота ровно 2 состояния на весь прогон партии
 * (цвет игрока в слоте не меняется), поэтому не нужен кроссфейд-таймер:
 * оба кадра декодируются один раз при монтировании и дальше просто
 * показываются/прячутся мгновенно, без паузы декодирования.
 * `!player` (заблокированный слот) — ассет не меняется никогда, обычный
 * одиночный `<Image>`, трогать нечего.
 */
function SwitchSlot({ player, active, onSelect, height }) {
    const width = Math.round(height * SWITCH_ASPECT);

    if (!player) {
        return (
            <TouchableOpacity disabled activeOpacity={0.75}>
                <Image source={SWITCH_OFF_BLOCKED} resizeMode="contain" style={{ width, height }} />
            </TouchableOpacity>
        );
    }

    const onSource = SWITCH_ON[player.colorKey] ?? SWITCH_ON.red;
    return (
        <TouchableOpacity activeOpacity={0.75} onPress={() => onSelect(player.id)}>
            <View style={{ width, height }}>
                <Image source={SWITCH_OFF_CYAN} resizeMode="contain" style={{ width, height }} />
                <Image
                    source={onSource}
                    resizeMode="contain"
                    style={{ position: 'absolute', top: 0, left: 0, width, height, opacity: active ? 1 : 0 }}
                />
            </View>
        </TouchableOpacity>
    );
}

/**
 * Переключатель игроков — ТОЛЬКО сами 4 переключателя (2026-10-10, замена
 * табов PlayerSwitcher.js для портретного native-режима — см.
 * GameBoardScreen.js#useMobileNavButtons, реальные ассеты присланы/
 * перекрашены пользователем ещё 2026-10-04). Панель с именем выбранного
 * игрока — соседний экспорт `NamePanel` ниже, рендерится ОТДЕЛЬНО
 * вызывающей стороной (GameBoardScreen.js), не частью этого компонента —
 * по итоговой раскладке у неё свой сосед снизу (настройки+лог), этот
 * компонент о них ничего не знает.
 *
 * Всегда 4 слота: активный ВЫБРАННЫЙ игрок — switch_on своего цвета,
 * остальные реальные игроки партии — switch_off_cyan (включая выбывших,
 * status=OUT — по прямому решению пользователя: визуально как обычный
 * невыбранный, он всё ещё часть партии), слоты без игрока (партия на 2-3)
 * — switch_off_blocked. Порядок — по индексу в `players` (т.е. по порядку
 * захода в лобби), блокированные — хвостом.
 *
 * `height` — высота ряда переключателей, приходит от вызывающей стороны
 * (GameBoardScreen.js), та же величина, что и у соседних элементов строки
 * (стрелки навигации, имя+настройки+лог) — всё это один визуальный ряд.
 */
export default function PlayerSwitchPanel({ players, activeId, onSelect, height }) {
    const slots = Array.from({ length: MAX_SLOTS }, (_, i) => players[i] ?? null);

    return (
        <View style={styles.row}>
            {slots.map((p, i) => (
                <SwitchSlot
                    key={p ? p.id : `empty-${i}`}
                    player={p}
                    active={!!p && p.id === activeId}
                    onSelect={onSelect}
                    height={height}
                />
            ))}
        </View>
    );
}

/**
 * Панелька с именем ВЫБРАННОГО СЕЙЧАС игрока — тот же декоративный корпус
 * (PersonPanel), что у RoundPanel/RoadBonusPanel ("в стиле как панель
 * хода, бонуса, бегуна" — прямая формулировка запроса). `style` —
 * вызывающая сторона задаёт геометрию (ширина/высота) снаружи, этот
 * компонент сам себя не размеряет под соседей.
 */
export function NamePanel({ name, style }) {
    const [size, setSize] = useState(null);
    const onLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
    }, []);

    return (
        <View onLayout={onLayout} style={[styles.nameBox, style]}>
            <PersonPanel size={size} />
            <Text style={styles.nameText} numberOfLines={1} noGlobalTint>
                {name ?? ''}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    nameBox: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
    nameText: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.small },
});
