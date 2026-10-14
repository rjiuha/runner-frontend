// src/components/game/RunnerToken.js
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import { RUNNER_DISPLAY } from '../../constants/GameConstants';
import { colorKeyForHex } from '../../constants/runnerAnimHelpers';
import { listAllSpriteSources, resolveSpriteAvatarFrame, resolveSpriteRef } from '../../constants/spritePacks';
import { getAvatarGif, hasAvatarGif } from '../../constants/avatarGifs';
// SpritePackAnimation — рендерер нового AI-спрайт-пака (assets/sprites/,
// 2026-09-23, см. CLAUDE.md) — заменяет старый комбинированный gif-спрайт-
// хак только для Скаута/Android (constants/scoutSpriteSheets.js/
// SpriteSheetAnimation.js — были мёртвым кодом, никем не импортировались
// после миграции, удалены 2026-09-28). Один заранее перекрашенный PNG-
// лист на тип+статус+цвет декодируется ОДИН раз при монтировании токена,
// смена анимационной позы — чистый сдвиг row/frameIndex внутри уже
// загруженного листа, не смена source — тот самый класс Android-decode-
// паузы, ради которого затевался старый scout-only хак, снимается
// СТРУКТУРНО, без крос-фейда (не нужен, см. докстринг SpritePackAnimation.js).
import SpritePackAnimation from '../ui/SpritePackAnimation';
// Старая gif-анимация (constants/runnerAnimations.js) — 2026-09-24, ВЕРНУЛИ
// на веб (см. AI-summary ниже, "тормоза жуткие"). Уже 2026-09-20 живым
// прогоном на реальном браузере пользователя было подтверждено: сама
// техника многострочного PNG-листа (тогда — комбинированный gif-хак, теперь
// — SpritePackAnimation) заметно тормозит именно веб-рендерер (react-native-
// web гоняет каждую смену кадра через полноценный DOM/CSS reflow, не через
// нативный decode, как на Android) — тогда решение было "спрайты только для
// Android, веб — старые gif" (см. RunnerToken.js в истории коммитов). Этот
// же класс регрессии вернулся 2026-09-23, когда компонент переписали на
// ЕДИНЫЙ путь для обеих платформ без Platform.OS-ветвления вообще — заодно с
// миграцией пользователь удалил всю папку `assets/images/runners/` (все
// require() в этом файле стали битыми, никто их больше не импортировал —
// сборка молчала, потому что мёртвый импорт никогда не резолвится).
// Восстановлено из git-истории (`git checkout 13383bb --
// src/assets/images/runners/`, коммит прямо ПЕРЕД миграцией на спрайты) —
// файлы снова на месте, `getRunnerAnimationImage`/`getRunnerAvatarImage`
// покрывают ВСЕ 5 типов (не только Скаута, как в самом первом scout-хаке) —
// восстановление веб-ветки не требует отдельного хака под конкретный тип.
import { getRunnerAnimationImage, getRunnerAvatarImage, listAllRunnerAnimationSources } from '../../constants/runnerAnimations';
import { colors } from '../../theme';

const IS_WEB = Platform.OS === 'web';

// Прогретые комбинации type|status|colorKey (2026-09-25, см. useEffect ниже) —
// модульный, не per-компонент кэш: несколько бегунов одного типа/статуса/
// цвета на доске одновременно (обычное дело — 2 спринтера одной команды) не
// должны прогревать один и тот же набор файлов по нескольку раз.
const prewarmedCombos = new Set();

