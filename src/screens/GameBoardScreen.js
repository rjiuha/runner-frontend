// src/screens/GameBoardScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
import EventLogPanel from '../components/game/EventLogPanel';
import GameMenuButton from '../components/game/GameMenuButton';
import GameMenuModal from '../components/game/GameMenuModal';
import GameSettingsModal from '../components/game/GameSettingsModal';
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
import { useAdaptiveOrientation } from '../hooks/useAdaptiveOrientation';
import { useRunnerAnimations } from '../hooks/useRunnerAnimations';
import { useGhostPairs } from '../hooks/useGhostPairs';
import { useMineBlasts } from '../hooks/useMineBlasts';
import { ROAD_AREA_SPACING, useBoardLayout } from '../hooks/useBoardLayout';
import { useBoardScroll } from '../hooks/useBoardScroll';
import { flattenTrackSegments, flattenPeekColumn, computeFragmentBands, resolveCellVisual, pickSegmentImage, pickBaseImage } from '../lib/board';
import { forwardNeighbors, cellKey } from '../lib/hexDirection';
import { describeEvent, directionLabel, rawEventFallback } from '../lib/eventLog';
import { handleSequenceItem, DEATH_KIND_BY_REASON } from '../lib/runnerAnimTriggers';
import { identifyGhostConsumption } from '../lib/ghostPairs';
import { pickActiveSoundSource, pickShootSoundSource, pickMoveSoundSource, pickStartSoundSource } from '../lib/runnerSoundTriggers';
import { COLLISION_SOUND, FALLBACK_MOVE_SOUND, pickRandom } from '../constants/runnerSounds';
import { COMMENT_SOUNDS } from '../constants/commentSounds';
import { BACKGROUND_MUSIC_TRACKS, pickRandomTrackIndex } from '../constants/backgroundMusic';
import { notify, confirm } from '../lib/notify';
import { createLogger } from '../lib/logger';
import { runnerGameApi } from '../api/runnerGame';
import { runnerGameReducer } from '../store/runnerGameReducer';
import { ROUTES } from '../navigation/routes';
import {
    BACKEND_TO_FRONTEND_PLAYER_COLOR,
    BOARD_LAYOUT, GAME_STATUS, MOBILE_FRAME_BLEED,
    PLAYER_COLOR_HEX, PLAYER_COLORS, PLAYER_STATUS, PLAYER_STEP,
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

// Collision — PHP int-backed enum на бэке (Enum/Collision.php: LOWER=1/TOP=2),
// json_encode сериализует backed enum напрямую в число (не строку). Нужна
// collisionFlyingRunnerLabel (см. тело компонента) для формулы TOP→runnerId/
// LOWER→otherRunnerId, см. её докстринг за разбором StepCollisionService.
const COLLISION_TOP = 2;

// Высота баннера "Твой ход"/столкновение/сдвиг трассы — ЗАФИКСИРОВАНА под 3
// строки (заголовок + подсказка + опциональная вторая строка вроде "Бросок:
// ...") вместо auto-height, чтобы плитка не "прыгала" по высоте между
// разными состояниями (раньше три РАЗНЫХ баннера — turnBanner/panelTurnBanner
// + отдельный collisionBanner — были схлопнуты в один общий контейнер, см.
// turnBannerInner ниже, по прямому запросу пользователя, 2026-09-26). Меньше
// на native (2026-09-26, живая жалоба с Android) — там баннер встроен в
// PlayerInfoPanel с ФИКСИРОВАННЫМ общим бюджетом высоты (panelH, см.
// useBoardLayout), а не растягивается вместе с экраном, как на вебе
// (панель веба высотой во весь столбец) — полные 78 сдвигали плитку
// кубиков/усилений за пределы видимой области.
const TURN_BANNER_MIN_HEIGHT = Platform.OS === 'web' ? 78 : 64;

// Хореография сдвига фрагментов трассы (game_track_updated) — по прямому
// запросу пользователя, 2026-09-08: заход на "пик" 4-го фрагмента (см.
// lib/board#flattenPeekColumn) должен переключать ВСЕХ игроков на фрагмент 1,
// показать там destroy/fly у тех, кто на нём стоял, дать фрагменту исчезнуть
// волной по колонкам, затем прыгнуть камерой к бегуну, который вызвал сдвиг,
// и плавно проявить новый вид. См. подробный разбор у эффекта ниже.
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
    // "Комментарии" (2026-09-11) — звуки результатов из assets/sounds/comments/
    // (старт партии/уничтожение/выбывание/столкновение/аномалия), см.
    // constants/commentSounds.js. Один общий канал на все 5 категорий — тот
    // же компромисс, что и у voice/shoot/start чуть выше (если два разных
    // комментария выпадут почти одновременно, второй оборвёт первый через
    // .replace() — событие редкое, специально не усложняем множеством
    // каналов). collisionSound играет ЦИКЛИЧНО, пока видна поза столкновения
    // (см. handleCollisionPoseStart/End ниже), а не один раз коротким
    // хлопком — по прямому запросу пользователя.
    const commentSound = useAudioPlayer(null);
    useEffect(() => {
        collisionSound.loop = true;
    }, [collisionSound]);
    // Громкость по каналам — lib/audioSettings.js (панель настроек, кнопка
    // settings в seam-ряду, 2026-10-04). Раньше тут были захардкожены
    // MUSIC_VOLUME=0.1/collisionSound.volume=0.5 прямо на плеере — теперь
    // ЕДИНСТВЕННЫЙ источник этих чисел, слайдеры в GameSettingsModal
    // показывают именно то, что реально звучит, без скрытого множителя
    // поверх. 'voice' — ТОЛЬКО реплики бегунов (active/damagedActive, по
    // прямому запросу пользователя — отдельно от остального "игрового"
    // звука); 'action' — всё остальное небоевое-не-музыка-не-комментатор:
    // выстрелы/ожидание решения при столкновении/шаги/появление Жнеца-Мяча.
    const audioSettings = useAudioSettings();
    useEffect(() => {
        voiceSound.volume = audioSettings.voice;
    }, [voiceSound, audioSettings.voice]);
    useEffect(() => {
        shootSound.volume = audioSettings.action;
        startSound.volume = audioSettings.action;
        collisionSound.volume = audioSettings.action;
    }, [shootSound, startSound, collisionSound, audioSettings.action]);
    useEffect(() => {
        commentSound.volume = audioSettings.commentator;
    }, [commentSound, audioSettings.commentator]);
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
    const triggerWithSound = useCallback(
        (runnerId, kind, extra) => {
            // Подавляем ТОЛЬКО визуальный триггер (дублирующий walk-цикл) —
            // звук "прилёта" (drone_start.wav) всё равно проигрываем: во
            // время локального превью никакого звука не было (превью чисто
            // визуальное), так что размещавший игрок иначе вообще не
            // услышал бы этот эффект.
            const suppressAnim = kind === 'start' && Date.now() < reaperStartSkipUntilRef.current;
            // Гейт для GameFinishModal (см. hasDeathAnimPlaying/
            // pendingDeathRunnerIds выше) — как только acid/burn-поза
            // РЕАЛЬНО начинает играть (не когда её только поставили в
            // очередь, см. useRunnerAnimations), снимаем runnerId из
            // pendingDeathRunnerIds — дальше hasDeathAnimPlaying отражает её
            // через runnerAnim.anims сам.
            const deathOnStart = (kind === 'acid' || kind === 'burn')
                ? () => {
                    setPendingDeathRunnerIds((prev) => {
                        if (!prev.has(runnerId)) return prev;
                        const next = new Set(prev);
                        next.delete(runnerId);
                        return next;
                    });
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
                    if (pendingMineCellIdsRef.current.delete(mineCellKey)) mineBlasts.trigger(mineCellKey);
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
            const deathCommentOnStart = (kind === 'destroyed' || kind === 'acid' || kind === 'burn')
                ? () => playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.destroyed))
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
            const combinedOnStart = (deathOnStart || cellReleaseOnStart || mineOnStart || deathCommentOnStart || voiceLineOnStart)
                ? () => { deathOnStart?.(); cellReleaseOnStart?.(); mineOnStart?.(); deathCommentOnStart?.(); voiceLineOnStart?.(); }
                : undefined;
            if (suppressAnim) reaperStartSkipUntilRef.current = 0;
            else runnerAnim.trigger(runnerId, kind, combinedOnStart ? { ...extra, onStart: combinedOnStart } : extra);
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
        [runnerAnim.trigger, playOneShot, shootSound, startSound, voiceSound, commentSound, releaseHeldCellOnStart, mineBlasts.trigger],
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
    // `pendingCollisionPair`/`sawStepCollision` — контекст ОДНОЙ цепочки
    // (одного bundle), живёт только внутри этого вызова: 'collision'-item
    // запоминает участников (`runnerId`/`otherRunnerId`, см.
    // lib/runnerAnimTriggers.js#handleSequenceItem за тем, зачем) для
    // СЛЕДУЮЩЕГО в этой же цепочке 'runner_save' с reason:'collision'.
    // `sawStepCollision` — резервный сигнал для известного бэкового пробела
    // (ветка "Использовать" у /collision не проставляет reason вообще, см.
    // докстринг в runnerAnimTriggers.js) — раз `step_collision`-транзиент
    // (StepCollisionEvent) в этой цепочке был, следующий безreason'ный
    // runner_save всё равно нужно считать отбросом (fly), не шагом (move).

    // Результат УЖЕ БРОШЕННОГО кубика столкновения — по прямому запросу
    // пользователя, 2026-09-10: баннер "Использовать/Перебросить" не
    // показывал, ЧТО именно произойдёт при "Использовать", решение
    // принималось вслепую. `CollisionEvent` несёт `{collision, direction,
    // runnerId, otherRunnerId}` — все четыре сохраняются и читаются (см.
    // collisionFlyingRunnerLabel в теле компонента за точной формулой
    // TOP/LOWER→runnerId/otherRunnerId, найденной чтением
    // StepCollisionService на бэке, read-only). Первая версия этой формулы
    // (2026-10-11, "не мой участник отлетит") была НЕВЕРНОЙ — живая жалоба
    // пользователя поймала конкретный случай (бэк показал Атлета, отлетел
    // Танк) — исправлена в тот же день на формулу, основанную на
    // `collision`, не на владельце.
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

    const reduceAndLog = useCallback(
        (state, bundle) => {
            let current = state;
            let pendingCollisionPair = null;
            let sawStepCollision = false;
            for (const item of bundle.sequence ?? [bundle]) {
                const e = { ...item, event: item.type ?? item.event, gameId: bundle.gameId };
                pushLog(e);

                if (e.event === 'collision') {
                    pendingCollisionPair = { runnerId: e.runnerId, otherRunnerId: e.otherRunnerId };
                }
                if (e.event === 'step_collision') {
                    sawStepCollision = true;
                }

                // Детекция ДО handleSequenceItem (см. докстринг у
                // pendingDeathRunnerIds выше) — порядок важен: если очередь
                // анимаций у этого бегуна сейчас пуста, acid/burn стартует
                // СИНХРОННО прямо внутри вызова ниже (advanceQueue зовёт
                // onStart сразу же), и deathOnStart уже успеет убрать runnerId
                // из этого Set к моменту, когда управление сюда вернётся —
                // если добавлять ПОСЛЕ вызова, эта ранняя отписка произошла
                // бы РАНЬШЕ подписки, и флаг завис бы навсегда.
                if (e.event === 'runner_destroy' && DEATH_KIND_BY_REASON[e.reason]) {
                    setPendingDeathRunnerIds((prev) => new Set(prev).add(e.runnerId.id));
                }
                handleSequenceItem(current, e, triggerWithSound, {
                    onceStepDone: runnerAnim.onceStepDone,
                    completeWaitStep: runnerAnim.completeWaitStep,
                    collisionPair: pendingCollisionPair,
                    forceKnockback: sawStepCollision,
                });
                // Лечение возвращает бегуна к healthy — триггерим 'heal'-
                // анимацию (проигрывается МЕЖДУ damaged_idle и healthy_idle).
                if (e.event === 'ability_heal' && e.runner?.id != null) {
                    triggerWithSound(e.runner.id, 'heal', {});
                }
                // 'ghost_consumed' — версионное, несёт runnerId/otherRunnerId
                // явно (см. lib/ghostPairs.js#identifyGhostConsumption).
                const ghostPass = identifyGhostConsumption(current, e);
                if (ghostPass) ghostPairs.record(ghostPass.key);
                // Замораживаем клетку в ЕЁ ЖЕ ВИДЕ ДО вскрытия (см. heldCells
                // выше) — читаем rawType из `current` (это ещё PRE-update
                // снимок ЭТОГО шага цепочки, сам редьюсер применится строкой
                // ниже). cellId — тот же формат, что и BoardGrid/lib/board.
                if (e.event === 'game_cell_updated' && e.cell) {
                    const { segment, row: positionX, column: positionY } = e.cell;
                    const cellId = cellKey({ segment, positionX, positionY });
                    // См. minePendingRef ниже — если непосредственно ПЕРЕД
                    // этим вскрытием (в ЭТОЙ ЖЕ цепочке) пришёл транзиент
                    // danger==='mine', именно ЭТА клетка и есть место взрыва.
                    if (minePendingRef.current) {
                        minePendingRef.current = false;
                        if (activatedCellKeysRef.current.has(cellId)) {
                            mineBlasts.trigger(cellId);
                        } else {
                            pendingMineCellIdsRef.current.add(cellId);
                            setTimeout(() => {
                                if (pendingMineCellIdsRef.current.delete(cellId)) mineBlasts.trigger(cellId);
                            }, MINE_TRIGGER_SAFETY_TIMEOUT_MS);
                        }
                    }
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

                const nextState = runnerGameReducer(current, e);
                // Игрок выбыл (player_out) — играет у ВСЕХ клиентов партии,
                // КРОМЕ случая, когда это выбывание ПОСЛЕДНЕГО соперника и
                // партия тут же завершилась победой оставшегося. Считаем
                // активных игроков ПОСЛЕ применения патча: если остался
                // РОВНО 1 — это терминальный случай, иначе игра продолжается,
                // звук нужен.
                if (e.event === 'player_out') {
                    const activeCount = (nextState.gamePlayers ?? []).filter((p) => p.status === PLAYER_STATUS.ACTIVE).length;
                    if (activeCount !== 1) playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.lost));
                }
                // Voice-реплика — ставится в очередь (pendingVoiceLineRef), как
                // только для бегуна РЕАЛЬНО появляются зелёные клетки хода (шаг
                // игрока становится MOVE), но проигрывается НЕ тут — см.
                // triggerWithSound#voiceLineOnStart, 2026-10-12, по прямому
                // запросу пользователя: раньше звучала сразу в этот момент,
                // ДО фактической постановки/хода бегуна, что при выходе из
                // резерва воспринималось как "звук раньше анимации". Диффим
                // player.step ДО/ПОСЛЕ применения ЭТОГО шага цепочки. Для
                // ЛЮБОГО игрока — все клиенты партии слышат один и тот же
                // выбор (реплика выбирается тут же, на этом клиенте, детерминизм
                // между клиентами тут не нужен — это не игровой стейт).
                for (const player of nextState.gamePlayers ?? []) {
                    const prevPlayer = current.gamePlayers?.find((p) => p.id === player.id);
                    if (player.step === PLAYER_STEP.MOVE && prevPlayer?.step !== PLAYER_STEP.MOVE && player.activeRunner != null) {
                        const runner = nextState.runners?.find((r) => String(r.id) === String(player.activeRunner));
                        const source = runner ? pickActiveSoundSource(runner.type, runner.status) : null;
                        if (source) pendingVoiceLineRef.current[runner.id] = source;
                    }
                }

                // Транзиентные, не про анимацию — те же side-effects, что
                // раньше жили в отдельном onTransient (звук/баннер), теперь
                // тут же, по ходу той же единой цепочки.
                if (e.event === 'danger' && e.danger === 'mine') {
                    minePendingRef.current = true;
                }
                if (e.event === 'collision') {
                    // runnerId/otherRunnerId — раньше тут сохранялись ТОЛЬКО
                    // collision/direction, хотя CollisionEvent несёт оба id
                    // (простое упущение при первой реализации этого стейта,
                    // id просто не докинули в объект) — все 4 поля нужны
                    // collisionFlyingRunnerLabel (см. pendingCollisionRoll
                    // выше за полным разбором формулы).
                    setPendingCollisionRoll({ collision: e.collision, direction: e.direction, runnerId: e.runnerId, otherRunnerId: e.otherRunnerId });
                    if (!collisionCommentPlayedRef.current) {
                        collisionCommentPlayedRef.current = true;
                        playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.collision));
                    }
                }
                if (e.event === 'anomaly') {
                    playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.anomalyHole));
                }
                if (e.event === 'ricochet') {
                    playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.ricochet));
                }
                if (e.event === 'attack' && e.hit === false) {
                    playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.miss));
                }

                current = nextState;
            }
            return current;
        },
        [
            pushLog, triggerWithSound, playOneShot, commentSound, mineBlasts.trigger,
            ghostPairs.record, runnerAnim.onceStepDone, runnerAnim.completeWaitStep,
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
            for (const item of bundle.sequence ?? [bundle]) {
                const e = { ...item, event: item.type ?? item.event, gameId: bundle.gameId };
                pushLog(e);
                handleSequenceItem(gameRef.current, e, triggerWithSound, {});
                if (e.event === 'danger' && e.danger === 'mine') {
                    minePendingRef.current = true;
                }
                if (e.event === 'collision') {
                    // Тот же фикс, что и в reduce() выше — runnerId/
                    // otherRunnerId раньше терялись и тут (отдельный путь
                    // для version-less бандлов, см. докстринг onTransient).
                    setPendingCollisionRoll({ collision: e.collision, direction: e.direction, runnerId: e.runnerId, otherRunnerId: e.otherRunnerId });
                    if (!collisionCommentPlayedRef.current) {
                        collisionCommentPlayedRef.current = true;
                        playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.collision));
                    }
                }
                if (e.event === 'anomaly') {
                    playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.anomalyHole));
                }
                if (e.event === 'ricochet') {
                    playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.ricochet));
                }
                if (e.event === 'attack' && e.hit === false) {
                    playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.miss));
                }
            }
        },
        [pushLog, triggerWithSound, playOneShot, commentSound],
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
    // `lowRunnerId`/`topRunnerId` от бэка — те же роли, что раньше
    // приходилось выводить из `runnerId`/`otherRunnerId` транзиента (см.
    // collisionFlyingRunnerLabel ниже по файлу) — runnerId≡topRunnerId,
    // otherRunnerId≡lowRunnerId, маппинг сохранён для совместимости с уже
    // работающей формулой. Должен идти ПОСЛЕ объявления `game` выше (см.
    // комментарий у pendingCollisionRoll за разбором TDZ-краша, который
    // раньше был на этом месте).
    useEffect(() => {
        if (pendingCollisionRoll || !game?.pendingCollision) return;
        const { lowRunnerId, topRunnerId, collision, direction } = game.pendingCollision;
        setPendingCollisionRoll({ collision, direction, runnerId: topRunnerId, otherRunnerId: lowRunnerId });
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
    const navBoxH = Math.round(arrowBtnSize * 0.7);
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
    // GameMenuModal/GameSettingsModal, 2026-10-04) — только 2 уровня, оба
    // модальные, друг друга не перекрывают (см. handleOpenSettings ниже).
    const [gameMenuOpen, setGameMenuOpen] = useState(false);
    const [gameSettingsOpen, setGameSettingsOpen] = useState(false);

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

    // Тип бегуна, который реально отлетит при столкновении — ПЕРВАЯ ПОПЫТКА
    // (2026-10-11, "не мой участник = он отлетит") была НЕВЕРНОЙ, живая
    // жалоба подтвердила ("видел Атлет, отлетел Танк") — роль не зависит от
    // владельца. Настоящая формула найдена чтением `StepCollisionService::
    // run()` на бэке (read-only, обработчик /collision с accept:true):
    // `collision===LOWER → move($lowRunner)`, `collision===TOP →
    // move($topRunner)`. А `CollisionEvent.runnerId`/`.otherRunnerId` —
    // ВСЕГДА `topRunner`/`lowRunner` соответственно (порядок параметров в
    // `Collision::runnerCollision()`→`saveCollision()`→`new CollisionEvent
    // (..., $runner->getId(), $runner2->getId())` на бэке — $runner
    // (первый) всегда становится topRunner, $runner2 (второй) — lowRunner,
    // НЕЗАВИСИМО от того, кто из них физически крупнее — имена low/top тут
    // не про размер). Значит: TOP → летит runnerId, LOWER → летит
    // otherRunnerId — ни "мой/чужой", ни размер тут вообще не при чём.
    const collisionFlyingRunnerLabel = useMemo(() => {
        if (!pendingCollisionRoll) return null;
        const flyingId = pendingCollisionRoll.collision === COLLISION_TOP
            ? pendingCollisionRoll.runnerId
            : pendingCollisionRoll.otherRunnerId;
        const runner = runners.find((r) => String(r.id) === String(flyingId));
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
                // партий, созданных до появления этого поля.
                // BACKEND_TO_FRONTEND_PLAYER_COLOR[p.color] ?? p.color —
                // 2026-10-01, см. её докстринг в GameConstants.js: ЕДИНСТВЕННАЯ
                // точка перевода "green" (бэк) → "purple" (фронт), дальше по
                // коду (PlayerInfoPanel.js и т.д.) "green" уже нигде не
                // встречается, только готовый hex.
                color: PLAYER_COLOR_HEX[BACKEND_TO_FRONTEND_PLAYER_COLOR[p.color] ?? p.color]
                    ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
                // colorKey — 2026-10-10, нужен PlayerSwitchPanel (переключатель
                // игроков, см. его докстринг): выбор нужного switch_on_<key>
                // ассета требует имени цвета ('red'/'blue'/'purple'/'yellow'),
                // а не уже готового hex, который несёт `color` выше. Тот же
                // перевод "green"(бэк)→"purple"(фронт), просто без финального
                // шага в hex — фолбэк на 'red', если цвет не распознан
                // (партии до появления этого поля, см. комментарий у `color`).
                colorKey: BACKEND_TO_FRONTEND_PLAYER_COLOR[p.color] ?? p.color ?? 'red',
                dice: [p.dice1, p.dice2, p.dice3, p.dice4],
                ability: p.ability,
                // step — 2026-09-20, нужен PlayerInfoPanel/RunnerCard, чтобы
                // показать индикатор бонуса хода на плитке РЕАЛЬНОГО игрока
                // (не обязательно "моего" — панель переключаемая, см.
                // roadBonusValue ниже).
                step: p.step,
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

    // Живая жалоба, 2026-09-12: во время исчезновения старого фрагмента 1 на
    // нём же оказывались и "жители" фрагмента 2 — причина в TrackService::
    // shift() (бэк, read-only): при сдвиге ВСЕ выжившие на middle/end
    // получают segment-1 и свой runner_save (перенумерация, они физически не
    // двигались), а по глобальной колонке (segment*cols+positionX) это
    // ровно то же окно [0,8), что и замороженный кадр старого фрагмента 1
    // (камера на нём всю settling/wiping, см. boardGridEl ниже). Раз
    // паразитная 'fly'-анимация для этого случая уже подавлена (см.
    // lib/runnerAnimTriggers.js), у перенумерованных выживших НЕТ записи в
    // runnerAnim.visualPositions — фильтруем `runners` именно по её
    // наличию: только те, кто реально доигрывает анимацию ухода с
    // фрагмента 1 (destroy/bomb/жнец-в-резерв), должны быть видны на
    // замороженном кадре. Хук объявлен ЗДЕСЬ (до ранних `return` ниже по
    // файлу — `!game`/WAITING), а не рядом с остальной track-shift-логикой
    // у boardGridEl — иначе он звался бы условно и ловил "Rendered more
    // hooks than during the previous render" на переходе между этими
    // early-return состояниями и обычным рендером доски.
    const trackShiftRunners = useMemo(
        () => runners.filter((r) => runnerAnim.visualPositions[r.id] != null),
        [runners, runnerAnim.visualPositions],
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
    //      а бегуны/токены остаются ЖИВЫМИ — см. boardGridEl ниже).
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
        // Хореография сдвига фрагментов (trackShiftPhase != null) —
        // "кат-сцена": камера скачет туда-сюда сама, интерактив с доской на
        // это время выключен целиком (по прямому запросу пользователя,
        // 2026-09-08 — "тапать некуда, доска сейчас показывает не то, чем
        // управляет игрок прямо сейчас").
        if (!myTurn || busy || trackShiftPhase) return { highlightedCells: new Set(), tapMode: null };

        if (pendingReaperPlacement && reaperPreviewReady && reaperConfirmed) {
            // Направление выстрела Жнеца сразу при размещении — подсветка
            // на доске вместо кнопок ↖/↑/↗ (единообразно с MOVE, по прямому
            // запросу пользователя, 2026-09-07). Появляется только ПОСЛЕ
            // того, как "прилёт" Жнеца успел доиграть (reaperPreviewReady) И
            // игрок подтвердил размещение (reaperConfirmed, второй диалог,
            // 2026-10-11) — до этого highlightedCells пуст, тапать некуда. Все 3
            // направления вперёд, как у обычного MOVE/SHOOT (2026-09-30, по
            // прямому запросу пользователя — реверс прежнего решения
            // 2026-09-08 "стрелять строго по прямой должен только Жнец").
            // Бэк это уже поддерживал всегда: `ReaperService::run()`
            // (read-only) прогоняет `direction` через ТОТ ЖЕ DirectionService,
            // что и обычный ход, `ReaperDTO`/`DetailsReaperDTO` не
            // ограничивают направление одним UP — ограничение было чисто
            // фронтовым (см. историю коммита).
            //
            // Раньше клетка подсвечивалась БЕЗ проверки раунда/занятости —
            // жалоба пользователя, 2026-09-08: диалог "выстрелить?" появлялся,
            // даже когда бэк заведомо проигнорирует выстрел. Перечитал
            // ReaperService::run() (read-only): сам выстрел применяется
            // ТОЛЬКО если `$player->getGame()->getRound() > 0` (в первом
            // раунде игры, round===0, блок с attackResolver вообще не
            // выполняется — направление в событие ВСЁ РАВНО попадает,
            // ReaperEvent публикуется ДО этой проверки, так что фронт видел
            // e.attack и играл анимацию атаки, хотя урона не было) И только
            // если `$target = $cell->getRunner()` не пуст (пустая клетка —
            // молчаливый no-op). Теперь клетка подсвечивается (и тапабельна)
            // ТОЛЬКО когда оба условия реально выполнены — иначе игроку
            // остаётся только «Без выстрела» (см. stepInstruction/canReaperShoot).
            const cells = game.round > 0
                ? forwardNeighbors(pendingReaperPlacement)
                    .filter((pos) => findRunnerAt(runners, pos))
                    .map(cellKey)
                : [];
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
            // Накат (type=ROLL, см. canSelectRunner) — реверс решения
            // 2026-09-08 ("накат — это строго движение вперёд", только UP),
            // по прямому запросу пользователя, 2026-10-03: теперь все 3
            // клетки вперёд, ПО АНАЛОГИИ С ОБЫЧНЫМ ХОДОМ — та же
            // forwardNeighbors(activeRunner), без фильтра по направлению.
            // isRollMove (вычисляется отдельно в handleCellPress ниже) по-
            // прежнему нужен ДЛЯ ДРУГОГО решения — "накат не должен
            // предлагать доп. выстрел" (2026-09-30) — эта логика не тронута.
            const neighbors = forwardNeighbors(activeRunner);
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
            // так что и занятость, и проходимость (не wall/anomaly/danger)
            // считаем сами (danger исключён по прямому запросу пользователя,
            // 2026-09-15 — жетон опасности под клеткой ещё не вскрыт, ставить
            // туда Жнеца не должно быть можно).
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
                        if (type === 'wall' || type === 'anomaly' || type === 'danger') continue;
                        if (findRunnerAt(runners, pos)) continue;
                        cells.add(cellKey(pos));
                    }
                }
            }
            return { highlightedCells: cells, tapMode: 'reaper' };
        }

        return { highlightedCells: new Set(), tapMode: null };
    }, [myTurn, myStep, activeRunner, busy, pendingAbility, runners, totalBlocks, game, pendingReaperPlacement, reaperPreviewReady, reaperConfirmed, trackShiftPhase]);

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
        if (tapMode === 'start') {
            jumpedForSelectionRef.current = true;
            jumpToStart(0);
        } else if (tapMode === 'move' && activeRunner?.segment != null) {
            jumpedForSelectionRef.current = true;
            jumpTo(activeRunner.segment * BOARD_LAYOUT.COLS + activeRunner.positionX);
        }
    }, [tapMode, activeRunner?.id, activeRunner?.segment, activeRunner?.positionX, jumpToStart, jumpTo]);

    // Есть ли у Жнеца реальный выстрел ПРЯМО СЕЙЧАС (раунд>0 И подсвеченная
    // клетка реально нашлась, см. reaperShoot-ветку useMemo выше) — общий
    // источник истины для подсказки (stepInstruction) и для авто-подтверждения
    // "без выстрела" ниже, вынесен в отдельную переменную, чтобы не дублировать
    // выражение в двух местах.
    const canReaperShoot = tapMode === 'reaperShoot' && highlightedCells.size > 0;

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
    const hasDeathAnimPlaying = useMemo(
        () => Object.values(runnerAnim.anims).some((a) => a?.kind === 'acid' || a?.kind === 'burn')
            || pendingDeathRunnerIds.size > 0,
        [runnerAnim.anims, pendingDeathRunnerIds],
    );
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
    // целиком) из assets/sounds/background_music/, пока там один файл —
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

    const handleOpenGameMenu = useCallback(() => setGameMenuOpen(true), []);
    const handleCloseGameMenu = useCallback(() => setGameMenuOpen(false), []);
    const handleLeaveFromMenu = useCallback(() => {
        setGameMenuOpen(false);
        handleSurrender();
    }, [handleSurrender]);
    const handleOpenSettingsFromMenu = useCallback(() => {
        setGameMenuOpen(false);
        setGameSettingsOpen(true);
    }, []);
    const handleCloseSettings = useCallback(() => setGameSettingsOpen(false), []);

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

    // Раунд/Ход/Бонус хода — ПЕРЕЕХАЛИ (2026-10-11, по прямому запросу
    // пользователя) из строки под швом в колонку СПРАВА от баннера хода
    // ("Твой ход"), см. место рендера headerContent ниже. Квадраты, высота
    // каждого — РОВНО ⅓ измеренной высоты самого баннера (turnBannerSize,
    // тот же onLayout, что и раньше) — три квадрата без зазора между ними в
    // сумме точно равны высоте баннера, верх/низ колонки совпадают с
    // верхом/низом баннера. До первого измерения (turnBannerSize===null,
    // самый первый кадр) — 0, колонка просто не рендерится видимым
    // размером тот кадр (условие на использование — useMobileNavButtons,
    // см. место рендера).
    const turnBannerSideSize = turnBannerSize ? Math.round(turnBannerSize.height / 3) : 0;
    // Живая жалоба 2026-10-11: фиксированный font.h2 (24, см. styles.
    // seamRoundValue/seamBonusValue — унаследован от старого места этого
    // ряда, где квадраты были крупнее) в НОВЫХ, заметно более мелких
    // квадратах (turnBannerSideSize) выглядел "слишком здоровенным" —
    // цифра едва помещалась в рамку. Шрифт теперь пропорционален реальному
    // размеру квадрата, не константе темы.
    const turnBannerSideFontStyle = { fontSize: Math.max(10, Math.round(turnBannerSideSize * 0.45)) };
    // Ширина панели имени в строке под швом — живой баг 2026-10-11: первая
    // версия (фиксированный множитель от switchRowH) либо вылезала за край
    // экрана (настройки/лог обрезались), либо оставляла дыру — по прямому
    // запросу пользователя сумма (переключатели+имя+настройки+лог) теперь
    // считается от РЕАЛЬНО измеренной ширины самой строки (seamRowWidth, см.
    // onSeamRowLayout ниже), ровно той же техникой, что раньше спасла
    // аналогичный ряд от того же класса бага (см. старую историю
    // roadFrameRoundRowWidth в CLAUDE.md, 2026-10-10) — turnBannerSize тут
    // больше не годится, его измеренная ширина теперь УЖЕ полной строки
    // (баннер делит её с колонкой раунд/ход/бонус, см. headerContent).
    // switchesNaturalWidth — ширина 4 переключателей по их собственному
    // аспекту (SWITCH_ASPECT) + 3 внутренних зазора (PlayerSwitchPanel#
    // styles.row.gap=spacing.xs) между ними. iconsWidth — настройки+лог,
    // оба квадратные switchRowH×switchRowH. Между переключателями/именем/
    // настройками/логом зазора нет (styles.seamRow.gap=0, по прямому
    // запросу пользователя) — КРОМЕ стыка последний-переключатель→имя: там
    // отдельный marginLeft (см. место рендера), равный тому же spacing.xs,
    // что и между самими переключателями (по прямому запросу пользователя
    // 2026-10-11) — SEAM_NAME_GAP, вычитается тут же, чтобы сумма всей
    // строки по-прежнему не вылезала за экран. До первого измерения
    // (seamRowWidth===null) — безопасный фолбэк.
    const switchesNaturalWidth = Math.round(switchRowH * SWITCH_ASPECT) * 4 + spacing.xs * 3;
    const seamIconsWidth = switchRowH * 2;
    const seamNameWidth = seamRowWidth != null
        ? Math.max(40, seamRowWidth - spacing.md * 2 - switchesNaturalWidth - spacing.xs - seamIconsWidth)
        : Math.round(switchRowH * 2.4);

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
    const turnBannerInner = trackShiftPhase ? (
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

    // dialogState — ВРЕМЕННЫЙ ДУБЛЬ turnBannerInner выше в виде отдельной
    // модалки-карточки (GameDialogModal, 2026-10-12, по прямому запросу
    // пользователя — "вытащить все уведомления/диалоги в модалку"). Не
    // замена: turnBannerInner остаётся как есть, это параллельный рендер
    // ТОГО ЖЕ состояния через ДРУГОЙ компонент — задача сначала проверить,
    // что здесь оказались ВСЕ диалоги с выбором (плюс два явно запрошенных
    // "ждущих" уведомления по коллизии, у которых кнопок в обычном случае
    // нет), и только потом отдельным заходом убрать инлайн-версию. Простые
    // безкнопочные подсказки шага (SELECT "Перетащи кубик…", MOVE "Выбери
    // клетку…" и т.п.) — по прямому решению пользователя остаются ТОЛЬКО в
    // шапке панели, сюда не дублируются. "Ход игрока: X" (не мой ход, нет
    // коллизии) — та же категория, тоже не дублируется (не упоминалось в
    // списке пользователя). Текст/условия/кнопки — скопированы 1:1 с веток
    // turnBannerInner выше, НЕ переизобретены — при правке одной стороны
    // не забыть вторую, пока обе существуют параллельно.
    // НЕ useMemo — этот блок стоит ПОСЛЕ ранних `return` выше (!game/
    // WAITING), значит на части рендеров до него вообще не доходит; хук
    // тут нельзя (условный вызов хука — краш "Rendered more hooks than
    // during the previous render", живьём поймано на вебе, 2026-10-12).
    // Обычный IIFE, как и соседний turnBannerInner — та же логика (плоский
    // JSX ниже тоже пересчитывается каждый рендер без memo), просто другая
    // форма результата (объект, не JSX).
    const dialogState = (() => {
        if (trackShiftPhase) return { text: 'Трасса смещается…' };
        if (game.extraTurnPlayer != null) {
            const text = myCollision && pendingCollisionRoll
                ? `Заруба! Результат: ${collisionFlyingRunnerLabel ?? 'бегун'} отлетит ${directionLabel(pendingCollisionRoll.direction)}. Принять?`
                : myCollision
                    ? 'Заруба! Жду результат…'
                    : `Заруба! Ждём ${collisionWinnerPlayer?.name ?? 'игрока'}`;
            if (myCollision && !busy && collisionDecisionReady) {
                return {
                    text,
                    buttons: [
                        { key: 'accept', title: '✓', variant: 'success', onPress: () => handleCollision(true) },
                        { key: 'reroll', title: '↻', variant: 'danger', onPress: () => handleCollision(false) },
                    ],
                };
            }
            if (!myCollision && showStuckRefresh) {
                return {
                    text,
                    buttons: [{
                        key: 'resync',
                        title: 'Обновить состояние',
                        variant: 'info',
                        onPress: () => { runnerAnim.reset(); setPendingDeathRunnerIds(new Set()); resync(); },
                    }],
                };
            }
            return { text };
        }
        if (!myTurn) return null;
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
                    text: turnHintText,
                    buttons: [
                        { key: 'confirm', title: '✓', variant: 'success', onPress: () => setReaperConfirmed(true) },
                        { key: 'cancel', title: '✕', variant: 'danger', onPress: () => setPendingReaperPlacement(null) },
                    ],
                };
            }
            return { text: turnHintText, buttons: [{ key: 'skip', title: 'Скип', variant: 'danger', onPress: () => handleReaperShoot(undefined) }] };
        }
        if (pendingSelect && !busy) {
            return {
                text: turnHintText,
                buttons: [
                    { key: 'confirm', title: '✓', variant: 'success', onPress: handleConfirmSelect },
                    { key: 'cancel', title: '✕', variant: 'danger', onPress: handleCancelSelect },
                ],
            };
        }
        if (showRoadBonusChoice) {
            return {
                text: turnHintText,
                buttons: [
                    { key: 'bonus', title: `Бонус +${game.trackGain ?? ''}`, variant: 'success', onPress: () => handleRoadBonus(true) },
                    { key: 'skip', title: '✕', variant: 'danger', onPress: () => handleRoadBonus(false) },
                ],
            };
        }
        if (showAbilitySkip) {
            return { text: turnHintText, buttons: [{ key: 'skip', title: 'Скип', variant: 'danger', onPress: handleAbilitySkip }] };
        }
        if (showShootSkip) {
            return { text: turnHintText, buttons: [{ key: 'skip', title: 'Скип', variant: 'danger', onPress: handleShootSkip }] };
        }
        return null;
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
            highlightedCells={highlightedCells}
            runnerAnims={runnerAnim.anims}
            runnerVisualPositions={runnerAnim.visualPositions}
            currentTurnPlayerId={game.playerOrder}
            hiddenRunnerIds={runnerAnim.hiddenIds}
            ghostPairs={ghostPairs.pairs}
            mineBlasts={mineBlasts.blasts}
            onCollisionPoseStart={handleCollisionPoseStart}
            onCollisionPoseEnd={handleCollisionPoseEnd}
            onAnimStepEnd={runnerAnim.completeStep}
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
            columnOpacities={
                trackShiftPhase === 'wiping' ? trackShiftWipeColumnOpacityMap
                    : trackShiftPhase === 'revealing' ? trackShiftRevealColumnOpacityMap
                        : null
            }
            cellOverrides={heldCells}
            onCellPress={handleCellPress}
        />
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
                (2026-09-12, тот же принцип) — тем же способом ждём, пока не доиграет
                терминальная поза burn/acid (гибель на клетке wall), если она случилась
                ровно тем же ходом, что и победа. */}
            <GameFinishModal
                visible={game.status === GAME_STATUS.FINISH && !trackShiftPhase && !hasDeathAnimPlaying}
                winnerName={winnerPlayer?.user?.username ?? (winnerPlayer ? `Игрок ${winnerPlayer.id}` : null)}
                onExit={goToMainMenu}
            />

            {/* Игровое меню — кнопка settings в seam-ряду (см. ниже), только
                useMobileNavButtons (портретный native), см. CLAUDE.md за
                обоснованием области применения. */}
            <GameMenuModal
                visible={gameMenuOpen}
                onClose={handleCloseGameMenu}
                onLeave={handleLeaveFromMenu}
                onSettings={handleOpenSettingsFromMenu}
            />
            <GameSettingsModal visible={gameSettingsOpen} onClose={handleCloseSettings} />

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
                    switcherHeight={switcherH}
                    headerContent={(
                        <View style={styles.turnBanner} onLayout={onTurnBannerLayout}>
                            <FramePanel size={turnBannerSize} targetCornerSize={10} />
                            {turnBannerInner}
                        </View>
                    )}
                    roadBonusValue={game.trackGain}
                    gameRound={game.round}
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
                    {useMobileNavButtons && (
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
                    {/* Стрелки навигации — ПРЯМО НА нижней кайме рамки дороги,
                        ПО ЦЕНТРУ всей ширины, 2026-10-10 по прямому запросу
                        пользователя. `variant="person"` + `targetCornerSize`
                        тоньше дефолта (34px) — честная 9-slice рамка
                        (FramedSquare.js/PersonPanel.js докстринги) БЕЗ своего
                        фона поверх PNG-ассета `RoadNavButton` (тот своей
                        нарисованной рамки больше не содержит, см. CLAUDE.md
                        2026-10-10 — вырезана скриптом, чтобы не было двойного
                        контура). RoadNavButton#width/height (см. её докстринг)
                        даёт прямоугольную, не квадратную, кнопку. */}
                    {useMobileNavButtons && (
                        <View style={[styles.roadFrameNavRow, { bottom: (arrowBtnSize - navBoxH) / 2, gap: spacing.xs }]}>
                            <FramedSquare variant="person" width={navBoxH * 2} height={navBoxH} targetCornerSize={32} glow>
                                <RoadNavButton direction="up" height={navBoxH} width={navBoxH * 2} handlers={forwardButtonProps} />
                            </FramedSquare>
                            <FramedSquare variant="person" width={navBoxH * 2} height={navBoxH} targetCornerSize={32} glow>
                                <RoadNavButton direction="down" height={navBoxH} width={navBoxH * 2} handlers={backButtonProps} />
                            </FramedSquare>
                        </View>
                    )}
                    {/* ВРЕМЕННЫЙ ДУБЛЬ turnBannerInner — см. dialogState выше за
                        полным разбором. Ребёнок roadFrameWrap (не корневого
                        wrapper) — по прямому запросу пользователя, 2026-10-12:
                        карточка должна сидеть поверх ВЕРХНЕЙ части дороги, не
                        по центру всего экрана. Последний ребёнок — поверх
                        рамки/кнопок навигации дороги тоже. */}
                    <GameDialogModal dialogState={dialogState} width={roadFrameSize?.width} height={roadFrameSize?.height} />
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
                <View style={[styles.panelFrameWrap, useMobileNavButtons && styles.panelFrameWrapFlat]}>
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
                        flatBackground={useMobileNavButtons}
                        switchRowHeight={useMobileNavButtons ? switchRowH : 0}
                        headerContent={(
                            <View style={styles.turnBannerRow}>
                                <View style={[styles.turnBanner, styles.turnBannerFlex]} onLayout={onTurnBannerLayout}>
                                    <FramePanel size={turnBannerSize} targetCornerSize={10} />
                                    {/* NeonGlow (2026-10-11, по прямому запросу
                                        пользователя — "...у панели 'твой ход'...") —
                                        только тут (портретный native-вызов), не в
                                        альбомном/веб HeaderContent выше — тот же
                                        масштаб правки, что и у остальных мест этого
                                        захода (useMobileNavButtons-зона). */}
                                    <NeonGlow size={turnBannerSize} radius={frameNotchRadius(turnBannerSize, 10)} />
                                    {turnBannerInner}
                                </View>
                                {/* Раунд/Ход/Бонус хода — колонка квадратов СПРАВА
                                    от баннера (2026-10-11, по прямому запросу
                                    пользователя — переехали из строки под швом,
                                    см. её докстринг ниже). Только useMobileNavButtons
                                    — в остальных случаях (веб-портрет) этой колонки
                                    тут не было и не появляется, раунд/ход/бонус там
                                    по-прежнему не показываются вообще (см. TODO в
                                    CLAUDE.md про ход). Высота каждого квадрата —
                                    РОВНО ⅓ измеренной высоты баннера
                                    (turnBannerSideSize), без зазоров между ними —
                                    сумма трёх точно равна высоте баннера. */}
                                {useMobileNavButtons && (
                                    <View style={[styles.turnBannerSideCol, { width: turnBannerSideSize }]}>
                                        <FramedSquare width={turnBannerSideSize} height={turnBannerSideSize} targetCornerSize={6} glow>
                                            <Text style={[styles.seamRoundValue, turnBannerSideFontStyle]} numberOfLines={1} noGlobalTint>
                                                {game.round != null ? game.round : '-'}
                                            </Text>
                                        </FramedSquare>
                                        {/* "Ход" — заглушка до появления поля с бэка,
                                            см. TODO в CLAUDE.md. */}
                                        <FramedSquare width={turnBannerSideSize} height={turnBannerSideSize} targetCornerSize={6} glow>
                                            <Text style={[styles.seamRoundValue, turnBannerSideFontStyle]} numberOfLines={1} noGlobalTint>-</Text>
                                        </FramedSquare>
                                        <FramedSquare width={turnBannerSideSize} height={turnBannerSideSize} targetCornerSize={6} glow>
                                            <Text style={[styles.seamBonusValue, turnBannerSideFontStyle]} numberOfLines={1} noGlobalTint>
                                                {game.trackGain != null && game.trackGain > 0 ? game.trackGain : '—'}
                                            </Text>
                                        </FramedSquare>
                                    </View>
                                )}
                            </View>
                        )}
                        roadBonusValue={game.trackGain}
                        gameRound={game.round}
                    />
                </View>
            )}

            {/* Единая строка под швом — ОДНИМ рядом: 4 переключателя игрока,
                панель имени, настройки, лог — ВСЕ одной и той же высоты
                (switchRowH), по прямому запросу пользователя 2026-10-11
                (раньше тут ЕЩЁ были раунд/ход/бонус дороги, второй строкой
                под именем — переехали в колонку рядом с баннером хода, см.
                headerContent выше). Панель имени — ФИКСИРОВАННОЙ ширины
                (seamNameWidth), НЕ растягивается на остаток строки — по
                прямому запросу пользователя ("уже, чем сейчас"); свободное
                место справа от неё/настроек/лога просто остаётся залито тем
                же фоном строки (styles.seamRow#backgroundColor), не выглядит
                как дырка. Лежит ЦЕЛИКОМ ниже стыка, внутри territory
                панели — рамку дороги не трогает (предыдущая версия стояла
                ровно на стыке и конфликтовала то с рамкой, то с баннером
                хода внутри панели — живые жалобы). switchRowH — высота всей
                строки, та же величина, что PlayerInfoPanel резервирует у
                себя СВЕРХУ через switchRowHeight (см. её докстринг) —
                floating-ряд рисуется ровно над этим зарезервированным
                зазором, не перекрывая баннер хода. Только useMobileNavButtons
                — вне этого случая раскладка не менялась (лог в прежнем
                углу, см. else ниже). */}
            {useMobileNavButtons ? (
                <View style={[styles.seamRow, { bottom: panelH - switchRowH, height: switchRowH }]} onLayout={onSeamRowLayout}>
                    <PlayerSwitchPanel players={players} activeId={activePlayerId} onSelect={setActivePlayerId} height={switchRowH} />
                    {/* Панель имени — FramedSquare variant="frame" (по
                        умолчанию, FramePanel — "как у аватарки бегуна"), НЕ
                        старый PersonPanel-based NamePanel — финальный выбор
                        стиля после нескольких правок, см. докстринг у места
                        рендера кнопок навигации на рамке дороги выше.
                        marginLeft: spacing.xs (2026-10-11, по прямому
                        запросу пользователя) — ТОЛЬКО тут, между последним
                        переключателем и именем, тот же зазор, что и между
                        самими переключателями (PlayerSwitchPanel.js#
                        styles.row.gap) — остальные стыки строки (имя→
                        настройки→лог) остаются без зазора, см. seamRow. */}
                    <FramedSquare width={seamNameWidth} height={switchRowH} targetCornerSize={8} glow style={{ marginLeft: spacing.xs }}>
                        <Text style={styles.seamNameText} numberOfLines={1} noGlobalTint>
                            {players.find((p) => p.id === activePlayerId)?.name ?? ''}
                        </Text>
                    </FramedSquare>
                    {/* Настройки+лог — variant="person" (showBackground=false,
                        см. FramedSquare.js/PersonPanel.js докстринги) —
                        честная 9-slice рамка БЕЗ фона (их PNG-ассеты
                        `settings_*`/`log_*` уже содержат свой фон, просто без
                        нарисованной линии-рамки, см. CLAUDE.md 2026-10-10),
                        как и у RoadNavButton выше. Иконка — полный размер
                        слота, рамка рисуется ПОД ней (см. FramedSquare.js),
                        перекрытия нет. Квадратные — ширина = высота строки
                        (switchRowH), как и у всех остальных элементов ряда. */}
                    <FramedSquare variant="person" width={switchRowH} targetCornerSize={32} glow>
                        <GameMenuButton
                            size={switchRowH}
                            active={gameMenuOpen || gameSettingsOpen}
                            onPress={handleOpenGameMenu}
                        />
                    </FramedSquare>
                    <FramedSquare variant="person" width={switchRowH} targetCornerSize={32} glow>
                        <EventLogPanel entries={eventLog} position="seam" iconSize={switchRowH} />
                    </FramedSquare>
                </View>
            ) : (
                <EventLogPanel entries={eventLog} position={isPortrait ? 'top' : 'bottom-right'} />
            )}
            </View>
            {!boardReady && (
                <View style={[styles.boardReadyOverlay, { width: windowDimensions.width, height: windowDimensions.height }]}>
                    <LoadingCard label={STATUS_LABEL[status] ?? ''} />
                </View>
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
    // roadFrameWrap — обёртка под MobileFrameOverlay (та ОСТАЁТСЯ у дороги,
    // не трогали, 2026-10-10), ТОЛЬКО position:'relative', БЕЗ overflow:
    // 'hidden' — рамка сама заполняет её РОВНО (не вылезает за границы, см.
    // компонент), этот View просто даёт ей позиционирующий контекст. flex:1
    // — тот же слот, что раньше держал RoadArea напрямую.
    roadFrameWrap: { flex: 1, position: 'relative' },
    // Стрелки навигации на кайме рамки дороги (см. место рендера) —
    // zIndex/elevation выше самой рамки (10, см. MobileFrameOverlay.js),
    // чтобы не оказаться ПОД её декоративными слоями и ловить тапы.
    // По центру ВСЕЙ ширины (left:0,right:0 + justifyContent:'center').
    roadFrameNavRow: {
        position: 'absolute', left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'center',
        zIndex: 11, elevation: 11,
    },
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
    // Сплошная заливка панели на мобильном портрете (2026-10-10) — см.
    // комментарий у места рендера (useMobileNavButtons) и colors.panelPlateBg
    // за происхождением цвета. Применяется ТОЛЬКО в этом случае (отдельный
    // стиль, не влит в panelFrameWrap) — на вебе/альбомной раскладке
    // panelFrameWrap остаётся прозрачным, как было.
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
    // switchRowH, см. место рендера), отдельного обёрточного стиля-колонки
    // больше не нужно (раньше тут была колонка "имя + ряд из 5 квадратов",
    // та ушла целиком — раунд/ход/бонус переехали в styles.turnBannerSideCol
    // рядом с баннером хода, настройки/лог — соседи имени в этом же ряду).
    seamNameText: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.small },
    // Тот же стиль, что был у RoundPanel/RoadBonusPanel#styles.value (см.
    // их докстринги) — визуальное единообразие сохранено, хотя сам рендер
    // теперь инлайн через FramedSquare, не через эти компоненты (те остались
    // на PersonPanel, используются landscape/web-раскладкой в PlayerInfoPanel).
    // Используется в styles.turnBannerSideCol (раунд/ход/бонус рядом с
    // баннером хода, см. headerContent) — переехал туда вместе с колонкой
    // 2026-10-11, сам стиль текста не менялся.
    seamRoundValue: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.h2 },
    seamBonusValue: { color: colors.success, fontWeight: 'bold', fontSize: font.h2 },
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
    // turnBannerRow/turnBannerFlex/turnBannerSideCol (2026-10-11, по прямому
    // запросу пользователя) — ТОЛЬКО портретный headerContent (см. место
    // рендера): баннер хода теперь делит строку с колонкой раунд/ход/бонус
    // справа от него (бывшей частью строки под швом, см. CLAUDE.md). Строка
    // несёт marginTop, который раньше был на самом turnBanner (см.
    // turnBannerFlex — сбрасывает его в 0, чтобы не удвоился) — так верх
    // баннера и верх колонки квадратов совпадают. Ширина/высота колонки —
    // явные пропы (turnBannerSideSize), не стиль.
    // alignItems:'flex-start' (ЖИВОЙ БАГ, 2026-10-11, найден пользователем
    // на реальном устройстве при коллизии — баннер "Твой ход" ЗАМЕТНО
    // вырос, хотя раньше был жёстко зафиксирован под 3 строки) — БЕЗ этого
    // (дефолт flexbox-строки — 'stretch') turnBanner и turnBannerSideCol
    // образуют циклическую зависимость высоты: turnBannerSideCol сам
    // высотой с turnBannerSize.height (измеренной высоты БАННЕРА, см.
    // turnBannerSideSize выше), а 'stretch' тянет turnBanner вверх до
    // высоты СВОЕГО соседа по ряду (turnBannerSideCol) — если в какой-то
    // момент баннер был выше обычного (например длинный коллизионный текст
    // на 2 строки) или колонка уже "раздулась" на предыдущем рендере,
    // stretch держит баннер завышенным даже когда актуальный контент
    // (например короткие "Использовать"/"Перебросить") уже не требует такой
    // высоты — измеренная turnBannerSize так и остаётся завышенной, подпитывая
    // саму себя дальше. 'flex-start' отключает stretch — turnBanner высотой
    // ТОЛЬКО от своего контента/minHeight (как и было задумано, см.
    // TURN_BANNER_MIN_HEIGHT), turnBannerSideCol подстраивается ПОД него, не
    // наоборот.
    turnBannerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.xs },
    turnBannerFlex: { flex: 1, marginTop: 0 },
    turnBannerSideCol: { flexDirection: 'column' },
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
