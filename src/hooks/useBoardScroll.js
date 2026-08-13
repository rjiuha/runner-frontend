// src/hooks/useBoardScroll.js
import { useCallback, useRef } from 'react';
import { Animated, Easing, PanResponder, Platform } from 'react-native';
import { useScrollAnimation } from './useScrollAnimation';

/**
 * Единый интерфейс прокрутки поля вдоль оси скролла:
 * - веб — зажатие стрелки крутит с постоянной скоростью (useScrollAnimation);
 * - мобильные — палец тащит трек (PanResponder), а стрелки листают блоками
 *   по COLS ячеек (snapToBlock).
 *
 * `axis` ('x' | 'y') — вдоль какой оси экрана идёт скролл: 'x' в альбомной
 * раскладке (доска скроллится по горизонтали), 'y' в портретной (по
 * вертикали). Сама числовая семантика offset'а (0 = начало трассы, minOffset
 * = конец) от оси не зависит — меняется только то, какую компоненту жеста
 * (dx/vx или dy/vy) читает PanResponder. Какой конкретно CSS-transform
 * (translateX/translateY) применить к результату — решает BoardGrid.
 *
 * Оба набора хуков (веб/мобильные) вызываются безусловно (Platform.OS не
 * меняется в течение жизни приложения, но условный вызов хуков всё равно
 * нарушает Rules of Hooks и был багом в прежней версии) — ветвится только то,
 * что возвращается наружу.
 */
export function useBoardScroll({ minOffset, segmentSize, cols, totalBlocks, axis = 'x', webScrollSpeed = 20 }) {
    const isWeb = Platform.OS === 'web';

    const webScroll = useScrollAnimation(minOffset, { scrollSpeed: webScrollSpeed });

    const mobileOffset = useRef(new Animated.Value(0)).current;
    const minOffsetRef = useRef(minOffset);
    const segmentSizeRef = useRef(segmentSize);
    const startOffsetRef = useRef(0);
    const isAnimatingRef = useRef(false);

    // Обновляем на каждый рендер, чтобы обработчики жестов видели актуальные
    // границы/размеры без пересоздания PanResponder.
    minOffsetRef.current = minOffset;
    segmentSizeRef.current = segmentSize;

    // По оси Y — инвертировано (-dy/-vy), по прямому запросу пользователя после
    // живого теста на Android: палец вверх должен двигать трассу вниз (открывая
    // дальше по треку), а не вверх. С осью X (альбомная раскладка) не трогаем —
    // там инверсия не запрашивалась и жест уже привычный.
    const delta = (gestureState) => (axis === 'y' ? -gestureState.dy : gestureState.dx);
    const velocity = (gestureState) => (axis === 'y' ? -gestureState.vy : gestureState.vx);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_evt, gestureState) =>
                !isAnimatingRef.current && Math.abs(delta(gestureState)) > 5,
            onPanResponderGrant: () => {
                startOffsetRef.current = mobileOffset._value;
            },
            onPanResponderMove: (_evt, gestureState) => {
                const newOffset = startOffsetRef.current + delta(gestureState);
                const clamped = Math.max(minOffsetRef.current, Math.min(0, newOffset));
                mobileOffset.setValue(clamped);
            },
            // Лёгкая инерция по скорости флика при отпускании — без снэпа к фрагментам,
            // палец по-прежнему двигает трек свободно, просто отпускание не обрывает
            // движение резко. Это грубая оценка "наката" по времени, а не физическая
            // симуляция, но на ощупь ближе к обычному тачскролу.
            onPanResponderRelease: (_evt, gestureState) => {
                const v = velocity(gestureState);
                if (Math.abs(v) < 0.15) return;

                const current = mobileOffset._value;
                const projected = current + v * 180;
                const target = Math.max(minOffsetRef.current, Math.min(0, projected));

                Animated.timing(mobileOffset, {
                    toValue: target,
                    duration: 280,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }).start();
            },
        }),
    ).current;

    const snapToBlock = useCallback(
        (direction) => {
            if (isAnimatingRef.current) return;

            const currentOffset = mobileOffset._value;
            const blockSize = cols * segmentSizeRef.current;
            const quotient = Math.floor(-currentOffset / blockSize); // 0..totalBlocks-1

            const targetBlockIndex =
                direction === 'back' ? Math.max(0, quotient - 1) : Math.min(totalBlocks - 1, quotient + 1);

            if (targetBlockIndex === quotient) return; // на границе — двигаться некуда

            // Последний блок — не чистое кратное blockSize: minOffset уже включает
            // запас на "кирпичный" сдвиг нечётных дорожек (см. useBoardLayout), иначе
            // самая дальняя дорожка в последнем блоке не долистывалась до конца.
            const targetOffset =
                targetBlockIndex === totalBlocks - 1 ? minOffsetRef.current : -targetBlockIndex * blockSize;
            isAnimatingRef.current = true;
            Animated.timing(mobileOffset, {
                toValue: targetOffset,
                duration: 300,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start(() => {
                isAnimatingRef.current = false;
            });
        },
        [cols, totalBlocks, mobileOffset],
    );

    if (isWeb) {
        return {
            offset: webScroll.xOffset,
            containerHandlers: {},
            // back = к началу трассы (offset → 0), forward = вперёд по трассе (offset → minOffset).
            backButtonProps: { onPressIn: () => webScroll.startScroll(1), onPressOut: webScroll.stopScroll },
            forwardButtonProps: { onPressIn: () => webScroll.startScroll(-1), onPressOut: webScroll.stopScroll },
        };
    }

    return {
        offset: mobileOffset,
        containerHandlers: panResponder.panHandlers,
        backButtonProps: { onPress: () => snapToBlock('back') },
        forwardButtonProps: { onPress: () => snapToBlock('forward') },
    };
}