// Кольцо-эллипс под ногами активного бегуна (см. selected проп) — 2026-10-14,
// по прямому запросу пользователя, ЗАМЕНА прежнего вращающегося пунктирного
// ореола вокруг ВСЕГО токена (тот выбирался 2026-09-09 из 5 живых вариантов,
// см. CLAUDE.md за историей) на "наземное" кольцо-эллипс, пульсирующее
// размером (выбор между "эллипс вокруг бегуна"/"эллипс под ногами" —
// пользователь взял форму первого (кольцо: рамка+полупрозрачная заливка),
// но положение второго (у основания, не вокруг всего тела) — макеты
// сравнивались через mcp__visualize). Две живые правки по факту (2026-10-14,
// продолжение) после первой версии:
//  1) "ноги должны быть в ЦЕНТРЕ эллипса, не просто эллипс под бегуном" —
//     центр по Y теперь в точке SELECT_FEET_Y (см. ringTop ниже), не просто
//     "у низа кольца". Токены на доске ВСЕГДА `imageAlign="bottom"`
//     (BoardGrid.js передаёт `selected` только там, где `anchorBottom`/
//     `imageAlign` жёстко `true`/`'bottom'`) — низ самого КОЛЬЦА (`size`)
//     совпадает с низом image-бокса персонажа, НО не с визуальными ступнями
//     — у спрайта есть прозрачный отступ по низу кадра, живой фидбек
//     пользователя (ровно по низу кольца — "расположение стало ещё ниже")
//     подтвердил, что нужна поправка выше формального края — SELECT_FEET_Y
//     подбирается по факту, пока не совпадёт визуально.
//  2) "форма как буханка хлеба + контурный край" — простой прямоугольник с
//     `borderRadius: height/2` при width≫height даёт "стадион" (плоские
//     бока, полукруглые торцы), НЕ истинный эллипс — отсюда и вид, и то, что
//     обводка явно трассирует эти плоские грани. Фикс — классический приём
//     "растянутая окружность": базовая форма — КРУГ (сторона = SELECT_RING_
//     HEIGHT*size), `transform: scaleX` растягивает его до нужной ширины.
//     Математически растянутый круг — это точный эллипс (в отличие от
//     borderRadius-прямоугольника), см. JSX ниже.
// SELECT_PULSE_MS — время ОДНОЙ половины цикла (рост ИЛИ сжатие), MIN/MAX —
// крайние масштабы.
const SELECT_RING_WIDTH = 0.92;
const SELECT_RING_HEIGHT = 0.34;
const SELECT_RING_ASPECT = SELECT_RING_WIDTH / SELECT_RING_HEIGHT;
const SELECT_PULSE_MS = 900;
const SELECT_PULSE_MIN = 0.82;
const SELECT_PULSE_MAX = 1.18;

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
 * `runnerId`/`onAnimStepEnd` (2026-09-25) — только для доски (BoardGrid),
 * RunnerCard их не передаёт (avatar-режим не проигрывает транзиентные позы,
 * см. SpritePackAnimation#staticFrameIndex). Вызывается РОВНО когда
 * SpritePackAnimation реально дорисовала последний кадр невращающейся позы
 * (attack/gotShot/start/bomb/heal/destroyed/burn/acid) — настоящий сигнал
 * "действие закончилось", см. useRunnerAnimations.js#completeStep. Для
 * move/fly этот колбэк тут ни при чём — там сигналит слайд
 * (RunnerTokenSlide#onSlideEnd в BoardGrid), не поза (см. loop ниже).
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
 * `selectRingYOffset` (px, по умолчанию 0) — 2026-10-14. BoardGrid иногда
 * сдвигает ВЕСЬ токен (картинку+кольцо) своим внешним `transform`
 * (сейчас — только у Скаута на Android, "на 10% сегмента ниже остальных
 * типов", чисто под особенности спрайта) — этот проп даёт кольцу выбора
 * РАВНЫЙ ПО МОДУЛЮ, НО ОБРАТНЫЙ сдвиг (см. ringTop ниже), чтобы оно держало
 * один и тот же уровень "земли" независимо от типа бегуна — только
 * картинка персонажа подстраивается под особенности своего спрайта, само
 * кольцо-эллипс остаётся консистентным между типами.
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
 * игрока сущность, рисуется независимо от `showRing`: зелёное кольцо-эллипс
 * У НОГ, пульсирующее размером (см. константы SELECT_RING_WIDTH/
 * SELECT_PULSE_MIN и соседние выше), не рамка ПО кольцу — до 2026-09-09 тут
 * была белая рамка+тень, затем (до
 * 2026-10-14) вращающийся пунктирный ореол вокруг всего кольца, оба убраны
 * по прямым запросам пользователя (заодно избавляет от известного
 * Android-бага с elevation+прямоугольной тенью на View без фона — эффект
 * больше не использует shadow/elevation вообще).
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
function RunnerToken({
    type, status, color = '#fff', size = 32, selected = false, selectRingYOffset = 0, anim = null, avatar = false, imageScale = 0.68,
    showRing = false, imageAlign = 'center', style, runnerId = null, onAnimStepEnd,
}) {
    const display = RUNNER_DISPLAY[type];
    const colorKey = colorKeyForHex(color);

    if (!display) return null;

    const imgBoxStyle = { width: size * imageScale, height: size * imageScale };

    // Аватар (карточка в панели игрока) — по прямому запросу пользователя,
    // 2026-09-24, отдельный набор анимированных GIF (constants/avatarGifs.js,
    // assets/images/avatars/), И для healthy, И для damaged (scout/tank/
    // athlete) — вместо статичного кадра из спрайт-пака/старой gif-системы.
    // Drone (Жнец) — один сет без разделения по статусу (он и не получает
    // damaged по игровым правилам). Мяч без аватарки вообще — hasAvatarGif
    // для него всегда false, используется платформенный фолбэк ниже.
    const avatarGifSource = avatar && hasAvatarGif(type, status) ? getAvatarGif(type, status, colorKey) : null;

    // ВЕБ — старая gif-анимация (constants/runnerAnimations.js), НЕ спрайт-
    // пак, см. докстринг импорта выше ("тормоза жуткие"). Один <Image> на
    // состояние — GIF анимируется нативным браузерным декодером, без единого
    // React-ре-рендера на кадр (в отличие от SpritePackAnimation, которая
    // тикает JS-таймером и двигает layout-позицию каждые ~120мс на КАЖДЫЙ
    // токен). Не используется, если avatarGifSource уже покрыл аватар выше.
    const webGifSource = IS_WEB && !avatarGifSource
        ? (avatar ? getRunnerAvatarImage(type, status, colorKey) : getRunnerAnimationImage(type, status, anim, colorKey))
        : null;

    // Native (Android/iOS) ИЛИ веб без покрытия в старом наборе (не должно
    // случаться — все 5 типов есть в runnerAnimations.js, см. докстринг
    // импорта) — спрайт-пак, как и было. На вебе, когда webGifSource уже
    // нашёлся, resolveSpriteRef вызывать незачем — избегаем лишней работы.
    const frame = avatarGifSource || webGifSource
        ? null
        : avatar
            ? resolveSpriteAvatarFrame(type, status, colorKey)
            : resolveSpriteRef(type, status, anim, colorKey);

    // Веб (2026-10-05, прямой запрос пользователя — "пусть сначала
    // прогрузится анимация, а потом проиграется") — ДОПОЛНЕНИЕ к прогреву
    // выше: прогрев снижает шанс первого "пропадания", но не гарантирует его
    // (Image.prefetch — отдельный сетевой запрос, может не успеть к моменту
    // смены позы). Поэтому ЕЩЁ И сам рендер не переключает <Image source>
    // сразу на новый desiredGifSource — держит ПРЕДЫДУЩИЙ закоммиченный кадр
    // (committedGifSource), пока конкретно этот URI не прогрузится (тот же
    // приём, что уже применяет SpritePackAnimation.js для спрайт-пака —
    // preloadToken отсекает устаревший prefetch, если source сменился ЕЩЁ РАЗ
    // до того, как первый успел отработать). Только веб — на native
    // require()-ассеты уже в бандле приложения, сетевого ожидания нет,
    // renderedGifSource там просто всегда равен desiredGifSource напрямую.
    const desiredGifSource = avatarGifSource || webGifSource;
    const [committedGifSource, setCommittedGifSource] = useState(desiredGifSource);
    const gifPreloadTokenRef = useRef(0);
    useEffect(() => {
        if (!IS_WEB) return;
        if (desiredGifSource === committedGifSource) return;
        if (!desiredGifSource) {
            setCommittedGifSource(null);
            return;
        }
        const myToken = ++gifPreloadTokenRef.current;
        const uri = Image.resolveAssetSource?.(desiredGifSource)?.uri;
        const commit = () => {
            if (myToken === gifPreloadTokenRef.current) setCommittedGifSource(desiredGifSource);
        };
        if (!uri || typeof Image.prefetch !== 'function') {
            commit();
            return;
        }
        Image.prefetch(uri).then(commit).catch(commit);
    }, [desiredGifSource, committedGifSource]);
    const renderedGifSource = IS_WEB ? (committedGifSource ?? desiredGifSource) : desiredGifSource;

    // Пульсация кольца-эллипса (растёт→сжимается→растёт, зациклено) — ОДИН
    // непрерывный `Animated.loop(Animated.timing(0→1))` + `interpolate` в
    // треугольную волну (0→MAX→0, см. selectScale ниже), а НЕ
    // `Animated.loop(Animated.sequence([up, down]))` — живой баг, 2026-10-14:
    // с sequence+loop на границе цикла (ровно в MIN-точке) анимация ВИДИМО
    // "исчезает и появляется" вместо плавного разворота — известная
    // особенность `Animated.loop` при зацикливании СОСТАВНОЙ (sequence)
    // native-driven анимации (хендовер между итерациями даёт скачок/сброс
    // на один кадр). Один непрерывный `timing` в цикле — ТОТ ЖЕ приём, что
    // уже доказанно без мерцания работает у вращения ореола (см. история
    // выше) — зацикливает сам по себе, без хендовера между составными
    // кусками, разворот тут делает interpolate, не сама Animated-анимация.
    // JS `Animated` ПОДТВЕРЖДЁННО не прогрессирует на вебе на этом стеке
    // (живой тест, 2026-09-09) — на вебе крутится чистый CSS `@keyframes`
    // (см. ветку web в JSX ниже), тут только native (Android/iOS).
    // useNativeDriver:true — scale-transform им поддерживается нативно.
    const selectPulse = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!selected || Platform.OS === 'web') return undefined;
        selectPulse.setValue(0);
        const anim = Animated.loop(
            Animated.timing(selectPulse, { toValue: 1, duration: SELECT_PULSE_MS * 2, useNativeDriver: true }),
        );
        anim.start();
        return () => anim.stop();
    }, [selected, selectPulse]);
    const selectScale = selectPulse.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [SELECT_PULSE_MIN, SELECT_PULSE_MAX, SELECT_PULSE_MIN],
    });

    // Прогрев (2026-09-25, по прямому запросу пользователя — живая жалоба
    // "еле заметное мигание при смене idle на move", подтверждённая живьём
    // ТОЛЬКО на Android). Гипотеза: SpritePackAnimation (см. компонент) держит
    // СТАРЫЙ кадр, пока новый source не задекодируется через Image.prefetch —
    // idle почти всегда уже "тёплый" (показывается по умолчанию), а
    // конкретное направление move/attack может декодироваться ВПЕРВЫЕ ровно
    // в момент первого реального использования — слайд (RunnerTokenSlide) уже
    // начинает ехать, пока decode идёт, и поза потом резко "прыгает" на move
    // уже на середине пути. Прогреваем ВСЕ возможные кадры этой комбинации
    // type+status+colorKey заранее, один раз за комбинацию на весь сеанс
    // (prewarmedCombos выше) — сама проверка `!avatar` не нужна: у аватарки
    // те же type/status/colorKey, тот же набор файлов и так нужен доске рано
    // или поздно.
    //
    // **Веб (2026-10-05, живая жалоба пользователя)** — тот же класс бага,
    // но куда серьёзнее: на native `require()`-ассеты уже лежат в бандле
    // приложения, Image.prefetch там только прогревает decode-кэш. На вебе
    // КАЖДЫЙ require() — это отдельный HTTP-файл, который браузер реально
    // СКАЧИВАЕТ по факту первого использования — без прогрева первая игра
    // конкретной позы (attack/gotShot/start и т.п.) не просто чуть дёргается,
    // а не показывается ВООБЩЕ: бегун пропадает на всё время ANIM_DURATION_MS
    // (useRunnerAnimations.js), пока файл качается, таймер смены позы об этом
    // не знает и откатывает в idle, не дожидаясь загрузки. Повторная игра той
    // же позы — файл уже в браузерном кеше, играется мгновенно, отсюда и
    // жалоба "только первый раз за партию не проигрывается". Источник списка
    // веб-ветка берёт другой (listAllRunnerAnimationSources — старый
    // gif-реестр runnerAnimations.js, а не спрайт-пак), сам приём (Image.
    // resolveAssetSource+prefetch, один раз на комбинацию) — тот же.
    //
    // **2026-10-05, тот же день, дальше по сессии** — возникла живая жалоба
    // "веб тормозит при заходе в партию"; прогрев СНАЧАЛА откатывался с веба
    // как подозреваемая причина (массовый параллельный Image.prefetch по
    // 15-20 файлам на каждого смонтированного бегуна), но пользователь
    // уточнил — тормоза были и ДО этой правки, прогрев тут ни при чём, причина
    // не найдена/не в этом коде. Возвращено как было.
    useEffect(() => {
        if (!display) return;
        const comboKey = `${type}|${status}|${colorKey}`;
        if (prewarmedCombos.has(comboKey)) return;
        prewarmedCombos.add(comboKey);
        const sources = IS_WEB
            ? listAllRunnerAnimationSources(type, status, colorKey)
            : listAllSpriteSources(type, status, colorKey);
        for (const source of sources) {
            const uri = Image.resolveAssetSource?.(source)?.uri;
            if (uri) Image.prefetch(uri).catch(() => {});
        }
    }, [type, status, colorKey]);
    // Базовая форма — КРУГ со стороной ringH (не ringW×ringH-прямоугольник,
    // см. докстринг SELECT_RING_* выше за тем, почему) — `scaleX` растягивает
    // его в истинный эллипс. Центр по Y — SELECT_FEET_Y (живая подстройка,
    // 2026-10-14): низ самого кольца (`size`, imageAlign='bottom') оказался
    // НИЖЕ реальных ступней персонажа — у спрайта есть прозрачный отступ по
    // низу кадра, ступни визуально выше, чем формальный край кольца.
    // Понижать/повышать это число по живому фидбеку, пока не совпадёт.
    const SELECT_FEET_Y = 0.67;
    const ringH = size * SELECT_RING_HEIGHT;
    const ringLeft = (size - ringH) / 2;
    // selectRingYOffset (2026-10-14, см. докстринг пропа выше) — гасит
    // ВНЕШНИЙ translateY, который BoardGrid иногда накладывает на ВЕСЬ
    // токен целиком (сейчас — только у Скаута на Android, "спрайт на 10%
    // сегмента ниже остальных типов"), чтобы кольцо держало один и тот же
    // уровень "земли" независимо от типа — само же изображение персонажа
    // (не кольцо) эту внешнюю правку всё ещё получает как прежде.
    const ringTop = size * SELECT_FEET_Y - ringH / 2 + selectRingYOffset;

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
                (styles.selectRingWeb, animationKeyframes), НЕ Animated.View
                — см. комментарий у selectPulse выше про то, почему JS
                Animated не прогрессирует на этом вебе. animationKeyframes —
                официальный API react-native-web (0.21+), тот же приём, что
                их собственный ActivityIndicator использует для спиннера
                (node_modules/react-native-web/.../ActivityIndicator) —
                пульсация целиком на браузерном CSS-движке, JS/rAF не нужен. */}
            {Platform.OS === 'web' ? (
                <View
                    pointerEvents="none"
                    style={[
                        styles.selectRingWeb,
                        {
                            position: 'absolute',
                            left: ringLeft,
                            top: ringTop,
                            width: ringH,
                            height: ringH,
                            borderRadius: ringH / 2,
                            borderWidth: 2,
                            borderColor: colors.success,
                            backgroundColor: 'rgba(46,204,113,0.18)',
                            opacity: selected ? 0.9 : 0,
                        },
                    ]}
                />
            ) : (
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        left: ringLeft,
                        top: ringTop,
                        width: ringH,
                        height: ringH,
                        borderRadius: ringH / 2,
                        borderWidth: 2,
                        borderColor: colors.success,
                        backgroundColor: 'rgba(46,204,113,0.18)',
                        opacity: selected ? 0.9 : 0,
                        transform: [{ scaleX: SELECT_RING_ASPECT }, { scale: selectScale }],
                    }}
                />
            )}
            <View style={imgBoxStyle}>
                {desiredGifSource ? (
                    <Image source={renderedGifSource} resizeMode="contain" fadeDuration={0} style={imgBoxStyle} />
                ) : (
                    <SpritePackAnimation
                        frame={frame}
                        boxSize={imgBoxStyle.width}
                        staticFrameIndex={avatar ? frame?.frameIndex : null}
                        // loop=true для idle (anim==null), move/fly И collision
                        // (2026-09-25, по прямому запросу пользователя — "пока
                        // бегун бежит, анимация не должна прекращаться", и
                        // отдельно уточнено про collision тем же днём). Общее
                        // у этих трёх — НЕТ единого "шага очереди" с
                        // собственным nonce/сигналом окончания: move/fly решает
                        // слайд (RunnerTokenSlide#onSlideEnd), idle — вообще
                        // не заканчивается сам по себе, а collision — derived-
                        // состояние (см. BoardGrid#tokenOverlay — пересчитывается
                        // из "два бегуна физически ещё на одной клетке", не из
                        // события), крутим цикл, пока BoardGrid сам не перестанет
                        // передавать kind:'collision' (пара реально разъехалась
                        // и отстояла COLLISION_MIN_HOLD_MS). Для ОСТАЛЬНЫХ
                        // транзиентных поз (attack/gotShot/start/bomb/heal/
                        // destroyed/burn/acid) — по-прежнему false: играются
                        // один раз, последний кадр сам сигналит completeStep
                        // через onComplete ниже (держать кадр статично после
                        // этого не вредно — advanceQueue уже переключит anim).
                        loop={!anim || anim.kind === 'move' || anim.kind === 'fly' || anim.kind === 'collision'}
                        // Замыкание строится ЗДЕСЬ, не в BoardGrid/RunnerCard —
                        // проп RunnerToken снаружи остаётся СТАБИЛЬНЫМ
                        // (runnerId — примитив, onAnimStepEnd — ссылка из
                        // useRunnerAnimations, не пересоздаётся), поэтому
                        // React.memo (см. экспорт компонента ниже) по-прежнему
                        // отсекает лишние рендеры idle-токенов — то, ради чего
                        // memo вообще добавляли 2026-09-24. SpritePackAnimation
                        // само не страдает от нового замыкания на каждый рендер
                        // (см. её onCompleteRef).
                        onComplete={() => onAnimStepEnd?.(runnerId, anim?.nonce)}
                    />
                )}
            </View>
        </View>
    );
}

