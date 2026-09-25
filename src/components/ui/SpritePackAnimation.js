// src/components/ui/SpritePackAnimation.js
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image, PixelRatio, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, runOnJS } from 'react-native-reanimated';
import { createLogger } from '../../lib/logger';

// ВРЕМЕННО — диагностика "поза обрывается раньше срока" (acid/destroyed/
// attack пропадают через пару кадров), 2026-09-25, см. CLAUDE.md — не
// убирать, пока не закрыто. Тот же приём, что SLIDEDBG/WINDBG в
// RunnerTokenSlide.js/BoardGrid.js.
const poseLog = createLogger('POSEDBG');

// Пак не несёт per-frame тайминги (в отличие от старых gif, у которых была
// своя, авторская задержка на кадр) — единая, приблизительная скорость на
// все клипы всех типов. НЕ откалибровано живьём (нет доступа к устройству в
// эту сессию) — если конкретный клип будет казаться слишком быстрым/
// медленным, это первое, что стоит подстроить.
const DEFAULT_FRAME_MS = 120;

/**
 * Рендерит один кадр (или зацикленную анимацию по всем кадрам полоски)
 * нового AI-спрайт-пака (constants/spritePacks.js). `frame` — результат
 * resolveSpriteRef/resolveSpriteAvatarFrame: `{ source, cell:{w,h},
 * sheet:{w,h}, row, frameCount }` — `source` теперь ВСЕГДА ссылается на
 * отдельный PNG-файл ОДНОЙ анимации (полоску кадров подряд по горизонтали,
 * `row` всегда 0), НЕ на полный многострочный лист — см. находку 2026-09-24
 * ниже, почему это важно, не только "красивая архитектура".
 *
 * `boxSize` — фиксированный квадратный бокс, персонаж не "прыгает в размере"
 * при смене позы даже если у разных клипов/типов разный `cell.w/h` —
 * "contain"-масштаб по большей стороне ячейки, кадр центрируется внутри
 * неизменного boxSize×boxSize. `staticFrameIndex` — если задан (аватар в
 * панели игрока), рисует этот ОДИН кадр без анимации. Если не задан —
 * проигрывает все `frame.frameCount` кадров полоски, шаг — мгновенный
 * "прыжок" (ступенчато, не блендится), каждые `frameDurationMs`.
 *
 * `loop` (default true) — 2026-09-24, по прямому запросу пользователя
 * ("начинались с первого кадра и заканчивались последним в одном цикле для
 * start... и для остальных тоже, чтобы без сюрпризов"). `RunnerToken.js`
 * передаёт `loop=true` для idle/move/fly/collision (крутятся, пока их не
 * прервёт настоящий сигнал завершения снаружи — см. useRunnerAnimations.js),
 * `false` для остальных транзиентных поз (играются РОВНО один раз, конец
 * сигналит `onComplete`).
 *
 * **2026-09-25, ВТОРОЙ архитектурный заход — переход с `setInterval`+React-
 * state на `react-native-reanimated` (`useFrameCallback`)**. По прямому
 * запросу пользователя: вся сессия этого дня упиралась в один и тот же
 * класс багов — "JS-таймер (setInterval/setTimeout) не совпадает с тем, что
 * реально нарисовано на экране" (см. историю в useRunnerAnimations.js).
 * Кадровый шаг через `setInterval` — ЭТА ЖЕ болезнь: тикает на JS-потоке,
 * который может подтормозить относительно реального кадра экрана (GC,
 * обработка Mercure-события, что угодно ещё). `useFrameCallback` вызывается
 * Reanimated'ом НА КАЖДЫЙ реальный кадр отрисовки (UI-поток), кадр считается
 * от `frameInfo.timestamp` (реальные часы рендера), а не от накопленных
 * `setTimeout`-тиков.
 *
 * **Известный смежный риск, учтённый заранее** — в этом же проекте
 * (`ParallaxBackground.js`) уже был живьём подтверждённый Android-баг:
 * `Animated.Image` (Reanimated) под НЕПРЕРЫВНО анимируемым transform-ом
 * полностью пропадал на Android (анимация честно крутилась по логам,
 * картинка просто не рисовалась) — причина там была в способе рестарта
 * цикла (рекурсивный ворклет-колбэк), не обязательно применимо 1-в-1 к
 * `useFrameCallback` (тот тикает сам, без цепочки перезапусков), но раз
 * прецедент "Android + Animated.Image + непрерывная анимация" в этом же
 * кодовом стиле уже был — сама картинка (`<Image>` ниже) остаётся ОБЫЧНОЙ,
 * НЕ анимированной. Анимируется (через `useAnimatedStyle`) только
 * ОБЁРТЫВАЮЩИЙ `Animated.View` (`left`) — тот же паттерн, что уже
 * проверенно работает в `RunnerTokenSlide.js` (двигается View, содержимое
 * внутри статично). НЕ подтверждено живьём в этой сессии.
 *
 * `frameIdxSV`/`clipStartTsRef`/`completedRef` — shared values (UI-поток),
 * не React state — переключение кадра больше НЕ вызывает React-рендер
 * вообще (раньше `setFrameIdx` на каждый тик перерисовывал компонент).
 * Сброс на новый клип — обычный `useEffect` (не `useLayoutEffect`, как было
 * у старого `setFrameIdx(0)` — тем эффект был нужен ИМЕННО для React-рендера
 * до покраски; shared value не участвует в покраске React напрямую, гонка
 * того класса тут невозможна в принципе).
 *
 * **Живая регрессия, найденная и исправленная ДО перехода на Reanimated,
 * актуальна и здесь — `completedRef`-гейт**: если non-loop клип уже
 * доиграл (`completedRef.value === true`) и ЗАСТЫЛ на последнем кадре, а
 * `loop` внешне флипнется в `true` ПОКА `displayedFrame` всё ещё держит
 * этот же (уже доигравший) клип (см. "прогрузка перед показом" ниже —
 * держим старый клип, пока следующий не задекодируется) — БЕЗ этого гейта
 * ворклет начал бы заново мотать `raw % frameCount` от уже огромного
 * `elapsed`, то есть клип "ожил" бы и снова начал бы крутиться по кругу
 * вместо статичного удержания последнего кадра (тот же симптом, что и баг
 * с `loop` в deps старого `setInterval`-эффекта, см. историю ниже в
 * CLAUDE.md). Гейт останавливает ворклет полностью, как только клип
 * доиграл, — трогает `frameIdxSV`/тикает дальше только следующий, ДЕЙСТВИТЕЛЬНО
 * новый клип (сброс — см. reset-эффект).
 *
 * **НАСТОЯЩАЯ причина размытия на Android, найдена 2026-09-24 живым
 * бок-о-бок сравнением на реальном устройстве (не масштаб/DP/transform,
 * хотя все три подозревались и проверялись по очереди первыми)** — сам факт
 * рендера ОГРОМНОГО многострочного PNG-листа (у некоторых типов — под
 * 3068×4956, ~60МБ decoded RGBA) через `overflow:hidden`-clip: Android
 * рендерит такой лист размыто НЕЗАВИСИМО от того, как именно вырезается
 * видимое окно и в каком масштабе показывается результат. Подтверждено
 * методичным исключением переменных одну за другой, каждый раз с живым
 * сравнением на устройстве: (1) деление на PixelRatio (decode 1:1 вместо
 * скрытого decode-time апскейла под DP*pixelRatio) — не помогло; (2) возврат
 * нативного разрешения ассетов (236px вместо ужатых 110/150px) — не помогло;
 * (3) полное отображение БЕЗ всякого масштабирования (`scale=1`) — не
 * помогло; (4) уборка `transform:translateX/Y` (смена кадра через
 * layout-позиционирование `left`/`top` вместо GPU-матрицы) — НЕ помогло;
 * (5) уборка ПОСЛЕДНЕГО оставшегося `transform:scale` (масштаб встроен прямо
 * в размеры/смещения, ноль transform в цепочке вообще) — НЕ помогло. Только
 * когда рядом на экране показали (а) один маленький вырезанный кадр (236×236,
 * без листа/clip вовсе) — резкий, и (б) УЗКУЮ полоску ОДНОЙ анимации (8
 * кадров, 1888×236, тот же код рендера, тот же clip-механизм, просто
 * маленький исходный файл) — тоже резкая, тогда как полный лист (даже с
 * нулём transform) — размыт, стало ясно: дело в общем РАЗМЕРЕ листа
 * (высота/суммарный объём), не в способе его показа. Похоже на то, что
 * Fresco/Android декодер применяет собственное урезание разрешения к очень
 * большим bitmap вне зависимости от запрошенного view-размера — точный
 * механизм не установлен, эмпирика непротиворечива и воспроизводима.
 *
 * **Фикс** — пак пере-нарезан (`spritePackStrips.js`, автосгенерирован)
 * так, что каждая строка (анимация+направление) исходного листа — СВОЙ
 * маленький PNG-файл, а не часть одного огромного. `row` в `frame` теперь
 * ВСЕГДА 0, `sheet` = сама полоска (`cell.w*frameCount × cell.h`).
 * `PixelRatio`-деление (см. история выше) осталось — оно само по себе
 * корректно и нужно (иначе Fresco снова decode-и-stretch'ит под неверные
 * физические пиксели), просто оно одно не могло решить всю проблему целиком.
 *
 * **ВАЖНО (известный в этом проекте класс краша, см. CLAUDE.md 2026-09-12)**:
 * ключ `transform` со значением `undefined` в стиле на native валит
 * `_validateTransforms`. `useAnimatedStyle` ниже возвращает ТОЛЬКО `left` —
 * ключа `transform` не касается вообще.
 *
 * **Прогрузка ПЕРЕД показом, без мигания** (2026-09-24, по прямому запросу
 * пользователя — "пусть прогружается... а уже после этого начинается
 * бесшовное воспроизведение... каждый раз, когда нужно проиграть новую
 * цепочку — пусть будет остановка и прогрузка, не надо делать мигания").
 * Раньше при смене `frame.source` (новый клип/kind — теперь ВСЕГДА отдельный
 * PNG-файл, см. выше) Android/Fresco декодирует его С НУЛЯ, и до конца
 * декодирования `<Image>` рисует пустоту/старый кадр по-разному в
 * зависимости от момента — то самое мигание при смене анимаций, знакомая
 * болячка этого проекта ещё по старой gif-системе (там лечилось кросс-фейдом,
 * здесь кросс-фейд решили не городить заново, см. докстринг ниже — заменён
 * этим). Раз "цепочка" (последовательность шагов очереди `useRunnerAnimations
 * .js`) собирается ПОСТЕПЕННО, по мере прихода Mercure-событий одно за одним
 * (`trigger()` вызывается на каждое отдельно) — заранее знать "всю цепочку
 * целиком" и прогрузить её ОДНИМ пакетом невозможно физически: единственный
 * надёжный момент прогрузки — прямо ПЕРЕД тем, как конкретный ШАГ реально
 * должен показаться. Реализовано как `displayedFrame` (то, что РЕАЛЬНО
 * рисуется) — ОТДЕЛЬНО от `frame` (проп, то, что СЕЙЧАС просит показать
 * родитель): пока `frame.source` не совпадает с уже показанным, кадр НЕ
 * переключается — экран держит СТАРЫЙ `displayedFrame` (та самая
 * "остановка"), a `Image.prefetch()` грузит новый source в фоне; как только
 * прогрузка подтверждена (resolve ИЛИ reject — второе на случай, если
 * `prefetch` в принципе недоступен/упал, не блокировать показ навечно) —
 * `displayedFrame` переключается на новый, уже гарантированно decoded кадр,
 * без единого пустого/мигающего кадра между ними. Если `frame.source` тот
 * же файл (сменился только row/frameIndex — тот же клип, другая поза внутри
 * уже загруженного файла) — переключение МГНОВЕННОЕ, прогружать нечего.
 */
