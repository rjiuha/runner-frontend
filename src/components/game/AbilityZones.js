// src/components/game/AbilityZones.js
import React from 'react';
import { StyleSheet, View } from 'react-native';
import AbilityZone from './AbilityZone';
import { PLAYER_ABILITY_ORDER } from '../../constants/GameConstants';
import { spacing } from '../../theme';

/**
 * 4 зоны усилений (Буст/Лечение/Жнец/Призрак) — сетка 2×2 (landscape) либо
 * столбик из 4 (compactColumns, `vertical`, 2026-10-01, прямой запрос
 * пользователя "усиления вертикально справа" — abilitiesWrap теперь стоит
 * рядом с diceTrayWrap В РЯД, а не под ним, см. `PlayerInfoPanel.js`).
 *
 * `pulseKeys` (2026-09-14, по прямому запросу пользователя) — Set ключей
 * усилений, которые нужно подсветить "дышащей" рамкой ПРЯМО СЕЙЧАС (см.
 * AbilityZone#pulseHighlight) — PlayerInfoPanel сам решает, пуст он или нет
 * (пока не тащат кубик — пуст, во время драга — ключи, чей min/max подходит
 * под конкретное перетаскиваемое значение).
 */
export default function AbilityZones({
    assignments,
    hoverKey,
    hoverValid,
    onMeasured,
    onPressZone,
    remeasureTick,
    compact = false,
    vertical = false,
    color,
    pulseKeys = null,
    sizeScale = 1,
    zoneWidth = null,
    columnHeight = null,
}) {
    return (
        <View style={[styles.grid, vertical && styles.gridVertical]}>
            {PLAYER_ABILITY_ORDER.map((key, index) => {
                // zoneHeight — 2026-10-01, живая жалоба "нижняя рамка кубиков
                // не вровень с нижней рамкой усиления Призрак": раньше ВСЕМ
                // зонам доставалась ОДНА И ТА ЖЕ `Math.floor(columnHeight/4)`
                // — 4 одинаковых floor-округления вниз суммарно теряют
                // дробный остаток (напр. 206.857/4=51.714 → 51, 4×51=204,
                // теряем 2.857dp/~7px, оседает ПОСЛЕ последней зоны). Формула
                // `round(H*(i+1)/n) - round(H*i/n)` — стандартный приём
                // распределения остатка округления: КАЖДЫЙ индекс считает
                // границу заново от начала, поэтому сумма всех n результатов
                // ВСЕГДА точно равна round(H), без потерь — отдельные зоны
                // могут отличаться по высоте друг от друга максимум на 1px
                // (незаметно), зато последняя гарантированно дотягивается до
                // истинного низа колонки.
                const zoneHeight = columnHeight != null
                    ? Math.round((columnHeight * (index + 1)) / PLAYER_ABILITY_ORDER.length)
                        - Math.round((columnHeight * index) / PLAYER_ABILITY_ORDER.length)
                    : null;
                return (
                    <AbilityZone
                        key={key}
                        abilityKey={key}
                        assignedDice={assignments[key] ?? null}
                        hoverState={hoverKey === key ? (hoverValid ? 'valid' : 'invalid') : null}
                        onMeasured={onMeasured}
                        // Стабильная ссылка, НЕ инлайн-замыкание — 2026-09-19,
                        // см. докстринг RunnerCard.js#React.memo. AbilityZone
                        // сам передаёт свой abilityKey наружу (см. её handlePress).
                        onPress={onPressZone}
                        remeasureTick={remeasureTick}
                        compact={compact}
                        vertical={vertical}
                        color={color}
                        pulseHighlight={!!pulseKeys?.has(key)}
                        sizeScale={sizeScale}
                        zoneWidth={zoneWidth}
                        zoneHeight={zoneHeight}
                    />
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: spacing.xs,
    },
    // Столбик (2026-10-01) — каждая зона теперь ЯВНОЙ узкой ширины (см.
    // AbilityZone.js#zoneVertical, живая жалоба "рамка усиления огромная" —
    // была width:'100%', растягивалась на весь потенциально широкий
    // контейнер). `alignItems:'center'` — центрирует эти теперь более узкие
    // зоны по ширине столбца (тот же приём, что и у DiceTray.js#column).
    // `flex:1` + `justifyContent:'space-between'` (было 'flex-start', БЕЗ
    // flex:1) — 2026-10-01, живая жалоба "верхняя рамка усиления Ускорение
    // не вровень с рамкой кубиков" (низ при этом совпадал — чистая случайность
    // чисел, не гарантия): раньше эта колонка была натуральной высоты, а
    // PlayerInfoPanel.js центрировал её ЦЕЛИКОМ внутри выросшей
    // abilitiesWrapCompact — центрирование выравнивает только центр, не края,
    // а натуральная высота стопки усилений отличается от стопки кубиков
    // (DiceTray.js#column, тот же фикс тем же заходом). Теперь колонка сама
    // растягивается на всю высоту abilitiesWrapCompact и распределяет зоны
    // space-between — первая зона ВСЕГДА у самого верха, последняя ВСЕГДА у
    // самого низа, structurally совпадает с кубиками (обе колонки получают
    // одинаковый бокс сверху).
    // justifyContent: 'flex-start' (было 'space-between', 2026-10-01, живая
    // жалоба "усиления НЕ прижаты друг к другу") — раньше 4 зоны были
    // натуральной высоты (иконка+паддинг), а 'space-between' растягивало ЛЮБОЙ
    // излишек высоты колонки как видимые зазоры МЕЖДУ ними. Теперь каждая
    // зона получает ЯВНУЮ высоту от PlayerInfoPanel.js (`zoneHeight`, см. её
    // докстринг — dATileRowHeight/4), 4 зоны СУММАРНО заполняют колонку без
    // остатка (максимум 1-3px на округление) — 'flex-start' кладёт этот
    // мизерный остаток ПОСЛЕ последней зоны (не видно на фоне рамки), а не
    // распределяет тремя отдельными зазорами между всеми четырьмя.
    gridVertical: {
        flexDirection: 'column',
        flexWrap: 'nowrap',
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginTop: 0,
        flex: 1,
    },
});
