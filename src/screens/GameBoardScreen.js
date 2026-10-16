// src/screens/GameBoardScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import RoadNavButton from '../components/game/RoadNavButton';
import MobileFrameOverlay from '../components/game/MobileFrameOverlay';
import RoadArea from '../components/game/RoadArea';
import BoardGrid from '../components/game/BoardGrid';
import FragmentLabelStrip from '../components/game/FragmentLabelStrip';
import PlayerInfoPanel from '../components/game/PlayerInfoPanel';
import GameDialogModal from '../components/game/GameDialogModal';
import GameFinishModal from '../components/game/GameFinishModal';
import EventLogPanel, { EventLogEntries, EVENT_LOG_PANEL_STYLE } from '../components/game/EventLogPanel';
import GameMenuButton from '../components/game/GameMenuButton';
import GameMenuModal from '../components/game/GameMenuModal';
import GameSettingsHubModal from '../components/game/GameSettingsHubModal';
import GameSettingsModal from '../components/game/GameSettingsModal';
import GameGeneralSettingsModal from '../components/game/GameGeneralSettingsModal';
import PlayerSwitchPanel, { SWITCH_ASPECT } from '../components/game/PlayerSwitchPanel';
import FramedSquare from '../components/game/FramedSquare';
import Button from '../components/ui/Button';
import LoadingCard from '../components/ui/LoadingCard';
import PulseText from '../components/ui/PulseText';
import FramePanel, { frameNotchRadius } from '../components/ui/FramePanel';
import NeonGlow from '../components/ui/NeonGlow';
import { useAuth } from '../hooks/useAuth';
import { useMercure } from '../hooks/useMercure';
import { useAudioSettings } from '../hooks/useAudioSettings';
import { useGameAudio } from '../hooks/useGameAudio';
import { useGameMenuModals } from '../hooks/useGameMenuModals';
import { useTrackShiftChoreography } from '../hooks/useTrackShiftChoreography';
import { useAdaptiveOrientation } from '../hooks/useAdaptiveOrientation';
import { useRunnerAnimations } from '../hooks/useRunnerAnimations';
import { useGhostPairs } from '../hooks/useGhostPairs';
import { useMineBlasts } from '../hooks/useMineBlasts';
import { useRicochetTrails } from '../hooks/useRicochetTrails';
import { ROAD_AREA_SPACING, useBoardLayout } from '../hooks/useBoardLayout';
import { useBoardScroll } from '../hooks/useBoardScroll';
import {
    flattenTrackSegments, flattenPeekColumn, computeFragmentBands, resolveCellVisual,
    pickSegmentImage, pickBaseImage, computeHighlightedCells,
} from '../lib/board';
import { forwardNeighbors, cellKey } from '../lib/hexDirection';
import { describeEvent, directionLabel, rawEventFallback } from '../lib/eventLog';
import { handleSequenceItem, DEATH_KIND_BY_TERRAIN } from '../lib/runnerAnimTriggers';
import { identifyGhostConsumption } from '../lib/ghostPairs';
import { unwrapBundle } from '../lib/mercureBundle';
import { pickActiveSoundSource, pickShootSoundSource, pickMoveSoundSource, pickStartSoundSource } from '../lib/runnerSoundTriggers';
import { FALLBACK_MOVE_SOUND, pickRandom } from '../constants/runnerSounds';
import { COMMENT_SOUNDS } from '../constants/commentSounds';
import { LAND_MINE_SOUND, RADIATION_SOUND, RICOCHET_HIT_SOUNDS } from '../constants/commonSounds';
import { RUNNER_PICKED_SOUND, LOG_TOGGLE_SOUND } from '../constants/uiSounds';
import { BACKGROUND_MUSIC_TRACKS, pickRandomTrackIndex } from '../constants/backgroundMusic';
import { notify, confirm } from '../lib/notify';
import { createLogger } from '../lib/logger';
import { runnerGameApi } from '../api/runnerGame';
import { runnerGameReducer } from '../store/runnerGameReducer';
import { ROUTES } from '../navigation/routes';
import {
    BOARD_LAYOUT, GAME_STATUS, LOG_BUTTON_IMAGES, MOBILE_FRAME_BLEED,
    PLAYER_COLOR_HEX, PLAYER_COLORS, PLAYER_STATUS, PLAYER_STEP,
    RUNNER_DISPLAY, RUNNER_STATUS, RUNNER_TYPES, TAP_MODE, TURN_BANNER_MIN_HEIGHT,
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

// Пауза-буфер перед показом реального экрана партии вместо спиннера —
// 2026-10-12, по прямому запросу пользователя ("вижу, как последовательно
// появляются компоненты, подгоняются под экран"). Первый рендер активной
// доски — это сразу несколько панелей (compactColumns/PlayerInfoPanel,
// RunnerCard×N, FramePanel/PersonPanel, DicePips и т.п.), каждая меряет
// СВОЙ контейнер через onLayout и подгоняет масштаб/размер под него — на
// Android это может занять несколько каскадных рендеров подряд (одна
// панель смерилась → задела layout соседней → та тоже перемерилась),
// видимо как "дёрганье" элементов сразу после входа на экран. Честный
// сигнал "все панели измерились" пришлось бы тянуть от каждой из них
// отдельно (инвазивная правка по множеству файлов) — вместо этого контент
// монтируется СРАЗУ (opacity:0, замеры идут без изменений), а спиннер
// держится этот фиксированный буфер поверх него, затем прячется. Не
// идеальная гарантия (как и другие "запас N мс" в проекте), но узкая и
// безопасная правка.
const BOARD_READY_DELAY_MS = 500;

// Задержка перед показом кнопок "Использовать/Перебросить" — чтобы игрок
// сначала УВИДЕЛ анимацию столкновения, а не решал вслепую в момент, когда
// extraTurnPlayer только что появился. Раньше 2200мс (с большим запасом сверх
// SLIDE_DURATION_MS/ANIM_DURATION_MS.move ~1400мс + COLLISION_MIN_HOLD_MS в
// BoardGrid) — по прямому запросу пользователя, 2026-09-08, сокращено:
// 1400мс всё ещё покрывает приезд победителя (~1360-1440мс), просто без
// лишнего запаса поверх минимального показа самой позы.
const COLLISION_ANIM_DELAY_MS = 1400;

// 2026-10-15, по прямому запросу пользователя: GameFinishModal не должен
// показываться, пока доигрывает терминальная поза ПОСЛЕДНЕГО погибшего
// бегуна И её голосовой комментарий (COMMENT_SOUNDS.destroyed, deathCommentOnStart
// ниже) — раньше гейт (pendingDeathRunnerIds) снимался РОВНО в момент старта
// позы, синхронно с запуском комментария, то есть диалог мог появиться, пока
// комментарий ещё играет. Запас сверх старта терминальной позы — для короткой
// голосовой реплики достаточно, тот же порядок величины, что у
// REAPER_BOMB_TO_DESTROYED_DELAY_MS (useRunnerAnimations.js) для похожего
// случая "дождаться доигрывания короткого клипа".
const DEATH_FINISH_GATE_SETTLE_MS = 1800;

// FINISH_MODAL_SAFETY_MS — см. finishModalForced у места использования
// (2026-10-16): страховка на случай, если hasDeathAnimPlaying/trackShiftPhase
// никогда не снимутся сами. С запасом больше ЛЮБОЙ честной цепочки этого гейта
// (самая долгая терминальная поза + DEATH_FINISH_GATE_SETTLE_MS укладываются
// в единицы секунд) — чтобы в норме никогда не сработать раньше настоящего
// снятия гейта, но и не заставлять игрока ждать результат партии слишком долго.
const FINISH_MODAL_SAFETY_MS = 6000;

// 2026-10-14: бэк унифицировал CollisionEvent — вместо enum `collision`
// (LOWER/TOP) + сырых `runnerId`/`otherRunnerId` теперь явные
// `flyingRunnerId`/`stayingRunnerId`. Старая формула TOP→runnerId/
// LOWER→otherRunnerId (найденная чтением StepCollisionService, см.
// историю в CLAUDE_DONE_TASKS.md 2026-10-11/10-12) больше не нужна —
// "кто улетит" приходит готовым полем.

// TURN_BANNER_MIN_HEIGHT — вынесена в constants/GameConstants.js (2026-10-15,
// по прямому запросу пользователя — тот же размер теперь нужен и
// GameDialogModal.js, чтобы не плодить два магических числа одного смысла);
// история решения (зачем фиксированная высота под 3 строки, почему меньше
// на native) осталась в комментарии там.

// 2026-10-16 — константы хореографии сдвига фрагментов (TRACK_SHIFT_*)
// переехали в hooks/useTrackShiftChoreography.js вместе с самой логикой.

const DEAD_STATUSES = [RUNNER_STATUS.BROKEN, RUNNER_STATUS.DESTROYED];
// 2026-10-16 — SEGMENT_KEYS/findRunnerAt/rawCellType/REAPER_ALLOWED_CELL_TYPES
// переехали в lib/board.js вместе с computeHighlightedCells (единственным
// их потребителем) — DEAD_STATUSES остаётся тут, нужен ещё в паре мест,
// не связанных с подсветкой клеток (см. её usage ниже).

// Человеко-понятная подсказка "что делать", раз на экране нет туториала —
// первый живой прогон показал, что без этого не очевидно, что шаг ABILITY
// нужно явно пройти (усилить или пропустить), прежде чем откроется тап по
// доске для перемещения/размещения.
function stepInstruction(
    step, activeRunner, pendingAbility, pendingSelect, pendingRunnerName,
    pendingReaperPlacement, reaperPreviewReady, canReaperShoot, reaperConfirmed,
) {
    if (pendingReaperPlacement) {
        // До того, как "прилёт" из-за края карты успел доиграть
        // (reaperPreviewReady), подсветки на доске ещё нет — тапать некуда,
        // текст объясняет паузу, а не намекает на несуществующие клетки.
        if (!reaperPreviewReady) return 'Жнец приближается…';
        // Два последовательных диалога (2026-10-11, по прямому запросу
        // пользователя): сперва подтверждение размещения (✓/✕, см. кнопки
        // ниже в рендере), ПОТОМ, только после ✓ — выбор выстрела. Текст
        // второго диалога — буквально тот же, что у обычного SHOOT (см.
        // ниже), по прямому запросу пользователя ("сменим текстовку на...").
        // canReaperShoot тут больше не меняет ТЕКСТ (только то, появятся ли
        // реально подсвеченные клетки, см. highlightedCells) — если выстрела
        // в принципе нет, автоэффект (autoNoShotAttemptedRef) решит сам,
        // этот текст виден лишь на миг или не виден вовсе.
        if (!reaperConfirmed) return 'Жнец на месте — подтверди размещение';
        return 'Тапни на цель для выстрела или нажми «Скип»';
    }
    if (pendingSelect) {
        // Имя бегуна — по прямому запросу пользователя: раньше текст был безличным
        // ("Бегун выбран"), и на карточках с одинаковой иконкой/цветом (или просто
        // издалека) не всегда было очевидно, кого именно выбрали.
        // Сокращено по прямому запросу пользователя (2026-09-14) — кнопки
        // теперь сами по себе понятны (✓/✕, см. ниже), длинная инструкция
        // "подтверди или тапни бегуна ещё раз, чтобы отменить" избыточна,
        // но короткое "подтверди действие" оставлено — по отдельному прямому
        // запросу тем же днём, добавить обратно в ту же строку.
        const label = pendingRunnerName ? `«${pendingRunnerName}»` : 'Бегун';
        return pendingSelect.type === 'ROLL'
            ? `Накат для ${label} выбран — подтверди действие`
            : `Подтверди выбор бегуна ${label}`;
    }
    switch (step) {
        case PLAYER_STEP.SELECT:
            return 'Перетащи кубик на карточку бегуна';
        case PLAYER_STEP.ABILITY:
            if (pendingAbility?.ability === 'heal') return 'Тапни карточку своего повреждённого бегуна';
            if (pendingAbility?.ability === 'reaper') return 'Тапни подсвеченную клетку, чтобы поставить Жнеца';
            return 'Выбери усиление, если хочешь';
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
            // 2026-10-16, по прямому запросу пользователя: накат должен быть
            // явно назван накатом в тексте подсказки, не слит с обычным
            // ходом — тот же признак наката (activeRunner.dice===0 И
            // rollDice!=null), что уже используется в handleCellPress
            // (isRollMove) и в RunnerCard.js (diceValue).
            if (activeRunner.dice === 0 && activeRunner.rollDice != null) {
                return 'Накат — выбери направление';
            }
            return activeRunner.segment == null
                ? 'Тапни подсвеченную клетку в заднем ряду — это выход на трассу'
                : 'Выбери доступную клетку для хода';
        case PLAYER_STEP.SHOOT:
            if (!activeRunner) return 'Не удалось определить активного бегуна (проблема синхронизации) — доступен только «Скип»';
            return 'Тапни на цель для выстрела или нажми «Скип»';
        case PLAYER_STEP.ROAD_BONUS:
            return 'Применить бонус кубика дороги?';
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
// Логируем сам факт "игрок совершил действие" (2026-09-14, по прямому запросу
// пользователя) — отдельно от [API] (тот уже логирует конкретный HTTP-вызов
// внутри), этот тег про игровую семантику: началось/успех/провал, привязано к
// шагу игрока на момент вызова (см. runAction).
const gameLog = createLogger('GAME');

export default function GameBoardScreen({ route, navigation }) {
    useAdaptiveOrientation();
    // GameBoardScreen сознательно без SafeAreaView (см. шапку файла) — сам
    // экран считает отступы вручную (insets.top у roadZonePortrait/
    // MobileFrameOverlay ниже), та же болячка, что была у EventLogPanel
    // (см. его комментарий).
    const insets = useSafeAreaInsets();
    // Явный размер экрана для boardReadyOverlay (см. её стиль ниже) — тот же
    // класс Android-бага, что и у GameDialogModal (см. комментарий у
    // roadFrameSize): position:'absolute' внутри flex:1-родителя БЕЗ явного
    // пиксельного размера на Android ненадёжен. useWindowDimensions — не
    // onLayout, а системный размер окна, тут это уместно (оверлей и должен
    // закрыть именно весь экран, не какой-то конкретный дочерний контейнер).
    const windowDimensions = useWindowDimensions();
    const { user, isLoading: authLoading } = useAuth();
    const gameId = route?.params?.gameId ?? null;
    // См. LobbyScreen.js — true, только если сюда попали ПРЯМО из
    // "лобби только что создало игру" (единственный надёжный сигнал для
    // gameStartSoundPlayedRef ниже, раз WAITING больше не наблюдаем).
    const justStarted = route?.params?.justStarted === true;

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
    // самого game. handleSequenceItem (lib/runnerAnimTriggers) — чистая
    // функция "событие → что триггернуть", сам стейт трогает только
    // runnerAnim.trigger.
    const runnerAnim = useRunnerAnimations();
    // Пары бегунов, мирно сосуществующих на одной клетке благодаря "призраку"
    // (см. lib/ghostPairs.js) — BoardGrid рисует их как два независимых
    // solo-токена (idle рядом), не коллизионную позу, по прямому запросу
    // пользователя, 2026-09-09.
    const ghostPairs = useGhostPairs();
    // Одноразовые взрывы мины на клетках (danger==='mine') — см.
    // hooks/useMineBlasts.js. Триггер — двухшаговая корреляция транзиент→
    // версионное событие, см. minePendingRef и game_cell_updated-ветку в
    // reduceAndLog ниже (тот же паттерн, что уже используется для
    // ghost_consumed/жетонов повреждений в этом файле).
    const mineBlasts = useMineBlasts();
    const minePendingRef = useRef(false);
    // Визуальный след пролетающей пули рикошета — см. hooks/useRicochetTrails.js/
    // constants/ricochetVfx.js. Триггерится прямо в существующей ветке
    // `e.event === 'ricochet'` ниже (там же, где уже играет звук) — тайминг
    // уже готов "бесплатно": эта ветка и так ждёт, пока доиграет анимация
    // урона исходного бегуна (causedBy-цепочка), прежде чем сработать.
    const ricochetTrails = useRicochetTrails();
    // **2026-09-25, по прямому запросу пользователя** — раньше вскрытие
    // клетки (game_cell_updated) сразу же дёргало mineBlasts.trigger(cellId),
    // СОВЕРШЕННО не в курсе очереди анимаций бегуна, который эту мину
    // реально вызвал — совпадение по времени с его 'fly'-приземлением было
    // случайным побочным эффектом старых, искусственно растянутых таймеров
    // (см. useRunnerAnimations.js, "2026-09-25" в начале файла). Теперь мина
    // стартует ЧЕРЕЗ ТОТ ЖЕ `onStart`-механизм, что уже используется ниже
    // для heldCells (releaseHeldCellOnStart/triggerWithSound) — единственный
    // в проекте сигнал "этот toPosition РЕАЛЬНО начал играть", а не гадание
    // по параллельному таймеру. `pendingMineCellIdsRef` — Set cellId,
    // ожидающих СВОЕГО onStart (обычно один элемент, Set — на случай двух
    // мин почти подряд); `activatedCellKeysRef` (см. ниже, уже существует
    // для heldCells) переиспользуется как есть — если onStart для этой
    // позиции уже отработал РАНЬШЕ, чем мы узнали про мину (однохоповый
    // случай без каскада — см. докстринг у activatedCellKeysRef), ждать
    // больше нечего, взрываем сразу в game_cell_updated-ветке.
    const pendingMineCellIdsRef = useRef(new Set());
    // Страховочный потолок — тот же принцип, что HELD_CELL_TIMEOUT_MS ниже:
    // если ни один toPosition этого бегуна никогда не совпадёт с этой
    // клеткой (например бегуна уничтожило раньше, чем он "долетел"), не
    // держать взрыв невидимым вечно.
    const MINE_TRIGGER_SAFETY_TIMEOUT_MS = 8000;

    // Гейт для GameFinishModal (см. hasDeathAnimPlaying ниже) — живая жалоба,
    // 2026-09-12: "диалог победы на мгновение появился и исчез, потом
    // проигралась анимация, потом диалог снова появился (уже валидно)".
    // Причина — `hasDeathAnimPlaying` смотрел ТОЛЬКО на `runnerAnim.anims`
    // (то, что УЖЕ реально играется прямо сейчас) — а между `runner_destroy`
    // (game.status уже FINISH) и РЕАЛЬНЫМ стартом acid/burn-позы есть
    // задержка, если бегун в этот момент ещё доигрывал предыдущий шаг
    // очереди (move/fly) — тогда acid/burn просто встаёт в очередь,
    // `anims` его ещё не отражает, гейт ложно открыт. Этот Set — runnerId,
    // для которых МЫ УЖЕ ЗНАЕМ, что вот-вот заиграет acid/burn (заполняется
    // в reduceAndLog в момент детекции wall-death, до реального старта позы),
    // держит гейт закрытым С МОМЕНТА ОБНАРУЖЕНИЯ, а не с момента, когда
    // очередь до него реально дойдёт. Очищается в момент, когда поза РЕАЛЬНО
    // стартует (deathOnStart в triggerWithSound ниже) — дальше эстафету
    // берёт уже `anims` через обычный hasDeathAnimPlaying.
    const [pendingDeathRunnerIds, setPendingDeathRunnerIds] = useState(() => new Set());

    // Замороженные "невскрытые" клетки опасности — живая жалоба пользователя,
    // 2026-09-15: при каскаде (мина отбросила бегуна ещё на одну мину и т.д.)
    // все вскрытые сегменты game_cell_updated применяются к game-стейту
    // ПОЧТИ ОДНОВРЕМЕННО (бэк шлёт их одним залпом за десятки мс), тогда как
    // очередь анимаций бегуна честно проигрывает каждый хоп по очереди — на
    // экране все клетки открывались разом, а бегун ещё только долетал до
    // первой. Игровой СТЕЙТ (game.trackBegin/...grid) по-прежнему обновляется
    // МГНОВЕННО на каждое событие (архитектурное правило проекта — состояние
    // никогда не ждёт анимацию) — но ВИЗУАЛЬНО клетка держится в СТАРОМ,
    // ещё-невскрытом виде (см. cellKeyFromPosition/heldCells ниже, cellId →
    // {type,image,baseImage} снятые с PRE-update состояния), пока реальная
    // позиция бегуна (runnerAnim.visualPositions, см. эффект ниже) не
    // сравняется с этой клеткой — то есть пока анимация того самого хопа не
    // НАЧНЁТ играть. Передаётся в BoardGrid как cellOverrides.
    const [heldCells, setHeldCells] = useState({});
    // Тот же формат, что `lib/hexDirection#cellKey` (уже используется в этом
    // файле для подсветки/соседей) — раньше был независимо переизобретён тут
    // же строковым шаблоном, а строкой ниже (game_cell_updated) ещё и
    // переизобретён ВТОРОЙ раз инлайном; сведено к одной канонической
    // реализации, просто с null-гардом под опциональный `toPosition`.
    const cellKeyFromPosition = (pos) => (pos ? cellKey(pos) : null);
    // Страховочный потолок — если по какой-то причине ни один visualPositions
    // никогда не совпадёт с этой клеткой (бегуна уничтожило раньше, чем он
    // формально "долетел" туда, и т.п.), не держать клетку закрытой вечно.
    const HELD_CELL_TIMEOUT_MS = 8000;
    // Снимаем заморозку через onStart конкретного trigger()-вызова (см.
    // triggerWithSound ниже), НЕ через наблюдение за runnerAnim.visualPositions
    // — тот вариант (первая версия этого фикса, тот же день) ловил живую
    // жалобу "восклицательный знак исчез только через несколько секунд"
    // (сработал только 8-секундный страховочный таймаут): React батчит
    // setState-вызовы, и когда мина-мина-обычная-опасность прилетают в ОДНОМ
    // синхронном проходе reduceAndLog (см. useMercure#sync — цикл `for (const
    // e of pending)`), runnerAnim.visualPositions, прочитанный через замыкание
    // ЭТОГО компонента, ещё не отражал landing, случившийся МГНОВЕНИЕ назад в
    // ТОМ ЖЕ проходе — эффект видел устаревший снимок. onStart вызывается
    // СИНХРОННО изнутри самого runnerAnim.trigger() (после фикса
    // useRunnerAnimations.js — мердж-ветка раньше вообще не звала onStart,
    // только advanceQueue), поэтому гонки с батчингом React тут нет вообще —
    // передаётся ниже, в triggerWithSound, объединённый с deathOnStart.
    //
    // activatedCellKeysRef — ВТОРАЯ часть того же фикса, обязательная для
    // самого частого случая (один хоп, не каскад — например обычная ходьба
    // на danger или мина-Мяч): порядок событий там — landing-triggger
    // (runner_save, мгновенный мердж → onStart УЖЕ синхронно сработал) идёт
    // РАНЬШЕ game_cell_updated (реального вскрытия) — то есть заморозка
    // была бы создана уже ПОСЛЕ того, как release для неё уже (безрезультатно)
    // сработал. Этот ref синхронно помечает "позиция уже реально
    // активирована" в момент onStart — при вскрытии клетки, если её позиция
    // уже тут отмечена, замораживать вообще не нужно (анимация и так либо
    // уже играет, либо стартует в этом же кадре). Для каскадов (хоп2/3)
    // порядок обратный — их trigger() в момент вскрытия ЕЩЁ НЕ активирован
    // (стоит в очереди позади хопа1), activatedCellKeysRef на тот момент
    // пуст для этой позиции — заморозка создаётся как обычно, и снимается
    // позже, когда очередь до него реально дойдёт и onStart сработает.
    const activatedCellKeysRef = useRef(new Set());
    const releaseHeldCellOnStart = useCallback((toPosition) => {
        const key = cellKeyFromPosition(toPosition);
        if (!key) return undefined;
        return () => {
            activatedCellKeysRef.current.add(key);
            setHeldCells((prev) => {
                if (!(key in prev)) return prev;
                const next = { ...prev };
                delete next[key];
                return next;
            });
        };
    }, []);
    // gameRef — актуальный game НА МОМЕНТ транзиентного события (нужен
    // handleSequenceItem внутри onTransient, см. lib/runnerAnimTriggers —
    // reduce() получает свежий state параметром, а onTransient — нет).
    // Обычный `game` из замыкания тут не годится — onTransient коллбэк не должен
    // пересоздаваться на каждый рендер (иначе useMercure видел бы это как
    // повод переподключаться, см. его cb-ref).
    const gameRef = useRef(null);
    useEffect(() => {
        gameRef.current = game;
    });

    // 2026-10-16 — звуковой блок (6 переиспользуемых плееров + синхронизация
    // громкости) вынесен в hooks/useGameAudio.js, см. его докстринг за полным
    // разбором (moveSound/musicSound/eventLogToggleSound сознательно НЕ туда
    // — завязаны на свою отдельную логику в других местах этого файла).
    // audioSettings остаётся тут — нужен ещё нескольким другим плеерам ниже.
    const audioSettings = useAudioSettings();
    const { voiceSound, shootSound, startSound, collisionSound, commentSound, sfxSound } = useGameAudio(audioSettings);
    // Считает ОДНОВРЕМЕННО активные пары столкновений (на доске теоретически
    // может быть больше одной сразу) — collisionSound останавливаем, только
    // когда ПОСЛЕДНЯЯ пара реально разошлась, не раньше.
    const activeCollisionPosesRef = useRef(0);
    // "start"-комментарий должен прозвучать РОВНО один раз за всю партию.
    // Единственный реально работающий путь — mount-эффект на `justStarted`
    // ниже (см. его комментарий) — событие `player_roll_move_dice`, на
    // которое раньше рассчитывал ЭТОТ реф в reduceAndLog, на бэке НЕ
    // СУЩЕСТВУЕТ И НИКОГДА НЕ СУЩЕСТВОВАЛО (проверено grep'ом по всему
    // бэку, 2026-09-26) — тот код был мёртвым, убран при переходе на
    // бандлинг событий (2026-09-27, см. reduceAndLog).
    const gameStartSoundPlayedRef = useRef(false);
    // Звук финала (victory/lost, 2026-10-14/2026-10-15) — тот же приём
    // "сыграть РОВНО один раз", что у gameStartSoundPlayedRef выше, общий
    // гейт на ОБА звука (локальный зритель слышит либо один, либо другой,
    // никогда оба) — см. эффект рядом с hasDeathAnimPlaying.
    const gameFinishSoundPlayedRef = useRef(false);
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

    // Voice-реплика бегуна — ОТЛОЖЕНА до момента, когда его собственная поза
    // РЕАЛЬНО начинает играть ('start'/'move', через onStart в
    // triggerWithSound ниже), а не до момента появления доступных клеток
    // (2026-10-12, по прямому запросу пользователя — "звук должен играть в
    // момент анимации старта, а не когда появились клетки хода"; раньше это
    // звучало сразу по смене player.step на MOVE, см. комментарий на месте
    // старой записи ниже). { [runnerId]: soundSource } — звук УЖЕ выбран
    // (pickActiveSoundSource) в момент постановки в очередь, не в момент
    // проигрывания — статус бегуна на момент выбора реплики (damaged-вариант)
    // не должен зависеть от того, сколько времени реплика прождала своей
    // очереди.
    const pendingVoiceLineRef = useRef({});

    // Оборачивает runnerAnim.trigger — сам визуальный триггер не трогаем
    // (lib/runnerAnimTriggers.js ничего не знает о звуке), тут ТОЛЬКО решаем,
    // что доп. проиграть по kind. Тип бегуна для 'attack' ищем в текущем
    // game.runners (бегун уже существует, просто стреляет) — для 'start' он
    // может быть свежесозданным (Мяч) и его ещё нет в game.runners, поэтому
    // предпочитаем extra.runnerType, если он есть (см. runnerAnimTriggers.js
    // — прокинут явно именно для этого случая).
    //
    // 2026-09-15: был заход с гейтингом (ждать decode КОНКРЕТНОГО ассета
    // перед вызовом runnerAnim.trigger, вместо мгновенного вызова +
    // маскирующего кроссфейда в RunnerToken.js) — ОТКАЧЕН ЦЕЛИКОМ по двум
    // живым жалобам подряд: (1) "дёргания" (гейт добавляет РЕАЛЬНУЮ, а не
    // маскируемую задержку — на быстром/локальном бэке сетевой round-trip
    // почти никогда не длиннее decode, так что "параллельно с сетью"
    // практически не работает, и получается просто нестабильная пауза перед
    // КАЖДЫМ переключением вместо мгновенного показа); (2) при попадании на
    // anomaly бегуна корректно провело 'fly', затем ТЕЛЕПОРТИРОВАЛО ОБРАТНО
    // на клетку аномалии и заново проиграло уже 'move' — серийная цепочка
    // fire()-вызовов на runnerId (нужна была, чтобы гейтинг не переставлял
    // местами шаги каскада) сама вносила рассинхрон в timing pending-мерджа
    // (см. useRunnerAnimations.js — "заготовка от anomaly держит kind
    // 'fly'", логика полагается на СИНХРОННЫЙ, предсказуемый порядок
    // trigger()-вызовов, который гейтинг как раз и нарушал). Если захочется
    // вернуться к этой идее — НЕ трогать порядок/тайминг вызовов
    // runnerAnim.trigger вообще, ограничиться ЧИСТЫМ прогревом decode без
    // блокировки. (Сам класс проблемы — Android decode-пауза при первом
    // показе редко используемого ассета — с переходом на единый спрайт-лист
    // на тип+статус+цвет, 2026-09-23, скорее всего снят структурно: весь лист
    // декодируется один раз при монтировании токена, а не по кадру/анимации
    // — точечный прогрев конкретного ассета типа reaperAttackPreloadSource
    // (был здесь, удалён при миграции) больше не нужен, но не проверено
    // живьём.)
    // 2026-10-15: `seq` (5-й параметр, опциональный) — причинный ключ
    // элемента bundle.sequence, чей эффект вызвал этот triggerWithSound (см.
    // useRunnerAnimations.js#onceSeqDone/bundleCounterRef ниже) — просто
    // прокидывается в runnerAnim.trigger, сама функция его не читает.
    // Локальные вызовы ВНЕ обработки bundle.sequence (превью Жнеца при
    // размещении и т.п.) зовут без 5-го аргумента — undefined не участвует
    // в причинном учёте.
    const triggerWithSound = useCallback(
        (runnerId, kind, extra, seq, opts) => {
            // Подавляем ТОЛЬКО визуальный триггер (дублирующий walk-цикл) —
            // звук "прилёта" (drone_start.wav) всё равно проигрываем: во
            // время локального превью никакого звука не было (превью чисто
            // визуальное), так что размещавший игрок иначе вообще не
            // услышал бы этот эффект.
            const suppressAnim = kind === 'start' && Date.now() < reaperStartSkipUntilRef.current;
            // Гейт для GameFinishModal (см. hasDeathAnimPlaying/
            // pendingDeathRunnerIds выше) — как только терминальная поза
            // (acid/burn/destroyed) РЕАЛЬНО начинает играть (не когда её
            // только поставили в очередь, см. useRunnerAnimations), снимаем
            // runnerId из pendingDeathRunnerIds — дальше hasDeathAnimPlaying
            // отражает её через runnerAnim.anims сам. 2026-10-15: раньше было
            // ТОЛЬКО acid/burn (обычная 'destroyed' вообще не гейтилась —
            // диалог мог перекрыть её на лету) и снималось МГНОВЕННО вместе
            // со стартом голосового комментария (deathCommentOnStart ниже,
            // та же combinedOnStart) — диалог мог появиться, пока комментарий
            // ещё играет. Теперь: 'destroyed' тоже гейтит, и снятие отложено
            // на DEATH_FINISH_GATE_SETTLE_MS сверх старта позы — запас на
            // комментарий.
            const deathOnStart = (kind === 'acid' || kind === 'burn' || kind === 'destroyed')
                ? () => {
                    setTimeout(() => {
                        setPendingDeathRunnerIds((prev) => {
                            if (!prev.has(runnerId)) return prev;
                            const next = new Set(prev);
                            next.delete(runnerId);
                            return next;
                        });
                    }, DEATH_FINISH_GATE_SETTLE_MS);
                }
                : undefined;
            // Снятие заморозки клетки (см. heldCells/releaseHeldCellOnStart
            // выше) — для ЛЮБОГО kind с toPosition, не только acid/burn.
            const cellReleaseOnStart = extra?.toPosition ? releaseHeldCellOnStart(extra.toPosition) : undefined;
            // Взрыв мины (2026-09-25, см. pendingMineCellIdsRef выше) — тот
            // же приём: если этот toPosition сейчас числится "ждём взрыва",
            // запускаем его РОВНО когда шаг РЕАЛЬНО начинает играть, не
            // раньше. cellKeyFromPosition — тот же формат id, что и у
            // game_cell_updated-ветки reduceAndLog (см. там).
            const mineCellKey = extra?.toPosition ? cellKeyFromPosition(extra.toPosition) : null;
            const mineOnStart = mineCellKey && pendingMineCellIdsRef.current.has(mineCellKey)
                ? () => {
                    if (pendingMineCellIdsRef.current.delete(mineCellKey)) {
                        mineBlasts.trigger(mineCellKey);
                        playOneShot(sfxSound, LAND_MINE_SOUND);
                    }
                }
                : undefined;
            // Звук-комментарий смерти (2026-09-25, живая жалоба пользователя:
            // "звук смерти проигрывается в самом начале хода, а не тогда,
            // когда по факту проигрывается анимация смерти") — раньше играл
            // ПРЯМО ЗДЕСЬ, синхронно с этим вызовом triggerWithSound (т.е. в
            // момент, когда шаг только ставится в очередь useRunnerAnimations,
            // см. trigger() там) — если у бегуна уже что-то играло (каскад
            // отброс→... →destroyed), реальная терминальная поза стартовала
            // позже, а звук уже прозвучал. Тот же случай, что уже решён для
            // pendingDeathRunnerIds чуть выше (deathOnStart) — переносим и
            // звук на ТОТ ЖЕ `onStart`, единственный в проекте сигнал "этот
            // шаг РЕАЛЬНО начал играть" (advanceQueue в useRunnerAnimations.js
            // зовёт onStart ровно в момент, когда terminal-поза становится
            // активной). НЕ трогал collision/anomalyHole/ricochet/miss —
            // те синхронны с событием НАМЕРЕННО (см. collisionCommentPlayedRef
            // ниже, фикс 2026-09-20 — синхронизация с позой там раньше давала
            // обратный порядок звуков).
            // opts.suppressDeathComment (2026-10-16) — сдвиг фрагмента может
            // уничтожить СРАЗУ нескольких бегунов одним причинным событием
            // (reason:'track_shift', см. reduceAndLog#isParallelTrackShiftDeath) —
            // это одна одновременная потеря, а не N отдельных смертей, и
            // комментатор должен озвучить её ОДИН раз, а не на каждого.
            // Вызывающий код (reduceAndLog) помечает ВСЕ, кроме первого,
            // сиблинга такой группы — сама 'destroyed'-анимация и прочие
            // onStart-эффекты (снятие заморозки клетки и т.п.) не трогаются.
            const deathCommentOnStart = (kind === 'destroyed' || kind === 'acid' || kind === 'burn') && !opts?.suppressDeathComment
                ? () => playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.destroyed))
                : undefined;
            // Фоновый эффект гибели на acid-клетке (2026-10-14, по прямому
            // запросу пользователя) — синхронно с deathCommentOnStart выше.
            // 2026-10-15, живой тест: изначально был заведён и на 'burn' тоже
            // — живая проверка показала, что звук радиации на огне неуместен
            // (это звук именно кислотного/радиоактивного поражения), убран.
            const radiationOnStart = kind === 'acid'
                ? () => playOneShot(sfxSound, RADIATION_SOUND)
                : undefined;
            // Voice-реплика бегуна (см. pendingVoiceLineRef выше) — поставлена
            // в очередь, когда для него появились клетки хода (reduceAndLog),
            // проигрывается ТОЛЬКО тут, когда его СОБСТВЕННАЯ поза (первый
            // выход из резерва — 'start', обычный ход — 'move') реально
            // начинает играть. 'wait'/'fly'/прочие служебные kind её не
            // потребляют (она ждёт следующего подходящего). once — достаём и
            // сразу чистим, чтобы повторные накаты тем же бегуном в ЭТОМ же
            // ходу не переигрывали реплику заново.
            const queuedVoiceLine = (kind === 'start' || kind === 'move') ? pendingVoiceLineRef.current[runnerId] : null;
            const voiceLineOnStart = queuedVoiceLine
                ? () => {
                    delete pendingVoiceLineRef.current[runnerId];
                    playOneShot(voiceSound, queuedVoiceLine);
                }
                : undefined;
            const combinedOnStart = (deathOnStart || cellReleaseOnStart || mineOnStart || deathCommentOnStart || radiationOnStart || voiceLineOnStart)
                ? () => { deathOnStart?.(); cellReleaseOnStart?.(); mineOnStart?.(); deathCommentOnStart?.(); radiationOnStart?.(); voiceLineOnStart?.(); }
                : undefined;
            if (suppressAnim) reaperStartSkipUntilRef.current = 0;
            else runnerAnim.trigger(runnerId, kind, combinedOnStart ? { ...extra, onStart: combinedOnStart } : extra, seq);
            if (kind === 'attack') {
                const type = gameRef.current?.runners?.find((r) => String(r.id) === String(runnerId))?.type;
                playOneShot(shootSound, pickShootSoundSource(type));
            } else if (kind === 'start' && !suppressAnim) {
                // !suppressAnim — та же граница, что и у визуального триггера
                // чуть выше: если это реальный 'start' Жнеца, для которого мы
                // УЖЕ показали локальное превью прилёта (см. handleCellPress —
                // размещение играет 'start' сразу, локально, свой звук — см.
                // reaperStartSkipUntilRef ниже), повторно звук проигрывать не
                // нужно, иначе он звучал бы дважды (2026-09-09, по прямому
                // запросу пользователя — звук раньше играл ТОЛЬКО здесь, уже
                // ПОСЛЕ подтверждения диалога, с заметной задержкой от
                // момента, когда токен реально начинал двигаться визуально).
                const type = extra?.runnerType ?? gameRef.current?.runners?.find((r) => String(r.id) === String(runnerId))?.type;
                playOneShot(startSound, pickStartSoundSource(type));
            }
            // 'destroyed'/'acid'/'burn' — см. deathCommentOnStart выше, звук
            // теперь играет через onStart, не здесь.
        },
        [runnerAnim.trigger, playOneShot, shootSound, startSound, voiceSound, commentSound, sfxSound, releaseHeldCellOnStart, mineBlasts.trigger],
    );

    // 2026-09-27 — бэк перешёл на бандлинг Mercure-событий одного игрового
    // действия в одно сообщение (`action_result` + `sequence`, см.
    // `1_pitch_for_backend_dev.md`/`2_backend_todo.md`/`3_frontend_todo.md` в
    // scratchpad сессии, где всё это обсуждалось и было реализовано
    // бэкендером). `reduceAndLog` теперь получает ОДИН бандл за раз (не одно
    // плоское событие) и разворачивает `bundle.sequence` в цикл, применяя
    // ВЕСЬ прежний per-event код к каждому элементу по очереди — то, что
    // раньше вызывалось один раз на одно событие, теперь просто делает то же
    // самое N раз подряд, для каждого шага одной цепочки (мина→коллизия→
    // кислота→смерть и т.п.), внутри ОДНОГО React-колбэка на ОДНО сетевое
    // сообщение. `bundle.sequence ?? [bundle]` — защитный фолбэк на случай
    // одиночного (не завёрнутого) события, не должен понадобиться при
    // реальной работе с бэком, но не даёт молча сломаться, если где-то
    // событие придёт по старинке, плоским.
    //
    // `pendingCollisionPair` — контекст ОДНОЙ цепочки (одного bundle), живёт
    // только внутри этого вызова: 'collision'-item запоминает участников
    // (`runnerId`/`otherRunnerId`, см. lib/runnerAnimTriggers.js#
    // handleSequenceItem за тем, зачем) для СЛЕДУЮЩЕГО в этой же цепочке
    // 'runner_save' с reason:'collision'.

    // Результат УЖЕ БРОШЕННОГО кубика столкновения — по прямому запросу
    // пользователя, 2026-09-10: баннер "Использовать/Перебросить" не
    // показывал, ЧТО именно произойдёт при "Использовать", решение
    // принималось вслепую. 2026-10-14: бэк унифицировал `CollisionEvent` —
    // несёт готовые `flyingRunnerId`/`stayingRunnerId`/`direction` (+`from`/
    // `to`/`resolution`/`decisionPlayerId`, из которых фронт пока использует
    // только `direction` и id участников) — храним их 1-в-1, без формулы
    // TOP/LOWER (история формулы — CLAUDE_DONE_TASKS.md, 2026-10-11/10-12).
    const [pendingCollisionRoll, setPendingCollisionRoll] = useState(null);
    // Восстановление из персистентного game.pendingCollision — см. эффект
    // ПОСЛЕ объявления `game` (useMercure ниже), а не тут: `game` ещё не
    // существует в этой точке скоупа (TDZ-краш "Cannot access 'game' before
    // initialization" на каждом рендере — живой баг, найден на вебе сразу
    // после добавления, 2026-10-12, не ловится статической сборкой бандла,
    // только реальным рендером компонента).
    // Одноразовый комментарий (collision_*.wav) — ЗАЩИТА от двойного/
    // запоздалого звука (звук должен звучать синхронно с транзиентом
    // 'collision', не ждать цикл рендера BoardGrid). `collisionCommentPlayedRef`
    // не даёт звуку повториться на КАЖДЫЙ ПЕРЕБРОС — сбрасывается вместе с
    // pendingCollisionRoll ниже, когда game.extraTurnPlayer возвращается в
    // null (коллизия ПОЛНОСТЬЮ разрешена).
    const collisionCommentPlayedRef = useRef(false);

    // Причинная очерёдность (см. докстринг reduceAndLog ниже и
    // useRunnerAnimations.js) — `e.seq` локален одному бандлу, этот счётчик
    // даёт каждому бандлу свой уникальный префикс ключа.
    const bundleCounterRef = useRef(0);

    // 2026-10-15, causedBy/seq-рефакторинг (по прямому запросу пользователя
    // — см. useRunnerAnimations.js за полным докстрингом механизма и README
    // бэка за контрактом `seq`/`causedBy`). Раньше ВСЕ side-effects одного
    // элемента цепочки (анимации/звуки/заморозка клетки/вскрытие мины)
    // запускались СИНХРОННО, прямо по ходу этого же цикла, в ПОРЯДКЕ МАССИВА
    // — что при каскадах иногда давало неверный визуальный порядок (3
    // repro-кейса, зафиксированные в CLAUDE.md: мина молчит, потому что
    // клетка уже помечена активированной более ранним шагом ТОЙ ЖЕ цепочки;
    // отброс цели выстрела Жнеца телепортируется во время анимации атаки;
    // звук "заруба" аномалии играет раньше, чем сосед реально сдвинулся).
    // Теперь: СТЕЙТ (`runnerGameReducer`) продолжает фолдиться СИНХРОННО и
    // БЕЗУСЛОВНО для КАЖДОГО элемента, как и раньше (игровая логика — чьи
    // сейчас легальные ходы, чей шаг — не должна ждать анимацию, см. правило
    // работы в CLAUDE.md про узкие правки) — а вот запуск АНИМАЦИЙ/ЗВУКОВ
    // этого элемента (runEffects ниже) откладывается до тех пор, пока не
    // доиграет анимация элемента-ПРИЧИНЫ (`e.causedBy`), если она ещё
    // играет — см. `runnerAnim.onceSeqDone`. Для большинства элементов
    // (`causedBy: null` — независимые/добровольные действия) это НЕ МЕНЯЕТ
    // поведение вообще: onceSeqDone зовёт callback СРАЗУ, синхронно, 1-в-1
    // как раньше — риск регрессии сосредоточен только в реальных каскадах.
    //
    // `bundleId` — `e.seq` ЛОКАЛЕН одному бандлу (нумерация с 0 в КАЖДОМ
    // бандле, см. README бэка) — составной ключ `${bundleId}:${seq}` даёт
    // глобальную уникальность, не путая seq=2 одного бандла с seq=2 другого.
    const reduceAndLog = useCallback(
        (state, bundle) => {
            let current = state;
            let pendingCollisionPair = null;
            // 2026-10-16, по прямому запросу пользователя: голосовой
            // комментарий выстрела (miss/ricochet) должен играть ПОСЛЕ самого
            // выстрела (позы 'attack' у стрелка), не одновременно с ним. Поза
            // стрелка триггерится НЕ самим 'attack'/'ricochet'-событием, а
            // более ранним 'step_shoot' в этом же бандле (см.
            // lib/runnerAnimTriggers.js) — ключ которого backend НЕ указывает
            // явно как causedBy у 'attack'/'ricochet' (оба идут с
            // causedBy=null, независимы по данным бэка). Тот же приём, что и
            // pendingCollisionPair ниже — синхронный снимок "последнего
            // виденного step_shoot" на момент КАЖДОЙ итерации, используется
            // ниже при показе комментария.
            let pendingShootKey = null;
            // 2026-10-16 — см. isParallelTrackShiftDeath/triggerForItem ниже:
            // один голосовой комментарий смерти на ВСЮ группу одновременных
            // track_shift-жертв одного бандла, не на каждую по отдельности.
            let trackShiftDeathCommentPlayed = false;
            const bundleId = ++bundleCounterRef.current;
            // 2026-10-15/16 — сериализация сиблингов одной причины (все
            // элементы бандла с одним и тем же causedBy ждут не только
            // прямого родителя, но и ДРУГ ДРУГА по порядку seq) — чинит
            // визуальный порядок в каскадах вроде "Мяч на danger-клетке"
            // (см. git-историю файла за полным разбором находки). Живой баг,
            // найденный ПОСЛЕ внедрения (тем же днём): отложенный `trigger()`
            // задерживает позу/звук/visualPositions конкретного шага, а
            // game-стейт при этом ВСЕГДА фолдится синхронно и безусловно
            // (осознанная архитектура — игровая логика не должна ждать
            // анимацию) — пока бегун ждёт своей очереди, BoardGrid для него
            // БЕЗ активной visualPositions падает на уже обновлённую РЕАЛЬНУЮ
            // позицию и сам доезжает туда через RunnerTokenSlide, в обход
            // очереди — токен долетал молча, поза/звук "догоняли" с
            // опозданием. Чинится НЕ откатом сериализации (та отдельно нужна
            // для порядка каскадов), а pin-сидированием ТЕКУЩЕЙ (ещё не
            // изменившейся) позиции — см. блок на `runner_save` ниже.
            const lastSiblingKeyByCause = new Map();
            for (const e of unwrapBundle(bundle, { gameId: bundle.gameId })) {
                pushLog(e);
                // SEQDBG — 2026-10-15, по прямому запросу пользователя (живая отладка
                // двух каскадных багов анимации, см. CLAUDE.md): человекочитаемый лог
                // (pushLog/describeEvent) не несёт seq/causedBy/reason — без них нельзя
                // отличить "бэк прислал не то" от "оркестратор неверно сопоставил
                // причинность". Печатаем явно, с bundleId (тот же составной ключ, что
                // уходит в markSeqScheduled/onceSeqDone ниже) — НЕ убирать до следующего
                // живого репро этих багов. `pos` — 2026-10-16, по живой жалобе на
                // "одновременное" перемещение двух бегунов при коллизии Мяча: без
                // позиции из САМОГО события приходилось гадать, какой SLIDEDBG-строке
                // (там тоже теперь есть runnerId, см. RunnerTokenSlide.js) какой шаг
                // бандла соответствует — e.runnerId для runner_save/runner_ball несёт
                // весь patch (см. lib/runnerAnimTriggers.js), у остальных событий
                // (danger/collision/...) это просто id, position тогда undefined.
                const pos = (e.runnerId && typeof e.runnerId === 'object')
                    ? ` pos=${e.runnerId.segment}:${e.runnerId.positionX}:${e.runnerId.positionY}`
                    : '';
                gameLog(`SEQDBG bundle=${bundleId} event=${e.event} seq=${e.seq} causedBy=${e.causedBy} reason=${e.reason} runnerId=${JSON.stringify(e.runnerId?.id ?? e.runnerId)}${pos}`);

                if (e.event === 'collision') {
                    // lib/runnerAnimTriggers.js#handleSequenceItem ждёт пару
                    // в старых именах runnerId/otherRunnerId — тут просто
                    // переводим новые явные поля бэка в эту форму. Остаётся
                    // СИНХРОННЫМ (не внутри runEffects) — следующий элемент
                    // цепочки читает эту переменную уже на СЛЕДУЮЩЕЙ итерации
                    // цикла, которая должна видеть самую свежую пару, даже
                    // если runEffects ЭТОГО элемента отложен.
                    pendingCollisionPair = { runnerId: e.flyingRunnerId, otherRunnerId: e.stayingRunnerId };
                }
                // 2026-10-16, живое репро (Мяч на danger-клетке, см.
                // useRunnerAnimations.js#seedVisualPosition за полным
                // разбором) — СИНХРОННО, не через runEffects (та же причина,
                // что у pendingCollisionPair выше: это должно попасть в
                // САМЫЙ ПЕРВЫЙ рендер после этого бандла, а не ждать своей
                // очереди в причинной цепочке). Мяч — единственный случай в
                // игре, когда совсем новый runnerId рождается И получает
                // финальную позицию в ОДНОМ бандле; у обычных бегунов такого
                // зазора нет (первый выход из резерва — БЕЗ анимации вообще,
                // см. архитектуру orientation/анимаций в CLAUDE.md).
                if (e.event === 'runner_ball' && e.runnerId) {
                    const patch = e.runnerId;
                    runnerAnim.seedVisualPosition(patch.id, {
                        segment: patch.segment, positionX: patch.positionX, positionY: patch.positionY,
                    });
                }
                // 2026-10-16, живая жалоба — "Игрок победил" мелькнула СРАЗУ
                // (до того, как доиграла цепочка анимаций гибели), потом
                // пропала и появилась снова. Та же причина, что и у
                // остальных находок этого дня: `game.status` фолдится
                // синхронно и безусловно, а этот Set (gate для
                // GameFinishModal/звука victory-lost, см. hasDeathAnimPlaying
                // ниже) раньше выставлялся ВНУТРИ runEffects — которая сама
                // может быть отложена (сиблинг в каскаде). Модалка успевала
                // решить "смертей не играет" ДО того, как отложенный
                // runEffects вообще добирался до этой строки. Перенесено
                // СЮДА, в синхронную часть цикла — тот же приём, что и у
                // pendingCollisionPair/seedVisualPosition выше. Порядок
                // относительно handleSequenceItem (которая внутри runEffects
                // может синхронно позвать onStart) не нарушен — этот Set
                // пополняется СТРОГО до неё в любом случае, раньше или позже
                // (отложенной или нет).
                if (e.event === 'runner_destroy' && e.runnerId?.type !== RUNNER_TYPES.REAPER) {
                    setPendingDeathRunnerIds((prev) => new Set(prev).add(e.runnerId.id));
                }
                // 2026-10-16 — pin ТЕКУЩЕЙ (ещё не изменившейся) позиции для
                // runner_save, см. докстринг lastSiblingKeyByCause выше за
                // полным разбором бага, который это чинит. СИНХРОННО, читаем
                // `current` (ещё не nextState этого шага — фолд случится
                // ниже, ПОСЛЕ этого блока) — значит это точно позиция бегуна
                // ДО применения этого события. seedVisualPosition не
                // перезаписывает уже существующую запись — если у бегуна УЖЕ
                // идёт анимация, это no-op; срабатывает только когда очереди
                // нет вообще — именно та дыра, через которую реальный стейт
                // мог протечь раньше срока.
                // **Живой баг этой же правки, найден в ТОТ ЖЕ день**: пин
                // был безусловным для ЛЮБОГО runner_save — но при чистой
                // перенумерации сегмента (сдвиг фрагментов трассы, X/Y те
                // же, меняется только segment) `handleSequenceItem` НИЧЕГО
                // не триггерит (см. её докстринг — "не требует анимации",
                // return) — полагаясь, что BoardGrid сам возьмёт НОВЫЙ сегмент
                // из реального стейта напрямую. Безусловный пин запирал
                // бегуна на СТАРОМ сегменте навсегда — корректирующего
                // trigger() для этого случая никогда не приходит. Сузил
                // условие — пин ставится, ТОЛЬКО когда positionX/Y реально
                // меняются (настоящий ход, после которого trigger() точно
                // будет вызван) — чистая перенумерация сегмента эту ветку
                // больше не проходит, BoardGrid снова видит актуальный сегмент
                // сразу.
                if (e.event === 'runner_save' && e.runnerId) {
                    const patch = e.runnerId;
                    const prevRunner = current?.runners?.find((r) => String(r.id) === String(patch.id));
                    const realMove = prevRunner?.segment != null
                        && (prevRunner.positionX !== patch.positionX || prevRunner.positionY !== patch.positionY);
                    if (realMove) {
                        runnerAnim.seedVisualPosition(patch.id, {
                            segment: prevRunner.segment, positionX: prevRunner.positionX, positionY: prevRunner.positionY,
                        });
                    }
                }
                // Заморозка вскрываемой клетки (heldCells) — СИНХРОННО, та же
                // причина и тот же приём, что у seedVisualPosition/
                // pendingCollisionPair/pendingDeathRunnerIds выше (2026-10-16,
                // живая жалоба: каскад "Скаут на danger → Мяч → коллизия → Мяч
                // отброшен на клетку, которая САМА оказалась скрытой danger" —
                // клетка-приземление на миг снова стала "danger", хотя уже
                // честно показывала вскрытый тип (лужа/mud)). Раньше этот блок
                // стоял ВНУТРИ runEffects ниже — которая для НЕ первого элемента
                // цепочки (causedBy != null, ЛЮБОЕ вскрытие клетки каскадом,
                // не только эта конкретная) ОТКЛАДЫВАЕТСЯ до onceSeqDone, пока
                // реальный game-стейт (grid) уже обновился мгновенно и
                // синхронно (архитектурное правило проекта). За секунду-две
                // отставания доска успевала честно показать НОВЫЙ тип — а
                // запоздало выполнившийся runEffects замораживал её ОБРАТНО в
                // СТАРЫЙ (сняв oldRawType со `stateBeforeItem`, который к этому
                // моменту был уже устаревшим снимком) — ровно тот флик "новый
                // тип → снова danger → снова новый тип", что видел пользователь.
                // Читаем `current` (ещё НЕ пропатченный этим событием) —
                // гарантированно тот же "старый" тип, что и видела доска ДО
                // этого события, без риска устареть к моменту использования.
                // Guard на activatedCellKeysRef — как и раньше: если анимация
                // ДЛЯ ЭТОЙ ПОЗИЦИИ уже стартовала синхронно (однохоповый случай
                // без каскада, landing-triggger идёт раньше game_cell_updated),
                // замораживать незачем — релиз для неё уже состоялся бы
                // впустую. Release (`releaseHeldCellOnStart`) не трогали — он и
                // так уже срабатывает по факту реального onStart анимации,
                // независимо от того, когда была создана заморозка.
                if (e.event === 'game_cell_updated' && e.cell) {
                    const { segment, positionX, positionY } = e.cell;
                    const cellId = cellKey({ segment, positionX, positionY });
                    if (!activatedCellKeysRef.current.has(cellId)) {
                        const oldRawType = [current?.trackBegin, current?.trackMiddle, current?.trackEnd][segment]
                            ?.grid?.[positionX]?.[positionY] ?? null;
                        const oldType = resolveCellVisual(oldRawType);
                        setHeldCells((prev) => ({
                            ...prev,
                            [cellId]: { type: oldType, image: pickSegmentImage(oldType, cellId), baseImage: pickBaseImage(oldType, cellId) },
                        }));
                        setTimeout(() => {
                            setHeldCells((prev) => {
                                if (!(cellId in prev)) return prev;
                                const next = { ...prev };
                                delete next[cellId];
                                return next;
                            });
                        }, HELD_CELL_TIMEOUT_MS);
                    }
                }
                // Снимок ПАРЫ ИМЕННО сейчас — если в одном (крайне редком)
                // бандле случились бы ДВЕ коллизии подряд, а runEffects
                // первой был бы отложен дольше, чем успевает подойти вторая
                // (переписав pendingCollisionPair) — замыкание ниже всё
                // равно видит ПРАВИЛЬНУЮ, сделанную в момент ЭТОЙ итерации,
                // пару, а не ту, что подменил более поздний элемент цепочки.
                const collisionPairAtThisPoint = pendingCollisionPair;

                const stateBeforeItem = current; // снимок ДО этого шага — для runEffects, даже если он отложен
                const itemKey = `${bundleId}:${e.seq}`;
                // Снимок "последнего виденного step_shoot" ИМЕННО сейчас — та
                // же причина, что у collisionPairAtThisPoint выше. Обновляем
                // pendingShootKey ПОСЛЕ снимка — если ЭТО сам step_shoot, его
                // комментарий (если вдруг у step_shoot будет свой) видит
                // предыдущий выстрел, не себя, но step_shoot комментарий не
                // читает вообще, так что это не имеет практического значения.
                const shootKeyAtThisPoint = pendingShootKey;
                if (e.event === 'step_shoot') pendingShootKey = itemKey;
                // 2026-10-16 — сдвиг фрагмента трассы может уничтожить СРАЗУ
                // несколько бегунов одним причинным событием: все они делят
                // один и тот же causedBy (сам сдвиг), но это НЕ цепочка "один
                // ждёт другого" — это N независимых ОДНОВРЕМЕННЫХ потерь.
                // Обычная сиблинг-сериализация ниже (специально ждёт
                // предыдущего сиблинга — нужно для настоящих каскадов вроде
                // мины/коллизии/аномалии) тут заставляла их умирать по
                // очереди, а токен следующего в очереди даже не появлялся на
                // замороженном кадре фрагмента 1, пока не доходила его
                // очередь (см. useTrackShiftChoreography.js#trackShiftRunners
                // — рисует только тех, у кого уже есть visualPositions).
                // Признак — reason:'track_shift' на runner_destroy (бэковый
                // DestroyReason, не только у Жнеца, см. docstring выше) —
                // такие события ждут ТОЛЬКО прямого родителя (как первый
                // сиблинг группы) и сами НЕ становятся "последним сиблингом"
                // ни для кого — остальные (не-track_shift) сиблинги той же
                // причины продолжают цепляться друг за друга как раньше, этих
                // параллельных просто не видя. Специфично на этом reason —
                // больше ни один каскад так себя не ведёт.
                const isParallelTrackShiftDeath = e.event === 'runner_destroy' && e.reason === 'track_shift';
                // См. lastSiblingKeyByCause выше — первый сиблинг причины ждёт
                // САМУ причину, каждый следующий — предыдущего сиблинга (по
                // порядку seq). Регистрация (set) — СРАЗУ, не после runEffects.
                const causeKey = e.causedBy == null
                    ? null
                    : isParallelTrackShiftDeath
                        ? `${bundleId}:${e.causedBy}`
                        : (lastSiblingKeyByCause.get(e.causedBy) ?? `${bundleId}:${e.causedBy}`);
                if (e.causedBy != null && !isParallelTrackShiftDeath) lastSiblingKeyByCause.set(e.causedBy, itemKey);
                runnerAnim.markSeqScheduled(itemKey);
                // Один голосовой комментарий на ВСЮ группу одновременных
                // track_shift-смертей (см. deathCommentOnStart#suppressDeathComment
                // в triggerWithSound) — первый сиблинг группы играет его,
                // остальные — подавляют. trackShiftDeathCommentPlayed живёт
                // ВНЕ цикла (объявлена при входе в reduceAndLog, см. выше),
                // одна на весь бандл.
                const triggerForItem = (runnerId, kind, extra) => {
                    if (isParallelTrackShiftDeath && kind === 'destroyed') {
                        const suppress = trackShiftDeathCommentPlayed;
                        trackShiftDeathCommentPlayed = true;
                        return triggerWithSound(runnerId, kind, extra, itemKey, { suppressDeathComment: suppress });
                    }
                    return triggerWithSound(runnerId, kind, extra, itemKey);
                };

                const runEffects = () => {
                    // pendingDeathRunnerIds — теперь пополняется СИНХРОННО,
                    // выше в этом же цикле (см. докстринг там за разбором
                    // живого бага "модалка победы мелькает раньше времени"),
                    // не здесь.
                    handleSequenceItem(stateBeforeItem, e, triggerForItem, {
                        onceStepDone: runnerAnim.onceStepDone,
                        completeWaitStep: runnerAnim.completeWaitStep,
                        collisionPair: collisionPairAtThisPoint,
                    });
                    // Лечение возвращает бегуна к healthy — триггерим 'heal'-
                    // анимацию (проигрывается МЕЖДУ damaged_idle и healthy_idle).
                    if (e.event === 'ability_heal' && e.runner?.id != null) {
                        triggerForItem(e.runner.id, 'heal', {});
                    }
                    // 'ghost_consumed' — версионное, несёт runnerId/otherRunnerId
                    // явно (см. lib/ghostPairs.js#identifyGhostConsumption).
                    const ghostPass = identifyGhostConsumption(stateBeforeItem, e);
                    if (ghostPass) ghostPairs.record(ghostPass.key);
                    // Взрыв мины — см. pendingMineCellIdsRef выше. Заморозка
                    // клетки (heldCells) ПЕРЕЕХАЛА в синхронную часть цикла
                    // (см. её докстринг там, 2026-10-16, за разбором живого
                    // бага) — тут остался только звук/визуал взрыва, этой
                    // части переезд не касался (она и так уже корректно
                    // привязана к activatedCellKeysRef на момент СВОЕГО
                    // исполнения, тут нет гонки "старого снимка").
                    if (e.event === 'game_cell_updated' && e.cell) {
                        // 2026-10-14: бэк переименовал row/column → positionX/positionY (унификация Cell).
                        const { segment, positionX, positionY } = e.cell;
                        const cellId = cellKey({ segment, positionX, positionY });
                        // См. minePendingRef ниже — если непосредственно
                        // ПЕРЕД этим вскрытием (в ЭТОЙ ЖЕ цепочке, тем же
                        // runEffects-порядком с учётом causedBy) пришёл
                        // транзиент danger==='mine', именно ЭТА клетка и
                        // есть место взрыва. 2026-10-15: с причинной
                        // развязкой это вскрытие теперь ВСЕГДА ждёт, пока
                        // доиграет анимация приземления (её causedBy-цепочка
                        // восходит к этому же действию) — activatedCellKeysRef
                        // практически всегда УЖЕ содержит cellId к этому
                        // моменту (бегун успел доехать), так что "тихая"
                        // ветка ниже стала ОСНОВНЫМ путём, не запасным —
                        // звук обязателен и в ней (раньше его тут не было —
                        // реальный баг, найденный живьём 2026-10-15,
                        // см. CLAUDE.md).
                        if (minePendingRef.current) {
                            minePendingRef.current = false;
                            if (activatedCellKeysRef.current.has(cellId)) {
                                mineBlasts.trigger(cellId);
                                playOneShot(sfxSound, LAND_MINE_SOUND);
                            } else {
                                pendingMineCellIdsRef.current.add(cellId);
                                setTimeout(() => {
                                    if (pendingMineCellIdsRef.current.delete(cellId)) mineBlasts.trigger(cellId);
                                }, MINE_TRIGGER_SAFETY_TIMEOUT_MS);
                            }
                        }
                    }
                    // Транзиентные, не про анимацию — те же side-effects, что
                    // раньше жили в отдельном onTransient (звук/баннер),
                    // теперь тут же, по ходу той же единой цепочки.
                    if (e.event === 'danger' && e.danger === 'mine') {
                        minePendingRef.current = true;
                    }
                    if (e.event === 'collision') {
                        setPendingCollisionRoll({
                            flyingRunnerId: e.flyingRunnerId,
                            stayingRunnerId: e.stayingRunnerId,
                            direction: e.direction,
                        });
                        if (!collisionCommentPlayedRef.current) {
                            collisionCommentPlayedRef.current = true;
                            playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.collision));
                        }
                    }
                    if (e.event === 'anomaly') {
                        playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.anomalyHole));
                    }
                    if (e.event === 'ricochet') {
                        // 2026-10-16, по прямому запросу пользователя —
                        // "сначала выстрел, потом звук комментария": сам
                        // 'ricochet'/'attack' приходит с causedBy=null (не
                        // зависит от 'step_shoot' по данным бэка), поэтому
                        // стандартный causeKey тут не помогает — ждём явно
                        // захваченный ключ выстрела (shootKeyAtThisPoint, см.
                        // снимок выше). Нет выстрела в этом бандле (не должно
                        // случаться для ricochet/attack, но на всякий случай,
                        // fail-open) — играем сразу, как раньше.
                        const playRicochet = () => {
                            playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.ricochet));
                            playOneShot(sfxSound, pickRandom(RICOCHET_HIT_SOUNDS));
                            // 2026-10-17, по прямому запросу пользователя —
                            // визуальный след пролетающей пули, та же точка
                            // триггера (и тот же тайминг), что уже звук выше.
                            ricochetTrails.trigger(e.from, e.to);
                        };
                        if (shootKeyAtThisPoint) runnerAnim.onceSeqDone(shootKeyAtThisPoint, playRicochet);
                        else playRicochet();
                    }
                    if (e.event === 'attack' && e.hit === false) {
                        const playMiss = () => playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.miss));
                        if (shootKeyAtThisPoint) runnerAnim.onceSeqDone(shootKeyAtThisPoint, playMiss);
                        else playMiss();
                    }
                    runnerAnim.settleSeqIfIdle(itemKey);
                };

                if (causeKey == null) runEffects();
                else runnerAnim.onceSeqDone(causeKey, runEffects);

                // Стейт — ВСЕГДА синхронно и безусловно, независимо от того,
                // отложен ли runEffects выше (см. докстринг reduceAndLog).
                const nextState = runnerGameReducer(current, e);
                // Игрок выбыл (player_out) — играет у ВСЕХ клиентов партии,
                // КРОМЕ случая, когда это выбывание ПОСЛЕДНЕГО соперника и
                // партия тут же завершилась победой оставшегося. Считаем
                // активных игроков ПОСЛЕ применения патча: если остался
                // РОВНО 1 — это терминальный случай, иначе игра продолжается,
                // звук нужен. НЕ отложено через runEffects — это диктуется
                // сменой СТЕЙТА (чей статус active/out), не каскадом
                // анимаций, пауза тут неуместна.
                if (e.event === 'player_out') {
                    const activeCount = (nextState.gamePlayers ?? []).filter((p) => p.status === PLAYER_STATUS.ACTIVE).length;
                    if (activeCount !== 1) playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.lost));
                }
                // Voice-реплика — ставится в очередь (pendingVoiceLineRef), как
                // только для бегуна РЕАЛЬНО появляются зелёные клетки хода (шаг
                // игрока становится MOVE). 2026-10-12 (по прямому запросу
                // пользователя): раньше звучала сразу в этот момент, ДО
                // фактической постановки/хода бегуна — при ПЕРВОМ выходе из
                // резерва (сам 'start' происходит ВНУТРИ последующего MOVE-
                // действия, runner.segment тут ещё null) это читалось как
                // "звук раньше анимации" → отложили до triggerWithSound#
                // voiceLineOnStart (играет на onStart реальной 'start'-позы).
                // 2026-10-15 (живой тест, уточнение пользователя): это
                // откладывание нужно ТОЛЬКО для первого выхода — на следующих
                // раундах бегун УЖЕ стоит на трассе (`runner.segment != null`
                // здесь, в момент самого перехода SELECT→MOVE, задолго до
                // следующего реального шага), и реплика должна звучать сразу
                // на подтверждении выбора, не ждать анимацию хода. Диффим
                // player.step ДО/ПОСЛЕ применения ЭТОГО шага цепочки. Для
                // ЛЮБОГО игрока — все клиенты партии слышат один и тот же
                // выбор (реплика выбирается тут же, на этом клиенте, детерминизм
                // между клиентами тут не нужен — это не игровой стейт). Тоже
                // НЕ отложено — завязано на смену player.step, а не на
                // причинную цепочку анимаций конкретного элемента.
                for (const player of nextState.gamePlayers ?? []) {
                    const prevPlayer = current.gamePlayers?.find((p) => p.id === player.id);
                    if (player.step === PLAYER_STEP.MOVE && prevPlayer?.step !== PLAYER_STEP.MOVE && player.activeRunner != null) {
                        const runner = nextState.runners?.find((r) => String(r.id) === String(player.activeRunner));
                        const source = runner ? pickActiveSoundSource(runner.type, runner.status) : null;
                        if (!source) continue;
                        if (runner.segment != null) {
                            // Уже на трассе — не первый выход, играем сразу.
                            playOneShot(voiceSound, source);
                        } else {
                            // Ещё в резерве — отложить до onStart самой 'start'-позы.
                            pendingVoiceLineRef.current[runner.id] = source;
                        }
                    }
                }

                current = nextState;
            }
            return current;
        },
        [
            pushLog, triggerWithSound, playOneShot, commentSound, sfxSound, mineBlasts.trigger,
            ricochetTrails.trigger,
            ghostPairs.record, runnerAnim.onceStepDone, runnerAnim.completeWaitStep,
            runnerAnim.markSeqScheduled, runnerAnim.settleSeqIfIdle, runnerAnim.onceSeqDone,
            runnerAnim.seedVisualPosition,
        ],
    );

    // 2026-09-27 — бэк-без-version бандл (чисто транзиентная цепочка, ни
    // один её шаг не менял персистентное состояние — например одиночный
    // промах выстрела без каскада) идёт сюда, а не в reduceAndLog (см.
    // useMercure.js#handleEvent — версия/её отсутствие смотрит на БАНДЛ
    // целиком). На практике почти всегда пусто — 'collision' и большинство
    // остальных транзиентов реально едут ВМЕСТЕ с версионным `game_turn_changed`
    // /`runner_save` в ОДНОМ бандле (значит бандл versioned, идёт в
    // reduceAndLog) — здесь тот же цикл по `bundle.sequence`, но БЕЗ фолда
    // в `runnerGameReducer` (нечего фолдить) и БЕЗ pairing-контекста для
    // коллизии (в version-less бандле её процессионного `runner_save` не
    // бывает по определению — см. докстринг reduceAndLog). `gameRef.current`
    // — единственный источник "текущего состояния" для чтения (нет `state`
    // параметра, в отличие от reduce()).
    const onTransient = useCallback(
        (bundle) => {
            const bundleId = ++bundleCounterRef.current;
            // См. pendingShootKey в reduceAndLog выше — тот же приём, и тут
            // он даже АКТУАЛЬНЕЕ: одиночный промах выстрела без каскада
            // (самый частый случай ricochet/miss) — это ИМЕННО version-less
            // бандл, см. докстринг этой функции чуть выше.
            let pendingShootKey = null;
            // См. lastSiblingKeyByCause в reduceAndLog выше за полным разбором —
            // тот же приём, тут же он нужен version-less бандлам. Pin-сидирование
            // текущей позиции (см. тот же докстринг) тут НЕ нужно — в этой ветке
            // нет фолда в runnerGameReducer (gameRef.current не продвигается
            // этой функцией), значит и гонки "стейт уже обновился, а trigger ещё
            // нет" тут физически не бывает.
            const lastSiblingKeyByCause = new Map();
            for (const e of unwrapBundle(bundle, { gameId: bundle.gameId })) {
                pushLog(e);
                // SEQDBG — см. тот же лог (и pos=) в reduceAndLog выше за объяснением.
                const pos = (e.runnerId && typeof e.runnerId === 'object')
                    ? ` pos=${e.runnerId.segment}:${e.runnerId.positionX}:${e.runnerId.positionY}`
                    : '';
                gameLog(`SEQDBG(transient) bundle=${bundleId} event=${e.event} seq=${e.seq} causedBy=${e.causedBy} reason=${e.reason} runnerId=${JSON.stringify(e.runnerId?.id ?? e.runnerId)}${pos}`);
                const itemKey = `${bundleId}:${e.seq}`;
                // Снимок "последнего виденного step_shoot" — см. тот же приём
                // в reduceAndLog выше за полным разбором.
                const shootKeyAtThisPoint = pendingShootKey;
                if (e.event === 'step_shoot') pendingShootKey = itemKey;
                const causeKey = e.causedBy != null
                    ? (lastSiblingKeyByCause.get(e.causedBy) ?? `${bundleId}:${e.causedBy}`)
                    : null;
                if (e.causedBy != null) lastSiblingKeyByCause.set(e.causedBy, itemKey);
                runnerAnim.markSeqScheduled(itemKey);
                const triggerForItem = (runnerId, kind, extra) => triggerWithSound(runnerId, kind, extra, itemKey);

                const runEffects = () => {
                    // gameRef.current — та же особенность, что и раньше (см.
                    // докстринг reduceAndLog/onTransient выше — version-less
                    // бандл не несёт `state`-параметр вообще, снимка нет).
                    handleSequenceItem(gameRef.current, e, triggerForItem, {});
                    if (e.event === 'danger' && e.danger === 'mine') {
                        minePendingRef.current = true;
                    }
                    if (e.event === 'collision') {
                        setPendingCollisionRoll({
                            flyingRunnerId: e.flyingRunnerId,
                            stayingRunnerId: e.stayingRunnerId,
                            direction: e.direction,
                        });
                        if (!collisionCommentPlayedRef.current) {
                            collisionCommentPlayedRef.current = true;
                            playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.collision));
                        }
                    }
                    if (e.event === 'anomaly') {
                        playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.anomalyHole));
                    }
                    if (e.event === 'ricochet') {
                        // См. тот же блок в reduceAndLog выше за объяснением.
                        const playRicochet = () => {
                            playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.ricochet));
                            playOneShot(sfxSound, pickRandom(RICOCHET_HIT_SOUNDS));
                            ricochetTrails.trigger(e.from, e.to);
                        };
                        if (shootKeyAtThisPoint) runnerAnim.onceSeqDone(shootKeyAtThisPoint, playRicochet);
                        else playRicochet();
                    }
                    if (e.event === 'attack' && e.hit === false) {
                        const playMiss = () => playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.miss));
                        if (shootKeyAtThisPoint) runnerAnim.onceSeqDone(shootKeyAtThisPoint, playMiss);
                        else playMiss();
                    }
                    runnerAnim.settleSeqIfIdle(itemKey);
                };

                if (causeKey == null) runEffects();
                else runnerAnim.onceSeqDone(causeKey, runEffects);
            }
        },
        [
            pushLog, triggerWithSound, playOneShot, commentSound, sfxSound, ricochetTrails.trigger,
            runnerAnim.markSeqScheduled, runnerAnim.settleSeqIfIdle, runnerAnim.onceSeqDone,
        ],
    );

    const { state: game, status, resync } = useMercure({
        topic: gameId ? `runner_game_${gameId}` : null,
        fetchSnapshot,
        reduce: reduceAndLog,
        onTransient,
    });

    // Восстановление pendingCollisionRoll из персистентного
    // game.pendingCollision (бэк, 2026-10-12, по нашему предложению —
    // `RunnerGameViewModel::buildPendingCollision()`, те же данные, что
    // несёт транзиент `collision`, но читаются из сохранённого
    // `RunnerGameMove`, см. README бэка "Ожидающее столкновение"). Раньше
    // это значение существовало ТОЛЬКО как транзиентное событие — клиент,
    // пропустивший его (реконнект/холодный старт экрана ПОСЛЕ того, как
    // коллизия уже началась), навсегда оставался без данных для диалога
    // ("Заруба! Жду результат…" бесконечно), хотя game.extraTurnPlayer уже
    // требовал решения. Guard `!pendingCollisionRoll` — не перезаписывает
    // значение, уже выставленное транзиентом в этом же тике (обычный живой
    // путь продолжает работать как раньше, этот эффект — только фолбэк).
    // 2026-10-14: `game.pendingCollision` — та же форма, что и live-
    // транзиент `collision` (`CollisionEvent::describe()` на бэке, один
    // конструктор на оба места) — `flyingRunnerId`/`stayingRunnerId` берутся
    // отсюда напрямую, без перевода из старых lowRunnerId/topRunnerId.
    // Должен идти ПОСЛЕ объявления `game` выше (см.
    // комментарий у pendingCollisionRoll за разбором TDZ-краша, который
    // раньше был на этом месте).
    useEffect(() => {
        if (pendingCollisionRoll || !game?.pendingCollision) return;
        const { flyingRunnerId, stayingRunnerId, direction } = game.pendingCollision;
        setPendingCollisionRoll({ flyingRunnerId, stayingRunnerId, direction });
    }, [game?.pendingCollision, pendingCollisionRoll]);

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
    // useWebCompactChrome — НОВЫЙ, ОТДЕЛЬНЫЙ флаг (2026-10-16, по прямому
    // запросу пользователя: компактная/портретная раскладка на вебе должна
    // выглядеть 1:1 как на Android). Специально НЕ правим useMobileNavButtons
    // (его смысл "родное мобильное приложение" и весь native-код, который на
    // него завязан, не тронуты ни единой строкой — пользователь явно выбрал
    // этот вариант вместо расширения существующего флага, чтобы изменения
    // для веба были отдельной, самостоятельной веткой, а не редефайном
    // общего условия, используемого ~15 раз по файлу). Используется ТОЛЬКО
    // там, где мобильный шов/рамка/ряд чисто ВИЗУАЛЬНЫ и не зависят от
    // platform-специфичного API (сам визуал там и так уже общий для обеих
    // платформ, см. PlayerInfoPanel.js#compactColumns) — такие места ниже
    // дополнены `(useMobileNavButtons || useWebCompactChrome)`, собственно
    // определение useMobileNavButtons выше не меняется.
    const useWebCompactChrome = isPortrait && Platform.OS === 'web';
    // navBtnSize (кнопки слева от дороги, не в mobileNav-случае) — половина
    // размера сегмента, посчитана в useBoardLayout вместе с самим сегментом
    // (там же учтена ширина, которую эта колонка отъедает у сетки — см.
    // computeRoadGeometry#reserveNavColumn), не дублируем расчёт здесь.
    // arrowBtnSize остаётся только для mobileNav-кнопок в seamRow — те
    // привязаны к толщине декоративной рамки, не к сегменту.

    // Финальная раскладка низа экрана на native-портрете (2026-10-01..10-10,
    // много итераций с пользователем, см. CLAUDE.md за полной историей —
    // финальная раскладка):
    // — на самой кайме рамки дороги: стрелки навигации ПО ЦЕНТРУ всей каймы
    //   (ширина каждой = 2×своей высоты, не квадратная), рамка PersonPanel;
    // — сразу под швом, одна строка: СЛЕВА 4 переключателя игрока (во всю
    //   высоту строки), СПРАВА — панель имени сверху (рамка FramePanel), под
    //   ней в ряд 5 квадратов: раунд/ход/бонус дороги (FramePanel) +
    //   настройки/лог (PersonPanel) — общая высота правого блока совпадает
    //   с высотой переключателей слева, имя по ширине — ровно как весь ряд
    //   из 5 квадратов под ним.
    // Финальное распределение стилей рамок (несколько раз менялось в
    // разговоре с пользователем, см. CLAUDE.md): имя+раунд/ход/бонус —
    // FramePanel ("как у аватарки бегуна"); навигация/настройки/лог —
    // PersonPanel ("как у панели хода"), но ТОНКАЯ версия через
    // targetCornerSize — PersonPanel.js теперь это умеет (добавлено
    // специально под этот случай, см. её докстринг), по умолчанию её
    // поведение в остальных местах (RunnerCard и т.д.) не изменилось.
    const seamNameH = Math.round(arrowBtnSize * 0.8);
    // navBoxH (кнопки навигации на кайме рамки дороги) — УБРАН 2026-10-15, по
    // прямому запросу пользователя: RoadNavButton переехали в строку под
    // швом (seamRow), где уже используется switchRowH — отдельный размер
    // для них больше не нужен.
    // roadFrameRoundSize — ВЫСОТА (не ширина — та считается ниже, от
    // измеренной ширины баннера хода) квадратов раунд/ход/бонус/настройки/
    // лога. switchRowH — общая высота строки (= высоте переключателей
    // слева, те получают её готовой как height-проп PlayerSwitchPanel).
    const roadFrameRoundSize = Math.round(arrowBtnSize * 0.95);
    const switchRowH = seamNameH + roadFrameRoundSize + spacing.xs;

    const { windowStart, backButtonProps, forwardButtonProps, jumpTo, jumpToStart, step: scrollStep } = useBoardScroll({ cols: viewportCols });

    // Свайп по дороге на Android (2026-10-01, продолжение сессии, прямой
    // запрос пользователя "не только по кнопкам") — ДОПОЛНЕНИЕ к кнопкам
    // навигации (RoadNavButton/useBoardScroll), не замена: кнопки никуда не
    // делись. Та же посегментная модель — свайп не тащит сетку визуально
    // (BoardGrid.js вообще не умеет плавно скроллить, см. её докстринг),
    // просто переводит дистанцию жеста в целое число вызовов `step()`, по
    // одному на каждый пройденный `segmentH` (один сегмент дороги = один шаг
    // кнопки).
    // **Живой баг, найден и починен на реальном эмуляторе**: первая версия
    // этого жеста была на core `PanResponder` (RN) — собралось чисто, но на
    // живом устройстве НЕ СРАБОТАЛО ВООБЩЕ (`adb shell input swipe`, обычная
    // кнопка рядом при этом штатно скроллила). Причина — `GestureHandlerRootView`
    // (обязателен в App.js, см. CLAUDE.md) меняет диспетчеризацию тачей на
    // Android, и legacy `PanResponder` ненадёжен внутри его дерева (известная
    // несовместимость RNGH/PanResponder). Весь остальной драг в проекте
    // (DiceDie.js) уже и так идёт через `Gesture.Pan()`/`GestureDetector` из
    // `react-native-gesture-handler` — свайп переведён на тот же путь, а не
    // изобретает отдельный.
    // **Живой фидбек на эмуляторе, второй заход**: 1) направление было
    // перевёрнуто относительно ожидания пользователя — исправлено (dy>0,
    // палец тянут ВНИЗ = dir+1, "дальше по треку"); 2) шаг на целый
    // `segmentH` ощущался вялым — порог шага уменьшен вдвое (`segmentH*0.5`).
    // **Третий заход — живой вопрос пользователя "почему скролл срабатывает
    // только при отпускании пальца?"**: первая версия звала `step()` ТОЛЬКО
    // в `onEnd` (вся дистанция одним пакетом после релиза) — по прямому
    // запросу пользователя переведено на `onUpdate`, шаги срабатывают ПРЯМО
    // во время движения пальца, как только пройден очередной порог
    // (`segmentH*0.5`), не дожидаясь отпускания. `swipeConsumedSteps`
    // (shared value, не React state — обновляется из воркета на UI-потоке,
    // без моста на каждый кадр) считает, сколько шагов УЖЕ списано с текущего
    // жеста; `onUpdate` сравнивает с текущим "положенным по дистанции" числом
    // шагов и списывает только РАЗНИЦУ (`newSteps`) — не весь `translationY`
    // заново, иначе на каждый кадр жеста шаг повторялся бы с нуля. `onStart`
    // обнуляет счётчик — новый жест считает с чистого листа. Скоростной бонус
    // в `onEnd` (была часть второго захода) убран — прогрессивный `onUpdate`
    // уже даёт мгновенный отклик по факту движения, скоростной бонус поверх
    // него рисковал задвоить шаги на резком флике (onUpdate уже списал бы их
    // по дистанции, onEnd добавил бы ещё).
    const handleBoardSwipeStep = useCallback(
        (dir, count) => {
            for (let i = 0; i < count; i++) scrollStep(dir);
        },
        [scrollStep],
    );
    const swipeConsumedSteps = useSharedValue(0);
    // activeOffsetY/failOffsetX — жест НЕ активируется на обычный тап по
    // клетке (см. onCellPress) или на горизонтальное движение, только на
    // заметное (>12dp) вертикальное — тот же порог, что был у снятого
    // PanResponder-варианта. `pan`-объект пересоздаётся каждый рендер (не
    // обёрнут в useRef/useMemo) — GestureDetector сам переподхватывает новый
    // объект, тот же приём, что в DiceDie.js, замыкание всегда видит
    // актуальный `segmentH`/`handleBoardSwipeStep`.
    const boardSwipeGesture = Gesture.Pan()
        .enabled(Platform.OS === 'android')
        .activeOffsetY([-12, 12])
        .failOffsetX([-20, 20])
        .onStart(() => {
            swipeConsumedSteps.value = 0;
        })
        .onUpdate((e) => {
            if (!segmentH) return;
            const unit = segmentH * 0.5;
            // Палец тянут ВНИЗ (translationY>0) = "дальше по треку" (тот же
            // dir=+1, что у кнопки "вверх"/forwardButtonProps) — по прямому
            // запросу пользователя, обратная сторона от первой интуитивной
            // попытки. `Math.trunc` (не round) — знаковое число шагов,
            // положенное по ТЕКУЩЕЙ суммарной дистанции жеста с его начала.
            const totalSteps = Math.trunc(e.translationY / unit);
            const newSteps = totalSteps - swipeConsumedSteps.value;
            if (newSteps === 0) return;
            swipeConsumedSteps.value = totalSteps;
            runOnJS(handleBoardSwipeStep)(newSteps > 0 ? 1 : -1, Math.abs(newSteps));
        });

    const runners = game?.runners ?? [];
    const gamePlayers = game?.gamePlayers ?? [];

    // **2026-09-30, по прямому запросу пользователя** — жетоны урона на
    // карточке (PlayerInfoPanel/RunnerCard) и спрайт бегуна на доске
    // (BoardGrid/RunnerToken) читают `runner.status` НАПРЯМУЮ из game-стейта,
    // который реducer обновляет мгновенно, синхронно с версионным событием —
    // раньше, чем успевает доиграть анимация, которую этот же статус
    // запустил (взрыв мины → gotShot; см. lib/runnerAnimTriggers.js#fromStatus).
    // Живая жалоба: "танк на danger сразу стал damaged, а не после взрыва и
    // got_shot". `displayRunners` — ОДНА подмена статуса на оба потребителя
    // (доска и панель читают её ОДИНАКОВО, не рассинхронизируются): пока у
    // бегуна активен шаг очереди со своим `fromStatus` (сейчас — только
    // 'gotShot'/'destroyed', см. триггеры), рендерится СТАРЫЙ статус; как
    // только шаг доигрывает и `anims[id]` очищается — `displayRunners`
    // автоматически возвращает живой (уже актуальный) статус, без доп.
    // таймеров/подписок. `runners` (без подмены) НЕ ТРОГАЕМ — вся игровая
    // ЛОГИКА (легальные ходы, activeRunner и т.п.) должна видеть РЕАЛЬНЫЙ
    // статус в любой момент, подмена нужна ТОЛЬКО для рендера. НЕ подтверждено
    // живьём.
    const displayRunners = useMemo(
        () => runners.map((r) => {
            const fromStatus = runnerAnim.anims[r.id]?.fromStatus;
            return fromStatus != null && fromStatus !== r.status ? { ...r, status: fromStatus } : r;
        }),
        [runners, runnerAnim.anims],
    );

    // 2026-10-16 — страховка, см. useRunnerAnimations.js#unhide за полным
    // разбором. Живая жалоба: бегун (Атлет) пропал со доски И с панели
    // (hiddenIds прячет RunnerToken ВЕЗДЕ, где он рисуется) после одного
    // урона+аномалии на мине — на другом клиенте того же бегуна видно, игра
    // его уничтоженным не считает. hiddenIds — чисто локальный флаг этого
    // клиента (не часть game-стейта), причина рассинхрона НЕ найдена (нужен
    // android-лог, см. CLAUDE.md) — чинится инвариант, не гипотетическая
    // причина: если `runners` говорит, что бегун не 'destroyed', а
    // hiddenIds всё равно его прячет — снимаем.
    useEffect(() => {
        if (runnerAnim.hiddenIds.size === 0) return;
        for (const id of runnerAnim.hiddenIds) {
            const real = runners.find((r) => String(r.id) === String(id));
            if (!real || real.status !== RUNNER_STATUS.DESTROYED) runnerAnim.unhide(id);
        }
    }, [runners, runnerAnim.hiddenIds, runnerAnim.unhide]);

    // Гейт первого показа активной доски — см. BOARD_READY_DELAY_MS выше.
    // Реального "событие size settled" тут нет, поэтому НЕ привязан к
    // смене `game`/версии — выставляется РОВНО один раз за жизнь этого
    // маунта экрана (реконнект/новые версии game НЕ должны снова прятать
    // уже показанный экран под спиннер).
    const [boardReady, setBoardReady] = useState(false);
    useEffect(() => {
        if (boardReady) return undefined;
        const t = setTimeout(() => setBoardReady(true), BOARD_READY_DELAY_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Реальный замер roadFrameWrap через onLayout НА САМОМ ФЛОУ-ЭЛЕМЕНТЕ
    // (не на абсолютном потомке) — см. "Известные грабли RN/Android" в
    // CLAUDE.md: "onLayout на абсолютно спозиционированном элементе внутри
    // родителя с AUTO-высотой на Android может стабильно вернуть 0"/
    // ошибочно схлопнуться. 2026-10-12, живой баг: GameDialogModal мерился
    // ЧЕРЕЗ roadContainerW/H (computed-значения, НЕ фактический размер
    // дороги — roadContainerW явно ИСКЛЮЧАЕТ labelStripW, см.
    // useBoardLayout.js#boardBudgetW) — карточка оказывалась уже всей
    // дороги и прижата влево, не по центру. Настоящий размер — только
    // через onLayout этого реального View.
    const [roadFrameSize, setRoadFrameSize] = useState(null);
    const handleRoadFrameLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setRoadFrameSize((prev) => (prev?.width === width && prev?.height === height ? prev : { width, height }));
    }, []);

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
    // Игровое меню (кнопка settings в seam-ряду, см. GameMenuButton/
    // GameMenuModal/GameSettingsModal, 2026-10-04) — было 2 уровня, оба
    // модальные, друг друга не перекрывают. 2026-10-15, по прямому запросу
    // пользователя — между меню и звуком вставлен хаб (GameSettingsHubModal,
    // "Игра"/"Звук"): "Настройки" теперь ведёт В ХАБ, а не сразу в звук;
    // "Звук" из хаба — тот же GameSettingsModal, что и раньше; "Игра" —
    // новый GameGeneralSettingsModal (пока только ориентация сворачиваемой
    // модалки, см. lib/dialogSettings.js). MainMenuScreen.js специально НЕ
    // тронут — у него своя отдельная кнопка "⚙️ Настройки", которая по-
    // прежнему ведёт сразу в звук (хаб не нужен вне партии, "Ориентация
    // диалога" вне игры ничего не настраивает).
    // 2026-10-16 — стейт+хендлеры этих 4 панелей вынесены в
    // hooks/useGameMenuModals.js, см. его докстринг. Деструктурируем под
    // ТЕ ЖЕ имена, что были тут раньше (handleOpenGameMenu и т.п.) — ни JSX,
    // ни остальной код этого файла трогать не пришлось.
    const {
        gameMenuOpen, openGameMenu: handleOpenGameMenu, closeGameMenu: handleCloseGameMenu,
        openSettingsFromMenu: handleOpenSettingsFromMenu,
        settingsHubOpen, closeSettingsHub: handleCloseSettingsHub,
        openSoundSettingsFromHub: handleOpenSoundSettingsFromHub,
        openGeneralSettingsFromHub: handleOpenGeneralSettingsFromHub,
        gameSettingsOpen, closeSettings: handleCloseSettings,
        gameGeneralSettingsOpen, closeGeneralSettings: handleCloseGeneralSettings,
    } = useGameMenuModals();
    // Лог событий в mobileNav-раскладке (зона 9) — кнопка + измеренная
    // позиция живут ЗДЕСЬ (не в EventLogPanel.js), список рисуется последним
    // ребёнком корня экрана — см. EventLogPanel.js за полным разбором (две
    // откаченные попытки) того, почему. eventLogAnchor — {right, bottom}
    // от соответствующих краёв окна, готовые для style; null, пока не
    // измерено (между тапом и результатом measureInWindow — доля секунды,
    // список просто не рисуется этот один кадр).
    const [eventLogOpen, setEventLogOpen] = useState(false);
    const [eventLogAnchor, setEventLogAnchor] = useState(null);
    const eventLogToggleRef = useRef(null);
    const eventLogToggleSound = useAudioPlayer(LOG_TOGGLE_SOUND);
    useEffect(() => {
        eventLogToggleSound.volume = audioSettings.action;
    }, [eventLogToggleSound, audioSettings.action]);
    const handleEventLogToggle = useCallback(() => {
        eventLogToggleSound.seekTo(0);
        eventLogToggleSound.play();
        setEventLogOpen((v) => {
            const next = !v;
            if (next) {
                eventLogToggleRef.current?.measureInWindow((x, y, w, h) => {
                    setEventLogAnchor({ right: windowDimensions.width - x - w, bottom: windowDimensions.height - y });
                });
            }
            return next;
        });
    }, [eventLogToggleSound, windowDimensions.width, windowDimensions.height]);

    // Раньше совпадало с ANIM_DURATION_MS.start обычных бегунов
    // (useRunnerAnimations, 2200мс) — пока идёт "прилёт" Жнеца ИЗ-ЗА КРАЯ
    // карты (см. reaperPreview ниже), выбор направления выстрела ещё не
    // показываем (по прямому запросу пользователя, 2026-09-07: сперва
    // красивое появление, ПОТОМ выбор направления, а не одновременно).
    // Удвоено, 2026-09-09, по прямому запросу пользователя ("двигается
    // очень быстро, продли анимацию... в два раза") — держим в паре с
    // REAPER_PREVIEW_SLIDE_MS в BoardGrid.js (тот же слайд, тоже ×2 от
    // обычного SLIDE_DURATION_MS): "готово"-состояние не должно наступать
    // раньше, чем сам токен визуально закончит въезжать. reaperPreviewReady
    // переключается ровно ОДИН раз на каждое новое размещение — эффект
    // зависит от самого объекта pendingReaperPlacement (новый объект на
    // каждый тап, см. handleCellPress), не от отдельного счётчика.
    const REAPER_PREVIEW_MS = 2200 * 2;
    const [reaperPreviewReady, setReaperPreviewReady] = useState(false);
    useEffect(() => {
        setReaperPreviewReady(false);
        if (!pendingReaperPlacement) return undefined;
        const t = setTimeout(() => setReaperPreviewReady(true), REAPER_PREVIEW_MS);
        return () => clearTimeout(t);
    }, [pendingReaperPlacement]);

    // Явное подтверждение размещения Жнеца — второй диалог (выбор выстрела)
    // открывается ТОЛЬКО после него, по прямому запросу пользователя,
    // 2026-10-11: раньше после "прилёта" (reaperPreviewReady) сразу
    // показывался диалог выстрела, без отдельного шага "подтверди
    // размещение / верни Жнеца в руку". Сбрасывается вместе с
    // reaperPreviewReady — тот же приём (зависимость от самого объекта
    // pendingReaperPlacement, новый объект на каждое размещение).
    const [reaperConfirmed, setReaperConfirmed] = useState(false);
    useEffect(() => {
        setReaperConfirmed(false);
    }, [pendingReaperPlacement]);

    // По умолчанию — свой игрок, как только придут данные. Один раз (пока не выбран вручную).
    // Ждём authLoading===false: иначе, если gamePlayers приходят раньше, чем догрузится user,
    // "себя" не находим и НАВСЕГДА фиксируем чужого gamePlayers[0] (см. CLAUDE.md TODO, 2026-09-28).
    useEffect(() => {
        if (activePlayerId != null || gamePlayers.length === 0 || authLoading) return;
        const me = gamePlayers.find((p) => p.user?.id === user?.id);
        setActivePlayerId(me?.id ?? gamePlayers[0].id);
    }, [gamePlayers, user, activePlayerId, authLoading]);

    const myPlayer = useMemo(() => gamePlayers.find((p) => p.user?.id === user?.id) ?? null, [gamePlayers, user]);
    const myTurn = !!myPlayer && game != null && String(game.playerOrder) === String(myPlayer.id);
    const myStep = myPlayer?.step;
    const myCollision = !!myPlayer && game?.extraTurnPlayer != null
        && String(game.extraTurnPlayer) === String(myPlayer.id);

    // 2026-09-18: POST /runner_game/start удалён на бэке — партия теперь
    // активируется СИНХРОННО с созданием, на самом бэке (см. api/
    // runnerGame.js). Автостарт-эффект и его retry-UI (были нужны, пока
    // клиенту приходилось самому "подтверждать готовность" на этом экране,
    // см. историю файла) больше не нужны — status:'active' приходит СРАЗУ
    // первым REST-снапшотом, отдельного шага тут не осталось.

    // 'start'-комментарий ("игра стартовала, кубики розданы") — раньше
    // триггерился событием `player_roll_move_dice` (или, как фолбэк,
    // наблюдением game.status WAITING→ACTIVE в ЭТОМ mount'е — см. историю
    // файла). Оба сигнала бэк убрал одновременно: событие удалено вместе с
    // /start (PlayerRollMoveDiceEvent, read-only коммит), а WAITING теперь
    // физически недостижим фронтом (GameFactory::create() активирует игру
    // ДО того, как хоть один клиент успевает подписаться на её топик — см.
    // комментарий в RunnerGameFactory::start() на бэке). Новый сигнал —
    // `justStarted` из route.params (см. LobbyScreen.js): явно проставляется
    // ТОЛЬКО когда переход на этот экран вызван свежесозданной из лобби
    // игрой, не резюмом уже идущей (MainMenuScreen его не передаёт) —
    // надёжнее и проще прежней гонки с REST-снапшотом.
    useEffect(() => {
        if (justStarted && game != null && !gameStartSoundPlayedRef.current) {
            gameStartSoundPlayedRef.current = true;
            playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.start));
        }
        // !!game (не сам game) — иначе эффект перезапускался бы на КАЖДОЕ
        // live-обновление стейта партии (новый объект на каждый reduce),
        // хотя фактически нужен только переход "снапшот ещё не пришёл" →
        // "пришёл", один раз за маунт экрана.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [justStarted, !!game, playOneShot, commentSound]);

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
            // runner.rollDice: null — накат ни разу не брался в этом раунде;
            // 0 — накат ТОЛЬКО ЧТО завершён (RunnerRollService::run() на бэке
            // обнуляет его после хода, НЕ в null) — оба случая ДОЛЖНЫ пускать
            // к следующему накату (если rollMoves ещё <2). Ненулевое значение —
            // накат выбран (SELECT), но МУВ ещё не сделан — вот тогда блокируем
            // повторный выбор. Раньше было `!= null`, что в JS считало 0
            // "не null" (0 != null → true) и НАВСЕГДА блокировало 2-й накат
            // сразу после первого — баг, пойманный живым тестом пользователя
            // 2026-09-09 (то же расхождение null/falsy, что уже не раз ловили
            // в этом проекте между PHP `!$x` и JS `x != null`).
            if (runner.rollDice || (runner.rollMoves ?? 0) >= 2) return false;
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

    // Тип бегуна, который реально отлетит при столкновении — бэк теперь
    // называет его явно (`flyingRunnerId`, см. CollisionEvent выше), старая
    // формула TOP/LOWER→runnerId/otherRunnerId (история в
    // CLAUDE_DONE_TASKS.md 2026-10-11/10-12) больше не нужна.
    const collisionFlyingRunnerLabel = useMemo(() => {
        if (!pendingCollisionRoll) return null;
        const runner = runners.find((r) => String(r.id) === String(pendingCollisionRoll.flyingRunnerId));
        if (!runner) return null;
        return RUNNER_DISPLAY[runner.type]?.label ?? runner.type;
    }, [runners, pendingCollisionRoll]);

    const players = useMemo(
        () =>
            gamePlayers.map((p, i) => ({
                id: p.id,
                name: p.user?.username ?? `Игрок ${p.id}`,
                // Цвет — с бэка (RunnerPlayer.color, случайно и без повторов
                // назначается при создании партии). Индекс — фолбэк на случай
                // партий, созданных до появления этого поля. 2026-10-14: бэк
                // сам переименовал слот green→purple — перевод имени
                // (BACKEND_TO_FRONTEND_PLAYER_COLOR) больше не нужен, см.
                // докстринг PLAYER_COLOR_HEX в GameConstants.js.
                color: PLAYER_COLOR_HEX[p.color] ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
                // colorKey — 2026-10-10, нужен PlayerSwitchPanel (переключатель
                // игроков, см. его докстринг): выбор нужного switch_on_<key>
                // ассета требует имени цвета ('red'/'blue'/'purple'/'yellow'),
                // а не уже готового hex, который несёт `color` выше. Фолбэк на
                // 'red', если цвет не распознан (партии до появления этого поля).
                colorKey: p.color ?? 'red',
                dice: [p.dice1, p.dice2, p.dice3, p.dice4],
                ability: p.ability,
                // step — 2026-09-20, нужен PlayerInfoPanel/RunnerCard, чтобы
                // показать индикатор бонуса хода на плитке РЕАЛЬНОГО игрока
                // (не обязательно "моего" — панель переключаемая, см.
                // roadBonusValue ниже).
                step: p.step,
                // 2026-10-14: бэк добавил счётчик ходов раунда — закрывает
                // заглушку "Ход"/"—" в reaperRow (PlayerInfoPanel.js).
                turnsTaken: p.turnsTaken ?? null,
                activeRunnerId: p.activeRunner ?? null,
                // displayRunners, не runners — см. её докстринг (жетоны урона
                // не должны мигать раньше анимации на доске).
                runners: displayRunners.filter((r) => r.playerId === p.id),
            })),
        [gamePlayers, displayRunners],
    );

    const playerColorById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.color])), [players]);

    // Чей сейчас ход — на экране раньше не было видно вообще (см. CLAUDE.md,
    // живой прогон). game.playerOrder хранит RunnerPlayer.id как строку.
    const currentTurnPlayer = useMemo(
        () => gamePlayers.find((p) => String(p.id) === String(game?.playerOrder)) ?? null,
        [gamePlayers, game?.playerOrder],
    );

    // 2026-10-16, по прямому запросу пользователя — "кольцо под активным
    // бегуном оппонента тоже" и "камера переключается на его бегуна при
    // выборе". ТОЛЬКО когда ходит НЕ я (иначе дублировало бы уже
    // существующий activeRunner/jump для собственного выбора выше/ниже) —
    // тот же приём, что у activeRunner (myPlayer.activeRunner), просто для
    // currentTurnPlayer вместо myPlayer.
    const opponentActiveRunner = useMemo(
        () => (currentTurnPlayer != null && myPlayer != null && String(currentTurnPlayer.id) !== String(myPlayer.id)
            && currentTurnPlayer.activeRunner != null)
            ? runners.find((r) => String(r.id) === String(currentTurnPlayer.activeRunner)) ?? null
            : null,
        [currentTurnPlayer, myPlayer, runners],
    );

    // Победитель столкновения (см. myCollision выше) — тот, чей бегун крупнее
    // (бэк выставляет extraTurnPlayer именно ему, независимо от того, с кем
    // столкновение — с другим игроком или с "мячом", см. RunnerType::getSize()
    // на бэке, read-only: TANK=3/ATHLETE=2/SPRINTER=1/BALL=1 — "мяч" никогда
    // структурно не может оказаться крупной стороной, так что extraTurnPlayer
    // в столкновении с ним всегда указывает на реального игрока). Показываем
    // его имя в баннере — по прямому запросу пользователя, чтобы было видно,
    // КТО именно получил выбор "использовать/перебросить", не только сам факт.
    const collisionWinnerPlayer = useMemo(
        () => players.find((p) => String(p.id) === String(game?.extraTurnPlayer)) ?? null,
        [players, game?.extraTurnPlayer],
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

    // 2026-10-16 — хореография сдвига фрагментов трассы (конечный автомат
    // settling→wiping→revealing) вынесена в hooks/useTrackShiftChoreography.js,
    // см. его докстринг (пункт "б" аудита — самое чувствительное место,
    // вынос чисто механический, имена возврата не менялись). Остальной код
    // этого файла (boardGridEl/highlightedCells/GameFinishModal-гейт/
    // turnBannerInner/камера — 15+ мест потребления) не тронут вообще.
    const {
        trackShiftPhase, trackShiftGridData, trackShiftRunners,
        trackShiftWipeColumnOpacityMap, trackShiftRevealColumnOpacityMap,
    } = useTrackShiftChoreography({
        game, rows, cols, runners, visualPositions: runnerAnim.visualPositions, jumpToStart,
    });

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
    // 2026-10-16 — тело этого useMemo (что сейчас можно тапнуть на доске)
    // вынесено в lib/board.js#computeHighlightedCells, см. её докстринг
    // (пункт "в" аудита — ОСТОРОЖНО, игровая логика, не косметика; вынос
    // чисто механический, порядок/содержимое веток не менялись).
    // 2026-10-17 — см. docstring у lib/board.js#computeHighlightedCells
    // (ветка MOVE) за полным разбором: пока у активного бегуна ещё играет
    // анимация ПРЕДЫДУЩЕГО хопа (runnerAnim.anims[id] не пуст — move/fly/
    // что угодно ещё для него), следующая клетка не подсвечивается, не
    // давая натыкать несколько реальных ходов подряд быстрее, чем успевает
    // доиграть слайд.
    const activeRunnerAnimating = activeRunner != null && runnerAnim.anims[activeRunner.id] != null;
    const { highlightedCells, tapMode } = useMemo(
        () => computeHighlightedCells({
            myTurn, myStep, activeRunner, busy, pendingAbility, runners, totalBlocks, game,
            pendingReaperPlacement, reaperPreviewReady, reaperConfirmed, trackShiftPhase,
            activeRunnerAnimating,
        }),
        [myTurn, myStep, activeRunner, busy, pendingAbility, runners, totalBlocks, game, pendingReaperPlacement, reaperPreviewReady, reaperConfirmed, trackShiftPhase, activeRunnerAnimating],
    );

    // Первый выход бегуна из резерва на трассу (tapMode==='start') —
    // подсвеченные клетки ВСЕГДА на segment=0/positionX=0 (globalCol=0), но
    // камера могла быть проскроллена куда угодно с прошлого хода — по
    // прямому запросу пользователя, 2026-09-13, автоматически подводим окно
    // прокрутки к началу трассы, как только это состояние наступает, чтобы
    // подсветку было видно сразу, без ручного скролла.
    //
    // **tapMode==='move' (2026-09-25, живая жалоба пользователя)** — "выбрал
    // танка на участке дороги, где он не в фокусе — телепорта к нему не
    // случилось". Та же логика: как только у активного игрока появляется
    // выбранный, уже стоящий НА трассе бегун (обычный, не первый ход) —
    // подводим камеру К НЕМУ, не к началу дороги. Раньше такого перехода не
    // было вообще — только 'start' (первый выход из резерва).
    //
    // **Живая регрессия (2026-09-25): "фокус бегуна в центре после КАЖДОГО
    // хода"** — прежний `selectionJumpedRef` сбрасывался в `else`-ветке
    // КАЖДЫЙ раз, когда `tapMode` временно уходил от 'move' (например на
    // время API-вызова между хопами многошагового наката — `busy`/другой шаг
    // на мгновение) — при возврате в 'move' для ТОГО ЖЕ бегуна это ошибочно
    // читалось как "новый выбор", и камера прыгала заново на каждый хоп.
    // Фикс — привязка не к самому tapMode, а к ЛИЧНОСТИ активного бегуна:
    // прыгаем ОДИН раз на конкретный `activeRunner.id`, а не на каждое
    // попадание в 'start'/'move'. Сбрасывается ТОЛЬКО когда `activeRunner`
    // реально меняется (другой бегун ИЛИ null — обычный SELECT-шаг между
    // ходами) — готово сработать заново при следующем, отдельном выборе.
    const lastActiveRunnerIdRef = useRef(undefined);
    const jumpedForSelectionRef = useRef(false);
    useEffect(() => {
        const currentId = activeRunner?.id ?? null;
        if (currentId !== lastActiveRunnerIdRef.current) {
            lastActiveRunnerIdRef.current = currentId;
            jumpedForSelectionRef.current = false;
        }
        if (jumpedForSelectionRef.current) return;
        if (tapMode === TAP_MODE.START) {
            jumpedForSelectionRef.current = true;
            jumpToStart(0);
        } else if (tapMode === TAP_MODE.MOVE && activeRunner?.segment != null) {
            jumpedForSelectionRef.current = true;
            jumpTo(activeRunner.segment * BOARD_LAYOUT.COLS + activeRunner.positionX);
        }
    }, [tapMode, activeRunner?.id, activeRunner?.segment, activeRunner?.positionX, jumpToStart, jumpTo]);

    // 2026-10-16, по прямому запросу пользователя — тот же приём, что и у
    // jumpedForSelectionRef выше, но для ХОДА ОППОНЕНТА (opponentActiveRunner,
    // см. её докстринг): прыгаем ОДИН раз на конкретного бегуна оппонента,
    // когда он выбирает — не на каждый ре-рендер/событие в течение ЕГО хода.
    const lastOpponentActiveRunnerIdRef = useRef(undefined);
    const jumpedForOpponentSelectionRef = useRef(false);
    useEffect(() => {
        const currentId = opponentActiveRunner?.id ?? null;
        if (currentId !== lastOpponentActiveRunnerIdRef.current) {
            lastOpponentActiveRunnerIdRef.current = currentId;
            jumpedForOpponentSelectionRef.current = false;
        }
        if (jumpedForOpponentSelectionRef.current) return;
        if (opponentActiveRunner?.segment != null) {
            jumpedForOpponentSelectionRef.current = true;
            jumpTo(opponentActiveRunner.segment * BOARD_LAYOUT.COLS + opponentActiveRunner.positionX);
        }
    }, [opponentActiveRunner?.id, opponentActiveRunner?.segment, opponentActiveRunner?.positionX, jumpTo]);

    // 2026-10-16, по прямому запросу пользователя — после того как ВСЕ
    // анимации (бегуны + сдвиг фрагментов трассы) доиграли, камера сама
    // возвращается на активного бегуна ТЕКУЩЕГО хода — своего ИЛИ
    // оппонента (см. activeRunner/opponentActiveRunner выше), в зависимости
    // от того, чей сейчас ход. Отслеживаем переход "что-то играло" →
    // "больше ничего не играет" (runnerAnim.anims пуст И
    // trackShiftPhase===null) через ref — прыгаем РОВНО в момент этого
    // перехода, не на каждый рендер в состоянии покоя (иначе дёргало бы
    // камеру постоянно, пока игрок сам листает доску вручную в простое).
    const wasAnimatingForFocusRef = useRef(false);
    useEffect(() => {
        const anyAnimPlaying = Object.keys(runnerAnim.anims).length > 0;
        const settled = !anyAnimPlaying && trackShiftPhase == null;
        if (!settled) {
            wasAnimatingForFocusRef.current = true;
            return;
        }
        if (!wasAnimatingForFocusRef.current) return;
        wasAnimatingForFocusRef.current = false;
        const isMyTurn = currentTurnPlayer != null && myPlayer != null && String(currentTurnPlayer.id) === String(myPlayer.id);
        const focusRunner = isMyTurn ? activeRunner : opponentActiveRunner;
        if (focusRunner?.segment != null) {
            jumpTo(focusRunner.segment * BOARD_LAYOUT.COLS + focusRunner.positionX);
        }
    }, [runnerAnim.anims, trackShiftPhase, currentTurnPlayer, myPlayer, activeRunner, opponentActiveRunner, jumpTo]);

    // Есть ли у Жнеца реальный выстрел ПРЯМО СЕЙЧАС (раунд>0 И подсвеченная
    // клетка реально нашлась, см. reaperShoot-ветку useMemo выше) — общий
    // источник истины для подсказки (stepInstruction) и для авто-подтверждения
    // "без выстрела" ниже, вынесен в отдельную переменную, чтобы не дублировать
    // выражение в двух местах.
    const canReaperShoot = tapMode === TAP_MODE.REAPER_SHOOT && highlightedCells.size > 0;

    // Звук шага СИНХРОННО с анимацией перемещения — по прямому запросу
    // пользователя, 2026-09-01: играет, пока у ХОТЬ ОДНОГО бегуна сейчас
    // проигрывается поза 'move' (см. hooks/useRunnerAnimations —
    // anims[runnerId].kind), останавливается и перематывается в начало, как
    // только ни у кого больше нет активной 'move'-позы. 2026-09-03: раньше
    // тут всегда был общий lazer.mp3 для ВСЕХ типов — теперь свой звук на
    // каждый тип (pickMoveSoundSource, см. lib/runnerSoundTriggers.js — для
    // Атлета/ATHLETE, у которого своего move.wav нет, функция сама вернёт
    // тот же lazer.mp3 как фолбэк). movingRunnerType — тип ПЕРВОГО найденного
    // бегуна с kind==='move' (на практике почти всегда ровно один — если
    // когда-нибудь окажется больше одного одновременно, играем звук только
    // за первого, не накладываем несколько циклов друг на друга).
    const movingRunnerType = useMemo(() => {
        const movingId = Object.entries(runnerAnim.anims).find(([, a]) => a?.kind === 'move')?.[0];
        if (movingId == null) return null;
        return runners.find((r) => String(r.id) === String(movingId))?.type ?? null;
    }, [runnerAnim.anims, runners]);
    // Гейт для GameFinishModal (см. рендер ниже) — по прямому запросу
    // пользователя, живой тест, 2026-09-12: если бегун гибнет на клетке wall
    // (терминальная поза burn/acid) РОВНО тем же ходом, что делает игрока
    // последним активным, диалог "Игрок X победил" не должен
    // перекрывать ещё не доигранную терминальную позу — тот же приём, что
    // уже гейтит модалку по trackShiftPhase (хореография сдвига фрагментов).
    // pendingDeathRunnerIds (см. его докстринг выше) — ЖИВАЯ жалоба,
    // 2026-09-12: без этого была гонка ("диалог мелькнул, потом анимация,
    // потом диалог снова появился") — anims отражает ТОЛЬКО уже играющий
    // шаг, а acid/burn мог ещё стоять в очереди позади предыдущего.
    // 2026-10-15: расширено на 'destroyed' — обычная (не terrain) гибель
    // раньше вообще не гейтилась тут (см. докстринг pendingDeathRunnerIds
    // add-сайта выше).
    const hasDeathAnimPlaying = useMemo(
        () => Object.values(runnerAnim.anims).some((a) => a?.kind === 'acid' || a?.kind === 'burn' || a?.kind === 'destroyed')
            || pendingDeathRunnerIds.size > 0,
        [runnerAnim.anims, pendingDeathRunnerIds],
    );
    // Страховка на случай, если hasDeathAnimPlaying/trackShiftPhase почему-то
    // НИКОГДА не снимутся сами — 2026-10-16, живая жалоба: партия
    // закончилась (game.status===FINISH подтверждён бэком), а GameFinishModal
    // не появилась НИ на Android, ни на вебе, сколько ни ждали. У каждого
    // другого "подожди анимацию" гейта в этом файле (heldCells/мины/pending-
    // заготовки) уже есть свой страховочный таймер на случай, если реальный
    // сигнал завершения почему-то не пришёл (устройство/сеть/редкая гонка,
    // которую не удалось стопроцентно локализовать без живого лога именно
    // этого момента) — у ЭТОГО гейта (pendingDeathRunnerIds/
    // hasDeathAnimPlaying) такой страховки не было вообще, единственного
    // способа "застрял — покажи модалку всё равно" не существовало. Партия
    // УЖЕ закончилась (это не отменяется), скрывать результат от игрока
    // дольше нескольких секунд неверно в любом случае, даже если гейт
    // когда-нибудь снялся бы сам. Таймер стартует, как только game.status
    // становится FINISH, и форсирует показ модалки через
    // FINISH_MODAL_SAFETY_MS, даже если гейты сами по себе ещё не снялись —
    // НЕ трогает сами pendingDeathRunnerIds/anims (не хочет обрывать чужую
    // анимацию сайд-эффектом), только снимает блокировку с ВИДИМОСТИ модалки.
    const [finishModalForced, setFinishModalForced] = useState(false);
    useEffect(() => {
        if (game?.status !== GAME_STATUS.FINISH) {
            setFinishModalForced(false);
            return undefined;
        }
        const timer = setTimeout(() => setFinishModalForced(true), FINISH_MODAL_SAFETY_MS);
        return () => clearTimeout(timer);
    }, [game?.status]);
    // Звук финала (victory/lost) — 2026-10-14 изначально победа играла сразу
    // по факту смены статуса игрока на 'winner', не дожидаясь самого диалога
    // (и без звука поражения вовсе). 2026-10-15, по прямому запросу
    // пользователя: ОБА звука должны звучать РОВНО в момент, когда реально
    // показывается GameFinishModal — т.е. после того, как доиграла терминальная
    // поза последнего погибшего бегуна (hasDeathAnimPlaying) и сдвиг трассы
    // (trackShiftPhase), та же пара условий, что и у самого `visible` модалки
    // ниже (см. рендер). `gameFinishSoundPlayedRef` — один и тот же "once"-
    // гейт на обе ветки (локальный зритель либо выиграл, либо нет — никогда
    // не оба сразу).
    useEffect(() => {
        if (!winnerPlayer || !myPlayer || gameFinishSoundPlayedRef.current) return;
        if (game?.status !== GAME_STATUS.FINISH) return;
        // finishModalForced — см. её докстринг выше: если страховка сработала
        // (гейты сами не снялись), звук тоже должен прозвучать СИНХРОННО с
        // модалкой (та же пара условий, что и у visible ниже), а не молчать
        // просто потому, что trackShiftPhase/hasDeathAnimPlaying технически
        // всё ещё true.
        if (!finishModalForced && (trackShiftPhase || hasDeathAnimPlaying)) return;
        gameFinishSoundPlayedRef.current = true;
        if (winnerPlayer.id === myPlayer.id) {
            playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.victory));
        } else {
            playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.lost));
        }
        // 2026-10-15: `game` ещё `null` на самом первом рендере (useMercure
        // отдаёт снимок асинхронно) — deps-массив ниже вычисляется СИНХРОННО
        // на КАЖДЫЙ рендер (хуки не могут быть условными), `game.status` без
        // `?.` ронял ВЕСЬ экран партии ровно в этот момент на РЕАЛЬНОМ
        // холодном заходе (не Fast Refresh) — живой краш, найден 2026-10-15
        // при повторном открытии активной партии после логина. `game?.status`
        // и тут, и в самом теле эффекта выше.
    }, [winnerPlayer, myPlayer, game?.status, trackShiftPhase, hasDeathAnimPlaying, finishModalForced, playOneShot, commentSound]);
    const moveSound = useAudioPlayer(FALLBACK_MOVE_SOUND);
    useEffect(() => {
        moveSound.loop = true;
    }, [moveSound]);
    // 'action' — тот же канал, что у shoot/collision/start чуть выше (см.
    // audioSettings-эффекты рядом с их созданием) — шаги объявлены позже по
    // файлу (зависят от movingRunnerType), поэтому свой отдельный эффект.
    useEffect(() => {
        moveSound.volume = audioSettings.action;
    }, [moveSound, audioSettings.action]);
    useEffect(() => {
        if (movingRunnerType) {
            moveSound.replace(pickMoveSoundSource(movingRunnerType));
            moveSound.play();
        } else {
            moveSound.pause();
            moveSound.seekTo(0);
        }
    }, [movingRunnerType, moveSound]);

    // Фоновая музыка активной игровой сессии (2026-09-11) — отдельный,
    // отдельно управляемый канал (не переиспользует voice/shoot/start —
    // те гоняют короткие one-shot реплики поверх, музыка должна крутиться
    // непрерывно и независимо от них). BACKGROUND_MUSIC_TRACKS — статический
    // список (см. constants/backgroundMusic.js за тем, почему не директория
    // целиком) из assets/sounds/music/, пока там один файл —
    // пользователь обещал донабрать ещё, механизм уже рассчитан на N треков.
    // Громкость — audioSettings.music (lib/audioSettings.js), тот же канал,
    // что и у меню/лобби-музыки (useMenuMusic) — приглушена относительно
    // дефолтных 1.0 у звуковых эффектов, чтобы музыка не перекрикивала
    // голосовые реплики/выстрелы (см. AUDIO_DEFAULTS.music). Настоящая
    // причина "громкость не применяется" (живая жалоба пользователя,
    // 2026-09-12): на вебе expo-audio's `.replace()`
    // (AudioPlayerWeb, node_modules/expo-audio/src/AudioPlayer.web.ts)
    // выкидывает старый <audio>-элемент и создаёт НОВЫЙ (`_createMediaElement()`)
    // — громкость сбрасывается на дефолтные 1.0 браузера, `musicSound.volume`,
    // установленная один раз в отдельном mount-эффекте, тут же перекрывалась
    // ПЕРВЫМ ЖЕ вызовом playRandomTrack(). Фикс — выставлять volume ПОСЛЕ
    // КАЖДОГО .replace(), не один раз при монтировании.
    const musicSound = useAudioPlayer(null);
    const musicTrackIndexRef = useRef(-1);
    const playRandomTrack = useCallback(() => {
        // BACKGROUND_MUSIC_TRACKS.length — СВОЯ длина (2026-09-20, см.
        // докстринг pickRandomTrackIndex — та же функция теперь используется
        // и для меню-музыки с ДРУГОЙ длиной плейлиста, реальный краш был
        // именно там, но сигнатура общая для обоих вызывающих мест).
        const idx = pickRandomTrackIndex(BACKGROUND_MUSIC_TRACKS.length, musicTrackIndexRef.current);
        musicTrackIndexRef.current = idx;
        musicSound.replace(BACKGROUND_MUSIC_TRACKS[idx]);
        musicSound.volume = audioSettings.music;
        musicSound.play();
    }, [musicSound, audioSettings.music]);
    // Как только текущий трек доигрывает до конца — сразу следующий
    // случайный (без паузы/тишины между ними, обычный плейлист-шаффл).
    useEffect(() => {
        const sub = musicSound.addListener('playbackStatusUpdate', (status) => {
            if (status.didJustFinish) playRandomTrack();
        });
        return () => sub.remove();
    }, [musicSound, playRandomTrack]);
    // Живое изменение громкости, пока трек уже играет (слайдер "Фоновая
    // музыка" в GameSettingsModal) — без этого эффекта новое значение
    // применилось бы только на следующей смене трека, т.е. могло ждать
    // несколько минут.
    useEffect(() => {
        musicSound.volume = audioSettings.music;
    }, [musicSound, audioSettings.music]);
    // Играет ТОЛЬКО пока партия реально идёт (ACTIVE) — молчит в
    // ready-up-спиннере (WAITING) и на экране победителя (FINISH).
    useEffect(() => {
        if (game?.status === GAME_STATUS.ACTIVE) {
            playRandomTrack();
        } else {
            musicSound.pause();
            musicSound.seekTo(0);
            musicTrackIndexRef.current = -1;
        }
    }, [game?.status, playRandomTrack, musicSound]);

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
        gameLog(`действие: старт (шаг=${stepBeforeAction})`);
        try {
            await fn();
            gameLog('действие: успех');
            if (actionStuckTimerRef.current) clearTimeout(actionStuckTimerRef.current);
            if (!skipStuckWatch) {
                actionStuckTimerRef.current = setTimeout(() => {
                    if (myTurnRef.current && myStepRef.current === stepBeforeAction) setShowActionStuckRefresh(true);
                }, STUCK_ACTION_TIMEOUT);
            }
        } catch (e) {
            gameLog('действие: ПРОВАЛ —', e.userMessage ?? e.message);
            notify('Не удалось выполнить действие', e.userMessage ?? e.message);
        } finally {
            setBusy(false);
        }
    }, []);

    // "Покинуть игру" (GameMenuModal, 2026-10-04) — POST /runner_game/surrender
    // (без тела, см. api/runnerGame.js). Бэк следом шлёт player_surrender →
    // runner_destroy(reason:'surrender') по каждому бегуну → player_out, и
    // если это был последний активный игрок — game_finish; уходящий игрок
    // при этом сам не ждёт этих событий (они предназначены ОСТАЛЬНЫМ
    // клиентам партии) — сразу после успешного ответа уводим его в главное
    // меню тем же goToMainMenu, что уже использует GameFinishModal.
    // skipStuckWatch — после surrender игрок уходит с экрана, watchdog
    // "действие зависло" ему уже не нужен.
    const handleSurrender = useCallback(() => {
        confirm(
            'Покинуть игру?',
            'Ваши бегуны будут сняты с трассы, вы выбудете из партии. Остальные игроки продолжат без вас.',
            () => runAction(() => runnerGameApi.surrender().then(goToMainMenu), { skipStuckWatch: true }),
            'Покинуть',
        );
    }, [runAction, goToMainMenu]);

    // Остальные хендлеры этих панелей — см. useGameMenuModals() выше.
    // handleLeaveFromMenu остаётся тут: закрывает меню (из хука) и зовёт
    // РЕАЛЬНОЕ игровое действие (handleSurrender), хук сам ничего о surrender
    // не знает (см. его докстринг).
    const handleLeaveFromMenu = useCallback(() => {
        handleCloseGameMenu();
        handleSurrender();
    }, [handleCloseGameMenu, handleSurrender]);

    // Накат (type=ROLL) — до 2026-10-03 двигался АВТОМАТИЧЕСКИ (единственная
    // легальная клетка — строго UP, тапать было не по чему, см. git-историю
    // за старый `autoRollMoveKeyRef`-эффект). По прямому запросу пользователя
    // реверснуто: теперь highlightedCells для наката подсвечивает все 3
    // клетки вперёд (см. выше, isRollMove-фильтр убран) — выбор направления
    // идёт обычным тапом через handleCellPress/tapMode==='move', отдельного
    // наката-эффекта больше нет.
    //
    // Накат НЕ должен предлагать доп. выстрел — по прямому запросу
    // пользователя, 2026-09-30: "накат может привести к коллизии и другим
    // событиям, связанным с расположением на доске, но дополнительных
    // выстрелов давать не должен". Бэк предлагает SHOOT после ЛЮБОГО
    // перемещения (в т.ч. накат-хода), если рядом оказался легальный
    // прицел — та же логика, что и у обычного ручного MOVE (см.
    // PLAYER_STEP.SHOOT ниже) — отличать накат от обычного хода умеет
    // только фронт. `pendingRollShootSkipRef` взводится В handleCellPress
    // (2026-10-03, раньше — прямо перед авто-накатом, см. выше) ПРЯМО перед
    // вызовом move() для накат-хода, и держится, пока шаг игрока не
    // определится — как только он СТАНОВИТСЯ известен: SHOOT → авто-отказ
    // (`shoot(false)`, тот же вызов, что делает игрок кнопкой "Пропустить
    // выстрел"), любой ДРУГОЙ шаг (ROAD_BONUS/новый SELECT/конец хода) →
    // просто гасим флаг без действия — эти шаги (в т.ч. диалог коллизии,
    // управляемый ОТДЕЛЬНЫМ `game.extraTurnPlayer`, не `myStep`) должны
    // остаться штатными, интерактивными. НЕ подтверждено живьём (ни в старой,
    // ни в новой форме).
    const pendingRollShootSkipRef = useRef(false);
    useEffect(() => {
        if (!pendingRollShootSkipRef.current || busy) return;
        if (!myTurn) {
            pendingRollShootSkipRef.current = false;
            return;
        }
        if (myStep === PLAYER_STEP.SHOOT) {
            pendingRollShootSkipRef.current = false;
            runAction(() => runnerGameApi.shoot(false), { skipStuckWatch: true });
            return;
        }
        if (myStep === PLAYER_STEP.SELECT) {
            pendingRollShootSkipRef.current = false;
        }
    }, [myStep, myTurn, busy, runAction]);

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

    // Авто-подтверждение "без выстрела", когда выстрела в принципе быть не
    // может — по прямому запросу пользователя, 2026-09-09: "в первом раунде
    // вижу диалог... перед ним никого, чтобы стрелять... по правилам в
    // первом раунде жнец не может стрелять вообще, только встать". Раньше
    // игрок был ОБЯЗАН явно нажать «Без выстрела», даже когда canReaperShoot
    // заведомо false (round===0 ИЛИ нет цели прямо по курсу) — теперь в этом
    // случае решение принимается САМО, как только "прилёт" Жнеца доиграл
    // (reaperPreviewReady), без лишнего диалога. Если canReaperShoot true —
    // выбор остаётся за игроком (тапнуть клетку или явно нажать «Без
    // выстрела»), тут ничего не меняется.
    //
    // autoNoShotAttemptedRef — защита от повторного авто-вызова: если ЭТОТ
    // вызов почему-то упадёт (сеть), runAction молча покажет тост, busy
    // вернётся в false, а pendingReaperPlacement/reaperPreviewReady/
    // canReaperShoot останутся ТЕМИ ЖЕ значениями — без этой защиты эффект
    // немедленно перезапустил бы тот же обречённый вызов по кругу. Ref
    // хранит САМ ОБЪЕКТ pendingReaperPlacement (новый объект на каждое новое
    // размещение, см. handleCellPress) — сравнение по ссылке естественно
    // сбрасывается на следующей попытке, отдельно чистить не нужно. «Отмена»
    // (см. рендер кнопок ниже) остаётся видимой в любом случае — если
    // авто-вызов всё же завис/упал, у игрока по-прежнему есть явный выход.
    // 2026-10-11: дополнительно ждёт reaperConfirmed (новый диалог
    // подтверждения размещения, см. выше) — раньше срабатывал сразу по
    // reaperPreviewReady, минуя подтверждение; теперь автовыбор "без
    // выстрела" возможен только ПОСЛЕ того, как игрок явно подтвердил
    // размещение (✓), как и обычный тап по клетке выстрела.
    const autoNoShotAttemptedRef = useRef(null);
    useEffect(() => {
        if (!pendingReaperPlacement || !reaperPreviewReady || !reaperConfirmed || canReaperShoot || busy) return;
        if (autoNoShotAttemptedRef.current === pendingReaperPlacement) return;
        autoNoShotAttemptedRef.current = pendingReaperPlacement;
        handleReaperShoot(undefined);
    }, [pendingReaperPlacement, reaperPreviewReady, reaperConfirmed, canReaperShoot, busy, handleReaperShoot]);

    const handleCellPress = useCallback(
        (cell) => {
            if (!tapMode) return;
            const key = cell.id; // "segment-row-col" = "segment-positionY-positionX", см. lib/board.js
            if (!highlightedCells.has(key)) return;

            if (tapMode === TAP_MODE.START) {
                // skipStuckWatch — см. комментарий у runAction: MOVE может
                // состоять из нескольких ходов подряд без смены player.step.
                runAction(() => runnerGameApi.move(cell.row, null), { skipStuckWatch: true });
                return;
            }
            if (tapMode === TAP_MODE.MOVE) {
                const target = { segment: cell.blockIndex, positionX: cell.col - cell.blockIndex * cols, positionY: cell.row };
                const neighbor = forwardNeighbors(activeRunner).find((n) => cellKey(n) === cellKey(target));
                if (!neighbor) return;
                // Накат (type=ROLL, см. canSelectRunner) — тот же тап, что у
                // обычного хода (2026-10-03, см. комментарий у
                // pendingRollShootSkipRef выше), но дополнительно глушит
                // предложенный после хода довыстрел (решение 2026-09-30, не
                // тронуто).
                const isRollMove = activeRunner.dice === 0 && activeRunner.rollDice != null;
                if (isRollMove) pendingRollShootSkipRef.current = true;
                runAction(() => runnerGameApi.move(null, neighbor.direction), { skipStuckWatch: true });
                return;
            }
            if (tapMode === TAP_MODE.SHOOT) {
                // Все 3 направления — см. highlightedCells выше (2026-09-08).
                const target = { segment: cell.blockIndex, positionX: cell.col - cell.blockIndex * cols, positionY: cell.row };
                const neighbor = forwardNeighbors(activeRunner).find((n) => cellKey(n) === cellKey(target));
                if (!neighbor) return;
                runAction(() => runnerGameApi.shoot(true, neighbor.direction));
                return;
            }
            if (tapMode === TAP_MODE.REAPER_SHOOT) {
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
            if (tapMode === TAP_MODE.REAPER && pendingAbility) {
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
                // Звук "прилёта" — СРАЗУ, в момент, когда токен реально
                // начинает визуально въезжать (см. BoardGrid#reaperPreviewItem,
                // тот же тап заводит и локальный превью-слайд), а не позже,
                // когда придёт реальный ability_reaper с бэка (только ПОСЛЕ
                // подтверждения диалога) — по прямому запросу пользователя,
                // 2026-09-09: "звук движения жнеца проигрывается уже после
                // подтверждения в диалоге, а должен быть в момент анимации
                // движения". Дублирующий звук на РЕАЛЬНОМ событии подавлен —
                // см. triggerWithSound#suppressAnim выше (та же граница по
                // reaperStartSkipUntilRef, что уже гасила повторную ВИЗУАЛЬНУЮ
                // анимацию, теперь гасит и звук).
                reaperStartSkipUntilRef.current = Date.now() + 5000;
                playOneShot(startSound, pickStartSoundSource(RUNNER_TYPES.REAPER));
            }
        },
        [tapMode, highlightedCells, activeRunner, cols, pendingAbility, pendingReaperPlacement, handleReaperShoot, runAction, playOneShot, startSound],
    );

    // Дроп кубика на карточку бегуна — шаг SELECT. Реальный /select уходит не
    // сразу, а только после подтверждения (см. handleConfirmSelect) — раньше
    // коммитилось мгновенно на дроп, и промахнувшийся кубик было не вернуть.
    const handleDropOnRunner = useCallback(
        (playerId, runnerId, diceIndex) => {
            if (playerId !== myPlayer?.id || !canSelectRunner(runnerId)) return;
            const runner = runners.find((r) => r.id === runnerId);
            // Звук дропа (2026-10-14, перенесён сюда с handleConfirmSelect —
            // живая жалоба пользователя: runner_picked.mp3 на подтверждении
            // "конфликтовал" с voice-репликой активации бегуна (RUNNER_SOUNDS
            // .active, играет чуть позже через onStart — см. triggerWithSound).
            // Тут эта реплика ещё не в игре вообще, конфликтовать не с чем.
            playOneShot(sfxSound, RUNNER_PICKED_SOUND);
            setPendingSelect({ runnerId, diceIndex, type: runner.dice == null ? 'DICE' : 'ROLL' });
        },
        [myPlayer?.id, canSelectRunner, runners, playOneShot, sfxSound],
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
            // 2026-10-15, живой баг (пользователь, подтверждено бэком —
            // "Runner status must be broken or damaged"): гейт отсекал только
            // DESTROYED, пропуская HEALTHY (нечего лечить) — тап по здоровому
            // бегуну уходил на бэк и падал 400-й. Снимает один жетон
            // повреждения — валидная цель ровно DAMAGED/BROKEN, ни HEALTHY
            // (нечего снимать), ни DESTROYED (уже не на трассе).
            if (runner.status !== RUNNER_STATUS.DAMAGED && runner.status !== RUNNER_STATUS.BROKEN) return;
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

    // pendingCollisionRoll (см. onTransient выше) должен пропасть, как только
    // текущая коллизия разрешилась (extraTurnPlayer снова null) — иначе при
    // СЛЕДУЮЩЕЙ коллизии баннер на мгновение показал бы результат ПРЕДЫДУЩЕГО
    // броска, пока новый CollisionEvent ещё не долетел.
    useEffect(() => {
        if (game?.extraTurnPlayer == null) {
            setPendingCollisionRoll(null);
            // Снимаем "уже сыграли" ТОЛЬКО когда коллизия реально разрешилась
            // (не на каждый переброс) — см. collisionCommentPlayedRef выше.
            collisionCommentPlayedRef.current = false;
        }
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
        // Одноразовый комментарий (collision_*.wav) переехал в onTransient
        // (см. collisionCommentPlayedRef выше) — тут раньше игрался ОН ЖЕ,
        // но с задержкой в целый цикл рендера, что и давало обгон другими
        // звуками, приходящими напрямую (жалоба пользователя, 2026-09-20).
        // Тут остаётся только зацикленный collisionSound (вдвое приглушённая,
        // см. useEffect у объявления канала выше) — она осознанно ждёт
        // РЕАЛЬНОЙ видимой позы, не транзиента, стартует только на ПЕРВОЙ
        // одновременно активной паре, остальные лишь увеличивают счётчик
        // (см. handleCollisionPoseEnd ниже — останавливаем только когда
        // счётчик возвращается к 0, не раньше).
        activeCollisionPosesRef.current += 1;
        if (activeCollisionPosesRef.current === 1) {
            collisionSound.seekTo(0);
            collisionSound.play();
        }
    }, [collisionSound]);
    const handleCollisionPoseEnd = useCallback(() => {
        activeCollisionPosesRef.current = Math.max(0, activeCollisionPosesRef.current - 1);
        if (activeCollisionPosesRef.current === 0) {
            collisionSound.pause();
            collisionSound.seekTo(0);
        }
    }, [collisionSound]);

    // Декоративная рамка баннера хода (2026-09-28, по прямому запросу
    // пользователя — "оберни панель Ход игрока в рамку по аналогии с
    // панелями бегунов") — `FramePanel`, не `PersonPanel`: тот же фон/уголки
    // (PERSON_PANEL_BACKGROUND/_CORNER — дефолт FramePanel, см. её докстринг,
    // "тот же самый фон, что рисует PersonPanel у самой карточки-плитки"),
    // но с НАСТРАИВАЕМОЙ толщиной угла (`targetCornerSize`) — сам баннер
    // тонкий (TURN_BANNER_MIN_HEIGHT 64-78px), родной угол PersonPanel
    // (~34px, FRAME_SCALE=1.3) на такой высоте почти касался бы сам себя
    // сверху/снизу (два угла = ~68px). `targetCornerSize=10` — та же логика
    // выбора толщины, что и у DiceTray (её `FramePanel targetCornerSize={8}`
    // чуть выше в этом файле), под собственную высоту баннера. Размер — ЖИВОЙ
    // onLayout самого баннера (обычный flow-элемент, НЕ абсолютно
    // спозиционированный — тот же путь измерения, что у RunnerCard#cardSize,
    // не нужен measureInWindow-обход, см. её докстринг).
    // **ВАЖНО (найдено живым крашем "Rendered more hooks than during the
    // previous render", 2026-09-28)**: этот хук ОБЯЗАН стоять ДО обоих ранних
    // `return` ниже (`!game`/`WAITING`) — если объявить его глубже в теле
    // компонента (как было изначально), на рендерах, где рано срабатывает
    // один из этих `return`, React вызывает МЕНЬШЕ хуков, чем на рендере
    // активной партии — нарушение "Rules of Hooks" (хуки должны звонить
    // ОДИНАКОВОЕ число раз на каждый рендер), краш всего экрана.
    const [turnBannerSize, setTurnBannerSize] = useState(null);
    const onTurnBannerLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setTurnBannerSize({ width, height });
    }, []);
    // Ширина строки под швом (переключатели+имя+настройки+лог, см. место
    // рендера) — измеряется отдельно от turnBannerSize (та теперь только
    // про сам баннер хода, делящий свою строку с колонкой раунд/ход/бонус,
    // см. комментарий у seamNameWidth ниже).
    const [seamRowWidth, setSeamRowWidth] = useState(null);
    const onSeamRowLayout = useCallback((e) => {
        setSeamRowWidth(e.nativeEvent.layout.width);
    }, []);

    // Раунд/Ход/Бонус дороги + настройки/лог — ПЕРЕЕХАЛИ (2026-10-15, по
    // прямому запросу пользователя) на место, где раньше был баннер хода
    // (зона 11 на UI-карте) — тот убран целиком для mobileNav, см. место
    // рендера headerContent ниже. Раунд/Ход/Бонус — РЕЗИНОВЫЕ (делят ПОРОВНУ
    // всё место, оставшееся ПОСЛЕ настроек/лога, которые остаются тем же
    // квадратом switchRowH×switchRowH, что и раньше, см. прямой запрос:
    // "Настройка и Лог должны остаться той же формы... остальные должны
    // заполнить все пустоты"), а не фиксированный квадрат — высота строки
    // известна заранее (switchRowH), а не измеряется (в отличие от старой
    // версии, где сторона считалась от onLayout баннера) — ширина измеряется
    // (panelHeaderRowWidth, см. onPanelHeaderRowLayout) и делится на 3 ТОЧНЫМ
    // распределением остатка округления (`Math.round(W*(i+1)/3)-
    // Math.round(W*i/3)`, тот же приём, что уже спасал abilitiesWrap/
    // diceSlotHeight от потерянных пикселей, см. CLAUDE.md 2026-10-01) — сумма
    // трёх ширин гарантированно точно равна доступному месту, без зазора
    // справа. До первого измерения (panelHeaderRowWidth===null) — безопасный
    // фолбэк на равные квадраты.
    const [panelHeaderRowWidth, setPanelHeaderRowWidth] = useState(null);
    const onPanelHeaderRowLayout = useCallback((e) => {
        setPanelHeaderRowWidth(e.nativeEvent.layout.width);
    }, []);
    // computeRoundTurnBonusLayout(headerRowH) — 2026-10-16, параметризовано по
    // высоте строки: раньше тут были готовые значения, завязанные жёстко на
    // switchRowH (высота ПОРТРЕТНОГО seam-ряда, сосчитанная от ширины ВСЕГО
    // экрана) — для landscape-панели (узкая боковая колонка, см.
    // landscapeHeaderRowH ниже) это дало бы непропорционально высокие узкие
    // "плашки" вместо квадратов (живой замер DOM подтвердил: 44×104 вместо
    // примерно квадратных). Формула не изменилась — просто принимает высоту
    // параметром, а не читает switchRowH напрямую.
    const computeRoundTurnBonusLayout = (headerRowH) => {
        const totalWidth = panelHeaderRowWidth != null
            ? Math.max(0, panelHeaderRowWidth - headerRowH * 2)
            : null;
        const widths = totalWidth != null
            ? [0, 1, 2].map((i) => Math.round((totalWidth * (i + 1)) / 3) - Math.round((totalWidth * i) / 3))
            : [Math.round(headerRowH * 1.2), Math.round(headerRowH * 1.2), Math.round(headerRowH * 1.2)];
        const fontStyle = { fontSize: Math.max(10, Math.round(headerRowH * 0.3)) };
        return { widths, fontStyle };
    };
    // Шрифт — пропорционален высоте строки (0.3, подобрано живьём 2026-10-15,
    // см. computeRoundTurnBonusLayout выше за параметризованной версией).
    // Ширина панели имени в строке под швом — живой баг 2026-10-11: первая
    // версия (фиксированный множитель от switchRowH) либо вылезала за край
    // экрана (кнопки обрезались), либо оставляла дыру — по прямому запросу
    // пользователя сумма (переключатели+имя+навигация) теперь считается от
    // РЕАЛЬНО измеренной ширины самой строки (seamRowWidth, см. onSeamRowLayout
    // ниже), ровно той же техникой, что раньше спасла аналогичный ряд от
    // того же класса бага (см. старую историю roadFrameRoundRowWidth в
    // CLAUDE.md, 2026-10-10).
    // switchesNaturalWidth — ширина 4 переключателей по их собственному
    // аспекту (SWITCH_ASPECT) + 3 внутренних зазора (PlayerSwitchPanel#
    // styles.row.gap=spacing.xs) между ними. seamIconsWidth — 2 квадратные
    // switchRowH×switchRowH ячейки в конце строки — раньше настройки+лог,
    // 2026-10-15 стали кнопками навигации (RoadNavButton) — формула/размер
    // не изменились, сменился только визуальный смысл. styles.seamRow.gap=0
    // (по прямому запросу пользователя) — зазоров в строке ДВА явных
    // marginLeft (не gap): имя→переключатели и переключатели→навигация
    // (2026-10-15, живая жалоба "налезает, плотнячком" — раньше зазор был
    // только один), оба по spacing.xs, см. места рендера. Единственный стык
    // БЕЗ зазора — между самими кнопками навигации (up/down). Отсюда ДВА
    // (не один) spacing.xs в формуле ниже — забыть прибавить второй при
    // добавлении зазора было реальной причиной 4px переполнения строки в
    // этом же заходе. До первого измерения (seamRowWidth===null) —
    // безопасный фолбэк.
    const switchesNaturalWidth = Math.round(switchRowH * SWITCH_ASPECT) * 4 + spacing.xs * 3;
    const seamIconsWidth = switchRowH * 2;
    const seamNameWidth = seamRowWidth != null
        ? Math.max(40, seamRowWidth - spacing.md * 2 - switchesNaturalWidth - spacing.xs * 2 - seamIconsWidth)
        : Math.round(switchRowH * 2.4);

    // 2026-10-16 — ПЕРЕНЕСЕНО СЮДА (было прямо перед boardGridEl, намного
    // ниже по файлу) — реальный краш, живьём пойман пользователем: "Rendered
    // more hooks than during the previous render". boardGridEl стоит ПОСЛЕ
    // раннего `if (!game) return` чуть ниже — на первом рендере (game===null,
    // холодный коннект) этот useMemo вообще не вызывался, а на следующем
    // (game уже пришёл) вызывался — нарушение Rules of Hooks. Раньше (до
    // мемоизации) здесь был обычный литерал в JSX-пропе, не хук — этого бага
    // не было. Теперь хук стоит ДО любых early return, как и остальные.
    const reaperPreview = useMemo(
        () => (
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
        ),
        [pendingReaperPlacement, reaperPreviewReady, playerColorById, myPlayer?.id],
    );

    if (!game) {
        return (
            <View style={styles.wrapper}>
                <View style={styles.center}>
                    <LoadingCard label={STATUS_LABEL[status] ?? ''} />
                </View>
            </View>
        );
    }

    if (game.status === GAME_STATUS.WAITING) {
        // 2026-09-18: с удалением POST /runner_game/start партия больше НЕ
        // может реально прийти сюда со статусом WAITING — GameFactory::
        // create() на бэке активирует её синхронно с созданием, до того как
        // хоть один клиент успевает подписаться (см. api/runnerGame.js).
        // Ветка оставлена ТОЛЬКО как защитный фолбэк для гипотетической
        // партии, созданной ДО этого бэкового деплоя и застрявшей в WAITING
        // (её больше некому и нечем "стартовать" — раньше это делал именно
        // /start) — раньше тут был автовызов /start + retry-UI, теперь
        // действовать всё равно нечем, просто нейтральный спиннер вместо
        // падения на код ниже, который ожидает уже активную партию.
        return (
            <View style={styles.wrapper}>
                <View style={styles.center}>
                    <LoadingCard label="Ожидание начала партии…" />
                </View>
                <EventLogPanel entries={eventLog} />
            </View>
        );
    }

    const showShootSkip = myTurn && myStep === PLAYER_STEP.SHOOT && !busy;
    const showAbilitySkip = myTurn && myStep === PLAYER_STEP.ABILITY && !busy && !pendingAbility && !pendingReaperPlacement;
    const showRoadBonusChoice = myTurn && myStep === PLAYER_STEP.ROAD_BONUS && !busy;
    // Подсказка "что делать дальше" (2026-09-14, по прямому запросу
    // пользователя) — SELECT: пока кубик хода не тащат никуда, подсвечиваем
    // заголовок+панель кубиков в PlayerInfoPanel (см. highlightSelectIdle
    // там). ABILITY переиспользует УЖЕ существующий showAbilitySkip — то же
    // самое условие одновременно подсвечивает и панель кубиков (та же логика
    // в PlayerInfoPanel), и саму кнопку "Пропустить усиление" ниже.
    const highlightSelectIdle = myTurn && myStep === PLAYER_STEP.SELECT && !busy && !pendingSelect;

    // Раньше на экране не было видно вообще, чей ход и что делать дальше — см.
    // живой прогон в CLAUDE.md. Один банер: чей ход + подсказка по шагу + кнопка
    // "пропустить", если она сейчас уместна — всё в одном месте. В альбомной
    // раскладке — плавающий банер над доской (styles.turnBanner, как раньше). В
    // портретной — по запросу пользователя переехал ВНУТРЬ панели игрока, туда,
    // где раньше было крупное имя игрока (см. PlayerInfoPanel.headerContent) —
    // отдельный плавающий банер над узкой доской либо перекрывал её, либо
    // занимал место, которое теперь отдано доске/панели.
    const turnHintText = stepInstruction(
        myStep, activeRunner, pendingAbility, pendingSelect, pendingRunnerName,
        pendingReaperPlacement, reaperPreviewReady, canReaperShoot, reaperConfirmed,
    );
    // pendingSelect (карточка выбрана, ждём ✓/✕) — кнопки ПРАВЕЕ текста, в
    // одну строку с ним, а не отдельным рядом ниже (по прямому запросу
    // пользователя, 2026-09-14, "чтобы сократить размер плитки диалога" —
    // после того как сам текст уже укоротили, а кнопки стали иконками,
    // отдельная строка под ними тратила высоту зря). Остальные состояния
    // (ABILITY/MOVE/SHOOT/Жнец/бонус дороги) — без изменений, текст и кнопки
    // по-прежнему на разных строках (там текст длиннее, в строку не влезет).
    //
    // Коллизия/сдвиг трассы — раньше отдельный плавающий баннер
    // (styles.collisionBanner, свой top-right угол), теперь ветки ЭТОГО ЖЕ
    // turnBannerInner, с приоритетом НАД обычной подсказкой хода (по прямому
    // запросу пользователя, 2026-09-26— "все сообщения в одной менюшке, где
    // Твой ход"). Оба состояния блокируют игру целиком для всех игроков
    // (см. game.extraTurnPlayer/trackShiftPhase в комментариях выше по
    // файлу) — именно поэтому они перекрывают turnBannerInner, а не просто
    // дополняют его.
    // game.status===FINISH — та же дыра и тот же фикс, что у dialogState
    // выше (см. её комментарий): после победы тут не должно оставаться
    // никакого хода/подсказки, GameFinishModal уже показывает результат.
    const turnBannerInner = game.status === GAME_STATUS.FINISH ? null : trackShiftPhase ? (
        <Text style={[styles.turnHint, styles.turnHintCenter]} noGlobalTint>
            Трасса смещается…
        </Text>
    ) : game.extraTurnPlayer != null ? (
        <View style={styles.collisionRow}>
            <View style={styles.collisionTextColumn}>
                {/* "Заруба!..." — единый стиль текста на ВСЕ состояния этого
                    баннера (2026-10-11, по прямому запросу пользователя —
                    раньше "Заруба!" был только в тексте ПОДТВЕРЖДЕНИЯ, а
                    промежуточные состояния ("жду бросок"/"жду игрока") ещё
                    носили старое "Столкновение —..."). collisionDecisionReady
                    больше НЕ гейтит сам текст (только кнопки ✓/↻ ниже,
                    см. COLLISION_ANIM_DELAY_MS) — pendingCollisionRoll
                    приходит практически тем же бандлом, что и extraTurnPlayer,
                    так что ветка "решение моё, но результат ещё не пришёл"
                    теперь скорее теоретическая, чем реально видимая. */}
                <Text style={styles.turnHint} noGlobalTint>
                    {myCollision && pendingCollisionRoll
                        ? `Заруба! Результат: ${collisionFlyingRunnerLabel ?? 'бегун'} отлетит ${directionLabel(pendingCollisionRoll.direction)}. Принять?`
                        : myCollision
                            ? 'Заруба! Жду результат…'
                            : `Заруба! Ждём ${collisionWinnerPlayer?.name ?? 'игрока'}`}
                </Text>
            </View>
            {myCollision && !busy && collisionDecisionReady && (
                // Иконки вместо текста (2026-10-11, по прямому запросу
                // пользователя — "Использовать"/"Перебросить" занимали
                // слишком много ширины, коллизионному тексту слева не
                // хватало места и он обрезался в теперь-фиксированном
                // turnBanner, см. его докстринг) — ✓ (тот же глиф и стиль,
                // что уже использует подтверждение выбора бегуна/бонуса
                // дороги чуть ниже в этом же файле — БЕЗ textStyle-
                // переопределения, крупнее collisionBtnText) и ↻ (циклическая
                // стрелка — "перебросить").
                <View style={styles.turnBtnRow}>
                    <Button title="✓" variant="success" onPress={() => handleCollision(true)} style={styles.turnSkipBtnCompact} />
                    <Button title="↻" variant="danger" onPress={() => handleCollision(false)} style={styles.turnSkipBtnCompact} />
                </View>
            )}
            {!myCollision && showStuckRefresh && (
                <Button
                    title="Обновить состояние"
                    variant="info"
                    onPress={() => {
                        runnerAnim.reset();
                        setPendingDeathRunnerIds(new Set());
                        resync();
                    }}
                    style={styles.turnSkipBtnCompact}
                    textStyle={styles.collisionBtnText}
                />
            )}
        </View>
    ) : myTurn ? (
        <>
            {/* Пульсирует бело↔зелёным всё время, пока myTurn (весь этот блок
                рендерится только тогда) — по прямому запросу пользователя,
                2026-09-14, тем же общим механизмом, что и подсказки "что
                делать дальше" (см. usePulse/PulseText, CLAUDE.md). */}
            <PulseText active baseColor={colors.textOnDark} toColor={colors.success} style={styles.turnTitleMine}>
                Твой ход
            </PulseText>
            {pendingReaperPlacement && !busy && !reaperPreviewReady ? (
                // Approach-фаза (Жнец ещё летит) — БЕЗ диалога вообще, ни
                // текста, ни кнопок (2026-10-12, по прямому запросу
                // пользователя после живой проверки: "Без выстрела" раньше
                // появлялась РАНЬШЕ, чем долетал Жнец, что сбивало с толку —
                // реверс решения 2026-10-11, см. CLAUDE.md). "Твой ход" над
                // этим блоком остаётся видимым, просто без хинт-строки.
                null
            ) : pendingReaperPlacement && !busy ? (
                // Два последовательных диалога ПОСЛЕ "прилёта" (approach-фаза
                // — см. ветку выше), тот же приём турн-хинт-строки (текст+
                // кнопки справа), что у pendingSelect/showRoadBonusChoice/
                // showAbilitySkip — 2026-10-11, по прямому запросу
                // пользователя.
                //   1) !reaperConfirmed — подтверждение размещения: ✓
                //      переходит к выбору выстрела (reaperConfirmed=true), ✕
                //      возвращает Жнеца в руку (отменяет усиление целиком,
                //      ничего не отправляя на бэк).
                //   2) reaperConfirmed — выбор выстрела: подсвеченные клетки
                //      на доске (см. highlightedCells) + «Скип» (красная,
                //      тот же стиль/язык, что у showAbilitySkip/
                //      showShootSkip). Если выстрела в принципе нет
                //      (canReaperShoot===false) — автоэффект
                //      (autoNoShotAttemptedRef) решает сам практически
                //      мгновенно, эта кнопка видна лишь на миг или не видна.
                <View style={styles.turnHintRow}>
                    <Text style={[styles.turnHint, styles.turnHintFlex]} noGlobalTint>{turnHintText}</Text>
                    <View style={styles.turnBtnRow}>
                        {!reaperConfirmed ? (
                            <>
                                <Button title="✓" variant="success" onPress={() => setReaperConfirmed(true)} style={styles.turnSkipBtnCompact} />
                                <Button title="✕" variant="danger" onPress={() => setPendingReaperPlacement(null)} style={styles.turnSkipBtnCompact} />
                            </>
                        ) : (
                            <Button title="Скип" variant="danger" onPress={() => handleReaperShoot(undefined)} style={styles.turnSkipBtnCompact} />
                        )}
                    </View>
                </View>
            ) : pendingSelect && !busy ? (
                <View style={styles.turnHintRow}>
                    <Text style={[styles.turnHint, styles.turnHintFlex]} noGlobalTint>{turnHintText}</Text>
                    <View style={styles.turnBtnRow}>
                        <Button title="✓" variant="success" onPress={handleConfirmSelect} style={styles.turnSkipBtnCompact} />
                        <Button title="✕" variant="danger" onPress={handleCancelSelect} style={styles.turnSkipBtnCompact} />
                    </View>
                </View>
            ) : showRoadBonusChoice ? (
                // Тот же приём, что и у pendingSelect/showAbilitySkip выше —
                // текст+кнопки в одну строку, кнопки справа (по прямому
                // запросу пользователя, 2026-09-14). "Пропустить" заменена на
                // красную кнопку с крестиком (была variant="muted" с текстом)
                // — тот же язык, что уже используют ✓/✕ у pendingSelect.
                <View style={styles.turnHintRow}>
                    <Text style={[styles.turnHint, styles.turnHintFlex]} noGlobalTint>{turnHintText}</Text>
                    <View style={styles.turnBtnRow}>
                        <Button
                            title={`Бонус +${game.trackGain ?? ''}`}
                            variant="success"
                            onPress={() => handleRoadBonus(true)}
                            style={styles.turnSkipBtnCompact}
                        />
                        <Button title="✕" variant="danger" onPress={() => handleRoadBonus(false)} style={styles.turnSkipBtnCompact} />
                    </View>
                </View>
            ) : showAbilitySkip ? (
                // Тот же приём, что и у pendingSelect выше — текст+кнопка в
                // одну строку, кнопка справа (по прямому запросу пользователя,
                // 2026-09-14, "по аналогии с предыдущим диалогом"). Без
                // пульсации (была раньше, PulseHighlight active={showAbilitySkip})
                // — убрана по прямому запросу, тут больше не подсвечиваем.
                // "Пропустить" (2026-10-11, по прямому запросу пользователя)
                // сперва заменена на красную кнопку с крестиком (✕, тот же
                // приём, что у "Бонус дороги"/pendingSelect выше), затем в
                // том же заходе — текст на ней заменён на "Скип" (тем же
                // днём, по аналогии с кнопкой пропуска выстрела).
                <View style={styles.turnHintRow}>
                    <Text style={[styles.turnHint, styles.turnHintFlex]} noGlobalTint>{turnHintText}</Text>
                    <Button title="Скип" variant="danger" onPress={handleAbilitySkip} style={styles.turnSkipBtnCompact} />
                </View>
            ) : showShootSkip ? (
                // "Пропустить выстрел" (2026-10-11, по прямому запросу
                // пользователя) — переименована в "Скип", перекрашена в
                // красную (variant="danger", как и у остальных ✕-кнопок
                // этого баннера) и перенесена из отдельной строки НИЖЕ в
                // один ряд с текстом, кнопка справа — тот же приём, что у
                // pendingSelect/showRoadBonusChoice/showAbilitySkip выше
                // (пользователь сперва попросил слева, затем в том же
                // заходе передумал обратно на справа).
                <View style={styles.turnHintRow}>
                    <Text style={[styles.turnHint, styles.turnHintFlex]} noGlobalTint>{turnHintText}</Text>
                    <Button title="Скип" variant="danger" onPress={handleShootSkip} style={styles.turnSkipBtnCompact} />
                </View>
            ) : (
                // Центрировано (по прямому запросу пользователя, 2026-09-14) —
                // ТОЛЬКО этот, безкнопочный случай (MOVE/ABILITY heal-reaper
                // и т.п.). Строки с кнопками (turnHintFlex выше) не трогали —
                // там текст рядом с кнопкой, левое выравнивание там читается
                // естественнее.
                <Text style={[styles.turnHint, styles.turnHintCenter]} noGlobalTint>{turnHintText}</Text>
            )}
            {showActionStuckRefresh && !busy && (
                <Button
                    title="Обновить состояние"
                    variant="info"
                    onPress={() => {
                        setShowActionStuckRefresh(false);
                        runnerAnim.reset();
                        setPendingDeathRunnerIds(new Set());
                        resync();
                    }}
                    style={styles.turnSkipBtn}
                />
            )}
            {/* Жнец — весь диалог (approach/confirm/shoot) теперь ОДНОЙ
                turnHintRow-строкой выше (см. pendingReaperPlacement-ветку в
                начале этого тернарника), отдельного блока кнопок здесь
                больше нет. "Отмена" на фазе выстрела (3) сознательно убрана
                по прямому запросу пользователя, 2026-10-11, С ЯВНЫМ
                ПРЕДУПРЕЖДЕНИЕМ о риске (согласован): если бэк отклонит само
                размещение (например, невалидная клетка), runAction поймает
                ошибку тостом, но pendingReaperPlacement НЕ сбросится —
                showActionStuckRefresh тут НЕ срабатывает (вооружается
                только на УСПЕШНЫЙ вызов, см. runAction выше), значит
                реального аварийного выхода из этого конкретного тупика
                теперь нет (был — старая "Отмена", 2026-09-08). Если баг
                повторится — первое, что стоит проверить. */}
        </>
    ) : (
        // Центрировано + имя в цвете игрока, чей сейчас ход — по прямому
        // запросу пользователя, 2026-09-14, тот же playerColorById, что уже
        // красит кубики/обводку на доске/пилюлю переключателя (не выдуманный
        // отдельный акцент).
        <Text style={[styles.turnTitle, styles.turnHintCenter]} noGlobalTint>
            Ход игрока:{' '}
            <Text
                style={{ color: playerColorById[currentTurnPlayer?.id] ?? colors.textOnDark }}
                noGlobalTint
            >
                {currentTurnPlayer?.user?.username ?? '—'}
            </Text>
        </Text>
    );

    // dialogState — полный зеркальный разбор turnBannerInner выше в виде
    // отдельной модалки-карточки (GameDialogModal). Сначала (2026-10-12) был
    // ВРЕМЕННЫМ ДУБЛЕМ только диалогов с выбором — простые безкнопочные
    // подсказки шага и "Ход игрока: X" сознательно не дублировались, жили
    // только в шапке панели (зона 11, styles.turnBanner). По прямому запросу
    // пользователя 2026-10-15 эта модалка стала ЕДИНСТВЕННЫМ источником ЛЮБОЙ
    // подсказки хода (включая "Твой ход"/"Ход игрока: X") — инлайн-версия в
    // зоне 11 (turnBannerInner, headerContent в mobileNav-ветке ниже) больше
    // НЕ рендерится, но сама рамка/колонка Раунд-Ход-Бонус там оставлены как
    // есть (по прямому требованию — "зону 11 пока оставь в покое"), только
    // её содержимое убрано. Веб/landscape — turnBannerInner остался видимым,
    // там этой модалки нет. Текст/условия/кнопки — скопированы 1:1 с веток
    // turnBannerInner выше, НЕ переизобретены — при правке одной стороны не
    // забыть вторую, пока обе ветки существуют параллельно в коде.
    // НЕ useMemo — этот блок стоит ПОСЛЕ ранних `return` выше (!game/
    // WAITING), значит на части рендеров до него вообще не доходит; хук
    // тут нельзя (условный вызов хука — краш "Rendered more hooks than
    // during the previous render", живьём поймано на вебе, 2026-10-12).
    // Обычный IIFE, как и соседний turnBannerInner — та же логика (плоский
    // JSX ниже тоже пересчитывается каждый рендер без memo), просто другая
    // форма результата (объект, не JSX).
    const dialogState = (() => {
        // 2026-10-15, живая жалоба пользователя — модалка показывала "Твой
        // ход. null" уже ПОСЛЕ game.status===FINISH (обычно не видно —
        // перекрыто GameFinishModal, всплыло во время отладки другого бага,
        // когда тот был временно скрыт). Безкнопочный hint-фоллбэк (ниже по
        // функции) ничего не гейтил на статус партии — как и turnBannerInner
        // (тот же пробел, подновлён тем же заходом).
        if (game.status === GAME_STATUS.FINISH) return null;
        if (trackShiftPhase) return { kind: 'trackShift', text: 'Трасса смещается…' };
        if (game.extraTurnPlayer != null) {
            const text = myCollision && pendingCollisionRoll
                ? `Заруба! Результат: ${collisionFlyingRunnerLabel ?? 'бегун'} отлетит ${directionLabel(pendingCollisionRoll.direction)}. Принять?`
                : myCollision
                    ? 'Заруба! Жду результат…'
                    : `Заруба! Ждём ${collisionWinnerPlayer?.name ?? 'игрока'}`;
            if (myCollision && !busy && collisionDecisionReady) {
                return {
                    kind: 'collisionDecide',
                    text,
                    buttons: [
                        { key: 'accept', title: '✓', variant: 'success', onPress: () => handleCollision(true) },
                        { key: 'reroll', title: '↻', variant: 'danger', onPress: () => handleCollision(false) },
                    ],
                };
            }
            if (!myCollision && showStuckRefresh) {
                return {
                    kind: 'collisionStuckRefresh',
                    text,
                    buttons: [{
                        key: 'resync',
                        title: 'Обновить состояние',
                        variant: 'info',
                        onPress: () => { runnerAnim.reset(); setPendingDeathRunnerIds(new Set()); resync(); },
                    }],
                };
            }
            // myCollision без decisionReady ("Жду результат…") и !myCollision
            // без stuck ("Ждём игрока") — РАЗНЫЕ kind: это разные по смыслу
            // ожидания (сам решаю vs жду решения другого), диалог должен
            // появляться развёрнутым заново при переходе между ними.
            return { kind: myCollision ? 'collisionWaitMe' : 'collisionWaitOther', text };
        }
        if (!myTurn) {
            // "Ход игрока: X" — раньше сознательно не дублировалась в модалке
            // (см. комментарий ниже у dialogState), по прямому запросу
            // пользователя 2026-10-15 модалка теперь единственное место для
            // ЛЮБОЙ подсказки хода, не только тех, где есть кнопки. kind
            // привязан к id текущего игрока — смена хода разворачивает
            // карточку заново, даже если предыдущий игрок успел её закрыть.
            return { kind: `opponentTurn:${currentTurnPlayer?.id ?? 'x'}`, text: `Ход игрока: ${currentTurnPlayer?.user?.username ?? '—'}` };
        }
        if (pendingReaperPlacement && !busy) {
            // Approach-фаза (Жнец ещё летит из-за края карты) — БЕЗ диалога
            // вообще, ни текста, ни кнопок (2026-10-12, по прямому запросу
            // пользователя после живой проверки: "Без выстрела" раньше
            // появлялась РАНЬШЕ, чем долетал Жнец, что сбивало с толку —
            // реверс решения 2026-10-11, см. CLAUDE.md). Первый интерактивный
            // диалог — только после посадки (reaperPreviewReady), подтверждение
            // размещения.
            if (!reaperPreviewReady) return null;
            if (!reaperConfirmed) {
                return {
                    kind: 'reaperConfirm',
                    text: turnHintText,
                    buttons: [
                        { key: 'confirm', title: '✓', variant: 'success', onPress: () => setReaperConfirmed(true) },
                        { key: 'cancel', title: '✕', variant: 'danger', onPress: () => setPendingReaperPlacement(null) },
                    ],
                };
            }
            return { kind: 'reaperShoot', text: turnHintText, buttons: [{ key: 'skip', title: 'Скип', variant: 'danger', onPress: () => handleReaperShoot(undefined) }] };
        }
        if (pendingSelect && !busy) {
            return {
                kind: 'select',
                text: turnHintText,
                buttons: [
                    { key: 'confirm', title: '✓', variant: 'success', onPress: handleConfirmSelect },
                    { key: 'cancel', title: '✕', variant: 'danger', onPress: handleCancelSelect },
                ],
            };
        }
        if (showRoadBonusChoice) {
            return {
                kind: 'roadBonus',
                text: turnHintText,
                buttons: [
                    { key: 'bonus', title: `Бонус +${game.trackGain ?? ''}`, variant: 'success', onPress: () => handleRoadBonus(true) },
                    { key: 'skip', title: '✕', variant: 'danger', onPress: () => handleRoadBonus(false) },
                ],
            };
        }
        if (showAbilitySkip) {
            return { kind: 'abilitySkip', text: turnHintText, buttons: [{ key: 'skip', title: 'Скип', variant: 'danger', onPress: handleAbilitySkip }] };
        }
        if (showShootSkip) {
            return { kind: 'shootSkip', text: turnHintText, buttons: [{ key: 'skip', title: 'Скип', variant: 'danger', onPress: handleShootSkip }] };
        }
        // Простая безкнопочная подсказка шага (SELECT в самом начале хода,
        // MOVE/SHOOT без доступного "скип", ожидание второго тапа усиления и
        // т.п.) — раньше сознательно НЕ дублировалась тут (см. комментарий
        // ниже), по прямому запросу пользователя 2026-10-15 модалка теперь
        // единственное место для ЛЮБОЙ подсказки хода, включая "Твой ход" в
        // самом начале шага. kind привязан к myStep — смена шага
        // (SELECT→MOVE→...) разворачивает карточку заново, даже если игрок
        // успел закрыть/свернуть её на предыдущем шаге; мелкие изменения
        // turnHintText В РАМКАХ одного шага не меняют kind — карточка
        // остаётся в том виде, в каком её оставил игрок.
        return { kind: `hint:${myStep}`, text: `Твой ход. ${turnHintText}` };
    })();

    // Общий элемент для обеих раскладок (было продублировано дважды —
    // вынесено в переменную, чтобы новые пропы не пришлось синхронизировать
    // руками в двух местах, см. runnerAnims/currentTurnPlayerId ниже).
    // gridData во время фаз 'settling' И 'wiping' подменяется на замороженный
    // снимок старого фрагмента 1 (trackShiftGridData) — камера уже там
    // (jumpTo(0) в эффекте выше), runners — тоже на trackShiftRunners (см.
    // выше, только реально уходящие с фрагмента 1), так что
    // destroy/fly у тех, кто там стоял, доигрывают поверх ПРАВИЛЬНОЙ (старой)
    // земли, а посторонние (перенумерованные выжившие с других фрагментов)
    // не примешиваются. Держим заморозку ВСЮ 'wiping' (не только 'settling',
    // как было раньше) — волна (columnOpacities ниже) должна гасить именно
    // этот старый снимок в пустоту, а не открывать под собой уже
    // переключившийся на новый фрагмент боевой рендер (см. докстринг
    // эффекта выше).
    const boardGridEl = (
        <BoardGrid
            gridData={
                (trackShiftPhase === 'settling' || trackShiftPhase === 'wiping') && trackShiftGridData
                    ? trackShiftGridData
                    : gridData
            }
            rows={rows}
            cols={viewportCols}
            segmentW={segmentW}
            segmentH={segmentH}
            windowStart={windowStart}
            orientation="portrait"
            containerWidth={roadContainerW}
            containerHeight={roadContainerH}
            runners={
                (trackShiftPhase === 'settling' || trackShiftPhase === 'wiping')
                    ? trackShiftRunners
                    : displayRunners
            }
            playerColorById={playerColorById}
            selectedRunnerId={activeRunner?.id ?? null}
            opponentSelectedRunnerId={opponentActiveRunner?.id ?? null}
            highlightedCells={highlightedCells}
            highlightMode={tapMode}
            runnerAnims={runnerAnim.anims}
            runnerVisualPositions={runnerAnim.visualPositions}
            currentTurnPlayerId={game.playerOrder}
            hiddenRunnerIds={runnerAnim.hiddenIds}
            ghostPairs={ghostPairs.pairs}
            mineBlasts={mineBlasts.blasts}
            ricochetTrails={ricochetTrails.trails}
            onCollisionPoseStart={handleCollisionPoseStart}
            onCollisionPoseEnd={handleCollisionPoseEnd}
            onAnimStepEnd={runnerAnim.completeStep}
            reaperPreview={reaperPreview}
            columnOpacities={
                trackShiftPhase === 'wiping' ? trackShiftWipeColumnOpacityMap
                    : trackShiftPhase === 'revealing' ? trackShiftRevealColumnOpacityMap
                        : null
            }
            cellOverrides={heldCells}
            onCellPress={handleCellPress}
        />
    );

    // renderCompactHeaderRow(headerRowH) — ряд из 5 квадратов (Раунд/Ход/
    // Бонус дороги, РЕЗИНОВЫЕ + настройки/лог) — ОДНА общая функция,
    // переиспользуемая ТРЕМЯ раскладками (mobileNav/useWebCompactChrome —
    // headerContent портретной PlayerInfoPanel при headerRowH=switchRowH, и
    // landscape — headerContent её левой панели при headerRowH=landscapeHeaderRowH,
    // см. оба места рендера ниже), а не три копии одного и того же дерева —
    // иначе "1:1 как Android" переставало бы быть гарантией уже на первой же
    // будущей правке этого ряда (копии неизбежно разъехались бы). Параметр
    // height (не захардкоженный switchRowH) — 2026-10-16, живой DOM-замер
    // вскрыл реальный баг первой версии: switchRowH сосчитан от ШИРИНЫ ВСЕГО
    // ЭКРАНА (портретный seam-ряд во всю ширину) — применённый напрямую к
    // узкой (300-430px) landscape-панели давал не квадраты, а узкие высокие
    // "плашки" (44×104 на реальном замере). landscapeHeaderRowH (см. её
    // объявление ниже) — своя, пропорциональная ширине ПАНЕЛИ величина.
    const renderCompactHeaderRow = (headerRowH) => {
        const { widths, fontStyle } = computeRoundTurnBonusLayout(headerRowH);
        return (
            <View
                style={[styles.panelHeaderRow, { height: headerRowH }]}
                onLayout={onPanelHeaderRowLayout}
            >
                <FramedSquare width={widths[0]} height={headerRowH} targetCornerSize={8} glow>
                    <Text style={[styles.seamRoundValue, fontStyle]} numberOfLines={1} noGlobalTint>
                        {`Р: ${game.round != null ? game.round + 1 : '-'}`}
                    </Text>
                </FramedSquare>
                <FramedSquare width={widths[1]} height={headerRowH} targetCornerSize={8} glow>
                    <Text style={[styles.seamRoundValue, fontStyle]} numberOfLines={1} noGlobalTint>
                        {(() => {
                            const turnsTaken = players.find((p) => p.id === activePlayerId)?.turnsTaken;
                            // 2026-10-16 — тот же формат "N/M", что и в PlayerInfoPanel.js#turnsLabel
                            // (landscape), добавлен сюда же по прямому запросу пользователя.
                            // 2026-10-17 — тот же фикс+решение, что и там (см. её докстринг за
                            // полным разбором): убран лишний +1 (бэк уже шлёт turnsTaken
                            // 1-индексным к моменту публикации), turnsTaken===0 — пустая строка
                            // после "Х: " вместо "0/3" (ещё не было ни одного хода в раунде).
                            if (turnsTaken == null) return 'Х: -';
                            if (turnsTaken === 0) return 'Х: ';
                            return game.turnsPerRound != null
                                ? `Х: ${turnsTaken}/${game.turnsPerRound}`
                                : `Х: ${turnsTaken}`;
                        })()}
                    </Text>
                </FramedSquare>
                <FramedSquare width={widths[2]} height={headerRowH} targetCornerSize={8} glow>
                    <Text style={[styles.seamBonusValue, fontStyle]} numberOfLines={1} noGlobalTint>
                        {`Б: ${game.trackGain != null && game.trackGain > 0 ? game.trackGain : '—'}`}
                    </Text>
                </FramedSquare>
                <FramedSquare variant="person" width={headerRowH} targetCornerSize={32} glow>
                    <GameMenuButton
                        size={headerRowH}
                        active={gameMenuOpen || settingsHubOpen || gameSettingsOpen || gameGeneralSettingsOpen}
                        onPress={handleOpenGameMenu}
                    />
                </FramedSquare>
                <FramedSquare variant="person" width={headerRowH} targetCornerSize={32} glow>
                    <TouchableOpacity ref={eventLogToggleRef} onPress={handleEventLogToggle} activeOpacity={0.8}>
                        <Image
                            source={eventLogOpen ? LOG_BUTTON_IMAGES.pressed : LOG_BUTTON_IMAGES.unpressed}
                            style={{ width: headerRowH, height: headerRowH }}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </FramedSquare>
            </View>
        );
    };
    // landscapeHeaderRowH — высота ряда для landscape-панели, пропорциональна
    // её РЕАЛЬНОЙ ширине (leftPanelW, 300-430px), а не ширине всего экрана
    // (как switchRowH) — 5 ячеек в ряд (3 резиновых + 2 квадратных
    // settings/log), делим ширину на 5, чтобы все 5 получились примерно
    // квадратными (settings/log — точно квадратные по построению, Р/Х/Б —
    // примерно, см. computeRoundTurnBonusLayout).
    const landscapeHeaderRowH = Math.round(leftPanelW / 5);
    const compactHeaderRow = renderCompactHeaderRow(switchRowH);
    const landscapeCompactHeaderRow = renderCompactHeaderRow(landscapeHeaderRowH);
    // landscapeSwitcherH — та же история, что у landscapeHeaderRowH чуть
    // выше, но для rocker-переключателя (PlayerSwitchPanel): 2026-10-16,
    // живая жалоба "панель с переключателями выбилась по размерам" —
    // reuse'нутый switcherH (0.15 от ВЫСОТЫ ЭКРАНА — рассчитан под seamRow
    // почти во весь экран) на узкой (300-430px) боковой панели давал 4
    // переключателя суммарной шириной БОЛЬШЕ самой панели (живой DOM-замер:
    // 4×81px=324px+зазоры при панели шириной 304px — вылезало на ~30px).
    // Формула теперь решает ОБРАТНУЮ задачу — высота, при которой 4
    // переключателя (SWITCH_ASPECT уже, не квадратные) + 3 зазора
    // (spacing.xs) ровно вписываются в контент-ширину панели (leftPanelW
    // минус её padding, spacing.md с каждой стороны, см. PlayerInfoPanel.js
    // #styles.panel) — ×0.95 запас, чтобы не упираться в самый край.
    const landscapeSwitcherH = Math.max(
        28,
        Math.floor(
            ((leftPanelW - spacing.md * 2 - spacing.xs * 3) / (4 * SWITCH_ASPECT)) * 0.95,
        ),
    );

    return (
        <View style={[styles.wrapper, isPortrait && styles.wrapperPortrait]}>
            {/* boardReady (см. BOARD_READY_DELAY_MS выше) — весь реальный контент экрана
                смонтирован и меряется СРАЗУ (opacity:0, а не отложенный рендер), просто не
                виден игроку, пока не пройдёт буфер — иначе сам спиннер ждал бы ещё и
                первого реального монтирования, а не только замеров. pointerEvents='none' —
                не даёт тапнуть по ещё не устаканившейся разметке, пока она скрыта. */}
            <View
                style={[styles.boardContent, isPortrait && styles.boardContentPortrait, { opacity: boardReady ? 1 : 0 }]}
                pointerEvents={boardReady ? 'auto' : 'none'}
            >
            {/* Гейт trackShiftPhase — по прямому запросу пользователя, 2026-09-09: если
                game_finish пришёл ОДНОВременно со сдвигом фрагмента (типовой случай —
                сдвиг уничтожает свободных бегунов соперника, тот уходит в OUT, у
                оставшегося ровно одного активного игрока сразу победа), модалка не
                должна перекрывать/обрывать кат-сцену сдвига — ждём, пока
                trackShiftPhase не станет null (хореография доиграла целиком), и только
                тогда показываем результат. game.status уже реально FINISH всё это
                время (редьюсер применяет мгновенно, как и везде в проекте) — гейтится
                только ПОКАЗ модалки, не сам факт завершения игры. Гейт hasDeathAnimPlaying
                (2026-09-12, расширено 2026-10-15 на обычный 'destroyed') — тем же способом
                ждём, пока не доиграет терминальная поза (burn/acid/destroyed), если она
                случилась ровно тем же ходом, что и победа — звук victory/lost (см. эффект
                рядом с hasDeathAnimPlaying выше) звучит СИНХРОННО с этим же условием.
                finishModalForced (2026-10-16) — страховка: если оба гейта почему-то
                никогда не снимутся сами, форсирует показ через FINISH_MODAL_SAFETY_MS
                (см. её докстринг) — игра уже реально закончена, прятать результат
                дольше нескольких секунд неверно в любом случае. */}
            <GameFinishModal
                visible={game.status === GAME_STATUS.FINISH && (finishModalForced || (!trackShiftPhase && !hasDeathAnimPlaying))}
                winnerName={winnerPlayer?.user?.username ?? (winnerPlayer ? `Игрок ${winnerPlayer.id}` : null)}
                onExit={goToMainMenu}
            />

            {/* Игровое меню — кнопка settings теперь в compactHeaderRow (см. её
                определение ниже, перед `return`) — рендерится во ВСЕХ трёх
                раскладках (mobileNav/useWebCompactChrome/landscape), 2026-10-16.
                Сами модалки тут рендерятся безусловно для всех, их видимость
                держит только gameMenuOpen и т.п. стейт. */}
            <GameMenuModal
                visible={gameMenuOpen}
                onClose={handleCloseGameMenu}
                onLeave={handleLeaveFromMenu}
                onSettings={handleOpenSettingsFromMenu}
            />
            <GameSettingsHubModal
                visible={settingsHubOpen}
                onClose={handleCloseSettingsHub}
                onSound={handleOpenSoundSettingsFromHub}
                onGeneral={handleOpenGeneralSettingsFromHub}
            />
            <GameSettingsModal visible={gameSettingsOpen} onClose={handleCloseSettings} />
            <GameGeneralSettingsModal visible={gameGeneralSettingsOpen} onClose={handleCloseGeneralSettings} />

            {/* Кат-сцена сдвига фрагментов/столкновение — раньше отдельный
                плавающий styles.collisionBanner (свой top-right угол,
                независимый от turnBanner/panelTurnBanner), теперь содержимое
                целиком переехало В turnBannerInner (см. его вычисление выше) —
                единая плитка "Твой ход"/"Ход игрока"/коллизия/сдвиг трассы,
                по прямому запросу пользователя, 2026-09-26. */}

            {/* Баннер хода в альбомной раскладке (веб) — раньше отдельный
                position:'absolute' блок НАД панелью (перекрывал переключатель
                игроков сверху), теперь — headerContent панели, тем же приёмом,
                что уже был у портретной раскладки: рендерится между
                переключателем игроков и плиткой кубиков/усилений (см.
                PlayerInfoPanel — !switcherAtBottom && switcher, потом
                headerContent, потом diceAbilitiesTile). По прямому запросу
                пользователя, 2026-09-26 — "менюшка поверх кнопок переключения,
                сделай встроенной... под кнопками, но над панелью с кубиками".
                width больше не передаётся явно — headerContent наследует
                ширину панели через обычный layout-поток. */}

            {!isPortrait && (
                <PlayerInfoPanel
                    players={players}
                    activePlayerId={activePlayerId}
                    onSelectPlayer={setActivePlayerId}
                    myPlayerId={myPlayer?.id ?? null}
                    currentTurnPlayerId={game.playerOrder}
                    canAct={myTurn && !busy}
                    myStep={myStep}
                    pendingAbility={pendingAbility}
                    pendingSelect={pendingSelect}
                    canSelectRunner={canSelectRunner}
                    highlightSelectIdle={highlightSelectIdle}
                    highlightAbilityIdle={showAbilitySkip}
                    onDropOnAbility={handleDropOnAbility}
                    onPressAbilityZone={handlePressAbilityZone}
                    onDropOnRunner={handleDropOnRunner}
                    onRunnerCardPress={handleRunnerCardPress}
                    onRunnerCardDoubleTap={handleRunnerCardDoubleTap}
                    width={leftPanelW}
                    // switcherHeight — landscapeSwitcherH (НЕ switcherH, см. её
                    // докстринг выше за разбором живого бага "переключатели
                    // вылезли за край панели").
                    switcherHeight={landscapeSwitcherH}
                    // 2026-10-16, ОТКАЧЕНО по прямому требованию пользователя
                    // ("что за уродство в некомпактной версии веба, верни как
                    // было") — compactColumns для landscape БОЛЬШЕ НЕ передаём,
                    // большие карточки/горизонтальный трей кубиков снова как
                    // были. Оставлены ТОЛЬКО headerContent (ряд Раунд/Ход/Бонус+
                    // настройки/лог, landscapeCompactHeaderRow — пользователь
                    // прямо попросил это оставить) и hideReaperNode (не
                    // дублировать тот же ряд ещё и подписанной копией внутри
                    // тела, см. ScrollView-ветку PlayerInfoPanel.js). Сам баннер
                    // хода по-прежнему не нужен — та же информация уже
                    // показывается GameDialogModal (рендерится ниже, вне
                    // зависимости от isPortrait). rockerSwitcher — тот же
                    // rocker-переключатель (PlayerSwitchPanel), что в seamRow
                    // мобильной/веб-компактной раскладки, вместо старых
                    // текстовых табов PlayerSwitcher — по прямому запросу
                    // пользователя ("для переключателей между игроками
                    // используй подход switch из android").
                    hideReaperNode
                    rockerSwitcher
                    headerContent={landscapeCompactHeaderRow}
                    roadBonusValue={game.trackGain}
                    gameRound={game.round}
                    turnsPerRound={game.turnsPerRound}
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
                {!useMobileNavButtons && !useWebCompactChrome && (
                    <View style={styles.navBtnColumnLeft}>
                        <RoadNavButton direction="up" size={navBtnSize} handlers={forwardButtonProps} />
                        <RoadNavButton direction="down" size={navBtnSize} handlers={backButtonProps} />
                    </View>
                )}

                <View style={styles.roadFrameWrap} onLayout={handleRoadFrameLayout}>
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
                            {/* Появление/исчезновение фрагмента при сдвиге трассы теперь
                                рисует САМ BoardGrid (columnOpacities — см. эффект у
                                trackShiftPhase выше) — обёртка тут не нужна,
                                boardGridStack остался чисто layout-контейнером.
                                GestureDetector — см. boardSwipeGesture выше
                                (`.enabled(Platform.OS==='android')` внутри
                                самого жеста, отдельного условия тут не нужно;
                                на вебе/iOS жест просто никогда не активируется,
                                обычные тапы по клеткам не затронуты). */}
                            <GestureDetector gesture={boardSwipeGesture}>
                                <View style={styles.boardGridStack}>
                                    {boardGridEl}
                                </View>
                            </GestureDetector>
                        </View>
                    </RoadArea>
                    {/* bleed.top закрывает И вырез/статус-бар (insets.top), плюс
                        небольшой запас — так рамка реально доходит до истинного верха
                        экрана. Лево/право — чуть за край экрана. Низ — 0 (шов с панелью,
                        рамки соприкасаются впритык, каждая остаётся отдельной рамкой со
                        всеми 4 скруглёнными углами — НЕ сливаются в одну). */}
                    {(useMobileNavButtons || useWebCompactChrome) && (
                        <MobileFrameOverlay
                            borderDp={arrowBtnSize}
                            bleed={{
                                top: insets.top + MOBILE_FRAME_BLEED,
                                left: MOBILE_FRAME_BLEED,
                                right: MOBILE_FRAME_BLEED,
                            }}
                            cornerBackdropColor={colors.panelPlateBg}
                        />
                    )}
                    {/* Стрелки навигации — ПЕРЕЕХАЛИ в строку под швом (seamRow,
                        см. её рендер ниже), 2026-10-15, по прямому запросу
                        пользователя: на кайме рамки дороги их больше нет,
                        освободившееся место заняли только MobileFrameOverlay/
                        GameDialogModal ниже. */}
                    {/* ВРЕМЕННЫЙ ДУБЛЬ turnBannerInner — см. dialogState выше за
                        полным разбором. Ребёнок roadFrameWrap (не корневого
                        wrapper) — по прямому запросу пользователя: сначала
                        сидела поверх ВЕРХНЕЙ части дороги (2026-10-12), потом
                        переехала к НИЖНЕЙ (2026-10-15, justifyContent внутри
                        самого компонента).
                        bottomInset — 2026-10-15, живая жалоба "низ модалки
                        должен совпадать с низом первой клетки дороги, БЕЗ
                        нахлёста на рамку" (zIndex-костыль, рисовавший модалку
                        ПОВЕРХ рамки, был отклонён пользователем — нужно не
                        перекрытие, а отсутствие пересечения вообще). У
                        MobileFrameOverlay ниже bottom-bleed всегда 0 (кайма
                        внизу НЕ выступает наружу, см. её вызов — bleed без
                        bottom-поля) — значит её ВНУТРЕННИЙ край (где кайма
                        перестаёт перекрывать контент) ровно на arrowBtnSize
                        px от истинного низа roadFrameWrap, см. useBoardLayout
                        .js#frameEdgeClearance за той же логикой для ширины.
                        Только mobileNav (useMobileNavButtons) — у этой рамки
                        вообще нет такой каймы в остальных раскладках. */}
                    <GameDialogModal
                        dialogState={dialogState}
                        width={roadFrameSize?.width}
                        height={roadFrameSize?.height}
                        bottomInset={(useMobileNavButtons || useWebCompactChrome) ? arrowBtnSize : undefined}
                    />
                </View>
            </View>

            {isPortrait && (
                // backgroundColor (2026-10-10, по прямому запросу пользователя,
                // ВТОРАЯ попытка — первая, 2026-10-10 раньше в этот же день,
                // была реализована и полностью откачена, см. CLAUDE.md) — ТОЛЬКО
                // useMobileNavButtons (портрет+native, условие внутри стиля):
                // панель больше не в декоративной MobileFrameOverlay-рамке (той
                // ниже тут больше нет вообще), вместо неё — сплошная заливка
                // person_panel_background (см. styles.panelFrameWrap — сам цвет
                // #2d3e4f измерен из PNG, который оказался АБСОЛЮТНО плоским,
                // без текстуры, поэтому цвет, не тайлинг картинками). Веб-портрет
                // (isPortrait без useMobileNavButtons) не затронут — там всё как
                // было (полупрозрачная панель поверх параллакса).
                <View style={[styles.panelFrameWrap, (useMobileNavButtons || useWebCompactChrome) && styles.panelFrameWrapFlat]}>
                    <PlayerInfoPanel
                        players={players}
                        activePlayerId={activePlayerId}
                        onSelectPlayer={setActivePlayerId}
                        myPlayerId={myPlayer?.id ?? null}
                    currentTurnPlayerId={game.playerOrder}
                        canAct={myTurn && !busy}
                        myStep={myStep}
                        pendingAbility={pendingAbility}
                        pendingSelect={pendingSelect}
                        canSelectRunner={canSelectRunner}
                    highlightSelectIdle={highlightSelectIdle}
                    highlightAbilityIdle={showAbilitySkip}
                        onDropOnAbility={handleDropOnAbility}
                        onPressAbilityZone={handlePressAbilityZone}
                        onDropOnRunner={handleDropOnRunner}
                        onRunnerCardPress={handleRunnerCardPress}
                        onRunnerCardDoubleTap={handleRunnerCardDoubleTap}
                        height={panelH}
                        switcherHeight={switcherH}
                        switcherAtBottom
                        compactColumns
                        flatBackground={useMobileNavButtons || useWebCompactChrome}
                        switchRowHeight={(useMobileNavButtons || useWebCompactChrome) ? switchRowH : 0}
                        headerContent={
                            (useMobileNavButtons || useWebCompactChrome) ? compactHeaderRow : (
                                <View style={styles.turnBannerRow}>
                                    <View style={[styles.turnBanner, styles.turnBannerFlex]} onLayout={onTurnBannerLayout}>
                                        <FramePanel size={turnBannerSize} targetCornerSize={10} />
                                        <NeonGlow size={turnBannerSize} radius={frameNotchRadius(turnBannerSize, 10)} />
                                        {turnBannerInner}
                                    </View>
                                </View>
                            )
                        }
                        roadBonusValue={game.trackGain}
                        gameRound={game.round}
                        turnsPerRound={game.turnsPerRound}
                    />
                </View>
            )}

            {/* Единая строка под швом — ОДНИМ рядом: панель имени, 4
                переключателя игрока, кнопки навигации — ВСЕ одной и той же
                высоты (switchRowH). Порядок имя→переключатели (2026-10-15,
                по прямому запросу пользователя — переставлены, раньше было
                переключатели→имя), настройки/лог ПЕРЕЕХАЛИ в headerContent
                (см. выше) — их место заняли RoadNavButton (переехали сюда с
                каймы рамки дороги, см. её докстринг выше). Панель имени —
                ФИКСИРОВАННОЙ ширины (seamNameWidth), НЕ растягивается на
                остаток строки — по прямому запросу пользователя ("уже, чем
                сейчас"); свободное место справа от неё/навигации просто
                остаётся залито тем же фоном строки (styles.seamRow#
                backgroundColor), не выглядит как дырка. Лежит ЦЕЛИКОМ ниже
                стыка, внутри territory панели — рамку дороги не трогает
                (предыдущая версия стояла ровно на стыке и конфликтовала то
                с рамкой, то с баннером хода внутри панели — живые жалобы).
                switchRowH — высота всей строки, та же величина, что
                PlayerInfoPanel резервирует у себя СВЕРХУ через
                switchRowHeight (см. её докстринг) — floating-ряд рисуется
                ровно над этим зарезервированным зазором. Только
                useMobileNavButtons/useWebCompactChrome — для landscape (!isPortrait)
                раскладка не менялась, НО старая плашка-бейдж EventLogPanel
                (правый нижний угол) для неё теперь тоже убрана (2026-10-16) —
                landscape-панель получила СВОЮ иконку лога в compactHeaderRow
                (см. её headerContent выше), держать сразу два независимых
                переключателя "открыт/закрыт" (eventLogOpen тут vs. свой
                useState внутри EventLogPanel.js) было бы путаницей. См. else
                ниже — для isPortrait он фактически недостижим (оба флага
                вместе покрывают isPortrait целиком), оставлен только как
                defensive-фолбэк. */}
            {(useMobileNavButtons || useWebCompactChrome) ? (
                <View style={[styles.seamRow, { bottom: panelH - switchRowH, height: switchRowH }]} onLayout={onSeamRowLayout}>
                    {/* Панель имени — FramedSquare variant="frame" (по
                        умолчанию, FramePanel — "как у аватарки бегуна"), НЕ
                        старый PersonPanel-based NamePanel — финальный выбор
                        стиля после нескольких правок, см. докстринг у места
                        рендера кнопок навигации на рамке дороги выше. */}
                    <FramedSquare width={seamNameWidth} height={switchRowH} targetCornerSize={8} glow>
                        <Text style={styles.seamNameText} numberOfLines={1} noGlobalTint>
                            {players.find((p) => p.id === activePlayerId)?.name ?? ''}
                        </Text>
                    </FramedSquare>
                    {/* marginLeft: spacing.xs (2026-10-15 — сдвинулся на
                        переключатели вместе с перестановкой имя↔переключатели,
                        раньше был на имени) — тот же зазор, что и между самими
                        переключателями (PlayerSwitchPanel.js#styles.row.gap).
                        Такой же marginLeft (2026-10-15, живая жалоба —
                        "налезает, плотнячком") теперь и у первой кнопки
                        навигации (см. её рендер ниже) — единственный стык
                        БЕЗ зазора в этой строке — между самими кнопками
                        навигации (up/down), см. styles.seamRow#gap=0. */}
                    <View style={{ marginLeft: spacing.xs }}>
                        <PlayerSwitchPanel players={players} activeId={activePlayerId} onSelect={setActivePlayerId} height={switchRowH} />
                    </View>
                    {/* Кнопки навигации — ПЕРЕЕХАЛИ сюда с каймы рамки дороги
                        (2026-10-15, по прямому запросу пользователя, на место
                        настроек/лога — те переехали в headerContent, см.
                        выше). variant="person" + targetCornerSize/размер —
                        ТЕ ЖЕ, что были у настроек/лога тут раньше (честная
                        9-slice рамка без фона, PNG-ассет RoadNavButton и так
                        не содержит нарисованной линии-рамки, см. CLAUDE.md
                        2026-10-10). Квадратные (size=switchRowH), не
                        прямоугольные 2:1, как были на кайме рамки — там
                        RoadNavButton поддерживает отдельные width/height,
                        тут используем только size (обе грани равны).
                        marginLeft: spacing.xs (2026-10-15, живая жалоба
                        пользователя — "налезает, плотнячком") — тот же
                        зазор, что уже стоит между именем и переключателями
                        (см. выше), для единообразия по всей строке: теперь
                        ЛЮБОЙ стык в seamRow — либо spacing.xs, либо явно
                        gap:0 (переключатели между собой/настройки-лог —
                        не трогали). */}
                    <FramedSquare variant="person" width={switchRowH} targetCornerSize={32} glow style={styles.seamNavUpSpacer}>
                        <RoadNavButton direction="up" size={switchRowH} handlers={forwardButtonProps} />
                    </FramedSquare>
                    <FramedSquare variant="person" width={switchRowH} targetCornerSize={32} glow>
                        <RoadNavButton direction="down" size={switchRowH} handlers={backButtonProps} />
                    </FramedSquare>
                </View>
            ) : isPortrait ? (
                <EventLogPanel entries={eventLog} position="top" />
            ) : null}
            </View>
            {!boardReady && (
                <View style={[styles.boardReadyOverlay, { width: windowDimensions.width, height: windowDimensions.height }]}>
                    <LoadingCard label={STATUS_LABEL[status] ?? ''} />
                </View>
            )}
            {/* Лог событий (mobileNav, зона 9) — список. ПОСЛЕДНИЙ ребёнок
                корня экрана: рисуется позже (= поверх) ВСЕГО остального JSX
                этого файла, никакой Modal/zIndex-эквилибристики не нужно —
                см. EventLogPanel.js за докстрингом/историей, почему именно
                так. eventLogAnchor===null — доля секунды до результата
                measureInWindow, ничего не рисуем этот один кадр. */}
            {eventLogOpen && eventLogAnchor && (
                <ScrollView
                    style={[
                        EVENT_LOG_PANEL_STYLE,
                        styles.eventLogOverlay,
                        { right: eventLogAnchor.right, bottom: eventLogAnchor.bottom + spacing.xs },
                    ]}
                    contentContainerStyle={styles.eventLogOverlayContent}
                >
                    <EventLogEntries entries={eventLog} />
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // БЕЗ backgroundColor (2026-09-14) — раньше тут стоял colors.bg как
    // фолбэк на случай, если Animated.Image параллакс-фона не успевает/не
    // может отрисоваться (тяжёлый экран, много одновременных картинок, смена
    // ориентации через useAdaptiveOrientation), чтобы из-под него на Android
    // не просвечивал белый фон Activity по умолчанию. Теперь ParallaxBackground
    // ОДИН на всё приложение (App.js, живёт выше этого экрана) — свой
    // непрозрачный фон тут перекрывал бы его ПОЛНОСТЬЮ на каждом рендере
    // этого экрана, что и обесценивало бы саму идею общего непрерывного
    // фона. Фолбэк-цвет теперь ОДИН, на корневом View в App.js.
    // flexDirection:'row' — альбомная раскладка (панель слева, доска справа).
    // Портретная (wrapperPortrait) переключает на column — доска сверху,
    // панель снизу (см. useBoardLayout.orientation).
    wrapper: { flex: 1, flexDirection: 'row' },
    wrapperPortrait: { flexDirection: 'column' },
    // boardContent/boardContentPortrait — зеркалят wrapper/wrapperPortrait один
    // в один (та же row/column-раскладка панели+доски), просто на один уровень
    // глубже — см. boardReady выше: нужна отдельная обёртка, чтобы гасить
    // opacity ТОЛЬКО реального контента, не самого спиннера-оверлея (тот —
    // соседний, не вложенный, элемент wrapper).
    boardContent: { flex: 1, flexDirection: 'row' },
    boardContentPortrait: { flexDirection: 'column' },
    // position:'absolute' + top/left:0 + явный width/height (прокинуты инлайн
    // в месте рендера, useWindowDimensions) — НЕ absoluteFillObject
    // (top/left/right/bottom:0): та же Android-ненадёжность растягивания
    // через right/bottom внутри flex:1-родителя без явного размера, что и у
    // GameDialogModal (см. roadFrameSize-комментарий выше).
    boardReadyOverlay: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
    // Лог событий (mobileNav, зона 9) — см. докстринг у места рендера (конец
    // файла) за тем, почему позиция считается через measureInWindow, а не
    // живёт внутри EventLogPanel.js. right/bottom — инлайн (из eventLogAnchor).
    // zIndex/elevation (2026-10-15, живая жалоба — список ВСЁ ЕЩЁ рисовался
    // ЗА рамкой дороги (зона 2, zIndex:10) и за строкой под швом (seamRow,
    // zIndex:30), несмотря на то что это последний ребёнок корня) —
    // "последний сосед рисуется поверх" верно ТОЛЬКО когда ни у кого из
    // соседей нет явного zIndex; раз у seamRow/MobileFrameOverlay он есть,
    // Android сортирует ВСЕХ соседей по значению, а не по порядку в дереве
    // — безымянный (0) сосед проигрывает им, даже будучи последним по
    // JSX. Явный zIndex тут обязателен и должен быть БОЛЬШЕ обоих (30).
    eventLogOverlay: { position: 'absolute', zIndex: 40, elevation: 36 },
    eventLogOverlayContent: { padding: spacing.sm },
    // roadFrameWrap — обёртка под MobileFrameOverlay (та ОСТАЁТСЯ у дороги,
    // не трогали, 2026-10-10), ТОЛЬКО position:'relative', БЕЗ overflow:
    // 'hidden' — рамка сама заполняет её РОВНО (не вылезает за границы, см.
    // компонент), этот View просто даёт ей позиционирующий контекст. flex:1
    // — тот же слот, что раньше держал RoadArea напрямую.
    roadFrameWrap: { flex: 1, position: 'relative' },
    // roadFrameNavRow — УБРАН 2026-10-15 (стрелки навигации переехали в
    // seamRow, см. её стиль ниже) — больше не нужен, zIndex-проблема (кнопки
    // ПОД рамкой MobileFrameOverlay) этого места тоже снята сама собой,
    // seamRow уже имела свой zIndex:30 для других целей.
    // Полоса имени фрагмента (FragmentLabelStrip) + сетка, бок о бок — портретная
    // раскладка. Обе имеют явную height=roadContainerH (см. JSX), выравнивать
    // по кросс-оси дополнительно не нужно.
    roadRowPortrait: { flexDirection: 'row' },
    // Чисто layout-обёртка вокруг boardGridEl — появление/исчезновение
    // фрагмента (хореография сдвига) рисует сам BoardGrid (columnOpacities),
    // отдельного Animated.View тут не нужно.
    // position:'relative' оставлен для консистентности с остальными
    // stack-обёртками в этом файле.
    boardGridStack: { position: 'relative' },
    panelFrameWrap: { position: 'relative' },
    // Сплошная заливка панели на мобильном портрете (2026-10-10, с 2026-10-16
    // — и на веб-компакте, useWebCompactChrome) — см. комментарий у места
    // рендера (useMobileNavButtons || useWebCompactChrome) и colors.panelPlateBg
    // за происхождением цвета. Применяется ТОЛЬКО в этих случаях (отдельный
    // стиль, не влит в panelFrameWrap) — в landscape panelFrameWrap не
    // используется вообще (там своя, более узкая подмена, см. hideReaperNode
    // в PlayerInfoPanel.js), панель там остаётся со своим обычным
    // полупрозрачным фоном.
    panelFrameWrapFlat: { backgroundColor: colors.panelPlateBg },
    // Абсолютный ряд НА стыке дорожной и панельной рамок (см. комментарий в
    // JSX про расчёт bottom) — sibling обеих зон на уровне wrapper, поэтому
    // left+right без width, а не flex. zIndex/elevation выше рамок (10) и
    // выше EventLogPanel-плашек в остальных режимах (25), чтобы кнопки и
    // тоггл лога были кликабельны и видны поверх текстуры рамок.
    // backgroundColor (2026-10-10) — та же заливка, что и у panelFrameWrapFlat
    // (colors.panelPlateBg), чтобы шов с кнопками навигации/лога/настроек не
    // оставался прозрачным островком между дорогой и панелью (ровно та
    // "кривизна" первой попытки, по прямому замечанию пользователя) — этот
    // стиль рисуется ТОЛЬКО внутри useMobileNavButtons-ветки (см. место
    // рендера), отдельного условия тут не нужно.
    // elevation (2026-10-10, живая жалоба пользователя: видимый "зазор" между
    // этой строкой и панелью хода ниже + её собственный фон визуально отличался
    // по цвету от того же colors.panelPlateBg у панели) — elevation на Android
    // это НЕ только z-order, это ЕЩЁ И настоящая Material-тень (чем больше
    // число, тем гуще/шире размытие), а 30 было взято с запасом только чтобы
    // перебить другие элементы (рамка — 10, EventLogPanel в остальных
    // режимах — 25), не как осознанный выбор интенсивности тени. Снижено до
    // 26 (всё ещё перебивает 25) — тень заметно слабее; shadowColor:
    // 'transparent' — доп. подстраховка, на части версий RN/Android гасит её
    // почти полностью, не трогая сам z-order (который даёт elevation).
    // paddingHorizontal: spacing.md (2026-10-10, было spacing.sm, живая
    // жалоба "пустота справа, не вровень с панелью хода") — ТА ЖЕ величина,
    // что `padding` у PlayerInfoPanel.js#styles.panel (корень панели, внутри
    // которого лежит баннер хода) — левый край этой строки совпадает с левым
    // краем баннера хода. Содержимое строки (2026-10-11, см. место рендера)
    // вычисляется под точную ширину строки (seamNameWidth, см. seamRowWidth/
    // onSeamRowLayout) — переключатели+имя+настройки+лог заполняют её ровно
    // впритык к правому краю, без остатка. gap:0 (2026-10-11, прямой запрос
    // пользователя "между элементами не должно быть расстояния") — элементы
    // строки вплотную друг к другу (внутренний зазор МЕЖДУ 4 переключателями
    // — отдельный, см. PlayerSwitchPanel.js#styles.row, не трогали).
    seamRow: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.panelPlateBg,
        zIndex: 30,
        elevation: 26,
        shadowColor: 'transparent',
    },
    // Панель имени в строке под швом (2026-10-11) — просто Text, фиксированная
    // ширина/высота задаются инлайн через FramedSquare (seamNameWidth/
    // switchRowH, см. место рендера). 2026-10-15 — сосед справа сменился:
    // раньше настройки+лог, теперь кнопки навигации (переехали с каймы рамки
    // дороги, те уехали в headerContent, см. его докстринг).
    seamNameText: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.small },
    // Тот же стиль, что был у RoundPanel/RoadBonusPanel#styles.value (см.
    // их докстринги) — визуальное единообразие сохранено, хотя сам рендер
    // теперь инлайн через FramedSquare, не через эти компоненты (те остались
    // на PersonPanel, используются landscape/web-раскладкой в PlayerInfoPanel).
    // Используется в styles.panelHeaderRow (headerContent, см. её рендер) —
    // 2026-10-15 переехал туда с панели "Твой ход" (та убрана целиком для
    // mobileNav), сам стиль текста не менялся.
    seamRoundValue: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.h2 },
    seamBonusValue: { color: colors.success, fontWeight: 'bold', fontSize: font.h2 },
    // Ряд из 5 квадратов (Раунд/Ход/Бонус дороги + настройки/лог) на месте
    // убранного баннера "Твой ход" — ТОЛЬКО mobileNav, см. headerContent.
    // marginTop — та же величина, что раньше держал сам turnBanner (верх
    // ряда начинается на том же месте, где раньше начинался баннер).
    panelHeaderRow: { flexDirection: 'row', marginTop: spacing.xs },
    // 2026-10-16 — вынесен из инлайн-объекта у кнопки навигации "вверх" в
    // seamRow: StyleSheet.create даёт СТАБИЛЬНУЮ ссылку на каждый ре-рендер
    // (в отличие от {marginLeft: spacing.xs} прямо в JSX), что нужно для
    // корректной работы React.memo у FramedSquare (см. её докстринг).
    seamNavUpSpacer: { marginLeft: spacing.xs },
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
    // Раньше — контейнер отдельного плавающего collisionBanner (свой
    // top-right угол, pill-форма). Теперь коллизия — просто одна из веток
    // turnBannerInner (см. компонент), рисуется ВНУТРИ общего styles.turnBanner
    // — этот стиль только про внутреннюю раскладку строки (текст слева,
    // кнопки справа), не про позиционирование на экране.
    collisionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    // flex:1 — забирает всю ширину, оставшуюся ПОСЛЕ кнопок (которые не
    // должны сжиматься), не наоборот — иначе длинный текст с результатом
    // броска мог бы вытолкнуть кнопки за пределы баннера.
    collisionTextColumn: { flex: 1 },
    collisionBtnText: { fontSize: font.tiny, fontWeight: '600' },
    // Баннер хода/столкновения/сдвига трассы — headerContent PlayerInfoPanel
    // В ОБЕИХ раскладках (портретная и альбомная), между переключателем
    // игроков и плиткой кубиков/усилений (см. место рендера в обоих вызовах
    // PlayerInfoPanel). Раньше в альбомной раскладке был отдельный
    // position:'absolute' блок НАД панелью (перекрывал переключатель) — по
    // прямому запросу пользователя, 2026-09-26, встроен туда же, где уже был
    // портретный вариант (тогда panelTurnBanner и turnBanner были двумя
    // идентичными по сути стилями, слиты в один). height (было minHeight,
    // см. ниже)+justifyContent — плитка ЗАФИКСИРОВАНА под 3 строки (см.
    // TURN_BANNER_MIN_HEIGHT) и больше не "прыгает" по высоте между "Твой
    // ход"/подсказкой/коллизией/сдвигом трассы — контент короче трёх строк
    // просто центрируется внутри, а не растягивает контейнер.
    // 2026-09-28 — плоская заливка (backgroundColor/borderRadius) убрана:
    // фон и скруглённые уголки теперь рисует `FramePanel` (см. её рендер
    // рядом с onTurnBannerLayout выше, position:'absolute' поверх ЭТОГО же
    // View — сам `turnBanner` остаётся обычным flow-контейнером с паддингом,
    // FramePanel не участвует в раскладке).
    // height, НЕ minHeight + overflow:'hidden' (2026-10-11, прямое
    // уточнение пользователя после живого бага на реальном устройстве —
    // "не должна менять размер ВНЕ ЗАВИСИМОСТИ от того, что отображается,
    // нужно уметь уместить всё что угодно, не меняя размера") — `minHeight`
    // это только ПОЛ, а не потолок: если контенту (например двухстрочный
    // коллизионный текст + кнопки) не хватало места, бокс всё равно рос.
    // Теперь высота ЖЁСТКО фиксирована — контент, которому не хватает места,
    // обрезается (`overflow:'hidden'`), а не раздвигает рамку. Это также
    // попутно устраняет и сам баг с раздутой панелью (см. turnBannerRow
    // ниже, 'flex-start') — при фиксированной height turnBanner больше
    // физически не может сообщить onLayout'у "завышенный" размер, которым
    // раньше подпитывалась колонка раунд/ход/бонус.
    turnBanner: {
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
        marginTop: spacing.xs,
        height: TURN_BANNER_MIN_HEIGHT, justifyContent: 'center', overflow: 'hidden',
    },
    // turnBannerRow/turnBannerFlex — ТОЛЬКО веб-портрет (useMobileNavButtons
    // false), см. headerContent — mobileNav-ветка 2026-10-15 переведена на
    // отдельный styles.panelHeaderRow (баннер "Твой ход" там убран целиком,
    // см. её докстринг), эта пара стилей теперь обслуживает только
    // одиночный turnBanner-child веб-раскладки. Исторически (2026-10-11)
    // turnBannerRow несла ещё и колонку раунд/ход/бонус рядом с баннером
    // (turnBannerSideCol, с этого же захода УДАЛЕНА как мёртвый код) —
    // alignItems:'flex-start' тогда чинила живой баг циклической
    // зависимости высоты между ними (конкретику см. в git-истории/
    // CLAUDE_ARCHIVE.md при необходимости) — сейчас, с единственным
    // ребёнком, эта зависимость физически не может возникнуть, но сам
    // alignItems не мешает и не трогался, чтобы не расширять правку.
    turnBannerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.xs },
    turnBannerFlex: { flex: 1, marginTop: 0 },
    turnTitle: { color: colors.textOnDarkSecondary, fontSize: font.small, fontWeight: 'bold' },
    // color тут больше не используется (PulseText сам управляет цветом, см.
    // выше) — оставлен как безопасный дефолт на случай, если PulseText
    // почему-то не смонтируется. textAlign:'center' — по прямому запросу
    // пользователя, 2026-09-14, тайтл был прижат влево.
    turnTitleMine: { color: colors.success, fontSize: font.small, fontWeight: 'bold', textAlign: 'center' },
    turnHint: { color: colors.textOnDark, fontSize: font.tiny, marginTop: 2 },
    // Только для безкнопочного случая (см. turnBannerInner) — строки с
    // кнопками справа (turnHintFlex) не центрируем, там текст рядом с кнопкой.
    turnHintCenter: { textAlign: 'center' },
    // pendingSelect — текст+кнопки ✓/✕ в ОДНУ строку (см. turnBannerInner
    // выше), не друг под другом — сокращает высоту плитки диалога.
    turnHintRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: spacing.xs },
    turnHintFlex: { flex: 1, marginTop: 0 },
    turnSkipBtn: { minHeight: 32, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, marginTop: spacing.xs },
    // Компактный вариант turnSkipBtn для ✓/✕ рядом с текстом — без
    // marginTop (уже выровнены по строке через alignItems:'center' в
    // turnHintRow) и с меньшим горизонтальным паддингом (иконка уже сама по
    // себе узкая, полноразмерный паддинг кнопки тут ни к чему).
    // Ниже, чем обычный turnSkipBtn (minHeight:32) — по прямому запросу
    // пользователя, 2026-09-14 (сначала сказал "поуже", имел в виду "пониже").
    // Та же величина, что раньше была у отдельного collisionBtn (теперь
    // коллизия использует этот же стиль — см. turnBannerInner).
    turnSkipBtnCompact: { minHeight: 26, paddingVertical: 2, paddingHorizontal: spacing.md },
    turnBtnRow: { flexDirection: 'row', gap: spacing.xs },
});
