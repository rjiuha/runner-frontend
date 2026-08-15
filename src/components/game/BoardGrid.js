// src/components/game/BoardGrid.js
import React, { useMemo } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BOARD_LAYOUT, HIGHLIGHT_IMAGE, SEGMENT_IMAGES } from '../../constants/GameConstants';
import { indexRunnersByCell } from '../../lib/board';
import RunnerToken from './RunnerToken';

/**
 * Прокручиваемая сетка сегментов дороги.
 *
 * Альбомная раскладка (orientation='landscape'): дорожки — горизонтальные
 * полосы, стек по вертикали, скролл по X. Ряды через один сдвинуты на
 * пол-ячейки (кирпичная кладка), сама прокрутка — через Animated.View и
 * offset, приходящий из useBoardScroll.
 *
 * Портретная раскладка (orientation='portrait'): дорожки — вертикальные
 * полосы, стек по горизонтали (все 6 помещаются по ширине без скролла),
 * скролл по Y. По требованию — движение по трассе должно идти СНИЗУ ВВЕРХ
 * (начало трассы у панели игрока внизу экрана, дальше по треку — выше).
 *
 * ПЕРВАЯ версия этого файла добивалась "снизу вверх" трансформом
 * `scaleY(-1)` на всей сетке + контр-отражением каждой картинки/токена —
 * на реальном Android это дало сломанные стрелки прокрутки и свайп,
 * открывающий пустую зону (нет доступа к устройству для отладки, но по
 * описанным симптомам похоже на связку transform+overflow:hidden). Заменено
 * на `flexDirection: 'column-reverse'` — ЧИСТО layout-свойство, не paint-time
 * трансформ: цепочка ячеек лежит в массиве в обычном порядке (globalCol
 * возрастает), 'column-reverse' просто рисует их снизу вверх сама, без
 * transform и без контр-отражения (картинки/токены остаются в нормальной
 * ориентации, потому что ничего физически не отражается — просто порядок
 * укладки другой). Меньше движущихся частей — надёжнее.
 *
 * Вьюпорт (containerHeight, весь оставшийся вертикальный бюджет экрана, см.
 * useBoardLayout) значительно МЕНЬШЕ контента (H = TOTAL_COLS*segmentH, все
 * 3 фрагмента трассы). `justifyContent: 'flex-end'` на внешнем `container`
 * (см. `containerBottomAnchored`) прижимает контент к НИЗУ вьюпорта — иначе
 * RN по умолчанию прижал бы к верху, и при offset=0 в видимой части
 * оказался бы ДАЛЬНИЙ конец трассы вместо начала.
 *
 * Направление offset'а в портретной раскладке — ПОЛОЖИТЕЛЬНОЕ (0=начало,
 * minOffset>0=дальше по треку), в отличие от альбомной (0=начало,
 * minOffset<0=дальше) — см. useBoardLayout/useBoardScroll: чем дальше по
 * треку (globalCol растёт), тем выше нужно поднять контент экрана, а "выше"
 * при column-reverse — это положительный translateY (сдвигает контент вниз
 * от его "нулевой" позиции, вытягивая скрытый сверху хвост в видимую зону
 * снизу... см. useBoardScroll — там разобрано подробнее с конкретными
 * числами). Направление свайпа подтверждено с пользователем: палец ВНИЗ
 * открывает трассу ДАЛЬШЕ (тянешь трассу к себе).
 *
 * Токены бегунов в обеих раскладках рисуются ОДНИМ отдельным абсолютным
 * слоем НАД всей сеткой целиком (внутри той же прокручиваемой Animated.View,
 * чтобы ехать вместе со скроллом), с пиксельными координатами, посчитанными
 * вручную — раньше (на Android, в альбомной раскладке) токены, вложенные в
 * каждую ячейку, иногда рисовались ПОД картинкой сегмента (view-flattening),
 * отдельный слой поверх сетки это обходит независимо от компоновки ячейки.
 * В портретной раскладке y считается в ТОЙ ЖЕ системе, что и column-reverse
 * даёт клеткам (см. tokenOverlay ниже) — globalCol=0 внизу, растёт вверх.
 *
 * Тап по клетке всегда сообщается наружу через onCellPress: используется и
 * для звука/фидбека, и для тап-плейсмента выбранного бегуна. Формат cell.id
 * ("segment-row-col") и семантика row/col/blockIndex одинаковы в обеих
 * раскладках — меняется только то, как клетки визуально расположены на
 * экране, не координаты, которые видит GameBoardScreen.
 */