export default function SpritePackAnimation({
    frame, boxSize, frameDurationMs = DEFAULT_FRAME_MS, staticFrameIndex = null, loop = true, onComplete,
}) {
    // displayedFrame — см. докстринг "Прогрузка ПЕРЕД показом" выше.
    const [displayedFrame, setDisplayedFrame] = useState(frame ?? null);
    // Отсекает устаревшие prefetch-промисы, если source сменился ЕЩЁ РАЗ,
    // пока предыдущая прогрузка ещё не завершилась (тот же приём, что genRef
    // в useMercure.js) — иначе устаревший prefetch мог бы откатить
    // displayedFrame НАЗАД на уже неактуальный клип.
    const preloadTokenRef = useRef(0);
    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    // ВРЕМЕННО — см. poseLog выше. Монтирование/размонтирование — если
    // компонент вдруг пересоздаётся (ремаунт где-то выше по дереву, не
    // просто смена frame-пропа), это будет видно здесь по двум логам подряд
    // без правдоподобной причины (например без соответствующего изменения
    // frame?.source в "клип сброшен" чуть ниже).
    useEffect(() => {
        poseLog('mount, initial frame.source=', frame?.source, 'loop=', loop, 'static=', staticFrameIndex);
        return () => poseLog('unmount, last frame.source=', frame?.source);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useLayoutEffect(() => {
        if (!frame) { setDisplayedFrame(null); return undefined; }
        if (displayedFrame && displayedFrame.source === frame.source) {
            // Тот же файл — обновляем сразу (row/frameCount могли смениться,
            // например staticFrameIndex/аватар на другую позу того же клипа),
            // decode этого source уже случился, блокировать нечего.
            if (displayedFrame !== frame) setDisplayedFrame(frame);
            return undefined;
        }
        const myToken = ++preloadTokenRef.current;
        const uri = Image.resolveAssetSource?.(frame.source)?.uri;
        const commit = () => {
            if (myToken !== preloadTokenRef.current) return; // устарело
            setDisplayedFrame(frame);
        };
        if (!uri || typeof Image.prefetch !== 'function') {
            // Не смогли распознать URI/платформа не поддерживает prefetch —
            // не блокируем показ навечно, переключаем сразу (как было раньше).
            commit();
            return undefined;
        }
        Image.prefetch(uri).then(commit).catch(commit);
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [frame?.source]);

    // === Кадровый шаг — Reanimated (useFrameCallback), не setInterval ===
    // (см. докстринг выше). Инициализация — тот же начальный кадр, что и
    // раньше у React state.
    const frameIdxSV = useSharedValue(staticFrameIndex ?? 0);
    // -1 = "ещё не стартовали текущий клип" (первый тик после сброса ставит
    // реальный timestamp) — так же, как раньше `i = 0` перед первым тиком
    // setInterval, просто явным сентинелом, а не подразумеваемым нулём.
    const clipStartTsRef = useSharedValue(-1);
    // См. докстринг "completedRef-гейт" выше — без него доигравший non-loop
    // клип мог бы "ожить" и снова закрутиться, если loop флипнется на true
    // ПОКА displayedFrame ещё держит его же (прогрузка следующего клипа).
    const completedRef = useSharedValue(false);
    // 2026-09-25 (живой баг, POSEDBG-лог с реального устройства: "attack/acid
    // на пару кадров и пропадает") — `loop`, ПРИКОЛОЧЕННЫЙ к моменту сброса
    // клипа, а НЕ живой проп, читаемый воркетом каждый кадр. Проп `loop`
    // меняется на КАЖДЫЙ рендер (синхронно с `anim.kind` снаружи), а
    // `displayedFrame`/сброс — АСИНХРОННО, через Image.prefetch (см.
    // useLayoutEffect выше). Из-за этого была секунда, где `loop` уже стал
    // `false` (новая поза), а `clipStartTsRef` ещё тикал с МОМЕНТА СТАРТА
    // СТАРОГО (loop=true) клипа — `elapsed` мгновенно оказывался огромным,
    // `raw >= frameCount-1` сразу true, `onComplete` стрелял для ЕЩЁ
    // СТАРОГО (idle) кадра ровно в тот момент, когда снаружи уже считалось,
    // что это конец НОВОЙ (attack/acid/...) позы — очередь анимаций
    // продвигалась дальше ДО того, как новая поза вообще успевала
    // показаться. Читаем `loopSV.value` внутри воркета, а не `loop` из
    // замыкания — значение обновляется ТОЛЬКО вместе с настоящим сбросом
    // клипа (см. useEffect ниже), не раньше.
    const loopSV = useSharedValue(loop);

    const displayedSource = displayedFrame?.source;
    const displayedRow = displayedFrame?.row ?? 0;
    const frameCount = displayedFrame?.frameCount ?? 1;

    // Сброс на новый клип — обычный useEffect (не useLayoutEffect, как было
    // у старого setFrameIdx(0): тот был нужен именно для React-покраски,
    // shared value её не касается, ждать следующий кадр UI-потока не
    // проблема).
    useEffect(() => {
        poseLog('клип сброшен: source=', displayedSource, 'row=', displayedRow, 'frameCount=', frameCount, 'loop=', loop, 'static=', staticFrameIndex);
        frameIdxSV.value = staticFrameIndex ?? 0;
        clipStartTsRef.value = -1;
        completedRef.value = false;
        loopSV.value = loop;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayedSource, displayedRow, staticFrameIndex, frameIdxSV, clipStartTsRef, completedRef, loopSV]);

    const notifyComplete = () => {
        poseLog('клип доиграл (onComplete): source=', displayedSource, 'frameCount=', frameCount);
        onCompleteRef.current?.();
    };

    useFrameCallback((frameInfo) => {
        'worklet';
        if (staticFrameIndex != null || frameCount <= 1 || completedRef.value) return;
        if (clipStartTsRef.value < 0) clipStartTsRef.value = frameInfo.timestamp;
        const elapsed = frameInfo.timestamp - clipStartTsRef.value;
        const raw = Math.floor(elapsed / frameDurationMs);
        if (loopSV.value) {
            frameIdxSV.value = raw % frameCount;
        } else if (raw >= frameCount - 1) {
            frameIdxSV.value = frameCount - 1; // на последнем кадре — держим его, дальше не тикаем (см. completedRef выше)
            completedRef.value = true;
            // onComplete — РЕАЛЬНЫЙ сигнал "полоска дорисовала последний
            // кадр", той же системой отсчёта, что и сам рендер (frameInfo.
            // timestamp), не отдельным JS-таймером снаружи — см.
            // useRunnerAnimations.js#completeStep.
            runOnJS(notifyComplete)();
        } else {
            frameIdxSV.value = raw;
        }
    }, true);

    // displayedFrame.cell/sheet — ФИЗИЧЕСКИЕ пиксели PNG-файла (из JSON
    // пака), а React Native трактует width/height/transform как DP — делим
    // на pixelRatio, чтобы Fresco декодировал файл в его РОДНОМ физическом
    // размере, а не растягивал его при decode под DP*pixelRatio (см.
    // докстринг выше). Считается безопасно (с фолбэками), даже когда
    // displayedFrame ещё null — useAnimatedStyle ниже обязан вызываться на
    // КАЖДЫЙ рендер (правило хуков), а не только когда есть что показать.
    const pixelRatio = PixelRatio.get();
    const cellW = (displayedFrame?.cell.w ?? 0) / pixelRatio;
    const cellH = (displayedFrame?.cell.h ?? 0) / pixelRatio;
    const sheetW = (displayedFrame?.sheet.w ?? 0) / pixelRatio;
    const sheetH = (displayedFrame?.sheet.h ?? 0) / pixelRatio;
    const box = Math.round(boxSize);
    // "Contain" по большей стороне ячейки (см. докстринг) — letterbox-поля
    // остаются по меньшей оси, тот же принцип, что и Math.min(box/w, box/h).
    const scale = box / Math.max(cellW, cellH, 1);
    // Масштаб встроен ПРЯМО в размеры/смещения (никакого transform вообще,
    // даже scale) — 2026-09-24, см. докстринг: даже "безобидный" scale на
    // маленьком clip-контейнере — последний оставшийся transform в цепочке,
    // проверяем, не он ли причина.
    const cellWScaled = cellW * scale;
    const cellHScaled = cellH * scale;
    const sheetWScaled = sheetW * scale;
    const sheetHScaled = sheetH * scale;
    const rowYScaled = displayedRow * cellHScaled;
    // offsetY (2026-09-25, см. constants/spritePacks.js#CLIP_OFFSET_Y) —
    // ручная поправка на известную несостыковку обрезки МЕЖДУ клипами одного
    // бакета (персонаж нарисован в разных местах внутри одинаковой по
    // размеру ячейки) — те же единицы и та же система координат, что и
    // cell.w/h (исходные пиксели файла), поэтому проходит через то же деление
    // на pixelRatio и тот же scale, что и сама ячейка, прежде чем сложиться с
    // обычным центрирующим offsetTop.
    const offsetYScaled = ((displayedFrame?.offsetY ?? 0) / pixelRatio) * scale;
    const offsetTop = (box - cellHScaled) / 2 + offsetYScaled;
    const offsetLeft = (box - cellWScaled) / 2;

    // Анимируется ТОЛЬКО обёртывающий Animated.View (left) — см. докстринг
    // выше про известный Android-баг "Animated.Image + непрерывная анимация
    // пропадает". Сама картинка ниже — обычный, не анимированный <Image>.
    const sheetOffsetStyle = useAnimatedStyle(() => ({
        left: -frameIdxSV.value * cellWScaled,
    }));

    if (!displayedFrame) return null;

    return (
        <View style={[styles.outer, { width: box, height: box }]}>
            <View
                style={[
                    styles.innerClip,
                    {
                        width: cellWScaled,
                        height: cellHScaled,
                        top: offsetTop,
                        left: offsetLeft,
                    },
                ]}
            >
                <Animated.View
                    style={[
                        styles.sheetWrap,
                        { width: sheetWScaled, height: sheetHScaled, top: -rowYScaled },
                        sheetOffsetStyle,
                    ]}
                >
                    <Image
                        source={displayedFrame.source}
                        resizeMode="stretch"
                        fadeDuration={0}
                        style={[
                            styles.sheet,
                            Platform.OS === 'web' && styles.sheetWebCrisp,
                            { width: sheetWScaled, height: sheetHScaled },
                        ]}
                    />
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: { overflow: 'hidden' },
    innerClip: { position: 'absolute', overflow: 'hidden' },
    sheetWrap: { position: 'absolute', top: 0, left: 0 },
    sheet: { position: 'absolute', top: 0, left: 0 },
    // Web-only: настоящий пиксель-арт — 'pixelated' заставляет браузер
    // сэмплировать nearest-neighbor вместо стандартного bilinear/bicubic при
    // любом масштабе (RNW обычно пробрасывает незнакомые ключи стиля как
    // реальный CSS). Дешёвая подстраховка, не подтверждена живьём отдельно.
    sheetWebCrisp: { imageRendering: 'pixelated' },
});
