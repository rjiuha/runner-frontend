// src/components/game/DiceRollOverlay.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import DiceFace from './DiceFace';
import { colors, spacing } from '../../theme';

// Верхняя граница размера грани — на широких/альбомных экранах используется
// как есть. GAP фиксирован, а сам размер грани (bigSize, считается в
// компоненте от winW) сжимается на узких телефонных экранах, иначе группа
// из 4 граней шире самого экрана и вылезает за оба края (было замечено
// живьём на эмуляторе 411dp-шириной при плотности 420dpi — 4×100 + 3×GAP
// заведомо больше 411).
const MAX_BIG_SIZE = 100;
const GAP = spacing.md;
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
 * одним движением (перемещение+сжатие) переносятся В трей игрока (destRect —
 * см. PlayerInfoPanel.onDiceTrayMeasured) — БЕЗ угасания в полёте (это не
 * fade, а перенос: `diceOpacity` держится на 1 всю дорогу, дело только в
 * translateX/Y/scale). Плато и затемнение гаснут ПОСЛЕ прилёта, сами никуда
 * не летят.
 *
 * Реальный DiceTray ничего не хранит отдельно от game.player.diceN — он
 * всегда уже правильный под этим окошком, но вызывающий экран обязан прятать
 * его сам на время броска (см. onArrive ниже и DevPlaygroundScreen.
 * rollingPlayerId) — иначе настоящие значения будут видны в трее ДО того,
 * как крупные грани туда долетят.
 *
 * trigger: { nonce, values: [v1..v4], color } | null — nonce
 * меняется на каждое новое событие. destRect: { x, y, width, height } в
 * оконных координатах — куда лететь. Если ещё не измерен на момент
 * триггера — окошко просто держит настоящие значения на виду и не улетает.
 *
 * onArrive — вызывается РОВНО в момент прилёта (сразу после FLY_MS, ДО того
 * как погаснет само плато/затемнение) — этим моментом вызывающий экран
 * должен открыть настоящий DiceTray, чтобы переход выглядел как один
 * непрерывный перенос, а не две наложенные анимации. Специально НЕ через
 * `withTiming(...,callback)+runOnJS` (как раньше пробовали для onDone) —
 * этот механизм ненадёжен по таймингу на Android под нагрузкой (см. разбор
 * в CLAUDE.md про ParallaxBackground: колбэк воркета может сработать с
 * задержкой в секунду и больше, если JS-поток занят) — весь тайминг здесь
 * держится на чистых JS `setTimeout`, как и остальные стадии этого
 * компонента (тики/пауза), без единого перехода через UI-поток.
 */
