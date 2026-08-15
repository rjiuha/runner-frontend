// src/components/game/DiceRollOverlay.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import DiceFace from './DiceFace';
import { colors, spacing } from '../../theme';

const BIG_SIZE = 100;
const GAP = spacing.md;
const GROUP_W = BIG_SIZE * 4 + GAP * 3;
const GROUP_H = BIG_SIZE;
const PLATE_PAD = 28;

const TICK_MS = 90;
// Кубик i "останавливается" (перестаёт мерцать, ложится на настоящее
// значение) на этом тике — по одному, а не все разом, "тик-тик-тик-тик".
const LOCK_ON_TICK = [6, 7, 8, 9];
const TOTAL_TICKS = LOCK_ON_TICK[LOCK_ON_TICK.length - 1];
const SETTLE_HOLD_MS = 550; // держим настоящие значения на виду, прежде чем улететь
const FLY_MS = 500;
const SCENE_IN_MS = 180;
const SCENE_OUT_MS = 250;

// Полная длительность одного цикла — экспортируется, чтобы экраны,
// запускающие броски ПОДРЯД (см. "Бросить всем по очереди" в
// DevPlaygroundScreen), не подбирали задержку между игроками на глаз, а
// брали её отсюда — единственный источник правды по тайминг у.
export const DICE_ROLL_SEQUENCE_MS = TICK_MS + TOTAL_TICKS * TICK_MS + SETTLE_HOLD_MS + FLY_MS + SCENE_OUT_MS + 150;

const randFace = () => 1 + Math.floor(Math.random() * 6);

/**
 * Большое окошко броска кубиков перемещения (player_roll_move_dice): на
 * затемнённом плато 4 крупные грани мерцают, по очереди останавливаются на
 * настоящих значениях (уже известных на момент триггера — мерцание чисто
 * декоративное), держат паузу, чтобы игрок успел прочитать результат, и
 * одним движением (перемещение+сжатие) улетают в трей игрока (destRect —
 * см. PlayerInfoPanel.onDiceTrayMeasured). Плато и затемнение остаются на
 * месте и гаснут ПОСЛЕ того как кубики долетели, сами никуда не летят.
 *
 * Реальный DiceTray ничего не хранит отдельно от game.player.diceN — он
 * всегда уже правильный под этим окошком, оно просто визуально накрывает
 * его до момента прилёта.
 *
 * trigger: { nonce, values: [v1..v4], color } | null — nonce
 * меняется на каждое новое событие. destRect: { x, y, width, height } в
 * оконных координатах — куда лететь. Если ещё не измерен на момент
 * триггера — окошко просто держит настоящие значения на виду и не улетает.
 */
