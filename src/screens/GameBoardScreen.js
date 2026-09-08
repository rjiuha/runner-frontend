// src/screens/GameBoardScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RoadNavButton from '../components/game/RoadNavButton';
import MobileFrameOverlay from '../components/game/MobileFrameOverlay';
import RoadArea from '../components/game/RoadArea';
import BoardGrid from '../components/game/BoardGrid';
import FragmentLabelStrip from '../components/game/FragmentLabelStrip';
import PlayerInfoPanel from '../components/game/PlayerInfoPanel';
import GameFinishModal from '../components/game/GameFinishModal';
import EventLogPanel from '../components/game/EventLogPanel';
import ParallaxBackground from '../components/ui/ParallaxBackground';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useMercure } from '../hooks/useMercure';
import { useAdaptiveOrientation } from '../hooks/useAdaptiveOrientation';
import { useRunnerAnimations } from '../hooks/useRunnerAnimations';
import { useRunnerDamageTokens } from '../hooks/useRunnerDamageTokens';
import { ROAD_AREA_SPACING, useBoardLayout } from '../hooks/useBoardLayout';
import { useBoardScroll } from '../hooks/useBoardScroll';
import { flattenTrackSegments, flattenPeekColumn, computeFragmentBands } from '../lib/board';
import { forwardNeighbors, cellKey } from '../lib/hexDirection';
import { describeEvent, rawEventFallback } from '../lib/eventLog';
import { handleVersionedRunnerAnimEvent, handleTransientRunnerAnimEvent } from '../lib/runnerAnimTriggers';
import { identifyPendingDamageType, getWorsenedDamageRunnerId } from '../lib/runnerDamageTokens';
import { pickActiveSoundSource, pickShootSoundSource, pickMoveSoundSource, pickStartSoundSource } from '../lib/runnerSoundTriggers';
import { COLLISION_SOUND, FALLBACK_MOVE_SOUND } from '../constants/runnerSounds';
import { notify } from '../lib/notify';
import { runnerGameApi } from '../api/runnerGame';
import { runnerGameReducer } from '../store/runnerGameReducer';
import { ROUTES } from '../navigation/routes';
import {
    BOARD_LAYOUT, GAME_STATUS, MOBILE_FRAME_BLEED, PLAYER_COLOR_HEX, PLAYER_COLORS, PLAYER_STATUS, PLAYER_STEP,
    RUNNER_DISPLAY, RUNNER_STATUS, RUNNER_TYPES,
} from '../constants/GameConstants';
import { colors, spacing, font, radius } from '../theme';

const STATUS_LABEL = {
    connecting: 'Подключение…',
    syncing: 'Синхронизация…',
    live: 'В сети',
    error: 'Нет связи, переподключаемся…',
};

// Через сколько показать кнопку ручного рефетча, если игрок-цель зависшей
// коллизии (game.extraTurnPlayer) долго не отвечает — бэк это сам не разруливает.
const COLLISION_STUCK_TIMEOUT = 18000;

// Через сколько после УСПЕШНОГО собственного действия (SELECT/ability/move/
// ...) считать ход "зависшим", если myStep за это время так и не сдвинулся —
// см. watchdog у runAction ниже. Короче COLLISION_STUCK_TIMEOUT — тут ждём
// обычное живое событие в рамках СВОЕГО хода (обычно доли секунды), не
// решения другого игрока.
const STUCK_ACTION_TIMEOUT = 8000;

// Задержка перед показом кнопок "Использовать/Перебросить" (и перед авто-
// разрешением "мяча", см. myBallCollision) — чтобы игрок сначала УВИДЕЛ
// анимацию столкновения, а не решал вслепую в момент, когда extraTurnPlayer
// только что появился. С запасом на слайд+move-позу приезжающего бегуна
// (SLIDE_DURATION_MS/ANIM_DURATION_MS.move, ~1400мс) плюс минимальный показ
// самой позы столкновения (COLLISION_MIN_HOLD_MS в BoardGrid, 1000мс).
const COLLISION_ANIM_DELAY_MS = 2200;

// Плавность смены фрагментов трассы (game_track_updated, см. эффект у
// gridData ниже) — длительность fade-out старого (удаляемого) фрагмента №1,
// нарисованного overlay-слоем поверх уже подменённой сетки.
const TRACK_FADE_MS = 550;

const DEAD_STATUSES = [RUNNER_STATUS.BROKEN, RUNNER_STATUS.DESTROYED];
const SEGMENT_KEYS = ['trackBegin', 'trackMiddle', 'trackEnd'];

function findRunnerAt(runners, pos) {
    return runners.find(
        (r) => r.segment === pos.segment && r.positionX === pos.positionX && r.positionY === pos.positionY,
    );
}

/** Сырой RoadType клетки прямо из game.trackBegin/Middle/End — grid[positionX][positionY]. */
function rawCellType(game, segment, positionX, positionY) {
    return game?.[SEGMENT_KEYS[segment]]?.grid?.[positionX]?.[positionY] ?? null;
}

// Человеко-понятная подсказка "что делать", раз на экране нет туториала —
// первый живой прогон показал, что без этого не очевидно, что шаг ABILITY
// нужно явно пройти (усилить или пропустить), прежде чем откроется тап по
// доске для перемещения/размещения.
function stepInstruction(step, activeRunner, pendingAbility, pendingSelect, pendingRunnerName, trackGain, pendingReaperPlacement, reaperPreviewReady) {
    if (pendingReaperPlacement) {
        // До того, как "прилёт" из-за края карты успел доиграть
        // (reaperPreviewReady), подсветки на доске ещё нет — тапать некуда,
        // текст объясняет паузу, а не намекает на несуществующие клетки.
        return reaperPreviewReady
            ? 'Жнец на месте — тапни подсвеченную клетку для выстрела или нажми «Без выстрела»'
            : 'Жнец приближается…';
    }
    if (pendingSelect) {
        // Имя бегуна — по прямому запросу пользователя: раньше текст был безличным
        // ("Бегун выбран"), и на карточках с одинаковой иконкой/цветом (или просто
        // издалека) не всегда было очевидно, кого именно выбрали.
        const label = pendingRunnerName ? `«${pendingRunnerName}»` : 'Бегун';
        return pendingSelect.type === 'ROLL'
            ? `Накат для ${label} выбран — подтверди или тапни бегуна ещё раз, чтобы отменить`
            : `${label} выбран — подтверди или тапни бегуна ещё раз, чтобы отменить`;
    }
    switch (step) {
        case PLAYER_STEP.SELECT:
            return 'Перетащи кубик перемещения на карточку бегуна, чтобы выбрать его для хода';
        case PLAYER_STEP.ABILITY:
            if (pendingAbility?.ability === 'heal') return 'Тапни карточку своего повреждённого бегуна';
            if (pendingAbility?.ability === 'reaper') return 'Тапни подсвеченную клетку, чтобы поставить Жнеца';
            return 'Перетащи кубик на усиление или нажми «Пропустить усиление»';
        case PLAYER_STEP.MOVE:
            // activeRunner может быть неизвестен клиенту сразу после
            // reconnect/резинка — RunnerPlayer::toArray() на бэке не отдаёт
            // это поле в снапшоте вообще (только события его выставляют, см.
            // CLAUDE.md), так что даже ручной resync() тут не поможет — ждём
            // следующего события. Без этого текста подсказка ошибочно
            // намекала на подсвеченные клетки, которых физически нет
            // (жалоба пользователя, 2026-09-07 — "не подсвечена доступная
            // клетка... но диалог пропуска вижу").
            if (!activeRunner) return 'Не удалось определить активного бегуна (проблема синхронизации) — дождись следующего события или обнови соединение';
            return activeRunner.segment == null
                ? 'Тапни подсвеченную клетку в заднем ряду — это выход на трассу'
                : 'Тапни подсвеченную клетку, чтобы переместиться';
        case PLAYER_STEP.SHOOT:
            if (!activeRunner) return 'Не удалось определить активного бегуна (проблема синхронизации) — доступно только «Пропустить выстрел»';
            return 'Тапни подсвеченную цель или нажми «Пропустить выстрел»';
        case PLAYER_STEP.ROAD_BONUS:
            return `Бегун не покидал дорогу — использовать бонус кубика дороги (+${trackGain ?? '?'} очков) или пропустить?`;
        default:
            return null;
    }
}

/**
 * Экран игровой сессии. Фаза 2: реальная стейт-машина хода — select/ability/
 * move/shoot/collision дёргают бэк, а не локальный UI-стейт. Источник правды
 * для "что назначено" — сам live-`game` (runner.dice/rollDice, player.ability,
 * player.dice1..4): как только SELECT/ABILITY реально проходят на бэке, эти
 * поля обновляются событиями (runnerGameReducer, Фаза 1), и локальному
 * дублирующему стейту просто нечего было бы хранить.
 *
 * Переходные локальные стейты: pendingAbility (heal/reaper требуют второй тап —
 * по карточке бегуна / по клетке доски — ПОСЛЕ дропа кубика на зону, бэк ждёт
 * runnerId/positionX/positionY/segment одним вызовом /ability) и pendingSelect
 * (SELECT, включая накат/type=ROLL, требует явного подтверждения — дропнутый
 * не туда кубик иначе было бы не вернуть, реальный /select уходит только по
 * кнопке "Подтвердить"/повторному тапу по той же карточке — см. handleConfirmSelect).
 */
