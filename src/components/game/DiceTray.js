// src/components/game/DiceTray.js
import React from 'react';
import { StyleSheet, View } from 'react-native';
import DiceDie from './DiceDie';
import { spacing } from '../../theme';

/**
 * 4 кубика перемещения активного игрока. Индекс кубика (0..3) — это то же,
 * что dice1..dice4 на бэке (1-based при вызове API, см. GameBoardScreen).
 * draggable=false — не мой ход/не тот шаг: кубики видны, но не тащатся.
 *
 * **`vertical` (2026-10-01, прямой запрос пользователя)** — в compactColumns
 * `PlayerInfoPanel.js` теперь ставит `diceTrayWrap` слева и `abilitiesWrap`
 * справа В РЯД (вместо трея кубиков НАД сеткой усилений) — каждой из двух
 * половин при этом узко по ширине, но много места по высоте, поэтому кубики
 * здесь стоят СТОЛБИКОМ (`styles.column`), не в ряд. Размер кубика (см.
 * `PlayerInfoPanel.js#compactMoveDiceSize`) — явно вычислен так, чтобы точно
 * совпадать с шириной `diceTrayWrap` (см. её докстринг в PlayerInfoPanel.js),
 * сам кубик теперь рисуется программно (`DiceDie.js` → `DicePips`, не
 * картинкой) — квадрат гарантирован структурно на любом размере.
 */
function DiceTray({
    dice, draggable = true, onDragStart, onDragMove, onDrop, onDragEnd, size,
    ghostX, ghostY, panelOriginX, panelOriginY, vertical = false, color, slotHeight = null,
}) {
    const renderDie = (value, index) => (
        <DiceDie
            key={index}
            value={value}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragMove={(x, y, v) => onDragMove(index, x, y, v)}
            onDrop={(x, y, v) => onDrop(index, x, y, v)}
            onDragEnd={onDragEnd}
            ghostX={ghostX}
            ghostY={ghostY}
            panelOriginX={panelOriginX}
            panelOriginY={panelOriginY}
            // color — 2026-10-01, прямой запрос пользователя "кубики хода
            // под цвет бегунов игрока": та же `activePlayer.color`, что уже
            // красит аватар/рамку карточки бегуна в PlayerInfoPanel.js,
            // теперь и здесь, вместо дефолтного colors.danger в DicePips.js.
            color={color}
            {...(size != null ? { size } : {})}
        />
    );

    // slotHeight (2026-10-01, живая жалоба "кубики не оптимально
    // распределены по фрейму") — явная высота ОДНОГО слота
    // (diceTraySize.height/4 от PlayerInfoPanel.js), заменяет
    // `justifyContent:'space-between'` на `column` (см. её докстринг ниже),
    // который раньше растягивал излишек высоты рамки в неравномерные зазоры
    // между кубиками. Каждый кубик рендерится внутри слота РОВНО своей доли
    // высоты рамки, центрированного — 4 слота подряд без зазоров между
    // собой, сам кубик просто центрируется в своём (возможно, более
    // просторном по высоте) слоте.
    return (
        <View style={vertical ? styles.column : styles.row}>
            {vertical && slotHeight != null
                ? dice.map((value, index) => (
                    <View key={index} style={[styles.slot, { height: slotHeight }]}>
                        {renderDie(value, index)}
                    </View>
                ))
                : dice.map((value, index) => renderDie(value, index))}
        </View>
    );
}

// React.memo (2026-09-27) — тот же резон, что у AbilityZone/ReaperCard/
// RunnerCard: без него ЛЮБОЙ ре-рендер PlayerInfoPanel (не только смена
// таба игрока) пересобирал бы все 4 кубика заново. Требует стабильных
// ссылок у вызывающего кода (см. `trayDice`#useMemo в PlayerInfoPanel.js) —
// `onDragStart`/`onDragMove`/`onDrop`/`onDragEnd` там уже useCallback.
export default React.memo(DiceTray);

const styles = StyleSheet.create({
    // flexWrap — страховка на экстремально узкий экран (см. докстринг
    // компонента, 2026-10-01) — при нормальной ширине rightColumn (теперь
    // всегда полной ширины своей колонки) 4 кубика встают в один ряд без
    // переноса.
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
    },
    // Столбик из 4 кубиков (2026-10-01, см. докстринг компонента) —
    // alignItems:'center' центрирует кубики по ширине узкой левой половины
    // dATile. БЕЗ paddingHorizontal (был тут, убран 2026-10-01, живая жалоба
    // "кубики выпирают за пределы своего фрейма") — `diceTrayWrapCompact` в
    // PlayerInfoPanel.js уже считает свою явную ширину как "кубик + паддинг
    // САМОГО diceTrayWrap" (см. её докстринг), не учитывая ВТОРОЙ, свой
    // собственный паддинг этого column — с ним кубику для помещения было
    // нужно на 16px больше ширины, чем реально выделено (62 вместо 78), и он
    // вылезал за пределы decorативной рамки (та измеряет ИМЕННО diceTrayWrap,
    // не column). alignItems:'center' и без паддинга центрирует кубик как
    // надо, отступ до рамки уже даёт padding самого diceTrayWrap.
    // flex:1 + justifyContent:'space-between' (2026-10-01, живая жалоба
    // "нижняя рамка усиления Призрак вровень с рамкой кубиков, а верхняя
    // рамка усиления Ускорение — нет"): раньше эта колонка была натуральной
    // высоты, а PlayerInfoPanel.js центрировал её ЦЕЛИКОМ внутри выросшей
    // diceTrayWrapCompact — центрирование выравнивает ТОЛЬКО центр, не края;
    // у усилений (AbilityZones.js#gridVertical) натуральная высота стопки —
    // ДРУГАЯ, чем у стопки кубиков, значит центрирование давало разный отступ
    // сверху у двух колонок (совпадение снизу — чистая случайность чисел, не
    // гарантия). Теперь колонка сама растягивается на всю высоту
    // diceTrayWrapCompact (flex:1) и распределяет кубики space-between —
    // первый кубик ВСЕГДА у самого верха, последний ВСЕГДА у самого низа,
    // gap используется как МИНИМАЛЬНЫЙ отступ, а не единственный источник
    // расстояния между кубиками (обе колонки получают одинаковый бокс сверху,
    // высота обеих теперь общая — оба верха и оба низа совпадают структурно,
    // не по совпадению).
    // justifyContent: 'flex-start' (было 'space-between', 2026-10-01, живая
    // жалоба "кубики не оптимально распределены по фрейму") — теперь каждый
    // кубик сидит в СВОЁМ слоте явной высоты (см. `slot`/`slotHeight` в месте
    // рендера выше), 4 слота суммарно заполняют высоту рамки без остатка
    // (максимум 1-3px на округление) — 'flex-start' кладёт этот мизерный
    // остаток ПОСЛЕ последнего слота, не распределяет его тремя отдельными
    // зазорами между всеми кубиками, как раньше делал 'space-between'. `gap`
    // убран по той же причине — слоты уже примыкают друг к другу впритык,
    // дополнительный зазор поверх них просто вытолкнул бы последний слот за
    // пределы рамки.
    column: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flex: 1,
    },
    // slot — обёртка ОДНОГО кубика на явную долю высоты рамки (см. её
    // докстринг у места рендера) — центрирует кубик (который может быть
    // компактнее слота по высоте, см. потолок MOVE_DICE_SIZE_COMPACT)
    // внутри выделенной ему полосы.
    slot: { width: '100%', alignItems: 'center', justifyContent: 'center' },
});