export default function DiceRollOverlay({ trigger, destRect, onDone }) {
    const { width: winW, height: winH } = useWindowDimensions();

    const [visible, setVisible] = useState(false);
    const [displayValues, setDisplayValues] = useState([1, 1, 1, 1]);

    const dx = useSharedValue(0);
    const dy = useSharedValue(0);
    const scale = useSharedValue(1);
    const diceOpacity = useSharedValue(0);
    const sceneOpacity = useSharedValue(0);

    const timersRef = useRef([]);
    const clearTimers = useCallback(() => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    }, []);

    useEffect(() => clearTimers, [clearTimers]);

    // startCenter — фиксированная заметная точка (центр экрана, чуть выше
    // середины — не перекрывает нижнюю панель в портретной раскладке).
    const startCenterX = winW / 2;
    const startCenterY = winH * 0.4;
    const startLeft = startCenterX - GROUP_W / 2;
    const startTop = startCenterY - GROUP_H / 2;

    useEffect(() => {
        if (!trigger || destRect == null) return;
        clearTimers();

        setVisible(true);
        setDisplayValues([randFace(), randFace(), randFace(), randFace()]);
        dx.value = 0;
        dy.value = 0;
        scale.value = 1;
        diceOpacity.value = withTiming(1, { duration: SCENE_IN_MS });
        sceneOpacity.value = withTiming(1, { duration: SCENE_IN_MS });

        let tick = 0;
        const runTick = () => {
            tick += 1;
            setDisplayValues((prev) =>
                prev.map((v, i) => (LOCK_ON_TICK[i] <= tick ? trigger.values[i] : randFace())),
            );
            if (tick < TOTAL_TICKS) {
                timersRef.current.push(setTimeout(runTick, TICK_MS));
                return;
            }

            // Все 4 легли на настоящие значения — держим паузу, потом летим.
            timersRef.current.push(
                setTimeout(() => {
                    const destCenterX = destRect.x + destRect.width / 2;
                    const destCenterY = destRect.y + destRect.height / 2;
                    const targetScale = Math.max(0.15, destRect.width / GROUP_W);

                    dx.value = withTiming(destCenterX - startCenterX, { duration: FLY_MS, easing: Easing.in(Easing.cubic) });
                    dy.value = withTiming(destCenterY - startCenterY, { duration: FLY_MS, easing: Easing.in(Easing.cubic) });
                    scale.value = withTiming(targetScale, { duration: FLY_MS, easing: Easing.in(Easing.cubic) });
                    // Кубики гаснут точно к моменту прилёта; плато — чуть
                    // позже (SCENE_OUT_MS), после того как результат уже
                    // передан игроку, а не одновременно с ним.
                    diceOpacity.value = withTiming(0, { duration: FLY_MS }, (finished) => {
                        if (!finished) return;
                        sceneOpacity.value = withTiming(0, { duration: SCENE_OUT_MS }, (f2) => {
                            if (f2) runOnJS(handleDone)();
                        });
                    });
                }, SETTLE_HOLD_MS),
            );
        };
        timersRef.current.push(setTimeout(runTick, TICK_MS));

        function handleDone() {
            setVisible(false);
            onDone?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger?.nonce]);

    const diceStyle = useAnimatedStyle(() => ({
        opacity: diceOpacity.value,
        transform: [{ translateX: dx.value }, { translateY: dy.value }, { scale: scale.value }],
    }));
    const sceneStyle = useAnimatedStyle(() => ({ opacity: sceneOpacity.value }));
    // Затемнение фона — мягче самого плато (максимум 0.6, не 1), тот же
    // sceneOpacity, отдельная кривая, а не общий style, иначе оно бы тоже
    // доходило до непрозрачного чёрного.
    const scrimStyle = useAnimatedStyle(() => ({ opacity: sceneOpacity.value * 0.6 }));

    if (!visible || !trigger) return null;

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <Animated.View style={[styles.scrim, scrimStyle]} />

            {/* Не завязано на цвет игрока — общий фон для всех бросков.
                Остаётся на месте и гаснет ПОСЛЕ отлёта кубиков, само никуда
                не летит. */}
            <Animated.View
                style={[
                    styles.plate,
                    {
                        left: startLeft - PLATE_PAD,
                        top: startTop - PLATE_PAD,
                        width: GROUP_W + PLATE_PAD * 2,
                        height: GROUP_H + PLATE_PAD * 2,
                    },
                    sceneStyle,
                ]}
            />

            <Animated.View
                style={[
                    styles.group,
                    { left: startLeft, top: startTop, width: GROUP_W, height: GROUP_H },
                    diceStyle,
                ]}
            >
                {displayValues.map((v, i) => (
                    <DiceFace key={i} value={v} color={trigger.color} size={BIG_SIZE} />
                ))}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#08070d',
    },
    plate: {
        position: 'absolute',
        backgroundColor: colors.ritualBezel,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: colors.ritualBezelEdge,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 12,
    },
    group: {
        position: 'absolute',
        flexDirection: 'row',
        gap: GAP,
        zIndex: 999,
        elevation: 999,
    },
});
