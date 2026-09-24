// src/components/game/RunnerToken.js
import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import { RUNNER_DISPLAY } from '../../constants/GameConstants';
import { colorKeyForHex } from '../../constants/runnerAnimHelpers';
import { resolveSpriteAvatarFrame, resolveSpriteRef } from '../../constants/spritePacks';
import { getAvatarGif, hasAvatarGif } from '../../constants/avatarGifs';
// SpritePackAnimation — рендерер нового AI-спрайт-пака (assets/sprites/,
// 2026-09-23, см. CLAUDE.md) — заменяет ЦЕЛИКОМ старую gif-анимацию
// (constants/runnerAnimations.js, всё ещё в репозитории, просто больше не
// импортируется отсюда) И старый комбинированный gif-спрайт-хак только для
// Скаута/Android (constants/scoutSpriteSheets.js/SpriteSheetAnimation.js —
// тоже оставлены нетронутыми, но теперь ничем не импортируются вообще —
// их единственный потребитель, screens/__SpriteSheetPreview.js, удалён при
// этой миграции, см. CLAUDE.md). Единый путь для ВСЕХ 5 типов и ОБЕИХ платформ —
// никакого Platform.OS-ветвления тут больше не нужно: один заранее
// перекрашенный PNG-лист на тип+статус+цвет декодируется ОДИН раз при
// монтировании токена, смена анимационной позы — чистый сдвиг row/frameIndex
// внутри уже загруженного листа, не смена source — тот самый класс
// Android-decode-паузы, ради которого затевался старый scout-only хак,
// снимается СТРУКТУРНО для всех типов сразу, без крос-фейда (не нужен, см.
// докстринг SpritePackAnimation.js).
import SpritePackAnimation from '../ui/SpritePackAnimation';
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

/**
 * Иконка бегуна в цветном кольце владельца. Один и тот же компонент рисует
 * бегуна и на доске (BoardGrid), и в панели игрока (RunnerCard) — так фишки
 * на поле и карточки в панели выглядят одинаково и легко узнаются.
 *
 * `anim` — { kind: 'move'|'attack'|'fly'|'gotShot'|'destroyed'|'collision', direction?, side?, fromStatus? } | null
 * (idle), см. constants/spritePacks#resolveSpriteRef — доска передаёт сюда
 * текущее анимационное состояние бегуна (useRunnerAnimations в
 * GameBoardScreen), карточка в панели — не передаёт (там `avatar`).
 *
 * `avatar` — карточка бегуна в панели игрока (RunnerCard) использует
 * отдельный статичный кадр (см. resolveSpriteAvatarFrame) вместо игровых
 * анимаций — не связан с `anim` вообще.
 *
 * Для типа без записи в SPRITE_PACKS (constants/spritePacks.js) `display`
 * будет `null`, компонент рендерит пустоту (см. `if (!display) return null`
 * ниже) — новый тип бегуна получает анимации добавлением записи в
 * SPRITE_PACKS, без правок этого компонента.
 *
 * **Перекраска под цвет игрока — готовые PNG-варианты, не рантайм-tintColor**:
 * `resolveSpriteRef`/`resolveSpriteAvatarFrame` (constants/spritePacks.js)
 * принимают `colorKey` ('red'/'blue'/'green'/'yellow', см. colorKeyForHex) и
 * возвращают ссылку на ОДИН из 4 заранее перекрашенных PNG-листов (colorize
 * по luma, см. CLAUDE.md 2026-09-23) — `color` проп остаётся HEX (как и был,
 * для кольца-обводки), colorKeyForHex резолвит его в ключ ассета внутри
 * этого компонента, вызывающий код (BoardGrid/RunnerCard) не меняется.
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

    if (!display) return null;

    const imgBoxStyle = { width: size * imageScale, height: size * imageScale };

    // Аватар (карточка в панели игрока) — по прямому запросу пользователя,
    // 2026-09-24, отдельный набор анимированных GIF (constants/avatarGifs.js,
    // assets/images/avatars/), И для healthy, И для damaged (scout/tank/
    // athlete) — вместо статичного кадра из спрайт-пака. Drone (Жнец) — один
    // сет без разделения по статусу (он и не получает damaged по игровым
    // правилам). Мяч без аватарки вообще — hasAvatarGif для него всегда
    // false, используется прежний фолбэк (статичный кадр спрайт-пака).
    const avatarGifSource = avatar && hasAvatarGif(type, status) ? getAvatarGif(type, status, colorKey) : null;

    // Доска — анимированный кадр текущего `anim` (спрайт-пак). Аватар без
    // gif (damaged) — статичный кадр "south" из спрайт-пака, как и раньше.
    const frame = avatarGifSource
        ? null
        : avatar
            ? resolveSpriteAvatarFrame(type, status, colorKey)
            : resolveSpriteRef(type, status, anim, colorKey);

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
            {/* ВСЕГДА смонтирован (не `{selected && ...}`) — 2026-09-15, живой
                краш "connectAnimatedNodes: Animated node with tag (parent)
                [N] does not exist" сразу после тапа по клетке хода: смена
                `activeRunner` переключает `selected` между ДВУМЯ разными
                токенами почти одновременно, а условный рендер полностью
                уничтожал граф нативных Animated-нод (Animated.loop+
                interpolate) у одного и тут же создавал заново у другого —
                классическая гонка RN Animated (асинхронный "connect" от
                свежесозданного графа долетает до нативного потока уже после
                того, как узел-родитель снесён). Теперь узел создаётся ОДИН
                раз на весь жизненный цикл компонента, видимость — просто
                opacity (0 когда не выбран), Animated.loop по-прежнему
                стартует/стопается через selected в useEffect выше —
                поведение визуально не изменилось, изменился только момент
                mount/unmount самого узла. Явные width/height + left/top (НЕ
                StyleSheet.absoluteFill) — тот же класс бага, что уже ловили
                на react-native-web в этом файле чуть ниже (натуральный
                размер файла вместо растяжения под родителя). pointerEvents=
                "none" — чисто декоративный слой, не должен перехватывать
                тапы по токену.

                Platform.OS==='web' — ПЛОСКИЙ View со static CSS-анимацией
                (styles.haloWeb, animationKeyframes), НЕ Animated.View — см.
                комментарий у haloSpin выше про то, почему JS Animated не
                прогрессирует на этом вебе. animationKeyframes — официальный
                API react-native-web (0.21+), тот же приём, что их
                собственный ActivityIndicator использует для спиннера
                (node_modules/react-native-web/.../ActivityIndicator) —
                вращение целиком на браузерном CSS-движке, JS/rAF не нужен. */}
            {Platform.OS === 'web' ? (
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
                            opacity: selected ? 0.85 : 0,
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
                        opacity: selected ? 0.85 : 0,
                        transform: [{ rotate: haloRotate }],
                    }}
                />
            )}
            <View style={imgBoxStyle}>
                {avatarGifSource ? (
                    <Image source={avatarGifSource} resizeMode="contain" fadeDuration={0} style={imgBoxStyle} />
                ) : (
                    <SpritePackAnimation
                        frame={frame}
                        boxSize={imgBoxStyle.width}
                        staticFrameIndex={avatar ? frame?.frameIndex : null}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    ring: {
        alignItems: 'center',
        justifyContent: 'center',
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