// React.memo (2026-09-24, "тормоза жуткие" на обоих устройствах, обе
// платформы) — ЖИВОЙ `dumpsys gfxinfo` на реальном Android-эмуляторе показал
// 48.88% janky-кадров, доминирующая категория — "Slow issue draw commands"
// (55к из 115к) — И ЭТО СОХРАНЯЛОСЬ В ПОЛНОМ ПРОСТОЕ (никто не ходит,
// 48.48% на свежем сэмпле) — то есть нагрузка НЕ привязана к конкретному
// действию/анимации, а фоновая, постоянная. `RunnerToken` (в отличие от
// `RunnerCard`/`ReaperCard`/`FramePanel`/`PersonPanel`, уже мемоизированных
// раньше по той же причине, см. их докстринги) НЕ был обёрнут в memo — на
// доске (`BoardGrid`) он вызывается напрямую (не через `RunnerCard`), и
// КАЖДЫЙ рендер `BoardGrid` (происходит на КАЖДОЕ применённое Mercure-
// событие партии — частое дело в активной игре) заново прогонял весь этот
// компонент + `resolveSpriteRef`(новый объект на каждый вызов, см.
// spritePacks.js) + всё дерево `SpritePackAnimation` (3 вложенных View/Image)
// для КАЖДОГО токена на доске, ДАЖЕ для тех, кто просто стоит в idle и чьи
// пропсы физически не изменились. Для типового "все стоят" случая пропсы
// сюда приходят СТАБИЛЬНЫМИ (примитивы + `anim===null`/`style===null`,
// проверено чтением BoardGrid.js) — default (shallow) `React.memo` тут
// реально отсекает лишнюю работу. Для АКТИВНО анимирующегося токена `anim`/
// `style` иногда приходят НОВЫМ объектом на каждый рендер (коллизионная
// пара/призрак) — memo в этом случае продолжит пере-рендерить как и раньше
// (не хуже, чем без memo), просто не помогает именно этому меньшинству
// токенов — не проверено живьём, дало ли это заметный эффект в игре с
// БОЛЬШИМ числом одновременно активных токенов (было протестировано на 5
// idle-бегунах, см. CLAUDE.md).
const styles = StyleSheet.create({
    ring: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringBottom: {
        justifyContent: 'flex-end',
    },
    // Пульсация кольца-эллипса НА ВЕБЕ — чистый CSS `@keyframes`, тот же
    // приём, что react-native-web использует в своём собственном
    // ActivityIndicator. `animationKeyframes` — web-only ключ StyleSheet
    // (react-native-web 0.21+), молча игнорируется на native — там пульсирует
    // Animated.loop (см. JSX выше). Не зависит от JS Animated/rAF вообще —
    // работает на браузерном compositor.
    selectRingWeb: {
        // scaleX(SELECT_RING_ASPECT) — ПОСТОЯННЫЙ множитель, растягивающий
        // базовый круг в истинный эллипс (см. докстринг SELECT_RING_* выше),
        // scale(...) ПОВЕРХ него — та же пульсация размера, что и на native
        // (комбинация transform-функций в CSS применяется в указанном
        // порядке, как и массив transform в RN).
        animationKeyframes: [{
            '0%': { transform: `scaleX(${SELECT_RING_ASPECT}) scale(${SELECT_PULSE_MIN})` },
            '50%': { transform: `scaleX(${SELECT_RING_ASPECT}) scale(${SELECT_PULSE_MAX})` },
            '100%': { transform: `scaleX(${SELECT_RING_ASPECT}) scale(${SELECT_PULSE_MIN})` },
        }],
        animationDuration: `${SELECT_PULSE_MS * 2}ms`,
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
    },
});

export default React.memo(RunnerToken);
