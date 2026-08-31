// src/components/game/RunnerToken.js
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import { RUNNER_DISPLAY } from '../../constants/GameConstants';
import { getRunnerAnimationImage, getRunnerAvatarImage } from '../../constants/runnerAnimations';

// Только Android/iOS — на вебе смена gif происходит без видимой задержки
// декодирования, кроссфейд там просто не нужен (жалоба пользователя,
// 2026-09-02: "анимации нормально работают в браузерной версии, но в
// андроиде всё ещё какие-то блики между анимациями"). Короткий — маскирует
// именно decode-паузу нового gif, не должен ощущаться как "анимация теперь
// не сразу стартует".
const IS_NATIVE = Platform.OS !== 'web';
const CROSSFADE_MS = 120;

/**
 * Иконка бегуна в цветном кольце владельца. Один и тот же компонент рисует
 * бегуна и на доске (BoardGrid), и в панели игрока (RunnerCard) — так фишки
 * на поле и карточки в панели выглядят одинаково и легко узнаются.
 *
 * `anim` — { kind: 'move'|'attack'|'fly'|'gotShot'|'destroyed'|'collision', direction?, side?, fromStatus? } | null
 * (idle), см. constants/runnerAnimations#getRunnerAnimationImage — доска
 * передаёт сюда текущее анимационное состояние бегуна (useRunnerAnimations в
 * GameBoardScreen), карточка в панели — не передаёт (там `avatar`).
 *
 * `avatar` — карточка бегуна в панели игрока (RunnerCard) использует
 * отдельный статичный ассет "avatar" вместо игровых анимаций (по прямому
 * запросу пользователя, 2026-08-31) — не связан с `anim` вообще.
 *
 * Для типов без набора анимаций (constants/runnerAnimations — сейчас Скаут/
 * Солдат/Атлет, Жнец пока без набора) обе функции возвращают null, и
 * рендерится старая статичная иконка (RUNNER_DISPLAY[type].icon) — новый тип
 * бегуна получает анимации просто добавлением записи в RUNNER_ANIMATION_SETS,
 * без правок этого компонента.
 *
 * **Перекраска неона под цвет игрока** (2026-08-31): для типов с набором
 * анимаций `getRunnerAnimationImage`/`getRunnerAvatarImage` возвращают не
 * один ассет, а пару `{base, mask}` (см. constants/runnerAnimations) — base
 * рисуется как есть, mask поверх него ВТОРЫМ `<Image>` с `tintColor={color}`
 * (неон в mask — чистый белый на прозрачном, tintColor красит именно его, а
 * не весь спрайт). Для типов без набора (просто `display.icon`, обычный
 * require одной картинки) — старый однослойный рендер, как было.
 *
 * `imageScale` — доля `size`, которую занимает картинка ВНУТРИ кольца
 * (по умолчанию 0.68, как было изначально). По прямому запросу пользователя,
 * 2026-08-31, доска увеличивает персонажа независимо от кольца ("окружность
 * вокруг персонажа не увеличивай") — кольцо по-прежнему = `size`, картинка
 * может быть даже БОЛЬШЕ кольца (imageScale > 1), выходя за его пределы —
 * это осознанный эффект, не баг.
 *
 * `showRing` — цветной кружок-обводка (цвет игрока + полупрозрачная заливка).
 * По умолчанию `true` (карточка в панели — там он всё ещё нужен для быстрой
 * идентификации). На доске (BoardGrid) с 2026-08-31 передаётся `false` — сама
 * перекраска неона под цвет игрока уже показывает, чей это бегун, отдельная
 * обводка стала избыточной (прямой запрос пользователя). Белая рамка
 * `selected` (сейчас выбран для хода/выстрела) — другая, никак не связанная
 * с цветом игрока сущность, рисуется независимо от `showRing`.
 *
 * `imageAlign` — 'center' (по умолчанию) или 'bottom'. Определяет, как
 * картинка (которая может быть БОЛЬШЕ кольца, см. imageScale выше)
 * позиционируется ВНУТРИ кольца по вертикали. 'bottom' — по прямому запросу
 * пользователя, 2026-09-01, ТОЛЬКО для доски на native (BoardGrid) — низ
 * картинки прижат к низу кольца, лишний размер выпирает только ВВЕРХ, не
 * поровну на все 4 стороны. Кольцо само по себе тоже должно быть прижато к
 * низу своего родителя — за это отвечает ВНЕШНИЙ контейнер (см.
 * BoardGrid#styles.tokenLayerBottom), этот проп красит только внутреннее
 * позиционирование картинки относительно кольца.
 *
 * **Кроссфейд между анимациями, ТОЛЬКО native** (2026-09-02): прошлый фикс
 * мигания (см. animKey ниже) убрал ПРИНУДИТЕЛЬНЫЙ remount на повторе одной
 * анимации — но живой тест показал, что "блики, персонаж исчезает" остаются
 * на Android даже между РАЗНЫМИ анимациями (idle→move, move→attack и т.п.),
 * где `source` меняется на ДЕЙСТВИТЕЛЬНО другой файл. На вебе того же не
 * видно (жалоба пользователя это прямо подтвердила) — то есть дело не в
 * key/remount (уже проверено, тот путь чист), а в самой Android-декодировке
 * НОВОГО gif (Fresco): между "старый кадр ушёл" и "новый готов" есть
 * короткая пауза, в которую нативный <Image> держит пустой кадр. Починить
 * САМУ декодировку из JS нельзя — вместо этого держим ПРЕДЫДУЩИЙ source
 * видимым НЕПРОЗРАЧНЫМ слоем ПОД новым, пока новый набирает opacity
 * 0→1 (CROSSFADE_MS) — старый кадр прикрывает паузу декодирования нового.
 */
