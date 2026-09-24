// src/components/ui/SpritePackAnimation.js
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Image, PixelRatio, Platform, StyleSheet, View } from 'react-native';

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
 * передаёт `loop={!anim}` — по факту это значит: loop=true ТОЛЬКО для
 * настоящего idle (anim==null, бегун просто стоит — эту позу действительно
 * нужно крутить бесконечно), loop=false для ЛЮБОГО транзиентного шага
 * очереди (`useRunnerAnimations.js` — move/attack/gotShot/fly/start/bomb/
 * heal/destroyed/burn/acid) — каждый из них по архитектуре хука играется
 * РОВНО один раз за шаг очереди (advanceQueue), внешний таймер
 * (ANIM_DURATION_MS[kind]/TERMINAL_HIDE_DELAY_MS[kind]) сам решает, когда
 * переключить kind/спрятать токен — крутить полоску по кругу ВНУТРИ этого
 * окна означало ровно тот класс "сюрприза", который и словил пользователь на
 * 'start' (полоска дошла до конца раньше внешнего таймера, зациклилась и на
 * долю секунды снова показала кадр 0/поздний кадр). При loop=false полоска,
 * дойдя до последнего кадра, там и ОСТАНАВЛИВАЕТСЯ (не гаснет, не мигает) —
 * держит его статично до смены `frame` снаружи. Если конкретный клип короче
 * своего внешнего окна — просто короткая статичная пауза на последнем кадре,
 * не глитч (в отличие от неожиданного рестарта).
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
 * маленький PNG-файл, а не часть одного огромного. `SpritePackAnimation`
 * от этого стал ПРОЩЕ, не сложнее: `row` в `frame` всегда 0, `sheet` = сама
 * полоска (`cell.w*frameCount × cell.h`), смена кадра — просто `left`
 * (`-frameIdx*cellW`) на уже маленьком, декодированном 1:1 изображении.
 * `PixelRatio`-деление (см. история выше) осталось — оно само по себе
 * корректно и нужно (иначе Fresco снова decode-и-stretch'ит под неверные
 * физические пиксели), просто оно одно не могло решить всю проблему целиком.
 *
 * **ВАЖНО (известный в этом проекте класс краша, см. CLAUDE.md 2026-09-12)**:
 * ключ `transform` со значением `undefined` в стиле на native валит
 * `_validateTransforms`. Сейчас это не грозит — `transform` в этом файле не
 * используется вообще (ни объектом, ни ключом в массиве стилей).
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
    frame, boxSize, frameDurationMs = DEFAULT_FRAME_MS, staticFrameIndex = null, loop = true,
}) {
    // Обычный React state, НЕ Animated.Value — переключение кадра теперь
    // чистое layout-позиционирование (left/top), не GPU-transform (см.
    // докстринг выше), а сама смена кадра — мгновенный "прыжок" (та же
    // STEP_EASING-семантика, что и раньше), для которого не нужна
    // интерполяция между значениями вообще, значит и Animated не нужен.
    const [frameIdx, setFrameIdx] = useState(staticFrameIndex ?? 0);
    // displayedFrame — см. докстринг "Прогрузка ПЕРЕД показом" выше.
    const [displayedFrame, setDisplayedFrame] = useState(frame ?? null);
    // Отсекает устаревшие prefetch-промисы, если source сменился ЕЩЁ РАЗ,
    // пока предыдущая прогрузка ещё не завершилась (тот же приём, что genRef
    // в useMercure.js) — иначе устаревший prefetch мог бы откатить
    // displayedFrame НАЗАД на уже неактуальный клип.
    const preloadTokenRef = useRef(0);

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

    // useLayoutEffect (было useEffect, 2026-09-24, живая жалоба пользователя
    // "в начале анимации start виден последний кадр") — useEffect срабатывает
    // ПОСЛЕ покраски: при смене displayedFrame (новый клип/kind) один рендер
    // успевал уйти на экран со СТАРЫМ frameIdx (оставшимся от предыдущего
    // клипа, например от idle), но уже по НОВОМУ source/cellW — индекс из
    // чужого диапазона кадров мог указать на позднюю/последнюю позицию
    // нового клипа. useLayoutEffect сбрасывает frameIdx на 0 СИНХРОННО до
    // покраски — этот "чужой кадр" физически никогда не попадает на экран.
    useLayoutEffect(() => {
        if (staticFrameIndex != null || !displayedFrame) return undefined;
        setFrameIdx(0);
        if (displayedFrame.frameCount <= 1) return undefined;
        let i = 0;
        const id = setInterval(() => {
            if (loop) {
                i = (i + 1) % displayedFrame.frameCount;
            } else if (i < displayedFrame.frameCount - 1) {
                i += 1;
            } else {
                clearInterval(id); // на последнем кадре — держим его, дальше не тикаем
                return;
            }
            setFrameIdx(i);
        }, frameDurationMs);
        return () => clearInterval(id);
    }, [displayedFrame?.source, displayedFrame?.row, displayedFrame?.frameCount, staticFrameIndex, frameDurationMs, loop]);

    if (!displayedFrame) return null;

    // displayedFrame.cell/sheet — ФИЗИЧЕСКИЕ пиксели PNG-файла (из JSON
    // пака), а React Native трактует width/height/transform как DP — делим
    // на pixelRatio, чтобы Fresco декодировал файл в его РОДНОМ физическом
    // размере, а не растягивал его при decode под DP*pixelRatio (см.
    // докстринг выше).
    const pixelRatio = PixelRatio.get();
    const cellW = displayedFrame.cell.w / pixelRatio;
    const cellH = displayedFrame.cell.h / pixelRatio;
    const sheetW = displayedFrame.sheet.w / pixelRatio;
    const sheetH = displayedFrame.sheet.h / pixelRatio;
    const box = Math.round(boxSize);
    // "Contain" по большей стороне ячейки (см. докстринг) — letterbox-поля
    // остаются по меньшей оси, тот же принцип, что и Math.min(box/w, box/h).
    const scale = box / Math.max(cellW, cellH);
    const idx = staticFrameIndex != null ? staticFrameIndex : frameIdx;
    // Масштаб встроен ПРЯМО в размеры/смещения (никакого transform вообще,
    // даже scale) — 2026-09-24, см. докстринг: даже "безобидный" scale на
    // маленьком clip-контейнере — последний оставшийся transform в цепочке,
    // проверяем, не он ли причина.
    const cellWScaled = cellW * scale;
    const cellHScaled = cellH * scale;
    const sheetWScaled = sheetW * scale;
    const sheetHScaled = sheetH * scale;
    const rowYScaled = displayedFrame.row * cellHScaled;
    const colXScaled = idx * cellWScaled;
    const offsetTop = (box - cellHScaled) / 2;
    const offsetLeft = (box - cellWScaled) / 2;

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
                <Image
                    source={displayedFrame.source}
                    resizeMode="stretch"
                    fadeDuration={0}
                    style={[
                        styles.sheet,
                        Platform.OS === 'web' && styles.sheetWebCrisp,
                        {
                            width: sheetWScaled,
                            height: sheetHScaled,
                            left: -colXScaled,
                            top: -rowYScaled,
                        },
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: { overflow: 'hidden' },
    innerClip: { position: 'absolute', overflow: 'hidden' },
    sheet: { position: 'absolute', top: 0, left: 0 },
    // Web-only: настоящий пиксель-арт — 'pixelated' заставляет браузер
    // сэмплировать nearest-neighbor вместо стандартного bilinear/bicubic при
    // любом масштабе (RNW обычно пробрасывает незнакомые ключи стиля как
    // реальный CSS). Дешёвая подстраховка, не подтверждена живьём отдельно.
    sheetWebCrisp: { imageRendering: 'pixelated' },
});
