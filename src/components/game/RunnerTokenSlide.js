// src/components/game/RunnerTokenSlide.js
import React, { useLayoutEffect, useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { createLogger } from '../../lib/logger';

const log = createLogger('SLIDEDBG'); // ВРЕМЕННО — диагностика "телепорт/исчезновение", убрать после

// Длительность слайда между клетками — примерно совпадает с длительностью
// самой pose-анимации (ANIM_DURATION_MS.move в useRunnerAnimations), чтобы
// бегун и визуально доехал до новой клетки, и "движение ногами" длилось
// примерно столько же, не рассинхронизируясь. Вдвое медленнее исходных 850 —
// по прямому запросу пользователя, 2026-08-31 (держим в паре с move там же).
// На 20% быстрее (2026-09-02, по прямому запросу пользователя) — 1700×0.8.
export const SLIDE_DURATION_MS = 1360;

/**
 * Обёртка токена бегуна на доске — плавно СКОЛЬЗИТ от предыдущей позиции к
 * новой при каждом изменении x/y, вместо мгновенного "телепорта" (жалоба
 * пользователя, 2026-08-31: "хочу, чтобы он именно перемещался с помощью
 * анимаций, а не телепортировался из клетки в клетку").
 *
 * Механика: left/top — ВСЕГДА актуальная (целевая) позиция клетки, меняется
 * мгновенно вместе с рендером (никакой рассинхронизации с реальным game-
 * стейтом). Визуальное скольжение — отдельным transform (translateX/Y),
 * который на каждое изменение x/y мгновенно выставляется в "минус дельта"
 * (визуально токен остаётся на СТАРОМ месте, хотя left/top уже на новом) и
 * анимируется обратно к нулю — то есть в итоге токен едет от старой позиции
 * к новой, а базовая позиция (left/top) весь путь уже "правильная".
 *
 * КРИТИЧНО: React key в BoardGrid для этого компонента должен быть id
 * БЕГУНА, а не ключ клетки — иначе при каждом перемещении (клетка меняется)
 * компонент бы пересоздавался и Animated.ValueXY (см. ref ниже) терял бы
 * состояние, скольжение никогда бы не проигрывалось.
 *
 * useLayoutEffect, НЕ useEffect — обычный useEffect выполняется ПОСЛЕ отрисовки
 * кадра: React успевал бы отрисовать новые left/top (уже целевая клетка) ДО
 * того, как компенсирующий transform выставлялся в "минус дельта" — на один
 * кадр токен был реально виден в конечной точке, потом резко "прыгал" обратно
 * в исходную и только тогда начинал ехать (жалоба пользователя, 2026-08-31).
 * useLayoutEffect выполняется синхронно до того, как обновление уходит на
 * отрисовку — прыжка в исходную позицию никто не видит.
 *
 * `windowStart` — текущий сдвиг видимого окна прокрутки (см. useBoardScroll/
 * BoardGrid). x/y меняются НЕ только когда бегун реально сходил с клетки на
 * клетку, но и когда игрок просто пролистал дорогу стрелками — окно
 * прокрутки сдвинулось, localCol у всех токенов пересчитался, x/y "поехали",
 * хотя сам бегун стоит на месте. Раньше это тоже проигрывало слайд-анимацию
 * (жалоба пользователя, 2026-08-31, второй заход: "при скролле персонажи
 * медленно перемещаются на клетки, так быть не должно, они должны
 * перемещаться как сегменты — моментально"). Та же история с `width`/
 * `height` (= segmentW/segmentH) — они меняются при ресайзе/повороте окна
 * (новый segmentSize пересчитан целиком, см. useBoardLayout), токен опять
 * "едет" на новое место вместо мгновенного скачка вместе с самой сеткой
 * (третья жалоба пользователя, 2026-08-31, тот же день). Фикс — общий:
 * следим за изменением windowStart И width/height ОТДЕЛЬНО от x/y — если
 * что-то из них изменилось с прошлого рендера, применяем новую x/y
 * МГНОВЕННО (сброс translate в 0 без Animated.timing), не дожидаясь
 * следующего реального перемещения бегуна, которое уже будет анимировано
 * как обычно.
 *
 * `enterFrom` (2026-09-07, Жнец — см. GameBoardScreen#reaperPreview) —
 * необязательные {x,y}, ОТКУДА должен приехать элемент на своём первом же
 * рендере (обычно точка за краем видимой доски), вместо обычного правила
 * "первый рендер — ехать неоткуда, ставим сразу". Не влияет на поведение,
 * если не передан — существующие токены первый раз появляются мгновенно,
 * как и раньше.
 *
 * `duration` (2026-09-09) — необязательное переопределение SLIDE_DURATION_MS
 * ДЛЯ ЭТОГО КОНКРЕТНОГО токена, не трогая общую константу (та расшарена на
 * ВСЕ обычные перемещения по доске) — нужно для "прилёта" Жнеца из резерва
 * (см. BoardGrid#reaperPreviewItem), которую по прямому запросу пользователя
 * замедлили вдвое относительно обычного шага, не касаясь скорости шагов
 * остальных бегунов.
 *
 * **"Дёрганье": едет → на мгновение откатывается назад → резко продолжает с
 * середины** (2026-09-13, живая жалоба, идентичный паттерн уже не раз
 * встречался в этом проекте под разными масками — см. CLAUDE.md). Настоящая
 * причина именно ЭТОГО симптома — `fromPos = prevPos.current` брал
 * ЛОГИЧЕСКУЮ предыдущую цель (куда токен ДОЛЖЕН был доехать), а не ту точку,
 * где он ВИЗУАЛЬНО находится ПРЯМО СЕЙЧАС. Если новая x/y (см.
 * `visualPositions`/очередь в useRunnerAnimations) приходит РАНЬШЕ, чем
 * предыдущий `Animated.timing` успел доехать до 0 (два шага очереди почти
 * подряд — обычное дело для составного хода), `translate.setValue({x:dx,...})`
 * БЕЗУСЛОВНО ПЕРЕЗАПИСЫВАЛ текущее (ещё ненулевое, "в полёте") значение —
 * визуально это и есть "откат назад" (токен скачком уезжает в точку,
 * рассчитанную от СТАРОЙ цели, а не от того места, где он летел долю секунды
 * назад), после чего новая анимация везёт его дальше — "резкое продолжение".
 * Фикс — следим за РЕАЛЬНЫМ (а не только логическим) значением translate через
 * `addListener` (общепринятый способ прочитать текущее число из Animated.Value
 * — даже под `useNativeDriver`, RN периодически синхронизирует JS-значение
 * обратно) и, начиная новый слайд, ДОБАВЛЯЕМ его к вычисленной дельте, а не
 * заменяем целиком — если предыдущая анимация уже осела в 0 (обычный случай),
 * это ничего не меняет (0+dx=dx, как и было), а если ещё в полёте — сохраняет
 * визуальную непрерывность вместо скачка.
 */
export default function RunnerTokenSlide({ x, y, width, height, style, children, windowStart, enterFrom, duration = SLIDE_DURATION_MS }) {
    const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const prevPos = useRef(null);
    const prevWindowStart = useRef(windowStart);
    const prevSize = useRef({ width, height });
    const currentTranslateRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const id = translate.addListener((value) => { currentTranslateRef.current = value; });
        return () => translate.removeListener(id);
    }, [translate]);

    useLayoutEffect(() => {
        const scrolled = prevWindowStart.current !== windowStart;
        prevWindowStart.current = windowStart;
        const resized = prevSize.current.width !== width || prevSize.current.height !== height;
        prevSize.current = { width, height };

        const isFirstRender = prevPos.current == null;
        const fromPos = isFirstRender ? (enterFrom ?? { x, y }) : prevPos.current;
        prevPos.current = { x, y };

        if (isFirstRender && !enterFrom) {
            log('first render (no enterFrom), x=', x, 'y=', y);
            return; // обычный первый рендер — ехать неоткуда
        }

        const dx = fromPos.x - x;
        const dy = fromPos.y - y;
        if (dx === 0 && dy === 0) return;
        log('move: from=', fromPos, 'to=', { x, y }, 'isFirstRender=', isFirstRender, 'scrolled=', scrolled, 'resized=', resized);

        if (!isFirstRender && (scrolled || resized)) {
            translate.setValue({ x: 0, y: 0 }); // мгновенно, как и сами сегменты сетки
            return;
        }

        // ДОБАВЛЯЕМ к текущему (возможно ещё "в полёте") значению, а не
        // заменяем — см. докстринг компонента про "дёрганье".
        translate.setValue({
            x: dx + currentTranslateRef.current.x,
            y: dy + currentTranslateRef.current.y,
        });
        Animated.timing(translate, {
            toValue: { x: 0, y: 0 },
            duration,
            useNativeDriver: true,
        }).start();
    }, [x, y, width, height, windowStart, translate, enterFrom, duration]);

    return (
        <Animated.View
            style={[
                style,
                { position: 'absolute', left: x, top: y, width, height },
                { transform: translate.getTranslateTransform() },
            ]}
        >
            {children}
        </Animated.View>
    );
}