export default function GameBoardScreen({ route, navigation }) {
    useAdaptiveOrientation();
    // GameBoardScreen сознательно без SafeAreaView (см. шапку файла) — без
    // этого top:spacing.md у collisionBanner рисовал плашку под статус-баром
    // на телефонах, та же болячка, что была у EventLogPanel (см. его комментарий).
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const gameId = route?.params?.gameId ?? null;

    const fetchSnapshot = useCallback(async () => {
        const g = await runnerGameApi.get();
        return { state: g, version: g.version };
    }, []);

    // Отладочный лог всех Mercure-событий партии — см. components/game/EventLogPanel.js.
    // Капаем на 200 записей, чтобы не расти бесконечно за долгую партию.
    const [eventLog, setEventLog] = useState([]);
    const pushLog = useCallback((e) => {
        const text = describeEvent(e) ?? rawEventFallback(e);
        const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: new Date().toLocaleTimeString(), text };
        setEventLog((log) => (log.length >= 200 ? [...log.slice(1), entry] : [...log, entry]));
    }, []);

    // Анимации бегунов (пока только Скаут — см. constants/runnerAnimations) —
    // транзиентный стейт "что сейчас играется" по runnerId, отдельно от
    // самого game. handleVersionedRunnerAnimEvent/handleTransientRunnerAnimEvent
    // (lib/runnerAnimTriggers) — чистые функции "событие → что триггернуть",
    // сам стейт трогает только runnerAnim.trigger.
    const runnerAnim = useRunnerAnimations();
    // Локальный стор жетонов повреждений (см. lib/runnerDamageTokens.js) —
    // бэк не отдаёт ТИП жетона (Runner::toArray() только status), фронт сам
    // копит его из потока событий — иначе кружки повреждений на RunnerCard
    // всегда пустые (жалоба пользователя, 2026-08-31). Двухшаговая
    // корреляция (см. reduceAndLog/onTransient ниже): транзиентное событие
    // с типом жетона (damage/ricochet/rocket/stupor/anomaly) только
    // ЗАПОМИНАЕТ тип, реальный жетон пишется лишь когда следом ПРИДЁТ
    // версионный runner_damage — живьём поймано, что 'anomaly' сама по себе
    // может означать чистый редирект без урона (см. подробный разбор в
    // lib/runnerDamageTokens.js).
    const runnerDamageTokens = useRunnerDamageTokens();
    // gameRef — актуальный game НА МОМЕНТ транзиентного события (нужен для
    // anomaly и для жетонов повреждений — оба берут activeRunner текущего
    // ходящего игрока, ни то ни другое событие не несёт id бегуна само по
    // себе, см. lib/runnerAnimTriggers и lib/runnerDamageTokens). Обычный
    // `game` из замыкания тут не годится — onTransient коллбэк не должен
    // пересоздаваться на каждый рендер (иначе useMercure видел бы это как
    // повод переподключаться, см. его cb-ref).
    const gameRef = useRef(null);
    useEffect(() => {
        gameRef.current = game;
    });

    // Озвучка бегунов (2026-09-03) — 3 "переиспользуемых канала"
    // (.replace() на существующем плеере вместо создания нового на каждый
    // звук, см. constants/runnerSounds за тем, какие файлы у каких типов
    // есть) + отдельный фиксированный плеер под общий звук столкновения.
    // moveSound (зацикленный, per-type) — см. отдельный useEffect ниже, тот
    // же паттерн, что был раньше с общим lazer.mp3 для ВСЕХ типов.
    const voiceSound = useAudioPlayer(null);
    const shootSound = useAudioPlayer(null);
    const startSound = useAudioPlayer(null);
    const collisionSound = useAudioPlayer(COLLISION_SOUND);
    const playOneShot = useCallback((player, source) => {
        if (!source) return;
        player.replace(source);
        player.seekTo(0);
        player.play();
    }, []);

    // Подавляем ДУБЛИРУЮЩИЙ 'start' Жнеца на клиенте, который его сам только
    // что поставил — см. handleReaperShoot: локальное превью (reaperPreview
    // в BoardGrid) уже показало "прилёт сбоку" ДО реального API-вызова, и
    // когда настоящий ability_reaper-event приходит, повторный 'start'
    // (2.2с, визуально это gif ходьбы — у Жнеца нет отдельного start-ассета,
    // см. constants/runnerAnimations) заставлял казаться, будто на месте
    // выстрела играет анимация ХОДЬБЫ (жалоба пользователя, 2026-09-08:
    // "вместо анимации выстрела у жнеца анимация передвижения"). ДРУГИЕ
    // клиенты (не размещавшие этого Жнеца) превью не видели — им 'start'
    // по-прежнему нужен, поэтому подавление СТРОГО локальное (per-client
    // ref, не часть игрового стейта). TTL — на случай, если API-вызов
    // упадёт и событие никогда не придёт: флаг не должен свисать вечно и
    // случайно съесть 'start' у совершенно другого бегуна (первый выход из
    // резерва/спавн Мяча) позже в этой же партии.
    const reaperStartSkipUntilRef = useRef(0);
    // Оборачивает runnerAnim.trigger — сам визуальный триггер не трогаем
    // (lib/runnerAnimTriggers.js ничего не знает о звуке), тут ТОЛЬКО решаем,
    // что доп. проиграть по kind. Тип бегуна для 'attack' ищем в текущем
    // game.runners (бегун уже существует, просто стреляет) — для 'start' он
    // может быть свежесозданным (Мяч) и его ещё нет в game.runners, поэтому
    // предпочитаем extra.runnerType, если он есть (см. runnerAnimTriggers.js
    // — прокинут явно именно для этого случая).
    const triggerWithSound = useCallback(
        (runnerId, kind, extra) => {
            // Подавляем ТОЛЬКО визуальный триггер (дублирующий walk-цикл) —
            // звук "прилёта" (drone_start.wav) всё равно проигрываем: во
            // время локального превью никакого звука не было (превью чисто
            // визуальное), так что размещавший игрок иначе вообще не
            // услышал бы этот эффект.
            const suppressAnim = kind === 'start' && Date.now() < reaperStartSkipUntilRef.current;
            if (suppressAnim) reaperStartSkipUntilRef.current = 0;
            else runnerAnim.trigger(runnerId, kind, extra);
            if (kind === 'attack') {
                const type = gameRef.current?.runners?.find((r) => String(r.id) === String(runnerId))?.type;
                playOneShot(shootSound, pickShootSoundSource(type));
            } else if (kind === 'start') {
                const type = extra?.runnerType ?? gameRef.current?.runners?.find((r) => String(r.id) === String(runnerId))?.type;
                playOneShot(startSound, pickStartSoundSource(type));
            }
        },
        [runnerAnim.trigger, playOneShot, shootSound, startSound],
    );

    // Логируем И версионные события (через reduce — вызывается ровно по разу
    // на применённое событие, дубли уже отфильтрованы useMercure), И
    // транзиентные (step_*/orchestrator без version) — теперь они хоть куда-то
    // попадают, а не просто отбрасываются.
    const reduceAndLog = useCallback(
        (state, e) => {
            pushLog(e);
            handleVersionedRunnerAnimEvent(state, e, triggerWithSound);
            // Лечение возвращает бегуна к healthy — стираем локально
            // накопленные жетоны повреждений, иначе кружки останутся
            // закрашенными вопреки уже здоровому статусу.
            if (e.event === 'ability_heal' && e.runner?.id != null) {
                runnerDamageTokens.clearRunner(e.runner.id);
            }
            // Жетон повреждения записываем ТОЛЬКО здесь, на реальном
            // ухудшении статуса — не на самом транзиентном событии с типом
            // (см. lib/runnerDamageTokens.js: 'anomaly' в частности может
            // означать чистый редирект без урона, живьём поймано, что
            // считать его жетоном напрямую — ошибка).
            const worsenedRunnerId = getWorsenedDamageRunnerId(state, e);
            if (worsenedRunnerId != null) {
                const type = runnerDamageTokens.consumePendingType(worsenedRunnerId);
                if (type) runnerDamageTokens.recordToken(worsenedRunnerId, type);
            }
            const nextState = runnerGameReducer(state, e);
            // Voice-реплика — НЕ в момент выбора бегуна (SELECT), а когда для
            // него РЕАЛЬНО появляются зелёные клетки хода, то есть шаг игрока
            // становится MOVE (по прямому запросу пользователя, 2026-09-07:
            // раньше играла сразу на SELECT, пока игрок ещё мог проходить
            // ABILITY — ощущалось преждевременно, до того как вообще стало
            // ясно, что делать). Диффим player.step ДО/ПОСЛЕ применения
            // события — тот же приём, что раньше был у activeRunner (поле
            // приходит в разных типах событий, см. CLAUDE.md). Условие на
            // activeRunner != null остаётся — без него ссылка на бегуна ниже
            // могла бы не найтись. Играем для ЛЮБОГО игрока (не только
            // "своего") — все клиенты партии слышат один и тот же выбор.
            for (const player of nextState.gamePlayers ?? []) {
                const prevPlayer = state.gamePlayers?.find((p) => p.id === player.id);
                if (player.step === PLAYER_STEP.MOVE && prevPlayer?.step !== PLAYER_STEP.MOVE && player.activeRunner != null) {
                    const runner = nextState.runners?.find((r) => String(r.id) === String(player.activeRunner));
                    if (runner) playOneShot(voiceSound, pickActiveSoundSource(runner.type, runner.status));
                }
            }
            return nextState;
        },
        // Зависим от конкретных мемоизированных функций, не от всего объекта
        // runnerDamageTokens — тот пересоздаётся на каждый рендер хука
        // (новый литерал {tokensByRunner,...}), это пересоздавало бы
        // reduceAndLog/onTransient на каждый рендер экрана и (см. коммент у
        // gameRef выше) заставляло бы useMercure видеть повод переподключаться.
        [pushLog, triggerWithSound, runnerDamageTokens.clearRunner, runnerDamageTokens.consumePendingType, runnerDamageTokens.recordToken, playOneShot, voiceSound],
    );

    const onTransient = useCallback(
        (e) => {
            pushLog(e);
            handleTransientRunnerAnimEvent(e, gameRef, triggerWithSound);
            const pending = identifyPendingDamageType(e, gameRef);
            if (pending) runnerDamageTokens.notePendingType(pending.runnerId, pending.type);
        },
        [pushLog, triggerWithSound, runnerDamageTokens.notePendingType],
    );

    const { state: game, status, resync } = useMercure({
        topic: gameId ? `runner_game_${gameId}` : null,
        fetchSnapshot,
        reduce: reduceAndLog,
        onTransient,
    });

    const {
        orientation,
        leftPanelW,
        panelH,
        arrowBtnSize,
        switcherH,
        labelStripW,
        roadContainerW,
        roadContainerH,
        segmentW,
        segmentH,
        rows,
        cols,
        viewportCols,
        totalBlocks,
        navBtnSize,
    } = useBoardLayout();
    const isPortrait = orientation === 'portrait';
    // useMobileNavButtons — родное мобильное приложение (не веб) в портретной
    // раскладке панели: там кнопки навигации стоят РЯДОМ в нижнем слоте на
    // стыке рамок (seamRow ниже), а не в потоке. Декоративную sci-fi рамку
    // вокруг дороги/панели (MobileFrameOverlay) пробовали и откатили — на
    // реальном Android-эмуляторе рамки оказались слишком большими и с
    // искажёнными углами, пользователь попросил убрать рамку, но оставить
    // кнопки. Для остальных случаев (веб, включая широкое окно) — см.
    // navBtnSize/`navBtnColumnLeft` ниже, тот же ассет RoadNavButton, но
    // колонкой слева от дороги, по прямому запросу пользователя, 2026-08-31.
    const useMobileNavButtons = isPortrait && Platform.OS !== 'web';
    // navBtnSize (кнопки слева от дороги, не в mobileNav-случае) — половина
    // размера сегмента, посчитана в useBoardLayout вместе с самим сегментом
    // (там же учтена ширина, которую эта колонка отъедает у сетки — см.
    // computeRoadGeometry#reserveNavColumn), не дублируем расчёт здесь.
    // arrowBtnSize остаётся только для mobileNav-кнопок в seamRow — те
    // привязаны к толщине декоративной рамки, не к сегменту.

    const { windowStart, backButtonProps, forwardButtonProps, jumpTo, shiftWindowBy } = useBoardScroll({ cols: viewportCols });

    const runners = game?.runners ?? [];
    const gamePlayers = game?.gamePlayers ?? [];

    const [activePlayerId, setActivePlayerId] = useState(null);
    // { ability: 'heal'|'reaper', diceIndex } — ждём второй тап (карточка/клетка), см. шапку файла
    const [pendingAbility, setPendingAbility] = useState(null);
    // { runnerId, diceIndex, type: 'DICE'|'ROLL' } — SELECT ждёт подтверждения, см. шапку файла
    const [pendingSelect, setPendingSelect] = useState(null);
    // { diceIndex, positionX, positionY, segment } — клетка для Жнеца УЖЕ
    // выбрана тапом (см. handleCellPress, tapMode==='reaper'), но вызов
    // /ability ещё не ушёл — ждём выбор направления выстрела (по прямому
    // запросу пользователя, 2026-09-03: "стрелять жнец может... только в тот
    // момент, когда его переместили на сегмент" — бэк поддерживает
    // опциональный direction в ТОМ ЖЕ вызове /ability, см. handleReaperShoot
    // ниже). pendingAbility к этому моменту уже сброшен в null.
    const [pendingReaperPlacement, setPendingReaperPlacement] = useState(null);
    const [busy, setBusy] = useState(false);

    // Совпадает с ANIM_DURATION_MS.start обычных бегунов (useRunnerAnimations)
    // — пока идёт "прилёт" Жнеца ИЗ-ЗА КРАЯ карты (см. reaperPreview ниже),
    // выбор направления выстрела ещё не показываем (по прямому запросу
    // пользователя, 2026-09-07: сперва красивое появление, ПОТОМ выбор
    // направления, а не одновременно). reaperPreviewReady переключается
    // ровно ОДИН раз на каждое новое размещение — эффект зависит от самого
    // объекта pendingReaperPlacement (новый объект на каждый тап, см.
    // handleCellPress), не от отдельного счётчика.
    const REAPER_PREVIEW_MS = 2200;
    const [reaperPreviewReady, setReaperPreviewReady] = useState(false);
    useEffect(() => {
        setReaperPreviewReady(false);
        if (!pendingReaperPlacement) return undefined;
        const t = setTimeout(() => setReaperPreviewReady(true), REAPER_PREVIEW_MS);
        return () => clearTimeout(t);
    }, [pendingReaperPlacement]);

    // По умолчанию — свой игрок, как только придут данные. Один раз (пока не выбран вручную).
    useEffect(() => {
        if (activePlayerId != null || gamePlayers.length === 0) return;
        const me = gamePlayers.find((p) => p.user?.id === user?.id);
        setActivePlayerId(me?.id ?? gamePlayers[0].id);
    }, [gamePlayers, user, activePlayerId]);

    const myPlayer = useMemo(() => gamePlayers.find((p) => p.user?.id === user?.id) ?? null, [gamePlayers, user]);
    const myTurn = !!myPlayer && game != null && String(game.playerOrder) === String(myPlayer.id);
    const myStep = myPlayer?.step;
    const myCollision = !!myPlayer && game?.extraTurnPlayer != null
        && String(game.extraTurnPlayer) === String(myPlayer.id);

    // Автостарт партии (по прямому запросу пользователя, 2026-09-08) —
    // POST /runner_game/start технически обязателен для КАЖДОГО игрока (см.
    // RunnerGameService::start(), read-only: статус игры становится ACTIVE
    // только когда ВСЕ RunnerPlayer перешли в ACTIVE, контракт этого не
    // меняет), но сам вызов не несёт никакого решения — он просто дублировал
    // готовность, уже подтверждённую тем же игроком в лобби. Вызываем его
    // сами, как только видим свой WAITING-статус, вместо того чтобы ждать
    // ещё одного явного тапа (см. бывший components/game/GameWaitingRoom.js
    // с ручной кнопкой «Готов», теперь не используется).
    const autoStartAttemptedRef = useRef(false);
    const [autoStartError, setAutoStartError] = useState(null);
    // Инкремент форсирует повторный запуск эффекта ниже — единственный способ
    // повторить попытку после ошибки (сеть/бэк отказал именно в этот момент),
    // см. кнопку «Повторить» в JSX. Без него сброс autoStartAttemptedRef сам
    // по себе ничего не триггерит — эффект не перезапускается, пока не
    // изменится что-то из его зависимостей.
    const [startRetryNonce, setStartRetryNonce] = useState(0);
    useEffect(() => {
        if (game?.status !== GAME_STATUS.WAITING) {
            autoStartAttemptedRef.current = false; // сброс на случай следующей партии в этой же сессии
            return;
        }
        if (myPlayer?.status !== PLAYER_STATUS.WAITING) return; // уже готов, либо данные ещё не пришли
        if (autoStartAttemptedRef.current) return;
        autoStartAttemptedRef.current = true;
        setAutoStartError(null);
        runnerGameApi.start().catch((e) => {
            autoStartAttemptedRef.current = false; // разрешает повтор через startRetryNonce
            setAutoStartError(e.userMessage ?? e.message ?? 'Не удалось начать партию');
        });
    }, [game?.status, myPlayer?.status, startRetryNonce]);
    const retryAutoStart = useCallback(() => setStartRetryNonce((n) => n + 1), []);

    // "Мяч" (RUNNER_TYPES.BALL) — неконтролируемая коллизия (побочный эффект
    // вскрытия danger-клетки, RunnerBallInitService на бэке), в отличие от
    // контролируемой (игрок сам зашёл на клетку с чужим бегуном). Бэк гонит
    // ОБЕ через один и тот же Collision::handle() и ОДИНАКОВО выставляет
    // extraTurnPlayer текущему игроку — отличить их можно только по наличию
    // в game.runners ничейного бегуна type==='ball' (playerId==null, бэк
    // никогда не вызывает setPlayer() на нём). Прямого id, КАКОЙ именно мяч
    // относится к текущей коллизии, бэк не отдаёт — но раз мяч создаётся
    // непосредственно перед коллизией и потребляется её разрешением, сам
    // факт присутствия ЛЮБОГО мяча, пока висит extraTurnPlayer, уже
    // достаточно надёжный сигнал. По прямому запросу пользователя,
    // 2026-09-02: у "мяча" выбора "принять/перебросить" быть не должно
    // вообще — см. handleCollision-эффект ниже.
    const myBallCollision = myCollision
        && runners.some((r) => r.type === RUNNER_TYPES.BALL && r.playerId == null);

    // Можно ли сейчас выбрать этого бегуна дропом кубика — и обычным способом
    // (dice==null), и накатом (dice===0, уже полностью проехал в этом раунде).
    // Накат разрешён, только если среди СВОИХ бегунов не осталось неперемещённых
    // исправных (правило "нельзя выбрать накат, если есть исправный бегун,
    // которого вы не перемещали") и не больше 2 раз за раунд на бегуна —
    // см. StepSelectionValidator::rollValidate на бэке (перепроверено живым
    // прогоном, см. CLAUDE.md).
    const canSelectRunner = useCallback(
        (runnerId) => {
            if (!myTurn || myStep !== PLAYER_STEP.SELECT) return false;
            const runner = runners.find((r) => r.id === runnerId);
            if (!runner || DEAD_STATUSES.includes(runner.status)) return false;
            if (runner.dice == null) return true;

            if (runner.dice !== 0) return false; // ещё не доехал — не накат-кандидат
            if (runner.rollDice != null || (runner.rollMoves ?? 0) >= 2) return false;
            const hasUnmoved = runners.some(
                (r) => r.playerId === myPlayer?.id && r.id !== runnerId
                    && r.type !== RUNNER_TYPES.REAPER && !DEAD_STATUSES.includes(r.status) && r.dice == null,
            );
            return !hasUnmoved;
        },
        [myTurn, myStep, runners, myPlayer?.id],
    );

    // String(): RunnerPlayer::$activeRunner на бэке типизирован как ?string,
    // а Runner::$id — ?int (см. Entity/RunnerPlayer.php:33 и Entity/Runner.php:19),
    // JSON отдаёт "42" против 42 — строгое === никогда не совпадало, из-за чего
    // activeRunner был всегда null и подсветка MOVE/SHOOT не работала вообще
    // (текст подсказки не зависит от activeRunner, поэтому казался рабочим).
    const activeRunner = useMemo(
        () =>
            myPlayer?.activeRunner != null
                ? runners.find((r) => String(r.id) === String(myPlayer.activeRunner))
                : null,
        [runners, myPlayer?.activeRunner],
    );

    // Имя бегуна для текста подтверждения выбора (stepInstruction ниже) — по
    // прямому запросу пользователя, раньше текст был безличным.
    const pendingRunnerName = useMemo(() => {
        if (!pendingSelect) return null;
        const runner = runners.find((r) => r.id === pendingSelect.runnerId);
        if (!runner) return null;
        return RUNNER_DISPLAY[runner.type]?.label ?? runner.type;
    }, [runners, pendingSelect]);

    const players = useMemo(
        () =>
            gamePlayers.map((p, i) => ({
                id: p.id,
                name: p.user?.username ?? `Игрок ${p.id}`,
                // Цвет — с бэка (RunnerPlayer.color, случайно и без повторов
                // назначается при создании партии). Индекс — фолбэк на случай
                // партий, созданных до появления этого поля.
                color: PLAYER_COLOR_HEX[p.color] ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
                dice: [p.dice1, p.dice2, p.dice3, p.dice4],
                ability: p.ability,
                activeRunnerId: p.activeRunner ?? null,
                // damageTokens — с бэка НЕ приходит (см. hooks/useRunnerDamageTokens),
                // подставляем из локального стора по String(id); дефолт [null,null]
                // на случай, если локально ещё ничего не накопилось (свежий коннект).
                runners: runners
                    .filter((r) => r.playerId === p.id)
                    .map((r) => ({
                        ...r,
                        damageTokens: runnerDamageTokens.tokensByRunner[String(r.id)] ?? r.damageTokens ?? [null, null],
                    })),
            })),
        [gamePlayers, runners, runnerDamageTokens.tokensByRunner],
    );

    const playerColorById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.color])), [players]);

    // Чей сейчас ход — на экране раньше не было видно вообще (см. CLAUDE.md,
    // живой прогон). game.playerOrder хранит RunnerPlayer.id как строку.
    const currentTurnPlayer = useMemo(
        () => gamePlayers.find((p) => String(p.id) === String(game?.playerOrder)) ?? null,
        [gamePlayers, game?.playerOrder],
    );

    // game_finish (см. GameFinishService::run() на бэке, read-only) — статус
    // 'winner' выставляется РОВНО одному игроку (тому, кого передали в
    // сервис — победитель по финишу ИЛИ последний оставшийся после того, как
    // все остальные выбыли, см. Move.php:37/PlayerOutService.php:46), все
    // ОСТАЛЬНЫЕ активные переводятся в 'out' тем же вызовом — искать
    // безопасно без доп. проверок на "а вдруг их несколько".
    const winnerPlayer = useMemo(
        () => gamePlayers.find((p) => p.status === PLAYER_STATUS.WINNER) ?? null,
        [gamePlayers],
    );
    const goToMainMenu = useCallback(() => {
        navigation.reset({ index: 0, routes: [{ name: ROUTES.MAIN_MENU }] });
    }, [navigation]);

    // "Пик" 4-го фрагмента (первая колонка каждой дорожки trackNext) —
    // добавлена по прямому запросу пользователя, 2026-09-08: без неё бегуну
    // некуда шагнуть с последней клетки 3-го фрагмента. trackNext СЕЙЧАС не
    // отдаётся бэком (ни в REST-снапшоте, ни в game_track_updated — перечитан
    // read-only, D:\Programming\runner-game-backend, RunnerGame::toArray() и
    // GameTrackUpdatedEvent) — до этого `game?.trackNext` будет `undefined`,
    // flattenPeekColumn просто вернёт [], пик не рисуется (безопасный no-op,
    // не крашится и не показывает мусор).
    const gridData = useMemo(() => {
        const base = flattenTrackSegments([game?.trackBegin, game?.trackMiddle, game?.trackEnd], rows, cols);
        const peek = flattenPeekColumn(game?.trackNext, rows, BOARD_LAYOUT.COLS * BOARD_LAYOUT.TOTAL_BLOCKS);
        return [...base, ...peek];
    }, [game?.trackBegin, game?.trackMiddle, game?.trackEnd, game?.trackNext, rows, cols]);

    // game_track_updated (см. runnerGameReducer#'game_track_updated' и
    // TrackService::shift()/Move.php:41 на бэке, read-only) — сервер удаляет
    // фрагмент №1 (trackBegin), сдвигает №2→№1/№3→№2 и добавляет новый №3.
    // Реакция на это событие раньше отсутствовала ВООБЩЕ: `game.trackBegin/
    // Middle/End` (и, соответственно, `gridData`) уже применялись реducer'ом
    // мгновенно (плоское слияние полей), но (1) `cell.col`/`windowStart`
    // живут в системе координат, ЛОКАЛЬНОЙ для ТЕКУЩЕГО снимка [trackBegin,
    // trackMiddle,trackEnd] (blockIndex ВСЕГДА 0,1,2 у того, что сейчас лежит
    // в этих трёх полях, см. lib/board#flattenTrackSegments) — сдвиг
    // сегментов -1 в массиве без компенсации windowStart заставлял камеру
    // "смотреть" совсем не туда: то, что было видно в окне [windowStart,
    // windowStart+cols), мгновенно подменялось контентом совершенно другого
    // куска трассы; (2) сама подмена картинок происходила одним кадром, без
    // перехода.
    //
    // Обнаружение самого факта сдвига — по имени `game.trackBegin.name`, НЕ
    // по `game.trackNumber` (тот, проверено чтением бэка, выставляется ОДИН
    // раз в RunnerGameFactory и TrackService::shift() его никогда не меняет —
    // на каждое событие приходит одно и то же число, диффить нечего) и НЕ по
    // ссылке на сам объект `trackBegin` (первая версия этой правки так и
    // делала — оказалось ЛОМАЕТСЯ на КАЖДОМ reconnect/resync: useMercure#sync
    // на любом подключении, даже без единого реального события, всегда
    // парсит REST-снапшот ЗАНОВО и коммитит его как НОВЫЙ объект — ссылка на
    // `trackBegin` меняется, хотя фрагмент физически тот же самый; ложное
    // срабатывание сдвигало бы windowStart на -COLS без всякого реального
    // сдвига). Имя фрагмента — надёжный, содержательный идентификатор:
    // `TrackLoader::prepareTracksForGame()` тасует ВЕСЬ список файлов БЕЗ
    // возврата (`shuffle`+`array_splice`) — внутри одной партии одно и то же
    // имя не может встретиться дважды, значит "имя изменилось" ⇔ "это
    // реально другой фрагмент" всегда, а "имя то же" ⇔ "фрагмент не менялся"
    // даже если сам объект пересоздан REST-снапшотом.
    // trackSnapshotRef хранит СТАРОЕ значение (записывается в КОНЦЕ этого же
    // эффекта с ПРОШЛОГО срабатывания) — на момент, когда эффект видит новое
    // имя, `prev.trackBegin` — это как раз то, что было ДО
    // сдвига (сам `game` уже содержит новое — реducer применяет мгновенно,
    // без задержки, остальной игровой логике старые значения не нужны).
    // `prev.trackBegin != null` отсекает первый снапшот партии (переход
    // null→объект при загрузке, это не сдвиг). Известный неполный случай:
    // если ПОКА клиент был отключён произошло больше одного сдвига разом,
    // здесь виден только факт "имя другое" — компенсация windowStart всё
    // равно применится лишь на один TRACK_FADE (-COLS), не на N — не
    // проверено живьём, поскольку требует спец. сценария с длительным
    // разрывом связи, отложено как известное ограничение.
    // Как только замечен реальный сдвиг:
    //   1. windowStart сдвигается на ту же дельту (-BOARD_LAYOUT.COLS) —
    //      удерживает камеру на том же физическом месте трассы (см.
    //      shiftWindowBy в useBoardScroll.js за подробным разбором системы
    //      координат и почему именно такая дельта сохраняет позицию).
    //   2. Старый (удаляемый) фрагмент №1 — единственная часть, которая
    //      РЕАЛЬНО пропадает с экрана без замены (фрагменты 2/3 просто
    //      переименовываются в 1/2, тот же контент виден в тех же пикселях
    //      благодаря сдвигу windowStart из п.1, никакого визуального разрыва
    //      для них нет и своей анимации не нужно) — снимок его ячеек
    //      (посчитанный ИМЕННО от prev.trackBegin, той же функцией, что и
    //      сама сетка) кладётся overlay-слоем ПОВЕРХ уже подменившейся
    //      боевой сетки на СТАРОМ windowStart (там, где фрагмент №1 был
    //      виден до сдвига) и плавно растворяется (Animated.timing 1→0, см.
    //      TRACK_FADE_MS) — под ним к этому моменту уже отрисован новый
    //      расклад, так что затухание overlay'я и есть "плавное исчезновение
    //      первого фрагмента и вставка нового": сам новый (третий) фрагмент
    //      никакого отдельного fade-in не получает (он и так СРАЗУ виден в
    //      боевом слое) — оверлей просто перестаёт его закрывать.
    const trackSnapshotRef = useRef({ trackBegin: null });
    const [trackFadeOverlay, setTrackFadeOverlay] = useState(null); // { gridData, windowStart, opacity }
    useEffect(() => {
        const prev = trackSnapshotRef.current;
        const nameChanged = prev.trackBegin != null && game?.trackBegin != null
            && prev.trackBegin.name !== game.trackBegin.name;
        if (nameChanged) {
            shiftWindowBy(-BOARD_LAYOUT.COLS);
            // Массив из ОДНОГО элемента — flattenTrackSegments проходит только
            // blockIndex 0 (forEach по длине массива), считать/фильтровать
            // несуществующие blockIndex 1/2 не нужно.
            const removedGridData = flattenTrackSegments([prev.trackBegin], rows, cols);
            const opacity = new Animated.Value(1);
            setTrackFadeOverlay({ gridData: removedGridData, windowStart, opacity });
            Animated.timing(opacity, {
                toValue: 0,
                duration: TRACK_FADE_MS,
                useNativeDriver: true,
            }).start(() => setTrackFadeOverlay(null));
        }
        trackSnapshotRef.current = { trackBegin: game?.trackBegin };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game?.trackBegin?.name]);

    // Имена 3 фрагментов трассы (карт) для FragmentLabelStrip — портретная
    // раскладка, полоса слева от доски (см. useBoardLayout.labelStripW).
    const segmentNames = useMemo(
        () => [game?.trackBegin?.name, game?.trackMiddle?.name, game?.trackEnd?.name],
        [game?.trackBegin?.name, game?.trackMiddle?.name, game?.trackEnd?.name],
    );
    const fragmentBands = useMemo(
        () => computeFragmentBands(windowStart, viewportCols, cols, segmentNames),
        [windowStart, viewportCols, cols, segmentNames],
    );

    // Легальные клетки для тапа прямо сейчас — зависит от того, какой шаг идёт.
    // Одна и та же подсветка используется для MOVE/SHOOT/reaper-размещения/
    // первого выхода на трассу — GameBoardScreen решает, что означает тап,
    // handleCellPress ниже.
    const { highlightedCells, tapMode } = useMemo(() => {
        if (!myTurn || busy) return { highlightedCells: new Set(), tapMode: null };

        if (pendingReaperPlacement && reaperPreviewReady) {
            // Направление выстрела Жнеца сразу при размещении — подсветка
            // на доске вместо кнопок ↖/↑/↗ (единообразно с MOVE, по прямому
            // запросу пользователя, 2026-09-07). Появляется только ПОСЛЕ
            // того, как "прилёт" Жнеца успел доиграть (см. reaperPreviewReady
            // выше) — до этого highlightedCells пуст, тапать некуда. СТРОГО
            // вперёд (UP) — по прямому уточнению пользователя, 2026-09-08:
            // "стрелять строго по прямой должен только Жнец", остальные типы
            // (см. SHOOT-ветку ниже) стреляют по всем 3 направлениям, как
            // обычный MOVE. БЕЗ фильтра по занятости клетки — кнопки тоже не
            // проверяли занятость.
            const cells = forwardNeighbors(pendingReaperPlacement)
                .filter((pos) => pos.direction === 'UP')
                .map(cellKey);
            return { highlightedCells: new Set(cells), tapMode: 'reaperShoot' };
        }

        if (myStep === PLAYER_STEP.MOVE && activeRunner) {
            if (activeRunner.segment == null) {
                // Ещё не на трассе — любая клетка заднего края trackBegin (positionX=0)
                const cells = new Set();
                for (let positionY = 0; positionY <= 5; positionY++) {
                    cells.add(cellKey({ segment: 0, positionX: 0, positionY }));
                }
                return { highlightedCells: cells, tapMode: 'start' };
            }
            // Накат (type=ROLL, см. canSelectRunner) — строго 1 клетка ВПЕРЁД
            // (UP), без выбора направления (по прямому запросу пользователя,
            // 2026-09-08: "накат — это строго движение вперёд"). Бегун,
            // делающий накат, уже полностью проехал в обычном режиме (dice===0)
            // и получил ОТДЕЛЬНЫЙ кубик rollDice для этого доп. хода (см.
            // canSelectRunner/RunnerCard "Накат") — этой парой полей и отличаем
            // накат-ход от обычного здесь, где `activeRunner` уже не несёт
            // никакого признака "это был выбор type=ROLL" сам по себе.
            const isRollMove = activeRunner.dice === 0 && activeRunner.rollDice != null;
            const neighbors = forwardNeighbors(activeRunner).filter((n) => !isRollMove || n.direction === 'UP');
            return {
                highlightedCells: new Set(neighbors.map(cellKey)),
                tapMode: 'move',
            };
        }

        if (myStep === PLAYER_STEP.SHOOT && activeRunner) {
            // Все 3 направления вперёд (как обычный MOVE) — по прямому
            // уточнению пользователя, 2026-09-08: предыдущее решение
            // (2026-09-02, "стрелять только строго по прямой") оказалось
            // СЛИШКОМ строгим — ограничение "только вперёд, без диагоналей"
            // должно было касаться ТОЛЬКО Жнеца (см. pendingReaperPlacement
            // выше), не обычных бегунов.
            const targets = forwardNeighbors(activeRunner)
                .filter((pos) => {
                    const occupant = findRunnerAt(runners, pos);
                    return occupant && occupant.type !== RUNNER_TYPES.REAPER && !DEAD_STATUSES.includes(occupant.status);
                });
            return { highlightedCells: new Set(targets.map(cellKey)), tapMode: 'shoot' };
        }

        if (pendingAbility?.ability === 'reaper') {
            // Любая пустая проходимая клетка на всех трёх загруженных сегментах —
            // бэк это не проверяет (см. CLAUDE.md про ReaperService::validateCell),
            // так что и занятость, и проходимость (не wall/anomaly) считаем сами.
            // positionX ТОЛЬКО 0-5 (не 0-7, как у обычных клеток) — живой тест,
            // 2026-09-08, поймал реальный баг: бэк отклоняет размещение Жнеца в
            // последних 2 колонках сегмента отдельной валидацией DTO
            // ("details.positionX: This value should be between 0 and 5"),
            // раньше подсветка ошибочно предлагала все 8 колонок.
            const cells = new Set();
            for (let segment = 0; segment < totalBlocks; segment++) {
                for (let positionX = 0; positionX <= 5; positionX++) {
                    for (let positionY = 0; positionY <= 5; positionY++) {
                        const pos = { segment, positionX, positionY };
                        const type = rawCellType(game, segment, positionX, positionY);
                        if (type === 'wall' || type === 'anomaly') continue;
                        if (findRunnerAt(runners, pos)) continue;
                        cells.add(cellKey(pos));
                    }
                }
            }
            return { highlightedCells: cells, tapMode: 'reaper' };
        }

        return { highlightedCells: new Set(), tapMode: null };
    }, [myTurn, myStep, activeRunner, busy, pendingAbility, runners, totalBlocks, game, pendingReaperPlacement, reaperPreviewReady]);

    // Звук шага СИНХРОННО с анимацией перемещения — по прямому запросу
    // пользователя, 2026-09-01: играет, пока у ХОТЬ ОДНОГО бегуна сейчас
    // проигрывается поза 'move' (см. hooks/useRunnerAnimations —
    // anims[runnerId].kind), останавливается и перематывается в начало, как
    // только ни у кого больше нет активной 'move'-позы. 2026-09-03: раньше
    // тут всегда был общий lazer.mp3 для ВСЕХ типов — теперь свой звук на
    // каждый тип (pickMoveSoundSource, см. lib/runnerSoundTriggers.js — для
    // Солдата/ATHLETE, у которого своего move.wav нет, функция сама вернёт
    // тот же lazer.mp3 как фолбэк). movingRunnerType — тип ПЕРВОГО найденного
    // бегуна с kind==='move' (на практике почти всегда ровно один — если
    // когда-нибудь окажется больше одного одновременно, играем звук только
    // за первого, не накладываем несколько циклов друг на друга).
    const movingRunnerType = useMemo(() => {
        const movingId = Object.entries(runnerAnim.anims).find(([, a]) => a?.kind === 'move')?.[0];
        if (movingId == null) return null;
        return runners.find((r) => String(r.id) === String(movingId))?.type ?? null;
    }, [runnerAnim.anims, runners]);
    const moveSound = useAudioPlayer(FALLBACK_MOVE_SOUND);
    useEffect(() => {
        moveSound.loop = true;
    }, [moveSound]);
    useEffect(() => {
        if (movingRunnerType) {
            moveSound.replace(pickMoveSoundSource(movingRunnerType));
            moveSound.play();
        } else {
            moveSound.pause();
            moveSound.seekTo(0);
        }
    }, [movingRunnerType, moveSound]);

    // Watchdog "мой ход завис после успешного действия" (2026-09-07, живая
    // жалоба — "иногда после выбора персонажа ход не продолжается, помогает
    // только рестарт приложения на Android"). Бэковый баг, из-за которого
    // событие смены хода вообще не публиковалось, по данным бэкенд-агента
    // уже исправлен (TurnService::nextTurn теперь шлёт PlayerStepEvent на
    // КАЖДОМ переходе) — но это не исключает обычный сетевой пропуск события
    // конкретно на Android (см. исторические жалобы про Mercure в CLAUDE.md).
    // REST-вызов (select/ability/move/...) сам по себе УСПЕШЕН (200 OK), даже
    // если следующее live-событие, которое обычно двигает myStep дальше, до
    // этого клиента не долетело — busy корректно снимается, но шаг замирает.
    // myStepRef/myTurnRef — свежие значения на момент срабатывания таймера
    // (замыкание внутри runAction иначе видело бы их состояние на момент
    // ВЫЗОВА действия, не на момент проверки).
    const myStepRef = useRef(myStep);
    useEffect(() => { myStepRef.current = myStep; });
    const myTurnRef = useRef(myTurn);
    useEffect(() => { myTurnRef.current = myTurn; });
    const [showActionStuckRefresh, setShowActionStuckRefresh] = useState(false);
    const actionStuckTimerRef = useRef(null);
    // Шаг реально сдвинулся (или ход ушёл другому) — снимаем предупреждение и
    // таймер, если он ещё тикал (проверка сама себя опровергла раньше срока).
    useEffect(() => {
        if (actionStuckTimerRef.current) clearTimeout(actionStuckTimerRef.current);
        setShowActionStuckRefresh(false);
    }, [myStep, myTurn]);

    // `skipStuckWatch` — MOVE специально ИСКЛЮЧЁН из watchdog (живой тест,
    // 2026-09-08, поймал ВТОРОЙ реальный баг подряд в этом же механизме):
    // один ход игрока на шаге MOVE обычно состоит из НЕСКОЛЬКИХ успешных
    // /move-вызовов подряд (пока не кончится кубик хода), и КАЖДЫЙ из них
    // оставляет player.step тем же самым MOVE (шаг меняется только когда
    // движение ЗАКОНЧИЛОСЬ — на SHOOT/ROAD_BONUS/следующего игрока). Раз шаг
    // не меняется между отдельными успешными ходами, сравнение "шаг не
    // сдвинулся с момента действия" ложно считало бы "зависанием" ЛЮБОЕ
    // обычное раздумье игрока дольше 8с над СЛЕДУЮЩИМ шагом того же
    // многошагового хода — ровно тот же класс бага, что уже был исправлен
    // чуть выше (фиксация stepBeforeAction ДО вызова), но для MOVE это в
    // принципе неразрешимо через сравнение PLAYER_STEP — там просто НЕТ
    // гарантированного "шаг обязан смениться после одного успешного вызова".
    // Остальные действия (select/ability/shoot/roadBonus/collision/reaper) —
    // каждое ОДНОЗНАЧНО переводит игру в другой шаг за один успешный вызов,
    // watchdog для них остаётся осмысленным.
    const runAction = useCallback(async (fn, { skipStuckWatch = false } = {}) => {
        // Шаг фиксируем ДО вызова, не после — если брать myStep ПОСЛЕ await
        // fn() (когда live-событие уже успело прилететь и подвинуть шаг
        // дальше, что при быстрой локальной сети — обычное дело), сравнение
        // "шаг не сдвинулся с момента действия" сравнивало бы НОВЫЙ шаг сам
        // с собой — ложное "зависание" при обычном раздумье над следующим
        // шагом (первый баг того же живого теста, 2026-09-08).
        const stepBeforeAction = myStepRef.current;
        setBusy(true);
        try {
            await fn();
            if (actionStuckTimerRef.current) clearTimeout(actionStuckTimerRef.current);
            if (!skipStuckWatch) {
                actionStuckTimerRef.current = setTimeout(() => {
                    if (myTurnRef.current && myStepRef.current === stepBeforeAction) setShowActionStuckRefresh(true);
                }, STUCK_ACTION_TIMEOUT);
            }
        } catch (e) {
            notify('Не удалось выполнить действие', e.userMessage ?? e.message);
        } finally {
            setBusy(false);
        }
    }, []);

    // Автоматический ход накатом (по прямому запросу пользователя, 2026-09-08):
    // после подтверждения SELECT типа ROLL шаг игрока переходит в MOVE, а
    // highlightedCells (см. выше, isRollMove) подсвечивает РОВНО одну клетку
    // (строго UP, без выбора направления — уже решено ранее, 2026-09-08) —
    // тапать там больше не по чему выбирать, только по единственному
    // варианту, так что делаем этот тап сами. autoRollMoveKeyRef — защита от
    // повторного вызова: эффект перезапускается на каждое изменение
    // activeRunner (новый объект на каждое live-обновление), а не только
    // когда РЕАЛЬНО появляется новая накат-возможность — ключ
    // "runnerId:rollDice" уникален на каждую конкретную попытку наката
    // (rollDice меняется между накатами, см. RunnerRollService на бэке).
    const autoRollMoveKeyRef = useRef(null);
    useEffect(() => {
        if (!myTurn || busy || myStep !== PLAYER_STEP.MOVE || !activeRunner) return;
        const isRollMove = activeRunner.dice === 0 && activeRunner.rollDice != null;
        if (!isRollMove) {
            autoRollMoveKeyRef.current = null;
            return;
        }
        const key = `${activeRunner.id}:${activeRunner.rollDice}`;
        if (autoRollMoveKeyRef.current === key) return;
        autoRollMoveKeyRef.current = key;
        runAction(() => runnerGameApi.move(null, 'UP'), { skipStuckWatch: true });
    }, [myTurn, busy, myStep, activeRunner, runAction]);

    // Второй шаг размещения Жнеца — направление выстрела (или пропуск).
    // direction === undefined → JSON.stringify выкидывает поле из тела
    // запроса (см. api/runnerGame.js#ability) — бэк трактует отсутствие
    // direction как "без выстрела", тот же путь, что уже был раньше.
    // Определена ДО handleCellPress (который её вызывает из ветки
    // 'reaperShoot', см. ниже) — порядок объявления имеет значение для
    // читаемости, хотя обе это useCallback с деп-массивами, не влияет на
    // работоспособность саму по себе.
    const handleReaperShoot = useCallback(
        (direction) => {
            if (!pendingReaperPlacement) return;
            // См. reaperStartSkipUntilRef выше — мы уже показали "прилёт"
            // локальным превью, реальный 'start' от бэка для ЭТОГО Жнеца на
            // НАШЕМ клиенте больше не нужен. 5с — щедрый запас на сетевой
            // круговорот запроса, не более того.
            reaperStartSkipUntilRef.current = Date.now() + 5000;
            const { diceIndex, positionX, positionY, segment } = pendingReaperPlacement;
            runAction(() =>
                runnerGameApi
                    .ability(true, { ability: 'reaper', dice: diceIndex + 1, positionX, positionY, segment, direction })
                    .then(() => setPendingReaperPlacement(null)),
            );
        },
        [pendingReaperPlacement, runAction],
    );

    const handleCellPress = useCallback(
        (cell) => {
            if (!tapMode) return;
            const key = cell.id; // "segment-row-col" = "segment-positionY-positionX", см. lib/board.js
            if (!highlightedCells.has(key)) return;

            if (tapMode === 'start') {
                // skipStuckWatch — см. комментарий у runAction: MOVE может
                // состоять из нескольких ходов подряд без смены player.step.
                runAction(() => runnerGameApi.move(cell.row, null), { skipStuckWatch: true });
                return;
            }
            if (tapMode === 'move') {
                const target = { segment: cell.blockIndex, positionX: cell.col - cell.blockIndex * cols, positionY: cell.row };
                const neighbor = forwardNeighbors(activeRunner).find((n) => cellKey(n) === cellKey(target));
                if (!neighbor) return;
                runAction(() => runnerGameApi.move(null, neighbor.direction), { skipStuckWatch: true });
                return;
            }
            if (tapMode === 'shoot') {
                // Все 3 направления — см. highlightedCells выше (2026-09-08).
                const target = { segment: cell.blockIndex, positionX: cell.col - cell.blockIndex * cols, positionY: cell.row };
                const neighbor = forwardNeighbors(activeRunner).find((n) => cellKey(n) === cellKey(target));
                if (!neighbor) return;
                runAction(() => runnerGameApi.shoot(true, neighbor.direction));
                return;
            }
            if (tapMode === 'reaperShoot') {
                // Выбор направления выстрела Жнеца ТАПОМ по подсвеченной
                // клетке (см. highlightedCells выше) вместо кнопок ↖/↑/↗ —
                // по прямому запросу пользователя, 2026-09-07. pendingReaperPlacement
                // уже несёт координаты только что поставленного Жнеца.
                const target = { segment: cell.blockIndex, positionX: cell.col - cell.blockIndex * cols, positionY: cell.row };
                const neighbor = forwardNeighbors(pendingReaperPlacement).find((n) => cellKey(n) === cellKey(target));
                if (!neighbor) return;
                handleReaperShoot(neighbor.direction);
                return;
            }
            if (tapMode === 'reaper' && pendingAbility) {
                // Не вызываем /ability сразу — по прямому запросу пользователя,
                // 2026-09-03, размещение и выбор направления выстрела теперь
                // два отдельных шага (см. pendingReaperPlacement выше и
                // handleReaperShoot выше): сама клетка уже выбрана, ждём,
                // будет ли выстрел и куда. `side` — случайная сторона
                // "прилёта" (см. reaperPreview в BoardGrid), выбирается ОДИН
                // раз тут и держится неизменной всё время ожидания выбора
                // направления (2026-09-07).
                const { diceIndex } = pendingAbility;
                const positionX = cell.col - cell.blockIndex * cols;
                const positionY = cell.row;
                const side = Math.random() < 0.5 ? 'east' : 'west';
                setPendingReaperPlacement({ diceIndex, positionX, positionY, segment: cell.blockIndex, side });
                setPendingAbility(null);
            }
        },
        [tapMode, highlightedCells, activeRunner, cols, pendingAbility, pendingReaperPlacement, handleReaperShoot, runAction],
    );

    // Дроп кубика на карточку бегуна — шаг SELECT. Реальный /select уходит не
    // сразу, а только после подтверждения (см. handleConfirmSelect) — раньше
    // коммитилось мгновенно на дроп, и промахнувшийся кубик было не вернуть.
    const handleDropOnRunner = useCallback(
        (playerId, runnerId, diceIndex) => {
            if (playerId !== myPlayer?.id || !canSelectRunner(runnerId)) return;
            const runner = runners.find((r) => r.id === runnerId);
            setPendingSelect({ runnerId, diceIndex, type: runner.dice == null ? 'DICE' : 'ROLL' });
        },
        [myPlayer?.id, canSelectRunner, runners],
    );

    const handleConfirmSelect = useCallback(() => {
        if (!pendingSelect) return;
        const { runnerId, diceIndex, type } = pendingSelect;
        runAction(() => runnerGameApi.select(runnerId, diceIndex + 1, type).then(() => setPendingSelect(null)));
    }, [pendingSelect, runAction]);

    const handleCancelSelect = useCallback(() => setPendingSelect(null), []);

    // Дроп кубика на зону усиления — шаг ABILITY. boost/ghost зовут API сразу
    // (бэк сам берёт activeRunner), heal/reaper ждут второй тап — см. handleCellPress
    // и handleHealTarget.
    const handleDropOnAbility = useCallback(
        (playerId, abilityKey, diceIndex) => {
            if (!myTurn || myStep !== PLAYER_STEP.ABILITY || playerId !== myPlayer?.id) return;
            if (abilityKey === 'heal' || abilityKey === 'reaper') {
                setPendingAbility({ ability: abilityKey, diceIndex });
                return;
            }
            runAction(() => runnerGameApi.ability(true, { ability: abilityKey, dice: diceIndex + 1 }));
        },
        [myTurn, myStep, myPlayer?.id, runAction],
    );

    // Тап по зоне усиления: во время pending — отмена, иначе (уже применена) — ничего не делаем.
    const handlePressAbilityZone = useCallback(
        (abilityKey) => {
            if (pendingAbility?.ability === abilityKey) setPendingAbility(null);
        },
        [pendingAbility],
    );

    // Тап по карточке бегуна: если на ней уже висит pendingSelect — повторный
    // тап отменяет (та же карточка = "передумал"). Иначе, во время pending
    // heal — это выбор цели лечения. Больше тап по карточке ничего не делает.
    const handleRunnerCardPress = useCallback(
        (runner) => {
            if (pendingSelect?.runnerId === runner.id) {
                setPendingSelect(null);
                return;
            }
            if (pendingAbility?.ability !== 'heal') return;
            if (runner.playerId !== myPlayer?.id) return; // лечить можно только своих бегунов
            // Лечение чинит НЕИСПРАВНОГО (broken) бегуна — это как раз его смысл (см. правила
            // "Если этот бегун был неисправен, он становится исправным"). Нельзя вылечить
            // только уничтоженного (destroyed) — этот статус необратим.
            if (runner.status === RUNNER_STATUS.DESTROYED) return;
            const { diceIndex } = pendingAbility;
            runAction(() =>
                runnerGameApi
                    .ability(true, { ability: 'heal', dice: diceIndex + 1, runnerId: runner.id })
                    .then(() => setPendingAbility(null)),
            );
        },
        [pendingSelect, pendingAbility, myPlayer?.id, runAction],
    );

    // Двойной тап по карточке бегуна — переносит видимое окно дороги туда,
    // где он сейчас стоит (по прямому запросу пользователя, 2026-09-08).
    // Бегун в резерве (segment==null) ещё нигде не отрисован — переходить некуда.
    const handleRunnerCardDoubleTap = useCallback(
        (runner) => {
            if (runner.segment == null) return;
            jumpTo(runner.segment * BOARD_LAYOUT.COLS + runner.positionX);
        },
        [jumpTo],
    );

    const handleShootSkip = useCallback(() => {
        runAction(() => runnerGameApi.shoot(false));
    }, [runAction]);

    const handleRoadBonus = useCallback(
        (accept) => {
            runAction(() => runnerGameApi.roadBonus(accept));
        },
        [runAction],
    );

    const handleAbilitySkip = useCallback(() => {
        setPendingAbility(null);
        runAction(() => runnerGameApi.ability(false));
    }, [runAction]);

    const handleCollision = useCallback(
        (accept) => {
            runAction(() => runnerGameApi.collision(accept));
        },
        [runAction],
    );

    // Зависшая коллизия: бэк не резолвит сам, если игрок-цель не ответит на
    // /collision — вся игра стоит. Через COLLISION_STUCK_TIMEOUT даём ручной
    // рефетч снапшота вместо бесконечного ожидания вслепую.
    const [showStuckRefresh, setShowStuckRefresh] = useState(false);
    useEffect(() => {
        setShowStuckRefresh(false);
        if (game?.extraTurnPlayer == null) return undefined;
        const t = setTimeout(() => setShowStuckRefresh(true), COLLISION_STUCK_TIMEOUT);
        return () => clearTimeout(t);
    }, [game?.extraTurnPlayer]);

    // Кнопки "Использовать/Перебросить" не должны появляться РАНЬШЕ, чем
    // игрок увидит саму анимацию столкновения (жалоба пользователя,
    // 2026-09-02: банер с решением всплывал мгновенно вместе с
    // extraTurnPlayer, пока приезжающий бегун ещё визуально скользил к
    // клетке — решение приходилось принимать "вслепую"). См.
    // COLLISION_ANIM_DELAY_MS выше — не завязано на реальное состояние
    // очереди анимаций (GameBoardScreen её не видит на уровне конкретной
    // пары бегунов), простой таймер с запасом.
    const [collisionDecisionReady, setCollisionDecisionReady] = useState(false);
    useEffect(() => {
        setCollisionDecisionReady(false);
        if (game?.extraTurnPlayer == null) return undefined;
        const t = setTimeout(() => setCollisionDecisionReady(true), COLLISION_ANIM_DELAY_MS);
        return () => clearTimeout(t);
    }, [game?.extraTurnPlayer]);

    // Звук столкновения — играет ВСЕМ клиентам партии сразу, как только
    // BoardGrid реально показывает коллизионную позу (не когда
    // game.extraTurnPlayer только появился, см. COLLISION_ANIM_DELAY_MS
    // выше — тот момент совпадает с НАЧАЛОМ движения заезжающего бегуна, а
    // не с самой позой столкновения, жалоба пользователя, 2026-09-07).
    // onCollisionPoseStart — колбэк из BoardGrid (вызывается ровно один раз
    // на каждую новую коллизионную пару, см. компонент), работает и для
    // "ручных" коллизий (extraTurnPlayer, разные размеры), и для
    // автоматически разрешённых (одинаковый размер/Мяч) — оба идут через
    // ОДИН и тот же механизм пары в BoardGrid.
    const handleCollisionPoseStart = useCallback(() => {
        collisionSound.seekTo(0);
        collisionSound.play();
    }, [collisionSound]);

    // "Мяч" (см. myBallCollision выше) — неконтролируемая коллизия, у игрока
    // не должно быть выбора вообще (прямой запрос пользователя, 2026-09-02).
    // Бэк всё равно требует явный вызов /collision, чтобы снять
    // extraTurnPlayer и применить уже брошенный результат — форсируем
    // accept=true САМИ, без участия игрока, как только анимация столкновения
    // успела показаться (тот же collisionDecisionReady, что и у ручного
    // баннера). ballAutoResolvedRef — защита от повторного вызова: после
    // runAction busy на мгновение снова станет false, а СЕРВЕРНОЕ
    // extraTurnPlayer=null может прийти через Mercure с задержкой — без
    // этой защиты эффект успел бы выстрелить второй раз в этом окне.
    const ballAutoResolvedRef = useRef(false);
    useEffect(() => {
        if (game?.extraTurnPlayer == null) ballAutoResolvedRef.current = false;
    }, [game?.extraTurnPlayer]);
    useEffect(() => {
        if (myBallCollision && collisionDecisionReady && !busy && !ballAutoResolvedRef.current) {
            ballAutoResolvedRef.current = true;
            handleCollision(true);
        }
    }, [myBallCollision, collisionDecisionReady, busy, handleCollision]);

    if (!game) {
        return (
            <View style={styles.wrapper}>
                <ParallaxBackground />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.statusText}>{STATUS_LABEL[status] ?? ''}</Text>
                </View>
            </View>
        );
    }

    if (game.status === GAME_STATUS.WAITING) {
        // Раньше тут был отдельный экран (GameWaitingRoom) с ручной кнопкой
        // «Готов» — второе подтверждение того же самого, что игрок уже
        // подтвердил в лобби. По прямому запросу пользователя, 2026-09-08:
        // POST /runner_game/start вызывается автоматически (см. эффект у
        // autoStartAttemptedRef выше), тут — только спиннер того же вида,
        // что и у `!game` выше (не отдельный "экран", а продолжение той же
        // загрузки), плюс счётчик готовности остальных игроков и кнопка
        // «Повторить», если автовызов сам упал по сети/бэку.
        const readyCount = gamePlayers.filter((p) => p.status === PLAYER_STATUS.ACTIVE).length;
        return (
            <View style={styles.wrapper}>
                <ParallaxBackground />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.statusText}>
                        Начинаем партию… готовы {readyCount} из {gamePlayers.length}
                    </Text>
                    {autoStartError && (
                        <>
                            <Text style={styles.errorText}>{autoStartError}</Text>
                            <Button title="Повторить" variant="danger" onPress={retryAutoStart} style={styles.retryBtn} />
                        </>
                    )}
                </View>
                <EventLogPanel entries={eventLog} />
            </View>
        );
    }

    const showShootSkip = myTurn && myStep === PLAYER_STEP.SHOOT && !busy;
    const showAbilitySkip = myTurn && myStep === PLAYER_STEP.ABILITY && !busy && !pendingAbility && !pendingReaperPlacement;
    const showRoadBonusChoice = myTurn && myStep === PLAYER_STEP.ROAD_BONUS && !busy;

    // Раньше на экране не было видно вообще, чей ход и что делать дальше — см.
    // живой прогон в CLAUDE.md. Один банер: чей ход + подсказка по шагу + кнопка
    // "пропустить", если она сейчас уместна — всё в одном месте. В альбомной
    // раскладке — плавающий банер над доской (styles.turnBanner, как раньше). В
    // портретной — по запросу пользователя переехал ВНУТРЬ панели игрока, туда,
    // где раньше было крупное имя игрока (см. PlayerInfoPanel.headerContent) —
    // отдельный плавающий банер над узкой доской либо перекрывал её, либо
    // занимал место, которое теперь отдано доске/панели.
    const turnBannerInner = myTurn ? (
        <>
            <Text style={styles.turnTitleMine}>Твой ход</Text>
            <Text style={styles.turnHint}>
                {stepInstruction(myStep, activeRunner, pendingAbility, pendingSelect, pendingRunnerName, game.trackGain, pendingReaperPlacement, reaperPreviewReady)}
            </Text>
            {showActionStuckRefresh && !busy && (
                <Button
                    title="Обновить состояние"
                    variant="info"
                    onPress={() => {
                        setShowActionStuckRefresh(false);
                        runnerAnim.reset();
                        resync();
                    }}
                    style={styles.turnSkipBtn}
                />
            )}
            {/* Направление выстрела Жнеца — теперь тап по подсвеченной клетке
                (см. highlightedCells/handleCellPress выше), а не кнопки
                ↖/↑/↗ (по прямому запросу пользователя, 2026-09-07, "такое же
                отображение, как для обычных бегунов"). "Без выстрела"
                остаётся кнопкой — это не клетка на доске. Доступна сразу
                (не ждёт reaperPreviewReady) — пропустить выстрел можно и не
                дожидаясь, пока доиграет анимация прилёта. */}
            {pendingReaperPlacement && !busy && (
                <View style={styles.turnBtnRow}>
                    <Button title="Без выстрела" variant="muted" onPress={() => handleReaperShoot(undefined)} style={styles.turnSkipBtn} />
                    {/* "Отмена" — живой тест, 2026-09-08, поймал реальный
                        тупик: если размещение отклонено бэком (например,
                        невалидный positionX — см. фикс highlightedCells
                        выше), pendingReaperPlacement не сбрасывается сам
                        (runAction молча ловит ошибку, .then(()=>...) не
                        вызывается), а других способов вернуться к выбору
                        клетки не было — игрок застревал, раз за разом
                        повторяя ту же обречённую попытку. */}
                    <Button title="Отмена" variant="danger" onPress={() => setPendingReaperPlacement(null)} style={styles.turnSkipBtn} />
                </View>
            )}
            {!pendingReaperPlacement && pendingSelect && !busy && (
                <View style={styles.turnBtnRow}>
                    <Button title="Подтвердить" variant="success" onPress={handleConfirmSelect} style={styles.turnSkipBtn} />
                    <Button title="Отмена" variant="muted" onPress={handleCancelSelect} style={styles.turnSkipBtn} />
                </View>
            )}
            {!pendingReaperPlacement && !pendingSelect && showRoadBonusChoice && (
                <View style={styles.turnBtnRow}>
                    <Button
                        title={`Бонус +${game.trackGain ?? ''}`}
                        variant="success"
                        onPress={() => handleRoadBonus(true)}
                        style={styles.turnSkipBtn}
                    />
                    <Button title="Пропустить" variant="muted" onPress={() => handleRoadBonus(false)} style={styles.turnSkipBtn} />
                </View>
            )}
            {!pendingSelect && !showRoadBonusChoice && (showShootSkip || showAbilitySkip) && (
                <Button
                    title={showShootSkip ? 'Пропустить выстрел' : 'Пропустить усиление'}
                    variant="muted"
                    onPress={showShootSkip ? handleShootSkip : handleAbilitySkip}
                    style={styles.turnSkipBtn}
                />
            )}
        </>
    ) : (
        <Text style={styles.turnTitle}>Ход игрока: {currentTurnPlayer?.user?.username ?? '—'}</Text>
    );

    // Общий элемент для обеих раскладок (было продублировано дважды —
    // вынесено в переменную, чтобы новые пропы не пришлось синхронизировать
    // руками в двух местах, см. runnerAnims/currentTurnPlayerId ниже).
    const boardGridEl = (
        <BoardGrid
            gridData={gridData}
            rows={rows}
            cols={viewportCols}
            segmentW={segmentW}
            segmentH={segmentH}
            windowStart={windowStart}
            orientation="portrait"
            containerWidth={roadContainerW}
            containerHeight={roadContainerH}
            runners={runners}
            playerColorById={playerColorById}
            selectedRunnerId={activeRunner?.id ?? null}
            highlightedCells={highlightedCells}
            runnerAnims={runnerAnim.anims}
            runnerVisualPositions={runnerAnim.visualPositions}
            currentTurnPlayerId={game.playerOrder}
            hiddenRunnerIds={runnerAnim.hiddenIds}
            onCollisionPoseStart={handleCollisionPoseStart}
            reaperPreview={
                pendingReaperPlacement
                    ? {
                        segment: pendingReaperPlacement.segment,
                        positionX: pendingReaperPlacement.positionX,
                        positionY: pendingReaperPlacement.positionY,
                        side: pendingReaperPlacement.side,
                        settled: reaperPreviewReady,
                        color: playerColorById[myPlayer?.id] ?? '#fff',
                    }
                    : null
            }
            onCellPress={handleCellPress}
        />
    );

    // Overlay удаляемого фрагмента №1 (см. эффект у gridData/trackSnapshotRef
    // выше) — отдельный, некликабельный экземпляр BoardGrid поверх боевого,
    // рисующий ТОЛЬКО старые ячейки blockIndex 0 на их СТАРОЙ (до сдвига)
    // windowStart-позиции, плавно затухающий. runners не передаём (пустой
    // массив по умолчанию у BoardGrid) — токены уже отрисованы боевым слоем
    // и обновляются его собственной анимационной очередью, дублировать их
    // тут не нужно (и рисовало бы "двух бегунов" на время fade).
    const trackFadeOverlayEl = trackFadeOverlay ? (
        <Animated.View pointerEvents="none" style={[styles.boardGridFadeOverlay, { opacity: trackFadeOverlay.opacity }]}>
            <BoardGrid
                gridData={trackFadeOverlay.gridData}
                rows={rows}
                cols={viewportCols}
                segmentW={segmentW}
                segmentH={segmentH}
                windowStart={trackFadeOverlay.windowStart}
                orientation="portrait"
                containerWidth={roadContainerW}
                containerHeight={roadContainerH}
                playerColorById={playerColorById}
            />
        </Animated.View>
    ) : null;

    return (
        <View style={[styles.wrapper, isPortrait && styles.wrapperPortrait]}>
            <ParallaxBackground />

            <GameFinishModal
                visible={game.status === GAME_STATUS.FINISH}
                winnerName={winnerPlayer?.user?.username ?? (winnerPlayer ? `Игрок ${winnerPlayer.id}` : null)}
                onExit={goToMainMenu}
            />

            {!isPortrait && <View style={styles.turnBanner}>{turnBannerInner}</View>}

            {game.extraTurnPlayer != null && (
                <View style={[styles.collisionBanner, { top: insets.top + spacing.md }]}>
                    <Text style={styles.collisionText}>
                        {/* Столкновение происходит в любом случае — отказаться от него
                            нельзя (по правилам выбор есть только у более крупного бегуна
                            при столкновении разных размеров, см. myCollision выше). Выбор
                            здесь — использовать уже брошенный кубик или перебросить его
                            заново, а не "принять/отклонить само столкновение" — прежняя
                            формулировка вводила в заблуждение (жалоба пользователя,
                            2026-09-02). Для "мяча" (myBallCollision) выбора нет вообще —
                            это неконтролируемая коллизия (danger-клетка), не столкновение
                            с чужим бегуном, разрешается сама (см. эффект выше). */}
                        {myBallCollision
                            ? 'Столкновение с препятствием…'
                            : myCollision
                                ? 'Столкновение! Использовать бросок или перебросить?'
                                : 'Ожидаем реакцию игрока на столкновение…'}
                    </Text>
                    {myCollision && !myBallCollision && !busy && collisionDecisionReady && (
                        <>
                            <Button title="Использовать" variant="success" onPress={() => handleCollision(true)} style={styles.collisionBtn} />
                            <Button title="Перебросить" variant="danger" onPress={() => handleCollision(false)} style={styles.collisionBtn} />
                        </>
                    )}
                    {!myCollision && showStuckRefresh && (
                        <Button
                            title="Обновить состояние"
                            variant="info"
                            onPress={() => {
                                // Полный REST-рефетч заменяет game-стейт целиком, минуя
                                // событийный поток, который двигает очередь анимаций —
                                // без сброса застрявшая очередь держала бы бегуна в
                                // визуальной позиции старого (уже неактуального) шага.
                                runnerAnim.reset();
                                resync();
                            }}
                            style={styles.collisionBtn}
                        />
                    )}
                </View>
            )}

            {!isPortrait && (
                <PlayerInfoPanel
                    players={players}
                    activePlayerId={activePlayerId}
                    onSelectPlayer={setActivePlayerId}
                    myPlayerId={myPlayer?.id ?? null}
                    canAct={myTurn && !busy}
                    myStep={myStep}
                    pendingAbility={pendingAbility}
                    pendingSelect={pendingSelect}
                    canSelectRunner={canSelectRunner}
                    onDropOnAbility={handleDropOnAbility}
                    onPressAbilityZone={handlePressAbilityZone}
                    onDropOnRunner={handleDropOnRunner}
                    onRunnerCardPress={handleRunnerCardPress}
                    onRunnerCardDoubleTap={handleRunnerCardDoubleTap}
                    width={leftPanelW}
                    switcherHeight={switcherH}
                />
            )}

            {/* Дорога ВСЕГДА вертикальная (статичная сетка, стрелки вверх/вниз
                мгновенно сдвигают видимое окно на 1 сегмент/удержание — см.
                useBoardScroll/BoardGrid) — по прямому запросу пользователя,
                2026-08-31 (шестой заход), независимо от формы окна. Меняется
                только расположение ПАНЕЛИ игрока: снизу под дорогой на узком
                окне (panelH из useBoardLayout, см. BoardGrid про "снизу
                вверх"), слева от дороги на широком (см. leftPanelW выше) —
                эту часть пользователь попросил оставить "как сейчас". Кнопки
                навигации (не mobileNav-случай) — КОЛОНКОЙ СЛЕВА от дороги
                (по прямому запросу пользователя, 2026-08-31, третий заход —
                было выше/ниже), поэтому сам блок дороги (эта View) — строка
                (кнопки | дорога), а не колонка. */}
            <View
                style={[
                    styles.roadZonePortrait,
                    // Без этого кнопки/сетка (первый flow-элемент в этом
                    // блоке, экран без SafeAreaView) рисовались под статус-баром/
                    // вырезом камеры — не видны и не тапабельны (жалоба пользователя).
                    { paddingTop: insets.top },
                ]}
            >
                {/* Кнопки — ВСЕГДА вверх/вниз, колонкой СЛЕВА от дороги (не зависит от
                    расположения панели, см. комментарий выше блока): "вверх" = дальше по
                    треку, "вниз" = назад к началу (подтверждено пользователем явно).
                    Мгновенный посегментный сдвиг видимого окна (onPressIn: сразу шаг
                    +повтор каждые 250мс, пока удержана; onPressOut: стоп — см.
                    useBoardScroll), сетка на экране физически не двигается вообще (ни
                    скролла, ни анимации позиции). RoadNavButton — тот же ассет, что и в
                    mobileNav-случае (не круглая ArrowButton), размер — navBtnSize
                    (половина размера сегмента, прямой запрос пользователя, а не доля
                    экрана). useMobileNavButtons (портрет+native): здесь рендерится null —
                    у него СВОИ RoadNavButton в нижнем слоте на стыке рамок (см. seamRow
                    ниже), не в потоке здесь. */}
                {!useMobileNavButtons && (
                    <View style={styles.navBtnColumnLeft}>
                        <RoadNavButton direction="up" size={navBtnSize} handlers={forwardButtonProps} />
                        <RoadNavButton direction="down" size={navBtnSize} handlers={backButtonProps} />
                    </View>
                )}

                <View style={styles.roadFrameWrap}>
                    <RoadArea spacing={ROAD_AREA_SPACING} backgroundColor="#3a034b00">
                        {/* Полоса с именем фрагмента(ов) слева от сетки — под неё
                            зарезервирована ширина (labelStripW, см. useBoardLayout)
                            вместо того, чтобы центрировать сетку и оставлять пустые
                            поля по бокам. Раньше — только в портретной раскладке
                            (там же жила отдельная геометрия дороги), теперь дорога
                            везде вертикальная, так что и полоса везде. */}
                        <View style={styles.roadRowPortrait}>
                            <FragmentLabelStrip
                                bands={fragmentBands}
                                width={labelStripW}
                                segmentSize={segmentH}
                                totalHeight={roadContainerH}
                            />
                            <View style={styles.boardGridStack}>
                                {boardGridEl}
                                {trackFadeOverlayEl}
                            </View>
                        </View>
                    </RoadArea>
                    {/* bleed.top закрывает И вырез/статус-бар (insets.top), плюс
                        небольшой запас — так рамка реально доходит до истинного верха
                        экрана. Лево/право — чуть за край экрана. Низ — 0 (шов с панелью,
                        рамки соприкасаются впритык, каждая остаётся отдельной рамкой со
                        всеми 4 скруглёнными углами — НЕ сливаются в одну). */}
                    {useMobileNavButtons && (
                        <MobileFrameOverlay
                            borderDp={arrowBtnSize}
                            bleed={{
                                top: insets.top + MOBILE_FRAME_BLEED,
                                left: MOBILE_FRAME_BLEED,
                                right: MOBILE_FRAME_BLEED,
                            }}
                        />
                    )}
                </View>
            </View>

            {isPortrait && (
                <View style={styles.panelFrameWrap}>
                    <PlayerInfoPanel
                        players={players}
                        activePlayerId={activePlayerId}
                        onSelectPlayer={setActivePlayerId}
                        myPlayerId={myPlayer?.id ?? null}
                        canAct={myTurn && !busy}
                        myStep={myStep}
                        pendingAbility={pendingAbility}
                        pendingSelect={pendingSelect}
                        canSelectRunner={canSelectRunner}
                        onDropOnAbility={handleDropOnAbility}
                        onPressAbilityZone={handlePressAbilityZone}
                        onDropOnRunner={handleDropOnRunner}
                        onRunnerCardPress={handleRunnerCardPress}
                        onRunnerCardDoubleTap={handleRunnerCardDoubleTap}
                        height={panelH}
                        switcherHeight={switcherH}
                        switcherAtBottom
                        compactColumns
                        headerContent={<View style={styles.panelTurnBanner}>{turnBannerInner}</View>}
                    />
                    {/* bleed: низ/лево/право — чуть за край экрана. Верх — 0
                        (шов с дорогой, см. комментарий у неё выше) — рамки просто
                        стоят вплотную без зазора, каждая остаётся отдельной рамкой
                        со всеми 4 скруглёнными углами (НЕ сливаются в одну). */}
                    {useMobileNavButtons && (
                        <MobileFrameOverlay
                            borderDp={arrowBtnSize}
                            bleed={{ bottom: MOBILE_FRAME_BLEED, left: MOBILE_FRAME_BLEED, right: MOBILE_FRAME_BLEED }}
                        />
                    )}
                </View>
            )}

            {/* Единый ряд: стрелки вверх/вниз + кнопка лога, отцентрированный ровно НА
                стыке рамок (дорога/панель) — половина ряда лежит на нижней кромке
                дорожной рамки, половина на верхней кромке рамки панели. panelH
                известна (панель — последний child фиксированной высоты в колонке,
                прижат к самому низу wrapper), поэтому seam = panelH от низа экрана;
                bottom ряда = panelH − arrowBtnSize/2 ставит ЦЕНТР ряда (row height
                зафиксирована = arrowBtnSize) ровно на этот шов, независимо от
                фактической высоты кнопки лога — она просто center'уется внутри той
                же строки через alignItems. EventLogPanel в режиме position="seam"
                рендерит только кнопку-тоггл инлайн (без своего абсолютного wrapper'а)
                и раскрывающийся список — абсолютным дропдауном НАД собой. Только для
                useMobileNavButtons (мобильная рамка) — вне этого случая лог остаётся
                в прежнем углу (position ниже), кнопки навигации — RoadNavButton
                колонкой слева от дороги (см. navBtnColumnLeft выше). */}
            {useMobileNavButtons ? (
                <View style={[styles.seamRow, { bottom: panelH - arrowBtnSize / 2, height: arrowBtnSize }]}>
                    <RoadNavButton direction="up" size={arrowBtnSize} handlers={forwardButtonProps} />
                    <RoadNavButton direction="down" size={arrowBtnSize} handlers={backButtonProps} />
                    <EventLogPanel entries={eventLog} position="seam" />
                </View>
            ) : (
                <EventLogPanel entries={eventLog} position={isPortrait ? 'top' : 'bottom-right'} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // backgroundColor — та же тёмная тема, что Screen.js подставляет под
    // ParallaxBackground на всех остальных экранах (SafeAreaView с
    // {backgroundColor: bg}). У GameBoardScreen своего Screen-каркаса нет
    // (полноэкранный экран, фон вставляет вручную), и без этого фолбэка,
    // если Animated.Image парallax-фона не успевает/не может отрисоваться
    // (тяжёлый экран, много одновременных картинок, смена ориентации на
    // Android через useAdaptiveOrientation), из-под него на Android
    // просвечивает белый фон Activity по умолчанию — раньше сквозь пустоту
    // ничего не было видно, кроме белого.
    // flexDirection:'row' — альбомная раскладка (панель слева, доска справа).
    // Портретная (wrapperPortrait) переключает на column — доска сверху,
    // панель снизу (см. useBoardLayout.orientation).
    wrapper: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
    wrapperPortrait: { flexDirection: 'column' },
    // Обёртки под MobileFrameOverlay — ТОЛЬКО position:'relative', БЕЗ
    // overflow:'hidden'. Рамка сама заполняет их РОВНО (не вылезает за
    // границы, см. компонент) — эти View просто дают ей позиционирующий
    // контекст. roadFrameWrap — flex:1 (тот же слот, что раньше держал
    // RoadArea напрямую); panelFrameWrap — без flex (высота идёт от
    // PlayerInfoPanel через её проп height, как и раньше).
    roadFrameWrap: { flex: 1, position: 'relative' },
    // Полоса имени фрагмента (FragmentLabelStrip) + сетка, бок о бок — портретная
    // раскладка. Обе имеют явную height=roadContainerH (см. JSX), выравнивать
    // по кросс-оси дополнительно не нужно.
    roadRowPortrait: { flexDirection: 'row' },
    // position:'relative' — якорь для trackFadeOverlayEl (position:'absolute'
    // поверх боевого BoardGrid, см. game_track_updated эффект у gridData).
    boardGridStack: { position: 'relative' },
    boardGridFadeOverlay: { position: 'absolute', top: 0, left: 0 },
    panelFrameWrap: { position: 'relative' },
    // Абсолютный ряд НА стыке дорожной и панельной рамок (см. комментарий в
    // JSX про расчёт bottom) — sibling обеих зон на уровне wrapper, поэтому
    // left+right без width, а не flex. zIndex/elevation выше рамок (10) и
    // выше EventLogPanel-плашек в остальных режимах (25), чтобы кнопки и
    // тоггл лога были кликабельны и видны поверх текстуры рамок.
    seamRow: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
        zIndex: 30,
        elevation: 30,
    },
    // Блок дороги (кнопки навигации | сетка) — ВСЕГДА строка (кнопки колонкой
    // слева, дорога справа, по прямому запросу пользователя, 2026-08-31,
    // третий заход — было выше/ниже), дорога всегда вертикальная независимо
    // от расположения панели (см. комментарий в JSX). alignItems:'stretch'
    // (дефолт) — roadFrameWrap растягивается на всю высоту блока.
    roadZonePortrait: { flex: 1, flexDirection: 'row' },
    // Кнопки навигации слева от дороги — колонка, отцентрированная по высоте
    // относительно roadFrameWrap (соседний flex:1-ребёнок этой же строки).
    navBtnColumnLeft: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    statusText: { fontSize: font.small, color: colors.textOnDarkSecondary, marginTop: spacing.sm },
    errorText: { fontSize: font.small, color: colors.danger, marginTop: spacing.md, textAlign: 'center', paddingHorizontal: spacing.lg },
    retryBtn: { marginTop: spacing.sm },
    collisionBanner: {
        // right (не alignSelf:'center') — абсолютно спозиционированные дети в RN
        // не центрируются через alignSelf надёжно, нужны явные координаты.
        // top — задаётся динамически (insets.top+spacing.md, см. компонент).
        position: 'absolute', right: spacing.md, zIndex: 20, elevation: 20,
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.bgLight, borderRadius: radius.pill,
        paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    },
    collisionText: { color: colors.textOnDark, fontSize: font.tiny },
    collisionBtn: { minHeight: 32, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    turnBanner: {
        position: 'absolute', top: spacing.md, left: spacing.md, zIndex: 20, elevation: 20,
        maxWidth: 280, backgroundColor: colors.bgLight, borderRadius: radius.md,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    },
    turnTitle: { color: colors.textOnDarkSecondary, fontSize: font.small, fontWeight: 'bold' },
    turnTitleMine: { color: colors.success, fontSize: font.small, fontWeight: 'bold' },
    turnHint: { color: colors.textOnDark, fontSize: font.tiny, marginTop: 2 },
    turnSkipBtn: { minHeight: 32, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, marginTop: spacing.xs },
    turnBtnRow: { flexDirection: 'row', gap: spacing.xs },
    // Тот же баннер хода, что в альбомной раскладке плавает над доской
    // (styles.turnBanner), но встроенный в обычный поток панели (портретная
    // раскладка) — там, где раньше было крупное имя игрока. Без
    // position:'absolute' — это обычный блок в PlayerInfoPanel.headerContent.
    panelTurnBanner: {
        backgroundColor: colors.bgLight, borderRadius: radius.md,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
        marginTop: spacing.xs,
    },
});