export default function DiceRollOverlay({ trigger, destRect, onDone, onArrive }) {
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

    // Грань сжимается, если 4×MAX_BIG_SIZE+3×GAP не помещаются в 86% ширины
    // экрана (14% — отступы по краям, чтобы плато не упиралось в края).
    const bigSize = Math.min(MAX_BIG_SIZE, (winW * 0.86 - GAP * 3) / 4);
    const groupW = bigSize * 4 + GAP * 3;
    const groupH = bigSize;

    // startCenter — фиксированная заметная точка (центр экрана, чуть выше
    // середины — не перекрывает нижнюю панель в портретной раскладке).
    const startCenterX = winW / 2;
    const startCenterY = winH * 0.4;
    const startLeft = startCenterX - groupW / 2;
    const startTop = startCenterY - groupH / 2;

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

            // Все 4 легли на настоящие значения — держим паузу, потом
            // переносим (не гасим — см. заголовок файла) в трей.
            timersRef.current.push(
                setTimeout(() => {
                    const destCenterX = destRect.x + destRect.width / 2;
                    const destCenterY = destRect.y + destRect.height / 2;
                    const targetScale = Math.max(0.15, destRect.width / groupW);

                    dx.value = withTiming(destCenterX - startCenterX, { duration: FLY_MS, easing: Easing.in(Easing.cubic) });
                    dy.value = withTiming(destCenterY - startCenterY, { duration: FLY_MS, easing: Easing.in(Easing.cubic) });
                    scale.value = withTiming(targetScale, { duration: FLY_MS, easing: Easing.in(Easing.cubic) });
                    // diceOpacity НЕ трогаем здесь — грани остаются полностью
                    // непрозрачными весь перелёт, это перенос, а не fade.

                    // Момент прилёта — обычный JS-таймер, НЕ withTiming-колбэк
                    // (см. заголовок файла). Синхронно с вызовом onArrive
                    // (открывает настоящий трей у вызывающего экрана) гасим
                    // ГРАНИ мгновенно (без анимации — deliberately не
                    // withTiming, чтобы не было видимого fade/паузы: в этот
                    // же кадр на их месте уже открывается настоящий трей той
                    // же позиции/размера, подмена должна быть незаметна).
                    // Плато/затемнение — отдельно, гаснут ПОСЛЕ, чуть медленнее.
                    timersRef.current.push(
                        setTimeout(() => {
                            diceOpacity.value = 0;
                            onArrive?.();
                            sceneOpacity.value = withTiming(0, { duration: SCENE_OUT_MS });
                            timersRef.current.push(setTimeout(handleDone, SCENE_OUT_MS));
                        }, FLY_MS),
                    );
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
        <View pointerEvents="none" style={[styles.root, StyleSheet.absoluteFill]}>
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
                        width: groupW + PLATE_PAD * 2,
                        height: groupH + PLATE_PAD * 2,
                    },
                    sceneStyle,
                ]}
            />

            <Animated.View
                style={[
                    styles.group,
                    { left: startLeft, top: startTop, width: groupW, height: groupH },
                    diceStyle,
                ]}
            >
                {displayValues.map((v, i) => (
                    <DiceFace key={i} value={v} color={trigger.color} size={bigSize} />
                ))}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Два независимых бага, найденных живым прогоном на эмуляторе (см.
    // CLAUDE.md), оба маскировали друг друга — оверлей не было видно ВООБЩЕ:
    //
    // 1) `StyleSheet.absoluteFillObject` в react-native 0.85 БОЛЬШЕ НЕ
    //    СУЩЕСТВУЕТ (переименован в `StyleSheet.absoluteFill` — см.
    //    node_modules/react-native/Libraries/StyleSheet/StyleSheetExports.js).
    //    Обращение к нему даёт `undefined`, `{...undefined}` в объекте — тихо
    //    `{}` (не ошибка), а `undefined` в массиве стилей — тихо пропускается.
    //    В итоге ни у корневого View, ни у `scrim` не было НИКАКОГО
    //    `position:'absolute'`/размеров — они схлопывались в нулевой размер
    //    молча, без единого предупреждения в консоли. Починено переходом на
    //    `StyleSheet.absoluteFill` (см. использование ниже и в JSX).
    // 2) Даже после фикса (1) корневой View (без elevation) на Android
    //    рисовался ПОД любым соседом с elevation>0 (кнопки, `shadow.card` на
    //    карточках) — Android переупорядочивает по elevation ВСЕХ прямых
    //    детей общего родителя, независимо от порядка в JSX. `elevation`
    //    ниже у `plate`/`group` (12/999) упорядочивает их только ДРУГ
    //    ОТНОСИТЕЛЬНО ДРУГА внутри этого компонента — самому корню это не
    //    помогает, нужен свой elevation, отдельно и обязательно.
    //
    // Это НЕ тот баг, что был у ParallaxBackground (там ломалась видимость
    // Animated.Image под рекурсивной анимацией через withTiming-колбэк) —
    // тут статическая ошибка позиционирования + обычный Android
    // Z-reordering, ничего общего с Reanimated.
    root: {
        zIndex: 999,
        elevation: 999,
    },
    scrim: {
        ...StyleSheet.absoluteFill,
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
