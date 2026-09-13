// src/hooks/usePulse.js
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

// Один "прилив-отлив" (0->1 или 1->0) — по прямому запросу пользователя,
// 2026-09-14, "медленно меняет цвет" — не резкий мигающий сигнал, а мягкое
// привлечение внимания, не мешающее читать текст/цвет карточки.
const PULSE_HALF_MS = 1100;

/**
 * Общий "медленный" pulse-драйвер (0<->1, зациклен) — единая переиспользуемая
 * анимация подсказки "сюда сейчас можно/нужно взаимодействовать" во время
 * хода активного игрока (см. PulseText/PulseHighlight, GameBoardScreen,
 * PlayerInfoPanel, RunnerCard, AbilityZone — 2026-09-14).
 *
 * Реальная интерполяция ЦВЕТА (не просто пульс прозрачности) — по прямому
 * выбору пользователя после явного вопроса про эту развилку. `useNativeDriver:
 * false` ОБЯЗАТЕЛЕН — цвет не входит в набор свойств, поддерживаемых нативным
 * драйвером RN, анимация идёт JS-потоком. Это НЕ тот класс нагрузки, что уже
 * ломал производительность в истории проекта (см. CLAUDE.md, "Track 1",
 * 2026-09-02 — там одновременно проигрывались/декодировались ~240 gif) —
 * тут просто периодический пересчёт числа и обновление стиля у скромного
 * числа элементов (заголовок, рамка карточки/зоны, кнопка), без декодирования
 * каких-либо изображений.
 *
 * Один инстанс хука — один независимый цикл (не общий таймер на всё
 * приложение): несколько подсказок могут светиться параллельно (например
 * заголовок "Кубики" и панель под ним) без необходимости синхронизировать
 * фазу друг с другом.
 *
 * `active` включает/выключает цикл. При active=false — плавно (за
 * IDLE_RESET_MS) возвращается к 0 (обычный цвет/прозрачность), не зависает
 * на полпути прежнего цикла.
 */
const IDLE_RESET_MS = 220;

export function usePulse(active) {
    const value = useRef(new Animated.Value(0)).current;
    const loopRef = useRef(null);

    useEffect(() => {
        if (active) {
            loopRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(value, { toValue: 1, duration: PULSE_HALF_MS, useNativeDriver: false }),
                    Animated.timing(value, { toValue: 0, duration: PULSE_HALF_MS, useNativeDriver: false }),
                ]),
            );
            loopRef.current.start();
        } else {
            loopRef.current?.stop();
            Animated.timing(value, { toValue: 0, duration: IDLE_RESET_MS, useNativeDriver: false }).start();
        }
        return () => loopRef.current?.stop();
    }, [active, value]);

    return value;
}
