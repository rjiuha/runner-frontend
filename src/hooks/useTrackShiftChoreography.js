// src/hooks/useTrackShiftChoreography.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { BOARD_LAYOUT } from '../constants/GameConstants';
import { flattenTrackSegments } from '../lib/board';

/**
 * 2026-10-16, вынесено из GameBoardScreen.js по итогам аудита лучших
 * практик (пункт "б") — ОСТОРОЖНО: это конечный автомат хореографии сдвига
 * фрагментов трассы, историческое место самых живых анимационных багов в
 * проекте (несколько сессий подряд чинили телепорты/рывки, см. CLAUDE.md).
 * Вынос ЧИСТО механический — ни порядок эффектов, ни их содержимое, ни
 * имена возвращаемых значений (trackShiftPhase/trackShiftGridData/
 * trackShiftRunners/trackShiftWipeColumnOpacityMap/
 * trackShiftRevealColumnOpacityMap) НЕ менялись — GameBoardScreen.js
 * деструктурирует их под теми же именами, весь остальной код (15+ мест
 * потребления — boardGridEl/highlightedCells/GameFinishModal-гейт/
 * turnBannerInner/камера и т.п.) не тронут вообще.
 *
 * Хореография сдвига фрагментов трассы (game_track_updated) — по прямому
 * запросу пользователя, 2026-09-08: заход на "пик" 4-го фрагмента (см.
 * lib/board#flattenPeekColumn) должен переключать ВСЕХ игроков на фрагмент 1,
 * показать там destroy/fly у тех, кто на нём стоял, дать фрагменту исчезнуть
 * волной по колонкам, затем прыгнуть камерой к бегуну, который вызвал сдвиг,
 * и плавно проявить новый вид. См. подробный разбор у эффекта ниже.
 */
const TRACK_SHIFT_SETTLE_MS = 2200; // время доиграть destroy/fly тем, кто был на фрагменте 1
// WIPE/REVEAL — обе волны замедлены на ~2с каждая по прямому запросу
// пользователя, 2026-09-10 ("пусть и исчезновение, и появление длятся чуть
// дольше, на пару секунд... и то, и то"), поверх правки того же дня,
// сделавшей WIPE тоже посегментной волной (была ЕДИНЫМ фейдом).
const TRACK_SHIFT_WIPE_MS = 4800;   // волна исчезновения 8 колонок старого фрагмента
const TRACK_SHIFT_REVEAL_MS = 5000; // волна ПОЯВЛЕНИЯ 8 колонок нового фрагмента (см. ниже)

// Новый (только что раскрытый) фрагмент 3 после сдвига — ВСЕГДА один и тот же
// фиксированный диапазон глобальных колонок, не зависящий от того, где именно
// внутри него оказался бегун-инициатор: при TOTAL_COLS=25/COLS=8 фрагменты
// занимают 0-7/8-15/16-23, пик — колонка 24; после сдвига старый пик
// (col 24, только 1 колонка данных) становится ПОЛНЫМ третьим фрагментом
// (segment 2 = cols 16-23). Считать это заранее (а не искать позицию мовера
// в game.runners ПОСЛЕ волны, как было в первой версии) устраняет гонку:
// раньше жёстко зависело от того, успел ли собственный runner_save мовера
// прийти раньше конца анимации — теперь не нужно вообще, окно появления
// известно по построению.
const TRACK_SHIFT_NEW_FRAGMENT_SEGMENT = Math.floor(BOARD_LAYOUT.TOTAL_COLS / BOARD_LAYOUT.COLS) - 1;
const TRACK_SHIFT_REVEAL_WINDOW_START = TRACK_SHIFT_NEW_FRAGMENT_SEGMENT * BOARD_LAYOUT.COLS;
// Кусочек НОВОГО 4-го сегмента (новый пик, всегда последняя колонка —
// TOTAL_COLS-1) — по прямому запросу пользователя, 2026-09-08: должен
// проявиться САМЫМ ПОСЛЕДНИМ, отдельным шагом ПОСЛЕ того, как весь новый
// фрагмент 3 уже полностью показался волной, а не одновременно с ним в общей
// анимации. Добавлен ДЕВЯТЫМ элементом в конец TRACK_SHIFT_REVEAL_COLS (сам
// список сохраняет порядок "8 колонок фрагмента 3, потом пик") —
// trackShiftRevealColumnOpacityMap индексирует по глобальному номеру
// колонки, взятому из этого списка (см. её определение ниже).
const TRACK_SHIFT_PEEK_COL = BOARD_LAYOUT.TOTAL_COLS - 1;
const TRACK_SHIFT_PEEK_REVEAL_MS = 500;
const TRACK_SHIFT_REVEAL_COLS = [
    ...Array.from({ length: BOARD_LAYOUT.COLS }, (_, i) => TRACK_SHIFT_REVEAL_WINDOW_START + i),
    TRACK_SHIFT_PEEK_COL,
];

