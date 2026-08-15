// src/components/game/DiceDie.js
import React, { useCallback, useRef } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { DICE_FACE_IMAGES } from '../../constants/GameConstants';
import { colors } from '../../theme';

// Веб vs native — разные стратегии позиционирования во время драга, см.
// комментарий у DiceDie ниже.
const IS_WEB = Platform.OS === 'web';

/**
 * Один кубик перемещения — перетаскивается на зону усиления (AbilityZones)
 * или карточку бегуна (RunnerCard).
 *
 * **Веб**: кубик визуально "прилипает" ЦЕНТРОМ ровно к текущей точке курсора
 * (`e.absoluteX/Y`), хит-тест (`onDragMove`/`onDrop`) шлёт ТУ ЖЕ точку — то,
 * что видно, и то, что хит-тестится, совпадают по построению. Проверено
 * живым прогоном через автоматизацию с реальными trusted pointer-событиями.
 * Смещение для transform — (`absoluteX/Y` минус `origin`, координаты кубика
 * в покое из `measureInWindow`).
 *
 * **Native (Android/iOS)**: используем `origin + e.translationX/Y` — ЧИСТАЯ
 * ДЕЛЬТА с начала жеста (не завязана на оконные координаты вообще), в
 * отличие от `e.absoluteX/Y`. Причина расхождения с вебом: живой прогон на
 * реальном Android-устройстве показал, что кубик при драге визуально
 * оказывается смещён от пальца, а хит-тест карточек бегунов срабатывает
 * только в узкой полосе, не по всей видимой карточке — похоже на системный
 * сдвиг между `measureInWindow` (оконные координаты) и `e.absoluteX/Y` от
 * gesture-handler на Android (вероятный кандидат — edge-to-edge/статус-бар,
 * не подтверждено физическим устройством из сессии). `e.translationX/Y` —
 * дельта заведомо ИММУННА к такому сдвигу (он одинаково входит и вычитается
 * из обеих точек, между которыми считается разница), а на native (в отличие
 * от web-реализации gesture-handler) её вычисляет нативный код — там не было
 * найдено проблемы "translation застревает в 0", это была именно
 * веб-специфика синтетического автоматизированного ввода (см. историю в
 * CLAUDE.md, двадцатый заход).
 *
 * При неудачном дропе (мимо зоны или зона не принимает текущее значение)
 * пружиной возвращается на место — сам факт "не долетел" уже понятная
 * обратная связь, без дополнительных попапов.
 *
 * "Использованный" слот (value === null — кубик уже отдан на усиление)
 * жест не ловит и рисуется как пустое место, а не тусклая кость.
 * draggable=false — кубик виден (не отдан), но жест выключен: не мой ход
 * или не тот шаг хода (см. dragMode в PlayerInfoPanel).
 */
export default function DiceDie({ value, draggable = true, onDragMove, onDrop, size = 44 }) {
    const originX = useSharedValue(0);
    const originY = useSharedValue(0);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const dragging = useSharedValue(false);
    const dieRef = useRef(null);

    const measure = useCallback(() => {
        // requestAnimationFrame — см. тот же приём и объяснение в RunnerCard.js.
        requestAnimationFrame(() => {
            dieRef.current?.measureInWindow((x, y, width, height) => {
                originX.value = x + width / 2;
                originY.value = y + height / 2;
            });
        });
    }, [originX, originY]);

    const pan = Gesture.Pan()
        .enabled(value != null && draggable)
        .onStart(() => {
            dragging.value = true;
        })
        .onUpdate((e) => {
            if (IS_WEB) {
                translateX.value = e.absoluteX - originX.value;
                translateY.value = e.absoluteY - originY.value;
                if (onDragMove) runOnJS(onDragMove)(e.absoluteX, e.absoluteY, value);
            } else {
                translateX.value = e.translationX;
                translateY.value = e.translationY;
                if (onDragMove) runOnJS(onDragMove)(originX.value + e.translationX, originY.value + e.translationY, value);
            }
        })
        .onEnd((e) => {
            if (!onDrop) return;
            if (IS_WEB) {
                runOnJS(onDrop)(e.absoluteX, e.absoluteY, value);
            } else {
                runOnJS(onDrop)(originX.value + e.translationX, originY.value + e.translationY, value);
            }
        })
        .onFinalize(() => {
            dragging.value = false;
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: dragging.value ? 1.18 : 1 },
        ],
        zIndex: dragging.value ? 10 : 1,
        // На вебе поверх едет независимый "призрак" кубика (см. dragGhost в
        // PlayerInfoPanel) — без этого во время драга были видны ДВА кубика
        // одновременно (этот, застрявший под карточкой по стекингу, и призрак
        // поверх неё). На native призрака нет — там сам кубик и есть обратная
        // связь, прятать нечего.
        opacity: Platform.OS === 'web' && dragging.value ? 0 : 1,
    }));

    if (value == null) {
        return <View style={[styles.emptySlot, { width: size, height: size, borderRadius: size / 2 }]} />;
    }

    return (
        <GestureDetector gesture={pan}>
            <Animated.View ref={dieRef} onLayout={measure} style={[styles.die, { width: size, height: size }, animatedStyle]}>
                <Image
                    source={DICE_FACE_IMAGES[value]}
                    style={{ width: size, height: size }}
                    resizeMode="contain"
                />
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    die: { alignItems: 'center', justifyContent: 'center' },
    emptySlot: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.textOnDarkSecondary,
        opacity: 0.4,
    },
});