export default function RunnerToken({
    type, status, color = '#fff', size = 32, selected = false, anim = null, avatar = false, imageScale = 0.68,
    showRing = true, imageAlign = 'center', style,
}) {
    const display = RUNNER_DISPLAY[type];

    const raw = display ? (avatar ? getRunnerAvatarImage(type, status) : getRunnerAnimationImage(type, status, anim)) : null;
    // {base, mask} — объект, а не обычный require-ассет (тот на вебе тоже
    // объект вида {uri,width,height}, поэтому проверяем именно свои поля).
    const isDualLayer = raw != null && typeof raw === 'object' && 'base' in raw && 'mask' in raw;
    const source = display ? (isDualLayer ? raw : (raw ?? display.icon)) : null;

    // `key` у <Image> ниже — ВСЕГДА одна и та же строка ('base'/'mask'/'img'),
    // никогда не меняется. Раньше (до 2026-08-31, девятый заход) key нарочно
    // менялся на повторе ОДНОЙ И ТОЙ ЖЕ анимации подряд (два шага UP подряд
    // при многошаговом ходе), чтобы форсировать перезапуск gif с первого
    // кадра — это оказалось настоящей причиной жалобы "персонаж исчезает и
    // появляется" (мигание): смена key = полный размонт/монтаж <Image>, а на
    // Android новый gif решает свои надо декодировать заново — на кадр-два
    // экран пустой. Смена prop `source` на уже смонтированной Image и без
    // того перезапускает анимацию сама (стандартное поведение RN Image для
    // gif) — принудительный remount не нужен вообще, только вредит. Ценой
    // этого фикса могла бы быть "не совсем с первого кадра" при повторе
    // одного и того же шага подряд — но это гораздо менее заметно, чем
    // видимое мигание.
    const animKey = avatar ? 'avatar' : 'stable';

    // Кроссфейд — см. доку выше. Хуки вызываются БЕЗУСЛОВНО (до раннего
    // return ниже) — правила хуков требуют одинакового порядка на каждый
    // рендер, а display может оказаться пустым.
    const prevRef = useRef(null); // { source, isDualLayer } последнего РЕАЛЬНО отрисованного слоя
    const fade = useRef(new Animated.Value(1)).current;
    const [fadingLayer, setFadingLayer] = useState(null); // предыдущий слой, пока играет кроссфейд

    useEffect(() => {
        if (!IS_NATIVE || !display) return;
        const prev = prevRef.current;
        if (prev && prev.source !== source) {
            setFadingLayer(prev);
            fade.setValue(0);
            Animated.timing(fade, { toValue: 1, duration: CROSSFADE_MS, useNativeDriver: true }).start(() => {
                setFadingLayer(null);
            });
        }
        prevRef.current = { source, isDualLayer };
    }, [source, isDualLayer, display, fade]);

    if (!display) return null;

    const imgBoxStyle = { width: size * imageScale, height: size * imageScale };
    // НЕ StyleSheet.absoluteFillObject (top/left/right/bottom:0, без явных
    // width/height) — на react-native-web это НЕ растягивает <Image> на
    // размер родителя, он откатывается на натуральный пиксельный размер
    // самого gif-файла (тот же баг, что уже ловили на MobileFrameOverlay,
    // см. CLAUDE.md, 2026-08-29: "ширина через противоположные left/right без
    // width" не работает у Image на вебе). Даём те же width/height, что и
    // родителю — тогда оба слоя (base/mask) гарантированно совпадают с ним
    // и друг с другом на любой платформе.
    const imgLayerStyle = { position: 'absolute', top: 0, left: 0, ...imgBoxStyle };

    return (
        <View
            style={[
                styles.ring,
                imageAlign === 'bottom' && styles.ringBottom,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
                showRing && { borderWidth: 2, borderColor: color, backgroundColor: `${color}33` },
                selected && styles.selected,
                style,
            ]}
        >
            {/* Внешняя обёртка — ОБЫЧНЫЙ (не absolute) дочерний элемент кольца,
                поэтому центрирование/прижатие к низу (imageAlign) работает
                как и раньше, без изменений — сама рамка (imgBoxStyle) при
                кроссфейде не меняется, только то, что внутри нее. Уходящий
                кадр рисуется обычным потоком (задаёт размер рамки, как и
                раньше без кроссфейда), новый — absolute-наложением ровно
                той же формулой top:0/left:0 + явные width/height, что уже
                используется для base/mask (imgLayerStyle) — НЕ
                StyleSheet.absoluteFillObject, см. коммент у imgLayerStyle
                выше про баг на вебе (тут неважно — кроссфейд только native). */}
            <View style={imgBoxStyle}>
                {fadingLayer && (
                    // Предыдущий кадр — НЕПРОЗРАЧНЫЙ, лежит ПОД новым, пока тот
                    // декодируется на Android. imgKey тут не важен (слой
                    // статичен, сам себя размонтирует по завершении кроссфейда).
                    <TokenImageLayer
                        source={fadingLayer.source}
                        isDualLayer={fadingLayer.isDualLayer}
                        imgBoxStyle={imgBoxStyle}
                        imgLayerStyle={imgLayerStyle}
                        color={color}
                        imgKey="fading"
                    />
                )}
                <Animated.View style={fadingLayer ? [imgLayerStyle, { opacity: fade }] : undefined}>
                    <TokenImageLayer
                        source={source}
                        isDualLayer={isDualLayer}
                        imgBoxStyle={imgBoxStyle}
                        imgLayerStyle={imgLayerStyle}
                        color={color}
                        imgKey={animKey}
                    />
                </Animated.View>
            </View>
        </View>
    );
}