export function useTrackShiftChoreography({ game, rows, cols, runners, visualPositions, jumpToStart }) {
    // Живая жалоба, 2026-09-12: во время исчезновения старого фрагмента 1 на
    // нём же оказывались и "жители" фрагмента 2 — причина в TrackService::
    // shift() (бэк, read-only): при сдвиге ВСЕ выжившие на middle/end
    // получают segment-1 и свой runner_save (перенумерация, они физически не
    // двигались), а по глобальной колонке (segment*cols+positionX) это
    // ровно то же окно [0,8), что и замороженный кадр старого фрагмента 1
    // (камера на нём всю settling/wiping, см. boardGridEl в GameBoardScreen).
    // Раз паразитная 'fly'-анимация для этого случая уже подавлена (см.
    // lib/runnerAnimTriggers.js), у перенумерованных выживших НЕТ записи в
    // visualPositions — фильтруем `runners` именно по её наличию: только те,
    // кто реально доигрывает анимацию ухода с фрагмента 1 (destroy/bomb/
    // жнец-в-резерв), должны быть видны на замороженном кадре.
    const trackShiftRunners = useMemo(
        () => runners.filter((r) => visualPositions[r.id] != null),
        [runners, visualPositions],
    );

    // game_track_updated (см. runnerGameReducer#'game_track_updated' и
    // TrackService::shift()/Move::handle() на бэке, read-only) — заход
    // бегуна на "пик" 4-го фрагмента (см. lib/board#flattenPeekColumn) удаляет
    // фрагмент №1 (trackBegin), сдвигает №2→№1/№3→№2/№4(только что раскрытый
    // trackNext)→№3. По прямому запросу пользователя, 2026-09-08— это должно
    // быть заметной хореографией на экранах ВСЕХ игроков, а не тихой
    // подменой данных:
    //   1. Камера ВСЕХ клиентов принудительно прыгает на фрагмент 1
    //      (windowStart=0) — независимо от того, куда каждый был проскроллен.
    //   2. Пока камера там — доигрывают destroy/fly у тех, кто на фрагменте 1
    //      стоял (см. TRACK_SHIFT_SETTLE_MS) — это уже РАБОТАЕТ само по себе
    //      (существующий механизм в lib/runnerAnimTriggers.js, тут только
    //      подставляем ЗАМОРОЖЕННУЮ картинку старого фрагмента 1 вместо уже
    //      переименованной боевой, чтобы под анимацией была правильная земля,
    //      а бегуны/токены остаются ЖИВЫМИ — см. boardGridEl в GameBoardScreen).
    //   3. Фрагмент уходит в невидимость ВОЛНОЙ по 8 колонкам, одна за
    //      другой (см. TRACK_SHIFT_WIPE_MS, BoardGrid#columnOpacities —
    //      РЕАЛЬНЫЕ клетки И токены на них, не отдельный overlay-слой).
    //   4. Камера прыгает СТРОГО на новый фрагмент 3 (фиксированный диапазон
    //      колонок, не позиция бегуна — см. TRACK_SHIFT_REVEAL_WINDOW_START).
    //   5. Новый фрагмент 3 материализуется из невидимости ЗЕРКАЛЬНОЙ волной
    //      по 8 колонкам (см. TRACK_SHIFT_REVEAL_MS, BoardGrid#columnOpacities).
    //   6. Кусочек НОВОГО 4-го сегмента (новый пик) — камера сдвигается на
    //      правый край, показывая его, и он проявляется ПОСЛЕДНИМ, отдельным
    //      коротким шагом (TRACK_SHIFT_PEEK_REVEAL_MS) ПОСЛЕ того, как весь
    //      фрагмент 3 уже полностью виден — по прямому запросу пользователя,
    //      2026-09-08.
    //
    // Обнаружение самого факта сдвига — по имени `game.trackBegin.name`, НЕ
    // по `game.trackNumber` (тот, проверено чтением бэка, выставляется ОДИН
    // раз в RunnerGameFactory и TrackService::shift() его никогда не меняет —
    // на каждое событие приходит одно и то же число, диффить нечего) и НЕ по
    // ссылке на сам объект `trackBegin` (первая версия этой правки так и
    // делала — оказалось ЛОМАЕТСЯ на КАЖДОМ reconnect/resync: useMercure#sync
    // на любом подключении, даже без единого реального события, всегда
    // парсит REST-снапшот ЗАНОВО и коммитит его как НОВЫЙ объект — ссылка на
    // `trackBegin` меняется, хотя фрагмент физически тот же самый). Имя
    // фрагмента — надёжный идентификатор: `TrackLoader::prepareTracksForGame()`
    // тасует ВЕСЬ список файлов БЕЗ возврата, внутри одной партии одно и то
    // же имя не может встретиться дважды.
    // trackSnapshotRef хранит СТАРОЕ значение (записывается в КОНЦЕ этого же
    // эффекта с ПРОШЛОГО срабатывания) — `prev.trackBegin` на момент, когда
    // эффект видит новое имя, это как раз то, что было ДО сдвига (сам `game`
    // уже содержит новое — реducer применяет мгновенно). `prev.trackBegin !=
    // null` отсекает первый снапшот партии (переход null→объект, не сдвиг).
    // Известное ограничение: если ЗА ВРЕМЯ разрыва связи произошло больше
    // ОДНОГО сдвига разом, вся хореография запустится только один раз на
    // САМОЕ ПОСЛЕДНЕЕ состояние — не проверено живьём, требует спец.
    // сценария с длительным разрывом связи.
    const trackSnapshotRef = useRef({ trackBegin: null });
    const [trackShiftPhase, setTrackShiftPhase] = useState(null); // null | 'settling' | 'wiping' | 'revealing'
    const [trackShiftGridData, setTrackShiftGridData] = useState(null); // замороженные 8 колонок старого фрагмента 1
    // Исчезновение старого фрагмента — Animated.Value НА КОЛОНКУ (1=виден,
    // 0=невидим), применяется ПРЯМО К РЕАЛЬНЫМ клеткам И токенам (см.
    // BoardGrid#columnOpacities/item.col) — по прямому запросу пользователя,
    // 2026-09-10: "хочу, чтобы он исчезал посегментно, аналогично тому, как
    // появляется новый фрагмент" (была ЕДИНАЯ Animated.View-обёртка со
    // сплошным фейдом всего разом — правка того же дня чуть раньше, уже
    // заменившая ЕЩЁ более раннюю двух-overlay-слойную версию, см. историю
    // ниже). gridData у boardGridEl остаётся ЗАМОРОЖЕН на старом фрагменте
    // ВЕСЬ 'wiping' (см. проп ниже) — под волной реально пусто (фон экрана),
    // а не новый контент. Глобальные колонки старого фрагмента ВСЕГДА 0..7
    // (снимок берётся с windowStart=0, см. jumpToStart(0) ниже) — фиксированный
    // диапазон, в отличие от reveal (там диапазон зависит от
    // TRACK_SHIFT_REVEAL_WINDOW_START).
    const trackShiftWipeOpacitiesRef = useRef(
        Array.from({ length: BOARD_LAYOUT.COLS }, () => new Animated.Value(1)),
    );
    const trackShiftWipeColumnOpacityMap = useMemo(() => {
        const map = {};
        trackShiftWipeOpacitiesRef.current.forEach((v, col) => { map[col] = v; });
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Материализация НОВОГО фрагмента — тот же приём, зеркально (0→1). Длина —
    // TRACK_SHIFT_REVEAL_COLS.length (9: 8 колонок фрагмента 3 + 1 пик), см.
    // комментарий у TRACK_SHIFT_PEEK_COL выше про то, почему пик прицеплен
    // девятым элементом того же списка.
    const trackShiftRevealOpacitiesRef = useRef(
        Array.from({ length: TRACK_SHIFT_REVEAL_COLS.length }, () => new Animated.Value(0)),
    );
    // Стабильные map globalCol→Animated.Value для BoardGrid#columnOpacities —
    // построены ОДИН раз (константные диапазоны колонок, стабильные по ссылке
    // массивы рефов, никогда не пересоздаются), не пересчитываются на рендер.
    const trackShiftRevealColumnOpacityMap = useMemo(() => {
        const map = {};
        TRACK_SHIFT_REVEAL_COLS.forEach((col, idx) => {
            map[col] = trackShiftRevealOpacitiesRef.current[idx];
        });
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        const prev = trackSnapshotRef.current;
        const nameChanged = prev.trackBegin != null && game?.trackBegin != null
            && prev.trackBegin.name !== game.trackBegin.name;
        if (nameChanged) {
            // Массив из ОДНОГО элемента — flattenTrackSegments проходит только
            // blockIndex 0, считать/фильтровать несуществующие 1/2 не нужно.
            setTrackShiftGridData(flattenTrackSegments([prev.trackBegin], rows, cols));
            trackShiftWipeOpacitiesRef.current.forEach((v) => v.setValue(1)); // старый — сразу виден
            trackShiftRevealOpacitiesRef.current.forEach((v) => v.setValue(0)); // новый — сразу невидим
            jumpToStart(0); // камера ВСЕХ клиентов — на фрагмент 1, БЕЗ центрирования
            setTrackShiftPhase('settling');
        }
        trackSnapshotRef.current = { trackBegin: game?.trackBegin };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game?.trackBegin?.name]);

    // Фазы хореографии — см. докстринг у BoardGrid.js. 'settling': камера уже
    // на фрагменте 1, gridData у boardGridEl подменена на замороженный снимок
    // (см. проп ниже) — бегуны/анимации ОСТАЮТСЯ живыми, поэтому destroy/fly
    // у тех, кто там стоял, доигрывают как обычно поверх правильной (старой)
    // земли. 'wiping': gridData ОСТАЁТСЯ замороженной (не переключается на
    // боевую) — ВОЛНА по 8 колонкам (как и у reveal, см. ниже — по прямому
    // запросу пользователя, 2026-09-10: "хочу, чтобы он исчезал посегментно,
    // аналогично тому, как появляется новый фрагмент"), каждая гаснет 1→0,
    // ничего нового под ней не появляется, пока волна не закончится. По
    // завершении — снимок отпускается, камера прыгает СТРОГО на диапазон
    // нового фрагмента (TRACK_SHIFT_REVEAL_WINDOW_START, левый край без
    // центрирования — фиксированный диапазон по построению, не зависит от
    // того, успел ли прийти собственный runner_save мовера). 'revealing':
    // РЕАЛЬНЫЕ клетки нового фрагмента материализуются из невидимости
    // (opacity 0→1) по одной колонке за раз — НЕ отдельная серая маска поверх
    // уже отрисованного контента, как было раньше — см. BoardGrid#columnOpacities,
    // применяется прямо в laneCells.map/tokenOverlay.map.
    useEffect(() => {
        if (trackShiftPhase === 'settling') {
            const t = setTimeout(() => setTrackShiftPhase('wiping'), TRACK_SHIFT_SETTLE_MS);
            return () => clearTimeout(t);
        }
        if (trackShiftPhase === 'wiping') {
            const perCol = TRACK_SHIFT_WIPE_MS / BOARD_LAYOUT.COLS;
            Animated.stagger(
                perCol,
                trackShiftWipeOpacitiesRef.current.map((v) =>
                    Animated.timing(v, { toValue: 0, duration: perCol * 1.4, useNativeDriver: true }),
                ),
            ).start(() => {
                setTrackShiftGridData(null);
                jumpToStart(TRACK_SHIFT_REVEAL_WINDOW_START); // камера — строго на новый фрагмент 3
                setTrackShiftPhase('revealing');
            });
            return undefined;
        }
        if (trackShiftPhase === 'revealing') {
            // Сначала — волна ПО ФРАГМЕНТУ 3 целиком (первые 8 значений, см.
            // TRACK_SHIFT_REVEAL_COLS). Пик (9-й, последний элемент) в неё
            // намеренно НЕ входит — по прямому запросу пользователя, он должен
            // проявиться отдельным, самым последним шагом, а не одновременно
            // с общей волной.
            const perCol = TRACK_SHIFT_REVEAL_MS / BOARD_LAYOUT.COLS;
            const fragmentOpacities = trackShiftRevealOpacitiesRef.current.slice(0, BOARD_LAYOUT.COLS);
            Animated.stagger(
                perCol,
                fragmentOpacities.map((v) =>
                    Animated.timing(v, { toValue: 1, duration: perCol * 1.4, useNativeDriver: true }),
                ),
            ).start(() => {
                // Кусочек нового 4-го сегмента — камера сдвигается на самый
                // правый край (jumpToStart клэмпит любое большое значение до
                // maxStart), вводя пик в кадр, и только ТЕПЕРЬ он материализуется —
                // самый последний бит хореографии.
                jumpToStart(BOARD_LAYOUT.TOTAL_COLS);
                const peekOpacity = trackShiftRevealOpacitiesRef.current[BOARD_LAYOUT.COLS];
                Animated.timing(peekOpacity, {
                    toValue: 1,
                    duration: TRACK_SHIFT_PEEK_REVEAL_MS,
                    useNativeDriver: true,
                }).start(() => setTrackShiftPhase(null));
            });
            return undefined;
        }
        return undefined;
    }, [trackShiftPhase, jumpToStart]);

    return {
        trackShiftPhase, trackShiftGridData, trackShiftRunners,
        trackShiftWipeColumnOpacityMap, trackShiftRevealColumnOpacityMap,
    };
}
