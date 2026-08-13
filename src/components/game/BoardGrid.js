// src/components/game/BoardGrid.js
import React, { useMemo } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BOARD_LAYOUT, SEGMENT_IMAGES } from '../../constants/GameConstants';
import { indexRunnersByCell } from '../../lib/board';
import RunnerToken from './RunnerToken';
import { colors } from '../../theme';

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
 * (начало трассы у панели игрока внизу экрана), а не сверху вниз. Городить
 * для этого отдельную систему координат offset'а (0=начало/minOffset=конец —
 * та же семантика, что уже проверена и используется в альбомной раскладке)
 * не стали: контент строится в "естественной" системе (positionX=0 сверху,
 * растёт вниз — прямая зеркальная копия альбомной X-логики), а результат
 * целиком отражается по вертикали одним `transform: scaleY(-1)` на обёртке.
 * Из-за этого отражения все ЛИСТОВЫЕ визуальные элементы внутри (картинка
 * клетки, токен бегуна) получают контр-отражение (тоже `scaleY(-1)`), чтобы
 * сами по себе выглядеть не перевёрнутыми — переворачивается только их
 * ПОЗИЦИЯ, не содержимое.
 *
 * Второй обязательный кусок геометрии — контент (H = TOTAL_COLS*segmentH)
 * значительно выше вьюпорта (containerHeight — весь оставшийся вертикальный
 * бюджет экрана, не обязательно кратный одному фрагменту, см. useBoardLayout).
 * По умолчанию RN прижимает такой контент к ВЕРХУ контейнера, обрезая лишнее
 * снизу — а нужно наоборот (см. `containerBottomAnchored`/justifyContent:
 * 'flex-end' на внешнем `container`), иначе при offset=0 в видимой части
 * оказывается ДАЛЬНИЙ конец трассы, а не начало. Именно сочетание "отражение
 * по Y" + "якорь контента к низу вьюпорта" даёт нужный результат: при offset=0
 * видно начало трассы (globalCol 0 и далее, сколько влезет по высоте вьюпорта)
 * у панели игрока внизу экрана, а по мере скролла (offset уходит в minOffset,
 * та же схема, что и в альбомной раскладке) дальнейшие сегменты трассы
 * въезжают СВЕРХУ. Разобрано на бумаге
 * построчно (система линейных уравнений на container_y от pre_shift_y и
 * offset), но НЕ проверено визуально (нет доступа к устройству/браузеру из
 * сессии) — если направление скролла или что закрывает что выйдет не так,
 * смотреть сюда в первую очередь.
 *
 * Токены бегунов в обеих раскладках рисуются ОДНИМ отдельным абсолютным
 * слоем НАД всей сеткой целиком (внутри той же прокручиваемой Animated.View,
 * чтобы ехать вместе со скроллом), с пиксельными координатами, посчитанными
 * вручную — раньше (на Android, в альбомной раскладке) токены, вложенные в
 * каждую ячейку, иногда рисовались ПОД картинкой сегмента (view-flattening),
 * отдельный слой поверх сетки это обходит независимо от компоновки ячейки.
 *
 * Тап по клетке всегда сообщается наружу через onCellPress: используется и
 * для звука/фидбека, и для тап-плейсмента выбранного бегуна. Формат cell.id
 * ("segment-row-col") и семантика row/col/blockIndex одинаковы в обеих
 * раскладках — меняется только то, как клетки визуально расположены на
 * экране, не координаты, которые видит GameBoardScreen.
 */
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
    // определяет визуальную позицию ячейки — отдельно для каждой раскладки
    // (портретная — в "естественной" до-отражения системе, см. шапку файла).
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
                ? globalCol * segmentH + (row % 2 !== 0 ? segmentH / 2 : 0)
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
                                    <Image
                                        source={SEGMENT_IMAGES[cell.type] || SEGMENT_IMAGES.road}
                                        style={[
                                            {
                                                width: segmentW,
                                                height: segmentH,
                                                resizeMode: 'stretch',
                                                opacity: 0.9,
                                            },
                                            isPortrait && styles.counterFlip,
                                        ]}
                                    />
                                    {highlighted && <View style={styles.highlight} pointerEvents="none" />}
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
                        style={[
                            styles.tokenLayer,
                            { left: x, top: y, width: segmentW, height: segmentH },
                            isPortrait && styles.counterFlip,
                        ]}
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
                // Контент (H = TOTAL_COLS*segmentH) ЗНАЧИТЕЛЬНО выше вьюпорта
                // (containerHeight = COLS*segmentH, один фрагмент) — без явного
                // якоря он по умолчанию прижимается к ВЕРХУ контейнера (лишняя
                // высота обрезается снизу overflow:hidden), а нужно наоборот:
                // якорь к НИЗУ (лишняя высота обрезается сверху), чтобы при
                // offset=0 в видимой области сразу оказался globalCol=0..7
                // (начало трассы, у панели игрока внизу экрана), а не дальний
                // конец. См. подробный разбор в шапке файла.
                isPortrait && styles.containerBottomAnchored,
                { width: containerWidth, height: containerHeight },
            ]}
            {...containerHandlers}
        >
            {isPortrait ? (
                // Один Animated.View с ОБОИМИ трансформами (не вложенные View
                // mirror+translate по отдельности, как было раньше) — порядок в
                // массиве важен: translateY первым (сдвиг в "естественной",
                // до-отражения системе координат), scaleY вторым (отражает уже
                // сдвинутый результат целиком). Меньше вложенности — меньше
                // шансов на артефакты overflow:hidden+transform на Android.
                <Animated.View
                    style={[styles.laneRow, { transform: [{ translateY: offset }, { scaleY: -1 }] }]}
                >
                    {content}
                </Animated.View>
            ) : (
                <Animated.View style={{ transform: [{ translateX: offset }] }}>{content}</Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { overflow: 'hidden' },
    containerBottomAnchored: { justifyContent: 'flex-end' },
    row: { flexDirection: 'row', alignItems: 'center' },
    // Дорожки расположены слева направо (портретная раскладка), каждая — свой
    // вертикальный стек ячеек по возрастанию globalCol (см. шапку файла).
    laneRow: { flexDirection: 'row' },
    laneColumn: { flexDirection: 'column' },
    // Контр-отражение листовых визуальных элементов (картинка клетки, токен
    // бегуна) — родительский Animated.View целиком отражён по Y (см. JSX,
    // transform: translateY+scaleY) для "снизу вверх"; это возвращает САМО
    // содержимое (не позицию) в нормальную ориентацию.
    counterFlip: { transform: [{ scaleY: -1 }] },
    // Легальная клетка для тапа в текущем шаге (MOVE/SHOOT/reaper-размещение/
    // первый выход на трассу) — см. highlightedCells, считает GameBoardScreen.
    // Симметричная рамка — контр-отражение ей не нужно.
    highlight: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 3,
        borderColor: colors.success,
        backgroundColor: `${colors.success}33`,
    },
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
