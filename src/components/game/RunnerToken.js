// src/components/game/RunnerToken.js
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import { RUNNER_DISPLAY } from '../../constants/GameConstants';
import { colorKeyForHex, getRunnerAnimationImage, getRunnerAvatarImage } from '../../constants/runnerAnimations';
import { colors } from '../../theme';

// Вращающийся пунктирный ореол вокруг активного бегуна (см. selected проп) —
// по прямому запросу пользователя, 2026-09-09, ВМЕСТО прежней белой рамки-
// кружка/квадрата ("как иногда делают в играх") — выбран из 5 живых
// вариантов (сравнивались в отдельном Artifact-макете), пользователь выбрал
// именно этот: стабильное вращение пунктирной рамки, БЕЗ мерцания —
// "силовое поле", не "дыхание". HALO_SCALE — во сколько раз ореол крупнее
// самого кольца (не обрезается — у ring нет overflow:hidden), уменьшен на
// ~20% (1.35→1.08) по прямому запросу пользователя тем же днём, единообразно
// для Android и веба (платформенного сплита тут нет и не было). HALO_SPIN_MS —
// время ОДНОГО полного оборота (360°).
const HALO_SCALE = 1.08;
const HALO_SPIN_MS = 3000;

// Кроссфейд между сменами source — держит ПРЕДЫДУЩУЮ картинку видимой, пока
// новая набирает opacity, маскируя паузу декодирования нового gif на Android
// (Fresco). Это НЕ платформенный дефолт RN Image (тот отдельно подавлен
// fadeDuration={0} ниже, см. комментарий там) — свой, контролируемой
// длительности. Был в проекте с 2026-09-01 (тогда — на паре {base,mask}), но
// потерялся при переходе на готовые одноцветные ассеты 2026-09-02 (тот
// рефакторинг схлопнул dual-layer в один <Image>, вместе с ним ушёл и
// crossfade-слой) — обнаружено и восстановлено 2026-09-09 по жалобе
// пользователя "мерцание при анимации передвижения... стоит там, откуда
// начал, потом резко продолжение" — ТОЛЬКО на Android, что и указывало на
// decode-паузу (сам слайд позиции идёт независимо через RunnerTokenSlide,
// не блокируется декодированием — а вот СПРАЙТ до готовности нового кадра,
// похоже, продолжал показывать старый, отставая от уже проехавшей позиции).
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
 * отдельный статичный ассет "avatar" вместо игровых анимаций — не связан с
 * `anim` вообще.
 *
 * Для типов без набора анимаций (constants/runnerAnimations — сейчас Скаут/
 * Атлет/Танк, Жнец пока без набора) обе функции возвращают null, и
 * рендерится старая статичная иконка (RUNNER_DISPLAY[type].icon) — новый тип
 * бегуна получает анимации просто добавлением записи в RUNNER_ANIMATION_SETS,
 * без правок этого компонента.
 *
 * **Перекраска под цвет игрока — готовые ассеты, не рантайм-tintColor**
 * (2026-09-02): раньше каждая анимация была ПАРОЙ {base, mask} — два
 * наложенных `<Image>`, mask с `tintColor` цвета игрока поверх base. Это
 * означало ДВОЙНОЙ decode на Android при каждой смене анимации. Теперь
 * `getRunnerAnimationImage`/`getRunnerAvatarImage` принимают `colorKey`
 * ('red'/'blue'/'green'/'yellow', см. colorKeyForHex) и возвращают ОДИН уже
 * заранее перекрашенный (реверс-маскинг: неон родной, "сталь" тонирована
 * полупрозрачно в цвет команды) require()-ассет — один `<Image>` вместо двух.
 * `color` проп остаётся HEX (как и был, для кольца-обводки) — colorKeyForHex
 * резолвит его в ключ ассета внутри этого компонента, вызывающий код
 * (BoardGrid/RunnerCard) не меняется.
 *
 * `imageScale` — доля `size`, которую занимает картинка ВНУТРИ кольца
 * (по умолчанию 0.68, как было изначально). По прямому запросу пользователя,
 * доска увеличивает персонажа независимо от кольца ("окружность вокруг
 * персонажа не увеличивай") — кольцо по-прежнему = `size`, картинка может
 * быть даже БОЛЬШЕ кольца (imageScale > 1), выходя за его пределы — это
 * осознанный эффект, не баг.
 *
 * `showRing` — цветной кружок-обводка (цвет игрока + полупрозрачная заливка).
 * По умолчанию `false` (2026-09-09, по прямому запросу пользователя — "убери
 * кружок контурный с плитки вообще": раньше был `true` для карточек в панели,
 * "нужен для быстрой идентификации", но перекраска бегунов под цвет игрока
 * (см. выше) и так уже это показывает — отдельная обводка признана избыточной
 * ВЕЗДЕ. Ни один вызывающий код теперь не передаёт `true` — прежний
 * default-`true` был бы мёртвым/вводящим в заблуждение, дефолт синхронизирован
 * с фактическим использованием). `selected`
 * (сейчас выбран для хода/выстрела) — другая, никак не связанная с цветом
 * игрока сущность, рисуется независимо от `showRing`: вращающийся зелёный
 * пунктирный ореол ВОКРУГ кольца (см. HALO_SCALE/HALO_SPIN_MS выше), а не
 * рамка ПО кольцу — до 2026-09-09 тут была белая рамка+тень, убрана по
 * прямому запросу пользователя (заодно избавляет от известного Android-бага
 * с elevation+прямоугольной тенью на View без фона — эффект больше не
 * использует shadow/elevation вообще).
 *
 * `imageAlign` — 'center' (по умолчанию) или 'bottom'. Определяет, как
 * картинка (которая может быть БОЛЬШЕ кольца, см. imageScale выше)
 * позиционируется ВНУТРИ кольца по вертикали. 'bottom' — ТОЛЬКО для доски на
 * native (BoardGrid) — низ картинки прижат к низу кольца, лишний размер
 * выпирает только ВВЕРХ, не поровну на все 4 стороны. Кольцо само по себе
 * тоже должно быть прижато к низу своего родителя — за это отвечает ВНЕШНИЙ
 * контейнер (см. BoardGrid#styles.tokenLayerBottom), этот проп красит только
 * внутреннее позиционирование картинки относительно кольца.
 */
export default function RunnerToken({
    type, status, color = '#fff', size = 32, selected = false, anim = null, avatar = false, imageScale = 0.68,
    showRing = false, imageAlign = 'center', style,
}) {
    const display = RUNNER_DISPLAY[type];
    const colorKey = colorKeyForHex(color);
    const source = display
        ? (avatar ? getRunnerAvatarImage(type, status, colorKey) : getRunnerAnimationImage(type, status, anim, colorKey)) ?? display.icon
        : null;

    if (!display) return null;

    const imgBoxStyle = { width: size * imageScale, height: size * imageScale };

    // Своя crossfade-логика (см. CROSSFADE_MS выше) — НЕ завязана на
    // Platform.OS намеренно (тот же выбор, что и в 2026-09-01: на вебе смена
    // <img> src мгновенна, лишний 120мс opacity-бленд там просто незаметен,
    // отдельная ветка ради no-op не нужна). prevSourceRef хранит source
    // ПРЕДЫДУЩЕГО рендера — как только он реально меняется, старое значение
    // переезжает в fadingSource (рисуется под новым, статично, без анимации
    // само по себе) и гаснет по мере роста opacity у нового поверх него.
    const prevSourceRef = useRef(source);
    const [fadingSource, setFadingSource] = useState(null);
    const fadeOpacity = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (prevSourceRef.current === source) return;
        setFadingSource(prevSourceRef.current);
        prevSourceRef.current = source;
        fadeOpacity.setValue(0);
        Animated.timing(fadeOpacity, {
            toValue: 1,
            duration: CROSSFADE_MS,
            useNativeDriver: true,
        }).start(() => setFadingSource(null));
    }, [source, fadeOpacity]);

    // Вращение ореола — ОДИН Animated.Value, растёт линейно 0→1 и сразу
    // зацикливается (не туда-обратно, как было бы у пульса) — стабильное
    // вращение БЕЗ мерцания, по прямому выбору пользователя из 5 живых
    // вариантов. Останавливается и сбрасывается, когда selected становится
    // false — Animated.loop сам не остановится, если не вызвать .stop()
    // явно (и не начнёт с произвольного угла при повторном выборе).
    // useNativeDriver:true — rotate-transform им поддерживается нативно (не
    // layout-свойство). ТОЛЬКО native (Android/iOS) — на вебе живьём
    // подтверждено (2026-09-09, после фикса ниже), что RN `Animated`
    // (JS-driven, т.к. useNativeDriver на вебе не поддерживается) на этом
    // конкретном стеке не прогрессирует вообще (проверено полностью
    // изолированным тестом вне этого компонента — голый Animated.Value,
    // тот же результат): значение застревает на 0 бесконечно, колбэк
    // .start(cb) не срабатывает НИКОГДА. Причина НЕ установлена окончательно
    // (подозрение — визуальный движок именно в среде разработки/тестирования
    // не даёт rAF прогрессировать), но раз пользователь подтвердил статичность
    // и в СВОЁМ реальном браузере — решение: не полагаться на JS Animated для
    // веба вообще, см. ветку web в JSX ниже.
    const haloSpin = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!selected || Platform.OS === 'web') return undefined;
        haloSpin.setValue(0);
        const anim = Animated.loop(
            Animated.timing(haloSpin, { toValue: 1, duration: HALO_SPIN_MS, useNativeDriver: true }),
        );
        anim.start();
        return () => anim.stop();
    }, [selected, haloSpin]);
    const haloRotate = haloSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const haloSize = size * HALO_SCALE;

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
                style,
            ]}
        >
            {selected && (
                // Явные width/height + left/top (НЕ StyleSheet.absoluteFill) —
                // тот же класс бага, что уже ловили на react-native-web в
                // этом файле чуть ниже (натуральный размер файла вместо
                // растяжения под родителя) — тут своего файла нет, но привычка
                // из этой же сессии: явный размер надёжнее в любом случае.
                // pointerEvents="none" — чисто декоративный слой, не должен
                // перехватывать тапы по токену.
                //
                // Platform.OS==='web' — ПЛОСКИЙ View со static CSS-анимацией
                // (styles.haloWeb, animationKeyframes), НЕ Animated.View — см.
                // комментарий у haloSpin выше про то, почему JS Animated не
                // прогрессирует на этом вебе. animationKeyframes — официальный
                // API react-native-web (0.21+), тот же приём, что их
                // собственный ActivityIndicator использует для спиннера
                // (node_modules/react-native-web/.../ActivityIndicator) —
                // вращение целиком на браузерном CSS-движке, JS/rAF не нужен.
                Platform.OS === 'web' ? (
                    <View
                        pointerEvents="none"
                        style={[
                            styles.haloWeb,
                            {
                                position: 'absolute',
                                left: (size - haloSize) / 2,
                                top: (size - haloSize) / 2,
                                width: haloSize,
                                height: haloSize,
                                borderRadius: haloSize / 2,
                                borderWidth: 3,
                                borderStyle: 'dashed',
                                borderColor: colors.success,
                                opacity: 0.85,
                            },
                        ]}
                    />
                ) : (
                    <Animated.View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            left: (size - haloSize) / 2,
                            top: (size - haloSize) / 2,
                            width: haloSize,
                            height: haloSize,
                            borderRadius: haloSize / 2,
                            borderWidth: 3,
                            borderStyle: 'dashed',
                            borderColor: colors.success,
                            opacity: 0.85,
                            transform: [{ rotate: haloRotate }],
                        }}
                    />
                )
            )}
            <View style={imgBoxStyle}>
                {/* Явные width/height (НЕ StyleSheet.absoluteFill) — на
                    react-native-web <Image> с position:absolute и только
                    top/left/right/bottom (без явного width/height)
                    откатывается на НАТУРАЛЬНЫЙ пиксельный размер файла вместо
                    растяжения под родителя (тот же класс бага, что уже
                    ловили на MobileFrameOverlay/wipeOverlayCells в
                    BoardGrid.js — жалоба пользователя, 2026-09-09: "размеры
                    огромны", после того как этот слой добавился под
                    кроссфейд). На native оба варианта работали одинаково,
                    баг был только на вебе — но явный size надёжнее в любом
                    случае, absoluteFill тут не даёт ничего взамен.

                    fadeDuration=0 на ОБОИХ слоях — на Android <Image> по
                    умолчанию кросс-фейдит (~300мс) при КАЖДОЙ смене source
                    сам по себе (жалоба пользователя, 2026-09-08: "плавные
                    исчезновения одной gif и появление другого") — это
                    платформенный дефолт RN Image, не наш код, гасим его на
                    обоих <Image>, чтобы не накладывался ДВОЙНОЙ фейд поверх
                    собственного (управляемого, контролируемой длительности)
                    ниже. */}
                {fadingSource && (
                    <Image
                        source={fadingSource}
                        style={[styles.imgLayer, imgBoxStyle]}
                        resizeMode="contain"
                        fadeDuration={0}
                    />
                )}
                <Animated.Image
                    source={source}
                    style={[styles.imgLayer, imgBoxStyle, fadingSource && { opacity: fadeOpacity }]}
                    resizeMode="contain"
                    fadeDuration={0}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    ring: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    // top/left:0 фиксированы тут, width/height добавляются рядом через
    // imgBoxStyle (динамический, зависит от size/imageScale) — см. комментарий
    // у мест использования про то, почему не StyleSheet.absoluteFill.
    imgLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    ringBottom: {
        justifyContent: 'flex-end',
    },
    // Вращение ореола НА ВЕБЕ — чистый CSS `@keyframes`, тот же приём, что
    // react-native-web использует в своём собственном ActivityIndicator.
    // `animationKeyframes` — web-only ключ StyleSheet (react-native-web
    // 0.21+), молча игнорируется на native — там вращает Animated.loop (см.
    // JSX выше). Не зависит от JS Animated/rAF вообще — крутит браузерный
    // compositor.
    haloWeb: {
        animationKeyframes: [{
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' },
        }],
        animationDuration: `${HALO_SPIN_MS}ms`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
    },
});
