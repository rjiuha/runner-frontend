// src/components/ui/SpritePackAnimation.js
import React, { useEffect, useState } from 'react';
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
 * зацикленно проигрывает все `frame.frameCount` кадров полоски, шаг —
 * мгновенный "прыжок" (ступенчато, не блендится), каждые `frameDurationMs`.
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
 * **Крос-фейд не нужен** — `source` меняется ТОЛЬКО при смене цвета/статуса/
 * анимации-полоски (не на каждый кадр внутри одной полоски — та же полоска,
 * просто другой `left`), а сами полоски маленькие (не тысячи пикселей) —
 * decode-пауза, ради которой раньше городился кросс-фейд для gif, тут
 * не должна быть заметна (не откалибровано отдельным измерением).
 */
export default function SpritePackAnimation({ frame, boxSize, frameDurationMs = DEFAULT_FRAME_MS, staticFrameIndex = null }) {
    // Обычный React state, НЕ Animated.Value — переключение кадра теперь
    // чистое layout-позиционирование (left/top), не GPU-transform (см.
    // докстринг выше), а сама смена кадра — мгновенный "прыжок" (та же
    // STEP_EASING-семантика, что и раньше), для которого не нужна
    // интерполяция между значениями вообще, значит и Animated не нужен.
    const [frameIdx, setFrameIdx] = useState(staticFrameIndex ?? 0);

    useEffect(() => {
        if (staticFrameIndex != null || !frame) return undefined;
        setFrameIdx(0);
        let i = 0;
        const id = setInterval(() => {
            i = (i + 1) % frame.frameCount;
            setFrameIdx(i);
        }, frameDurationMs);
        return () => clearInterval(id);
    }, [frame?.source, frame?.row, frame?.frameCount, staticFrameIndex, frameDurationMs]);

    if (!frame) return null;

    // frame.cell/frame.sheet — ФИЗИЧЕСКИЕ пиксели PNG-файла (из JSON пака),
    // а React Native трактует width/height/transform как DP — делим на
    // pixelRatio, чтобы Fresco декодировал файл в его РОДНОМ физическом
    // размере, а не растягивал его при decode под DP*pixelRatio (см.
    // докстринг выше).
    const pixelRatio = PixelRatio.get();
    const cellW = frame.cell.w / pixelRatio;
    const cellH = frame.cell.h / pixelRatio;
    const sheetW = frame.sheet.w / pixelRatio;
    const sheetH = frame.sheet.h / pixelRatio;
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
    const rowYScaled = frame.row * cellHScaled;
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
                    source={frame.source}
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