/** Один слой картинки (dual-layer base+mask или одиночный) — вынесен, чтобы переиспользовать для текущего и уходящего (fade-out) кадра при кроссфейде. */
function TokenImageLayer({ source, isDualLayer, imgBoxStyle, imgLayerStyle, color, imgKey }) {
    if (isDualLayer) {
        return (
            <View style={imgBoxStyle}>
                <Image key={`${imgKey}-base`} source={source.base} style={imgLayerStyle} resizeMode="contain" />
                <Image
                    key={`${imgKey}-mask`}
                    source={source.mask}
                    style={imgLayerStyle}
                    tintColor={color}
                    resizeMode="contain"
                />
            </View>
        );
    }
    return <Image key={imgKey} source={source} style={imgBoxStyle} resizeMode="contain" />;
}

const styles = StyleSheet.create({
    ring: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringBottom: {
        justifyContent: 'flex-end',
    },
    // Известный баг Android: `elevation` на View БЕЗ явного backgroundColor
    // иногда рисует тень/контур по ПРЯМОУГОЛЬНОЙ границе вида, игнорируя
    // borderRadius (Android считает форму от заливки, а не только от
    // borderRadius) — у токенов на доске (showRing=false) кольцо обычно без
    // фона вообще, отсюда "у некоторых персонажей квадрат вместо кружка"
    // (жалоба пользователя, 2026-09-01, живой скриншот с Android — квадрат
    // именно вокруг ВЫБРАННОГО бегуна). backgroundColor:'transparent' даёт
    // Android нужную явную форму для расчёта тени, ничего визуально не меняя
    // (сама заливка прозрачная).
    selected: {
        borderWidth: 3,
        borderColor: '#fff',
        backgroundColor: 'transparent',
        shadowColor: '#fff',
        shadowOpacity: 0.9,
        shadowRadius: 4,
        elevation: 4,
    },
});
