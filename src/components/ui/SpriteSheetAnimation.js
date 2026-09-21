// src/components/ui/SpriteSheetAnimation.js
import React, { useLayoutEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { createLogger } from '../../lib/logger';

const log = createLogger('SPRITEDBG'); // ВРЕМЕННО — диагностика "телепорт/исчезновение", убрать после

// Ступенчатая "easing"-функция: прогресс сразу 1 на весь сегмент — кадр
// мгновенно "прыгает" на целевой индекс и держится там до конца duration,
// а не плавно интерполируется между соседними кадрами (спрайт-анимация
// ДОЛЖНА переключаться дискретно, не блендиться).
const STEP_EASING = () => 1;

/**
 * Один общий спрайт-лист (ВСЕ клипы одного бегуна+статуса+цвета в одной PNG)
 * вместо gif — 2026-09-20, боевая замена для Скаута (см. CLAUDE.md).
 *
 * **Построчная упаковка ("один клип — один ряд"), НЕ единая сетка с
 * фиксированной ячейкой** — кадры разных анимаций скаута РАЗНОГО размера
 * (168×168 у start до 188×224 у attack_north — исходники так нарисованы, не
 * унифицированы) — если бы паковали в общую сетку с одной ячейкой на весь
 * лист (padding до максимума), у клипов с меньшим родным холстом персонаж
 * визуально "усох" бы (тот же эффект contain, что и раньше, но теперь
 * относительно чужого, большего холста) — реальная регрессия размера
 * относительно gif-версии. Построчная схема сохраняет РОДНОЙ размер холста
 * каждого клипа как есть, только кадры ВНУТРИ клипа лежат подряд по X в
 * своём ряду, ряды идут по Y — при отрисовке используются per-клип
 * frameWidth/frameHeight ИМЕННО из его собственных данных, "contain"-подобный
 * scale считается заново на каждую смену клипа, как и раньше у одного gif.
 *
 * **Почему ОДИН лист на ВСЕ клипы, не файл на анимацию** — 2026-09-20,
 * прямое требование пользователя: переход idle→move не должен быть с
 * бликами/наслоением. Если бы у каждой анимации был свой файл, смена клипа
 * означала бы смену `source` у `<Image>` — ПЕРВЫЙ показ ЭТОГО файла заново
 * триггерил бы Android decode-паузу, та же болезнь, что у gif, просто на
 * каждую смену позы вместо каждого кадра. Общий лист декодируется ОДИН раз
 * при монтировании токена — смена клипа это ИСКЛЮЧИТЕЛЬНО смена диапазона
 * кадров/офсета внутри уже загруженной картинки, `source` не меняется.
 *
 * `clips` — `{ [name]: { frameWidth, frameHeight, frameCount, delaysMs, rowY } }`
 * (сгенерировано pack_scout_sheets.js, см. scout/healthy/spritesheets/meta.json
 * — сохранён в репозитории как `scoutSpriteSheets.js`, не как отдельный json,
 * чтобы require() PNG и метаданные жили вместе). `sheetWidth`/`sheetHeight` —
 * ПОЛНЫЙ размер листа (родной пиксельный, БЕЗ масштабирования) — Image
 * рендерится РОВНО в этом размере (см. RunnerToken.js#imgLayer — тот же
 * "decode 1:1, масштабировать уже готовый битмап через GPU-transform"
 * приём, что уже подтверждён живым сравнением 120px/216px 2026-09-20).
 * `activeClip` — имя текущего клипа (ключ `clips`).
 *
 * `boxSize` — ВСЕГДА фиксированный квадратный бокс (не зависит от клипа) —
 * критично: у клипов скаута РАЗНЫЕ пропорции холста (attack_north — 188×224,
 * не квадрат), и если внешний контейнер менял бы размер под конкретный клип,
 * персонаж визуально "дёргался/менял размер" бы при каждой смене позы внутри
 * RunnerToken#ring (тот центрирует контент — смена размера контента сдвинула
 * бы его). Вместо этого — тот же "contain" принцип, что раньше давал
 * `resizeMode="contain"` у gif: масштаб считается по МЕНЬШЕЙ из двух осей
 * (`Math.min(boxSize/frameWidth, boxSize/frameHeight)`), получившийся кадр
 * центрируется внутри неизменного `boxSize×boxSize` — бокс всегда одного
 * размера, у клипа может остаться пустое поле по одной из осей (как и было
 * у прежнего contain-letterboxing).
 */
export default function SpriteSheetAnimation({
    source, sheetWidth, sheetHeight, clips, activeClip, boxSize,
}) {
    // Фолбэк на idle, если для activeClip нет клипа в листе — зеркалит
    // `bucket.xxx ?? bucket.idle` из getRunnerAnimationImage (gif-путь).
    // 2026-09-21: пойман конкретный реальный случай — атака по диагонали на
    // "сдвинутую" дорожку (resolveMoveAssetDirection может вернуть southEast/
    // southWest), а у атаки скаута нарисованы ТОЛЬКО north/northEast/
    // northWest клипы (у gif-набора то же самое — там тихо откатывается на
    // idle). Без фолбэка `clips['attack_south_east']` был `undefined`,
    // компонент рендерил `null` — персонаж полностью пропадал с доски на
    // время анимации выстрела в этом сценарии, тогда как gif-путь просто
    // не показывал анимацию атаки (оставался в idle), не исчезал. Фолбэк
    // общий — страхует от ЛЮБОГО будущего расхождения имени клипа, не
    // только от этого конкретного.
    const clip = clips[activeClip] ?? clips.idle;
    const frameIndex = useRef(new Animated.Value(0)).current;
    log('render activeClip=', activeClip, 'found=', !!clips[activeClip], 'boxSize=', boxSize);

    // useLayoutEffect, НЕ useEffect (2026-09-21, найдено и починено чтением
    // кода, без живого теста — прямой запрос пользователя "ищи причину в
    // коде") — тот же класс бага, что уже задокументирован и решён точно так
    // же в RunnerTokenSlide.js (см. его докстринг). `translateY` (номер ряда
    // клипа) вычисляется прямо в теле рендера — переключается СИНХРОННО с
    // `activeClip`. А вот сброс `frameIndex` (номер кадра/колонки, отсюда
    // `translateX`) раньше стоял в обычном useEffect — тот выполняется ПОСЛЕ
    // отрисовки кадра. Окно между этими двумя моментами давало ровно один
    // кадр, где строка листа уже НОВАЯ (move/attack/...), а колонка — ещё
    // СТАРАЯ (хвостовое значение из цикла предыдущего клипа, напр. idle) —
    // "чужой" кадр анимации. Поскольку RunnerTokenSlide в этот же момент уже
    // синхронно (свой useLayoutEffect) показывает токен НА ЦЕЛЕВОЙ клетке,
    // совпадение "уже на новом месте" + "случайный кадр чужой анимации"
    // читалось как "телепортировался и на миг замер, потом анимация
    // включилась" (жалоба пользователя: "при начале движения скаута
    // телепортирует в конечную точку на мгновение, а потом уже происходит
    // анимация движения на android"). Фикс — сброс кадра и старт новой
    // последовательности теперь синхронны с самим рендером (той же фазой,
    // что и RunnerTokenSlide), окно для рассинхрона строки/колонки исчезает.
    useLayoutEffect(() => {
        // Тот же фолбэк на idle, что и у `clip` выше (см. комментарий там) —
        // если бы тут остался голый `clips[activeClip]`, при несуществующем
        // клипе цикл кадров просто не запускался бы вообще (frameIndex
        // замер бы на хвостовом значении предыдущего клипа), рассинхронно с
        // тем, что уже отрисовал рендер (там idle-фолбэк уже подключён).
        const c = clips[activeClip] ?? clips.idle;
        log('effect activeClip=', activeClip, 'found=', !!clips[activeClip]);
        frameIndex.setValue(0);
        const steps = [];
        for (let i = 0; i < c.frameCount; i++) {
            steps.push(
                Animated.timing(frameIndex, {
                    toValue: i,
                    duration: c.delaysMs[i] ?? 200,
                    easing: STEP_EASING,
                    useNativeDriver: true,
                }),
            );
        }
        const animation = Animated.loop(Animated.sequence(steps));
        animation.start();
        return () => animation.stop();
        // activeClip — единственная реальная причина перезапускать
        // последовательность; clips/frameIndex стабильны между рендерами
        // родителя (см. вызывающий код — тот же принцип, что и у
        // AVATAR_FRAME_SIZE в RunnerCard.js).
    }, [activeClip, clips, frameIndex]);

    if (!clip) return null;

    // "Contain" внутри ФИКСИРОВАННОГО квадратного бокса — по меньшей из осей
    // (см. докстринг выше). Letterbox-поля (top/left ниже) центрируют
    // получившийся прямоугольник внутри boxSize×boxSize.
    // scaleCorrection (см. scoutSpriteSheets.js#start) — поправка на клипы,
    // где персонаж занимает другую долю своей канвы, чем остальные (contain
    // по размеру канвы этого не учитывает) — измерено численно, не на глаз.
    const scale = Math.min(boxSize / clip.frameWidth, boxSize / clip.frameHeight) * (clip.scaleCorrection ?? 1);

    // translateX — сдвиг ВНУТРИ ряда клипа, в НАТИВНЫХ пикселях (без domножения
    // на scale — сдвиг происходит внутри недекорированного изображения, масштаб
    // применяется ПОСЛЕ, через transform:scale на innerClip). translateY —
    // ФИКСИРОВАННЫЙ офсет ряда (не анимируется, клип не меняет ряд сам по себе).
    const translateX = frameIndex.interpolate({
        inputRange: [0, Math.max(1, clip.frameCount - 1)],
        outputRange: [0, -(clip.frameCount - 1) * clip.frameWidth],
    });

    return (
        // outer — ВСЕГДА boxSize×boxSize, НЕ зависит от клипа (см. докстринг) —
        // само по себе пустое, просто резервирует место у родителя.
        <View style={[styles.outer, { width: boxSize, height: boxSize }]}>
            {/* innerClip — РОВНО один родной кадр ТЕКУЩЕГО клипа (frameWidth×
                frameHeight, БЕЗ scale), отцентрирован внутри outer (letterbox)
                и УЖЕ ПОТОМ растянут transform:scale целиком до displayWidth×
                displayHeight — тот же приём "decode 1:1, масштабировать готовый
                битмап GPU", что уже подтверждён живым сравнением 120px/216px
                этого же дня. */}
            <View
                style={[
                    styles.innerClip,
                    {
                        width: clip.frameWidth,
                        height: clip.frameHeight,
                        // Центрируем НЕмасштабированный кадр внутри boxSize×boxSize
                        // (как если бы scale не было), transform:scale применяется
                        // вокруг СВОЕГО ЖЕ центра (дефолт RN) — раз центр кадра уже
                        // совпадает с центром бокса, после масштабирования результат
                        // (displayWidth×displayHeight) остаётся центрирован в боксе
                        // без дополнительной компенсации — та же, ранее проверенная
                        // через DOM-матрицу схема (2026-09-20, gif vs спрайт-лист).
                        top: (boxSize - clip.frameHeight) / 2,
                        left: (boxSize - clip.frameWidth) / 2,
                        transform: [{ scale }],
                    },
                ]}
            >
                <Animated.Image
                    source={source}
                    resizeMode="stretch"
                    fadeDuration={0}
                    style={[
                        styles.sheet,
                        {
                            width: sheetWidth,
                            height: sheetHeight,
                            transform: [
                                { translateY: -clip.rowY },
                                { translateX },
                            ],
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
});