// ПЕРВАЯ версия делала подложку allowed_move.png БОЛЬШЕ слота клетки — на
// практике это давало наплыв на соседние сегменты (клетки в сетке стоят
// впритык друг к другу, зазора между ними нет). По уточнению пользователя —
// наоборот: подложка = ровно размер слота, а сама картинка типа клетки
// (road/sand/...) чуть МЕНЬШЕ слота и отцентрована — тогда "свечение" видно
// по краям только В ПРЕДЕЛАХ своего слота, не залезая на соседей. Доля,
// поровну по каждой стороне.
const SEGMENT_INSET = 0.15;

export default function BoardGrid({
    gridData,
    rows,
    cols,
    segmentW,
    segmentH,
    offset,
    orientation = 'landscape',
    containerHandlers,
    containerWidth,
    containerHeight,
    runners = [],
    playerColorById = {},
    selectedRunnerId = null,
    highlightedCells = null,
    onCellPress,
}) {
    const runnersByCell = useMemo(() => indexRunnersByCell(runners), [runners]);
    const tokenSize = Math.floor(Math.min(segmentW, segmentH) * 0.72);
    const isPortrait = orientation === 'portrait';

    // Ключ карты — "segment-row-localCol" (см. lib/board#indexRunnersByCell).
    // Переводим его в пиксельные координаты той же формулой, что уже
    // определяет визуальную позицию ячейки. Портретная: globalCol=0 внизу
    // (TOTAL_COLS-1-globalCol растёт сверху вниз, зеркалит column-reverse у
    // самих клеток), лейн слева направо, без сдвига по X (сдвиг —
    // "кирпичный", он вертикальный, см. marginTop у лейн-колонки).
    const tokenOverlay = useMemo(() => {
        const items = [];
        for (const [key, cellRunners] of runnersByCell.entries()) {
            const [segStr, rowStr, colStr] = key.split('-');
            const segment = Number(segStr);
            const row = Number(rowStr);
            const localCol = Number(colStr);
            const globalCol = segment * cols + localCol;
            const x = isPortrait
                ? row * segmentW
                : globalCol * segmentW + (row % 2 !== 0 ? segmentW / 2 : 0);
            const y = isPortrait
                ? (BOARD_LAYOUT.TOTAL_COLS - 1 - globalCol) * segmentH + (row % 2 !== 0 ? segmentH / 2 : 0)
                : row * segmentH;
            items.push({ key, x, y, topRunner: cellRunners[0], count: cellRunners.length });
        }
        return items;
    }, [runnersByCell, cols, segmentW, segmentH, isPortrait]);

    const content = (
        <>
            {Array.from({ length: rows }).map((_, laneIdx) => {
                const laneCells = gridData.filter((cell) => cell.row === laneIdx); // уже в порядке возрастания globalCol
                return (
                    <View
                        key={`lane-${laneIdx}`}
                        style={[
                            isPortrait ? styles.laneColumn : styles.row,
                            // Явная height (портрет) — без неё laneRow (flexDirection:'row',
                            // дефолтный alignItems:'stretch') растягивал/сжимал колонки лейнов
                            // под общую высоту ряда и "съедал" эффект marginTop у нечётных
                            // лейнов (кирпичная кладка пропадала целиком — баг с реального
                            // теста на Android, ровный "плиточный" рисунок вместо кирпичного).
                            isPortrait && { height: BOARD_LAYOUT.TOTAL_COLS * segmentH },
                            laneIdx % 2 !== 0 &&
                                (isPortrait ? { marginTop: segmentH / 2 } : { marginLeft: segmentW / 2 }),
                        ]}
                    >
                        {laneCells.map((cell) => {
                            const highlighted = highlightedCells?.has(cell.id) ?? false;
                            return (
                                <TouchableOpacity
                                    key={cell.id}
                                    onPress={() => onCellPress?.(cell)}
                                    style={{ width: segmentW, height: segmentH }}
                                    activeOpacity={0.75}
                                >
                                    {/* Подложка легальной клетки — под обычной картинкой типа
                                        (та полупрозрачна, opacity:0.9, так что подложка
                                        просвечивает). Раньше — рамка+цветная заливка поверх,
                                        теперь — ассет allowed_move.png под низом, РОВНО размер
                                        слота (не больше — иначе залезает на соседние сегменты,
                                        они стоят впритык без зазора). "Свечение" по краям
                                        получается за счёт того, что картинка ТИПА клетки ниже
                                        чуть МЕНЬШЕ слота (см. SEGMENT_INSET), а не за счёт того,
                                        что подложка больше. */}
                                    {highlighted && (
                                        <Image
                                            source={HIGHLIGHT_IMAGE}
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                width: segmentW,
                                                height: segmentH,
                                                resizeMode: 'stretch',
                                            }}
                                            pointerEvents="none"
                                        />
                                    )}
                                    <Image
                                        source={SEGMENT_IMAGES[cell.type] || SEGMENT_IMAGES.road}
                                        style={{
                                            position: 'absolute',
                                            left: segmentW * (SEGMENT_INSET / 2),
                                            top: segmentH * (SEGMENT_INSET / 2),
                                            width: segmentW * (1 - SEGMENT_INSET),
                                            height: segmentH * (1 - SEGMENT_INSET),
                                            resizeMode: 'stretch',
                                            opacity: 0.9,
                                        }}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                );
            })}

            <View
                style={[
                    styles.tokenOverlayLayer,
                    // Явные пиксельные width/height вместо inset-стретчинга
                    // (StyleSheet.absoluteFillObject: top/left/right/bottom:0):
                    // родитель (Animated.View) сам без явного размера — его
                    // ширина/высота выводятся из контента (строк), а не
                    // заданы числом. Стретч через отступы 0/0/0/0 у ребёнка
                    // рассчитывает на то, что размер родителя уже известен
                    // ДО этого прохода компоновки — на части рендеров/платформ
                    // это давало нулевой размер оверлея (токены пропадали
                    // целиком, а не просто не на своём месте). Числовой размер
                    // не зависит от этого нюанса компоновки.
                    isPortrait
                        ? { width: rows * segmentW, height: BOARD_LAYOUT.TOTAL_COLS * segmentH }
                        : { width: BOARD_LAYOUT.TOTAL_COLS * segmentW, height: rows * segmentH },
                ]}
                pointerEvents="none"
            >
                {tokenOverlay.map(({ key, x, y, topRunner, count }) => (
                    <View
                        key={key}
                        style={[styles.tokenLayer, { left: x, top: y, width: segmentW, height: segmentH }]}
                    >
                        <RunnerToken
                            type={topRunner.type}
                            color={playerColorById[topRunner.playerId]}
                            size={tokenSize}
                            selected={topRunner.id === selectedRunnerId}
                        />
                        {count > 1 && (
                            <View style={styles.stackBadge}>
                                <Text style={styles.stackBadgeText}>+{count - 1}</Text>
                            </View>
                        )}
                    </View>
                ))}
            </View>
        </>
    );

    return (
        <View
            style={[
                styles.container,
                isPortrait && styles.containerBottomAnchored,
                { width: containerWidth, height: containerHeight },
            ]}
            {...containerHandlers}
        >
            <Animated.View
                style={
                    isPortrait
                        ? [styles.laneRow, { transform: [{ translateY: offset }] }]
                        : { transform: [{ translateX: offset }] }
                }
            >
                {content}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { overflow: 'hidden' },
    containerBottomAnchored: { justifyContent: 'flex-end' },
    row: { flexDirection: 'row', alignItems: 'center' },
    // Дорожки расположены слева направо (портретная раскладка), каждая — свой
    // вертикальный стек ячеек. column-reverse: клетки в массиве идут по
    // возрастанию globalCol, но рисуются СНИЗУ ВВЕРХ (globalCol=0 внизу) —
    // см. шапку файла, почему это не transform, а просто другой порядок
    // укладки flexbox.
    // alignItems:'flex-start' — не дефолтный 'stretch': с ним все лейн-колонки
    // растягивались/сжимались под общую высоту ряда (см. комментарий у
    // laneColumn выше про исчезнувшую кирпичную кладку), явная height у
    // колонок это чинит только если сам ряд не пытается их дополнительно
    // растянуть.
    laneRow: { flexDirection: 'row', alignItems: 'flex-start' },
    laneColumn: { flexDirection: 'column-reverse' },
    // Один слой на всю сетку, растянутый по размеру Animated.View (сумма
    // строк/колонок) — см. комментарий в JSX про то, почему токены больше не
    // вложены в ячейки.
    tokenOverlayLayer: { position: 'absolute', top: 0, left: 0, zIndex: 2, elevation: 2 },
    tokenLayer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stackBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 14,
        height: 14,
        borderRadius: 7,
        paddingHorizontal: 3,
        backgroundColor: '#000000cc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stackBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
});
