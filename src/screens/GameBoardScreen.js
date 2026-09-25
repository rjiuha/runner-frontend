// src/screens/GameBoardScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import Button from '../components/ui/Button';
import LoadingCard from '../components/ui/LoadingCard';
import PulseText from '../components/ui/PulseText';
import { useAuth } from '../hooks/useAuth';
import { useMercure } from '../hooks/useMercure';
import { useAdaptiveOrientation } from '../hooks/useAdaptiveOrientation';
import { useRunnerAnimations } from '../hooks/useRunnerAnimations';
import { useRunnerDamageTokens } from '../hooks/useRunnerDamageTokens';
import { useGhostPairs } from '../hooks/useGhostPairs';
import { useMineBlasts } from '../hooks/useMineBlasts';
import { ROAD_AREA_SPACING, useBoardLayout } from '../hooks/useBoardLayout';
import { useBoardScroll } from '../hooks/useBoardScroll';
import { flattenTrackSegments, flattenPeekColumn, computeFragmentBands, resolveCellVisual, pickSegmentImage, pickBaseImage } from '../lib/board';
import { forwardNeighbors, cellKey } from '../lib/hexDirection';
import { describeEvent, directionLabel, rawEventFallback } from '../lib/eventLog';
import {
    handleVersionedRunnerAnimEvent, handleTransientRunnerAnimEvent, DEATH_KIND_BY_REASON, identifyStatusWorsening,
} from '../lib/runnerAnimTriggers';
import { identifyPendingDamageType, getWorsenedDamageRunnerId } from '../lib/runnerDamageTokens';
import { identifyGhostPass } from '../lib/ghostPairs';
import { pickActiveSoundSource, pickShootSoundSource, pickMoveSoundSource, pickStartSoundSource } from '../lib/runnerSoundTriggers';
import { COLLISION_SOUND, FALLBACK_MOVE_SOUND, pickRandom } from '../constants/runnerSounds';
import { COMMENT_SOUNDS } from '../constants/commentSounds';
import { BACKGROUND_MUSIC_TRACKS, pickRandomTrackIndex } from '../constants/backgroundMusic';
import { notify } from '../lib/notify';
import { createLogger } from '../lib/logger';
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

// Задержка перед показом кнопок "Использовать/Перебросить" — чтобы игрок
// сначала УВИДЕЛ анимацию столкновения, а не решал вслепую в момент, когда
// extraTurnPlayer только что появился. Раньше 2200мс (с большим запасом сверх
// SLIDE_DURATION_MS/ANIM_DURATION_MS.move ~1400мс + COLLISION_MIN_HOLD_MS в
// BoardGrid) — по прямому запросу пользователя, 2026-09-08, сокращено:
// 1400мс всё ещё покрывает приезд победителя (~1360-1440мс), просто без
// лишнего запаса поверх минимального показа самой позы.
const COLLISION_ANIM_DELAY_MS = 1400;

// Collision — PHP int-backed enum на бэке (Enum/Collision.php: LOWER=1/TOP=2),
// json_encode сериализует backed enum напрямую в число (не строку) — см.
// pendingCollisionRoll в теле компонента.
const COLLISION_LOWER = 1;
const COLLISION_TOP = 2;

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
    pendingReaperPlacement, reaperPreviewReady, canReaperShoot,
) {
    if (pendingReaperPlacement) {
        // До того, как "прилёт" из-за края карты успел доиграть
        // (reaperPreviewReady), подсветки на доске ещё нет — тапать некуда,
        // текст объясняет паузу, а не намекает на несуществующие клетки.
        // canReaperShoot (см. highlightedCells выше) — стрелять реально
        // можно, только если раунд>0 И на клетке впереди есть бегун (бэк
        // молча игнорирует выстрел в обоих остальных случаях, см.
        // ReaperService::run(), read-only) — если нельзя, не намекаем на
        // несуществующий выбор, остаётся только "Без выстрела".
        if (!reaperPreviewReady) return 'Жнец приближается…';
        return canReaperShoot
            ? 'Жнец на месте — тапни подсвеченную клетку для выстрела или нажми «Без выстрела»'
            : 'Жнец на месте — нажми «Без выстрела»';
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
            : `${label} выбран — подтверди действие`;
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
            if (!activeRunner) return 'Не удалось определить активного бегуна (проблема синхронизации) — доступно только «Пропустить выстрел»';
            return 'Тапни подсвеченную цель или нажми «Пропустить выстрел»';
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
    // GameBoardScreen сознательно без SafeAreaView (см. шапку файла) — без
    // этого top:spacing.md у collisionBanner рисовал плашку под статус-баром
    // на телефонах, та же болячка, что была у EventLogPanel (см. его комментарий).
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
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
    // Пары бегунов, мирно сосуществующих на одной клетке благодаря "призраку"
    // (см. lib/ghostPairs.js) — BoardGrid рисует их как два независимых
    // solo-токена (idle рядом), не коллизионную позу, по прямому запросу
    // пользователя, 2026-09-09.
    const ghostPairs = useGhostPairs();
    // Одноразовые взрывы мины на клетках (danger==='mine') — см.
    // hooks/useMineBlasts.js. Триггер — двухшаговая корреляция транзиент→
    // версионное событие, см. minePendingRef и game_cell_updated-ветку в
    // reduceAndLog ниже (тот же паттерн, что уже используется для ghost_pass/
    // жетонов повреждений в этом файле).
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

    // **2026-09-25, живая жалоба пользователя** — "healthy меняется на
    // damaged ДО того, как проигралась анимация move, до взрыва мины, до
    // анимации получения урона". Та же природа, что и у мины/heldCells чуть
    // выше: `runner.status` (решает, healthy или damaged bucket спрайт-пака
    // рисует RunnerToken — см. resolveSpriteRef) обновляется МГНОВЕННО вместе
    // с игровым стейтом (архитектурное правило проекта — состояние не ждёт
    // анимацию), а бегун в этот момент может ещё доигрывать move/fly К месту
    // удара. Тот же честный `onStart`-приём, не отдельный таймер: держим
    // СТАРЫЙ статус, пока не начнёт реально играть та поза (gotShot/
    // destroyed/acid/burn), которая и ЕСТЬ визуальный момент удара — см.
    // identifyStatusWorsening (lib/runnerAnimTriggers.js) и
    // statusReleaseOnStart в triggerWithSound ниже.
    //
    // `heldRunnerStatusesRef` (не только React state) — по ТОЙ ЖЕ причине,
    // что и activatedCellKeysRef/pendingMineCellIdsRef выше: заморозка
    // ставится в reduceAndLog ДО handleVersionedRunnerAnimEvent (см. там,
    // тот же порядок, что уже у pendingDeathRunnerIds — если очередь этого
    // бегуна сейчас пуста, onStart может сработать СИНХРОННО прямо внутри
    // этого вызова), а снимается ИЗ triggerWithSound — оба места должны
    // видеть АКТУАЛЬНОЕ значение в рамках одного синхронного прохода, не
    // ждать следующего рендера (React batching). State — чисто для того,
    // чтобы BoardGrid реально перерисовался с переопределённым статусом.
    //
    // Пишем ТОЛЬКО если для этого runnerId ЕЩЁ НИЧЕГО не заморожено (не
    // перезаписываем) — при каскаде из НЕСКОЛЬКИХ ударов подряд (redко, но
    // возможно) это сохраняет САМЫЙ РАННИЙ статус (тот, что был ДО всего
    // каскада), а не статус "перед последним конкретным ударом" — иначе
    // промежуточные позы каскада увидели бы уже "наполовину" ухудшённый
    // статус вместо честного исходного.
    const [heldRunnerStatuses, setHeldRunnerStatuses] = useState({});
    const heldRunnerStatusesRef = useRef({});
    const HELD_RUNNER_STATUS_TIMEOUT_MS = 8000; // тот же принцип, что и у HELD_CELL_TIMEOUT_MS/MINE_TRIGGER_SAFETY_TIMEOUT_MS
    const releaseHeldRunnerStatus = useCallback((runnerId) => {
        if (!(runnerId in heldRunnerStatusesRef.current)) return;
        delete heldRunnerStatusesRef.current[runnerId];
        setHeldRunnerStatuses((prev) => {
            if (!(runnerId in prev)) return prev;
            const next = { ...prev };
            delete next[runnerId];
            return next;
        });
    }, []);

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
    const cellKeyFromPosition = (pos) => (pos ? `${pos.segment}-${pos.positionY}-${pos.positionX}` : null);
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
    // "Комментарии" (2026-09-11) — звуки результатов из assets/sounds/comments/
    // (старт партии/уничтожение/выбывание/столкновение/аномалия), см.
    // constants/commentSounds.js. Один общий канал на все 5 категорий — тот
    // же компромисс, что и у voice/shoot/start чуть выше (если два разных
    // комментария выпадут почти одновременно, второй оборвёт первый через
    // .replace() — событие редкое, специально не усложняем множеством
    // каналов). collisionSound (существующий, .wav вне comments/) теперь
    // приглушена вдвое и играет ЦИКЛИЧНО, пока видна поза столкновения (см.
    // handleCollisionPoseStart/End ниже), а не один раз коротким хлопком —
    // по прямому запросу пользователя.
    const commentSound = useAudioPlayer(null);
    useEffect(() => {
        collisionSound.loop = true;
        collisionSound.volume = 0.5;
    }, [collisionSound]);
    // Считает ОДНОВРЕМЕННО активные пары столкновений (на доске теоретически
    // может быть больше одной сразу) — collisionSound останавливаем, только
    // когда ПОСЛЕДНЯЯ пара реально разошлась, не раньше.
    const activeCollisionPosesRef = useRef(0);
    // "start"-комментарий должен прозвучать РОВНО один раз за всю партию —
    // единственный надёжный сигнал "это самый первый ход" — событие
    // player_roll_move_dice, бэк шлёт его ТОЛЬКО из StepBeginService::start()
    // (никогда из startNewRound()/resetPlayer()), см. commentSounds.js.
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
            const combinedOnStart = (deathOnStart || cellReleaseOnStart || mineOnStart)
                ? () => { deathOnStart?.(); cellReleaseOnStart?.(); mineOnStart?.(); }
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
            } else if (kind === 'destroyed' || kind === 'acid' || kind === 'burn') {
                // Любой способ уничтожения (выстрел/стена/ловушка Жнеца/
                // отброс за край и т.п.) — этот kind триггерится ТОЛЬКО на
                // реальное ухудшение статуса до 'destroyed', см. statusWorsened
                // в lib/runnerAnimTriggers.js, повторов на один и тот же
                // бегун быть не должно. 'acid'/'burn' (2026-09-12/13, по
                // прямому запросу) — терминальная поза смерти на клетке wall,
                // это ТОЖЕ уничтожение (см. lib/runnerAnimTriggers.js — оба
                // kind заменяют обычный 'destroyed', отдельного вызова с
                // kind==='destroyed' для этого случая никогда не будет).
                playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.destroyed));
            }
        },
        [runnerAnim.trigger, playOneShot, shootSound, startSound, commentSound, releaseHeldCellOnStart, mineBlasts.trigger],
    );

    // Логируем И версионные события (через reduce — вызывается ровно по разу
    // на применённое событие, дубли уже отфильтрованы useMercure), И
    // транзиентные (step_*/orchestrator без version) — теперь они хоть куда-то
    // попадают, а не просто отбрасываются.
    const reduceAndLog = useCallback(
        (state, e) => {
            pushLog(e);
            // Детекция ДО handleVersionedRunnerAnimEvent (см. докстринг у
            // pendingDeathRunnerIds выше) — порядок важен: если очередь
            // анимаций у этого бегуна сейчас пуста, acid/burn стартует
            // СИНХРОННО прямо внутри вызова handleVersionedRunnerAnimEvent
            // ниже (advanceQueue вызывает onStart сразу же), и deathOnStart
            // уже успеет убрать runnerId из этого Set к моменту, когда
            // управление сюда вернётся — если добавлять ПОСЛЕ вызова, эта
            // ранняя отписка произошла бы РАНЬШЕ подписки, и флаг завис бы
            // навсегда. Проверка ТА ЖЕ (DEATH_KIND_BY_REASON), что уже
            // используется в lib/runnerAnimTriggers.js для решения "acid или
            // burn вместо destroyed" — продублирована намеренно (независимый
            // потребитель того же факта). 2026-09-18: раньше тут тоже
            // приходилось звать cellTypeAt по последней известной позиции —
            // теперь бэк прямо называет причину в e.reason.
            if (e.event === 'runner_destroy' && DEATH_KIND_BY_REASON[e.reason]) {
                setPendingDeathRunnerIds((prev) => new Set(prev).add(e.runnerId.id));
            }
            handleVersionedRunnerAnimEvent(state, e, triggerWithSound, {
                onceStepDone: runnerAnim.onceStepDone,
                completeWaitStep: runnerAnim.completeWaitStep,
            });
            // "Игра стартовала, кубики розданы" — см. gameStartSoundPlayedRef
            // выше за тем, почему именно player_roll_move_dice (а не
            // game_active/step_begin) — это событие приходит N раз (по разу
            // на игрока), звук должен прозвучать один раз на всю партию.
            if (e.event === 'player_roll_move_dice' && !gameStartSoundPlayedRef.current) {
                gameStartSoundPlayedRef.current = true;
                playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.start));
            }
            // Лечение возвращает бегуна к healthy — стираем локально
            // накопленные жетоны повреждений, иначе кружки останутся
            // закрашенными вопреки уже здоровому статусу. Заодно триггерим
            // 'heal'-анимацию (2026-09-12, новый ассет пользователя) — по
            // прямому запросу проигрывается МЕЖДУ damaged_idle и healthy_idle
            // (getRunnerAnimationImage сам достаёт heal-ассет из damaged-
            // бакета, независимо от уже применённого нового статуса).
            if (e.event === 'ability_heal' && e.runner?.id != null) {
                runnerDamageTokens.clearRunner(e.runner.id);
                triggerWithSound(e.runner.id, 'heal', {});
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
            // Замораживаем клетку в ЕЁ ЖЕ ВИДЕ ДО вскрытия (см. heldCells выше)
            // — читаем rawType из `state` (это ещё PRE-update снимок, сам
            // редьюсер применится строкой ниже). e.cell.row/column — это
            // positionX/positionY соответственно (см. store/runnerGameReducer
            // #patchCell — та же путаница в именах полей унаследована от
            // бэка), cellId собираем в ТОМ ЖЕ формате, что и BoardGrid/lib/board
            // (`${segment}-${positionY}-${positionX}`).
            if (e.event === 'game_cell_updated' && e.cell) {
                const { segment, row: positionX, column: positionY } = e.cell;
                const cellId = `${segment}-${positionY}-${positionX}`;
                // См. minePendingRef/onTransient выше — если непосредственно
                // ПЕРЕД этим вскрытием пришёл транзиент danger==='mine',
                // именно ЭТА клетка и есть место взрыва (бэк публикует их
                // строго подряд в одном и том же коде-пути, см. Danger.php
                // read-only). Флаг одноразовый — сбрасываем сразу, следующее
                // вскрытие (не мина) не должно случайно унаследовать его.
                if (minePendingRef.current) {
                    minePendingRef.current = false;
                    // Как и у heldCells чуть ниже (см. activatedCellKeysRef) —
                    // если onStart для ЭТОЙ позиции уже отработал ДО того, как
                    // мы узнали про мину (однохоповый случай, без каскада —
                    // мгновенный мердж пришёл раньше вскрытия), ждать больше
                    // нечего, взрываем сейчас же. Иначе — откладываем до
                    // onStart (см. triggerWithSound#mineOnStart), с
                    // страховочным потолком на случай, если он не придёт.
                    if (activatedCellKeysRef.current.has(cellId)) {
                        mineBlasts.trigger(cellId);
                    } else {
                        pendingMineCellIdsRef.current.add(cellId);
                        setTimeout(() => {
                            if (pendingMineCellIdsRef.current.delete(cellId)) mineBlasts.trigger(cellId);
                        }, MINE_TRIGGER_SAFETY_TIMEOUT_MS);
                    }
                }
                // Если позиция УЖЕ активирована (см. activatedCellKeysRef выше)
                // — типовой случай "один хоп, не каскад" (например мина-Мяч):
                // trigger() для этой же клетки уже синхронно сработал ДО этого
                // события (мгновенный мердж пришёл раньше вскрытия) — замораживать
                // нечего, анимация и так уже активна/стартует в этом же кадре.
                if (!activatedCellKeysRef.current.has(cellId)) {
                    const oldRawType = [state?.trackBegin, state?.trackMiddle, state?.trackEnd][segment]
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
            const nextState = runnerGameReducer(state, e);
            // Игрок выбыл (player_out) — играет у ВСЕХ клиентов партии, КРОМЕ
            // случая, когда это выбывание ПОСЛЕДНЕГО соперника и партия тут
            // же завершилась победой оставшегося (пользователь прямо попросил
            // не дублировать этот момент отдельным "выбыл", раз сразу следом
            // придёт game_finish). Считаем активных игроков ПОСЛЕ применения
            // патча (nextState — этот игрок уже OUT): если остался РОВНО 1 —
            // по бэковой логике (PlayerOutService::run(), read-only) это и
            // есть терминальный случай (count($activePlayers)===1 → сразу
            // GameFinishService) — иначе игра продолжается, звук нужен.
            if (e.event === 'player_out') {
                const activeCount = (nextState.gamePlayers ?? []).filter((p) => p.status === PLAYER_STATUS.ACTIVE).length;
                if (activeCount !== 1) playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.lost));
            }
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
        [
            pushLog, triggerWithSound, runnerDamageTokens.clearRunner, runnerDamageTokens.consumePendingType,
            runnerDamageTokens.recordToken, playOneShot, voiceSound, commentSound, mineBlasts.trigger,
            runnerAnim.onceStepDone, runnerAnim.completeWaitStep,
        ],
    );

    // Результат УЖЕ БРОШЕННОГО кубика столкновения — по прямому запросу
    // пользователя, 2026-09-10: баннер "Использовать/Перебросить" не
    // показывал, ЧТО именно произойдёт при "Использовать", решение
    // принималось вслепую. `CollisionEvent` (бэк, read-only) публикуется
    // РОВНО в момент броска (до того, как игрок вообще видит баннер —
    // тот же кубик потом либо применяется, либо перебрасывается заново) —
    // несёт `{collision, direction}`. `collision` — PHP int-backed enum
    // (Collision::LOWER=1/TOP=2, см. Enum/Collision.php), json_encode
    // сериализует backed enum в его value НАПРЯМУЮ (число, не строка) — см.
    // COLLISION_LOWER/COLLISION_TOP ниже. Не пытаемся определить, ЧЕЙ именно
    // бегун сдвинется ("мой"/"чужой") — у backend'а есть задокументированный
    // (см. CLAUDE.md, находка 2026-09-10) баг с перепутанным порядком
    // lowRunner/topRunner в одной из веток `runnerCollision()`, так что
    // категория "меньший/больший бегун" (сама по себе корректна — это прямое
    // значение броска) безопаснее конкретного "твой/их".
    const [pendingCollisionRoll, setPendingCollisionRoll] = useState(null);
    // Одноразовый комментарий (collision_*.wav) — ЗАЩИТА от двойного/
    // запоздалого звука, 2026-09-20, живая жалоба пользователя: "звук
    // comments для чёрной дыры проигрался РАНЬШЕ, чем звук для коллизии",
    // хотя коллизия по игровому времени случилась ПЕРВОЙ. Причина —
    // раньше этот звук стартовал ТОЛЬКО из handleCollisionPoseStart, колбэка
    // от BoardGrid, который срабатывает лишь ПОСЛЕ того, как React
    // ПЕРЕРИСУЕТ доску с новыми позициями бегунов (versioned-событие →
    // reduceAndLog → commit → ре-рендер BoardGrid → он сам обнаруживает
    // новую пару) — целый цикл рендера задержки. anomalyHole/ricochet/miss
    // ниже, наоборот, играют ПРЯМО ЗДЕСЬ, синхронно с приходом транзиента,
    // без всякой зависимости от рендера — отсюда и обгон по факту, хотя
    // коллизия произошла раньше по времени сервера. Фикс — играть комментарий
    // столкновения ТОЖЕ синхронно, прямо на транзиент 'collision' (тот же
    // CollisionEvent, что уже даёт pendingCollisionRoll чуть ниже — бэк шлёт
    // его сразу в момент броска, задолго до того, как BoardGrid вообще
    // успевает отрисовать позу). `collisionCommentPlayedRef` не даёт звуку
    // повториться на КАЖДЫЙ ПЕРЕБРОС ("Перебросить" шлёт новый /collision →
    // новый транзиент 'collision' с тем же extraTurnPlayer, тот же
    // конфликт ещё не разрешён) — сбрасывается вместе с pendingCollisionRoll
    // ниже, когда game.extraTurnPlayer возвращается в null (коллизия
    // ПОЛНОСТЬЮ разрешена). Зацикленный collisionSound (см.
    // handleCollisionPoseStart ниже) специально НЕ трогали — та часть
    // осознанно ждёт реальной ВИДИМОЙ позы, не сдвигали.
    const collisionCommentPlayedRef = useRef(false);
    const onTransient = useCallback(
        (e) => {
            pushLog(e);
            handleTransientRunnerAnimEvent(e, gameRef, triggerWithSound);
            const pending = identifyPendingDamageType(e, gameRef);
            if (pending) runnerDamageTokens.notePendingType(pending.runnerId, pending.type);
            const ghostPass = identifyGhostPass(e, gameRef);
            if (ghostPass) ghostPairs.record(ghostPass.key);
            // Взрыв мины (см. mineBlasts выше) — только ЗАПОМИНАЕМ факт "ждём
            // клетку", саму клетку узнаём из следующего game_cell_updated
            // (транзиент 'danger' координат не несёт вообще, см.
            // DangerEvent.php на бэке read-only) — см. reduceAndLog ниже.
            if (e.event === 'danger' && e.danger === 'mine') {
                minePendingRef.current = true;
            }
            if (e.event === 'collision') {
                setPendingCollisionRoll({ collision: e.collision, direction: e.direction });
                if (!collisionCommentPlayedRef.current) {
                    collisionCommentPlayedRef.current = true;
                    playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.collision));
                }
            }
            // Опасная клетка вскрылась как Аномалия (чёрная дыра, см.
            // handleTransientRunnerAnimEvent#case 'anomaly' выше — тот же
            // транзиент уже триггерит визуальный 'fly', тут только звук).
            if (e.event === 'anomaly') {
                playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.anomalyHole));
            }
            // Опасная клетка вскрылась как Рикошет — тот же класс транзиента,
            // что и Аномалия выше, просто своей визуальной анимации не имеет.
            if (e.event === 'ricochet') {
                playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.ricochet));
            }
            // Выстрел не попал (AttackResolutionService::resolve() на бэке
            // вернул false) — бэк ВСЕГДА шлёт этот транзиент на КАЖДЫЙ
            // выстрел (обычный и атаку Жнеца при размещении), hit:false
            // значит урона не будет и каскад повреждений не начнётся.
            if (e.event === 'attack' && e.hit === false) {
                playOneShot(commentSound, pickRandom(COMMENT_SOUNDS.miss));
            }
        },
        [pushLog, triggerWithSound, runnerDamageTokens.notePendingType, ghostPairs.record, playOneShot, commentSound],
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

    const { windowStart, backButtonProps, forwardButtonProps, jumpTo, jumpToStart } = useBoardScroll({ cols: viewportCols });

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
                // step — 2026-09-20, нужен PlayerInfoPanel/RunnerCard, чтобы
                // показать индикатор бонуса хода на плитке РЕАЛЬНОГО игрока
                // (не обязательно "моего" — панель переключаемая, см.
                // roadBonusValue ниже).
                step: p.step,
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

        if (pendingReaperPlacement && reaperPreviewReady) {
            // Направление выстрела Жнеца сразу при размещении — подсветка
            // на доске вместо кнопок ↖/↑/↗ (единообразно с MOVE, по прямому
            // запросу пользователя, 2026-09-07). Появляется только ПОСЛЕ
            // того, как "прилёт" Жнеца успел доиграть (см. reaperPreviewReady
            // выше) — до этого highlightedCells пуст, тапать некуда. СТРОГО
            // вперёд (UP) — по прямому уточнению пользователя, 2026-09-08:
            // "стрелять строго по прямой должен только Жнец", остальные типы
            // (см. SHOOT-ветку ниже) стреляют по всем 3 направлениям, как
            // обычный MOVE.
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
                    .filter((pos) => pos.direction === 'UP' && findRunnerAt(runners, pos))
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
    }, [myTurn, myStep, activeRunner, busy, pendingAbility, runners, totalBlocks, game, pendingReaperPlacement, reaperPreviewReady, trackShiftPhase]);

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
    // MUSIC_VOLUME приглушена относительно дефолтных 1.0 у звуковых
    // эффектов, чтобы музыка не перекрикивала голосовые реплики/выстрелы.
    // Настоящая причина "громкость не применяется" (живая жалоба
    // пользователя, 2026-09-12): на вебе expo-audio's `.replace()`
    // (AudioPlayerWeb, node_modules/expo-audio/src/AudioPlayer.web.ts)
    // выкидывает старый <audio>-элемент и создаёт НОВЫЙ (`_createMediaElement()`)
    // — громкость сбрасывается на дефолтные 1.0 браузера, `musicSound.volume`,
    // установленная один раз в отдельном mount-эффекте, тут же перекрывалась
    // ПЕРВЫМ ЖЕ вызовом playRandomTrack(). Фикс — выставлять volume ПОСЛЕ
    // КАЖДОГО .replace(), не один раз при монтировании.
    const MUSIC_VOLUME = 0.1;
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
        musicSound.volume = MUSIC_VOLUME;
        musicSound.play();
    }, [musicSound]);
    // Как только текущий трек доигрывает до конца — сразу следующий
    // случайный (без паузы/тишины между ними, обычный плейлист-шаффл).
    useEffect(() => {
        const sub = musicSound.addListener('playbackStatusUpdate', (status) => {
            if (status.didJustFinish) playRandomTrack();
        });
        return () => sub.remove();
    }, [musicSound, playRandomTrack]);
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

    // Автоматический ход накатом (по прямому запросу пользователя, 2026-09-08):
    // после подтверждения SELECT типа ROLL шаг игрока переходит в MOVE, а
    // highlightedCells (см. выше, isRollMove) подсвечивает РОВНО одну клетку
    // (строго UP, без выбора направления — уже решено ранее, 2026-09-08) —
    // тапать там больше не по чему выбирать, только по единственному
    // варианту, так что делаем этот тап сами. autoRollMoveKeyRef — защита от
    // повторного вызова: эффект перезапускается на каждое изменение
    // activeRunner (новый объект на каждое live-обновление), а не только
    // когда РЕАЛЬНО появляется новая накат-возможность.
    // Ключ — "runnerId:rollMoves", НЕ "runnerId:rollDice" (было так до
    // 2026-09-12) — живая жалоба пользователя: "первый накат сработал
    // автоматом, второй пришлось прожимать рукой" (2 наката доступны,
    // остался 1 бегун). Причина: `rollDice` — это 1-based ИНДЕКС кубика
    // игрока (тот же слот, что и в обычном SELECT, см.
    // StepSelectionService::handleRoll — `$runner->setRollDice($dto->dice)`),
    // НЕ уникальный номер попытки — если игрок оба раза тащит кубик из
    // ОДНОГО и того же слота (например, остался последний свободный), у
    // второго наката `rollDice` совпадает с первым, ключ получается тем же
    // самым, и эффект молча пропускает автотап, думая, что уже обработал
    // именно эту попытку. `rollMoves`, наоборот, — счётчик РЕАЛЬНО
    // ВЫПОЛНЕННЫХ накатов, `RunnerRollService::run()` (бэк, read-only)
    // увеличивает его на 1 СТРОГО при завершении каждого наката — на
    // момент SELECT следующего наката это уже другое число, коллизия
    // невозможна независимо от того, какой кубик перетащил игрок.
    const autoRollMoveKeyRef = useRef(null);
    useEffect(() => {
        if (!myTurn || busy || myStep !== PLAYER_STEP.MOVE || !activeRunner) return;
        const isRollMove = activeRunner.dice === 0 && activeRunner.rollDice != null;
        if (!isRollMove) {
            autoRollMoveKeyRef.current = null;
            return;
        }
        const key = `${activeRunner.id}:${activeRunner.rollMoves}`;
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
    const autoNoShotAttemptedRef = useRef(null);
    useEffect(() => {
        if (!pendingReaperPlacement || !reaperPreviewReady || canReaperShoot || busy) return;
        if (autoNoShotAttemptedRef.current === pendingReaperPlacement) return;
        autoNoShotAttemptedRef.current = pendingReaperPlacement;
        handleReaperShoot(undefined);
    }, [pendingReaperPlacement, reaperPreviewReady, canReaperShoot, busy, handleReaperShoot]);

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
        pendingReaperPlacement, reaperPreviewReady, canReaperShoot,
    );
    // pendingSelect (карточка выбрана, ждём ✓/✕) — кнопки ПРАВЕЕ текста, в
    // одну строку с ним, а не отдельным рядом ниже (по прямому запросу
    // пользователя, 2026-09-14, "чтобы сократить размер плитки диалога" —
    // после того как сам текст уже укоротили, а кнопки стали иконками,
    // отдельная строка под ними тратила высоту зря). Остальные состояния
    // (ABILITY/MOVE/SHOOT/Жнец/бонус дороги) — без изменений, текст и кнопки
    // по-прежнему на разных строках (там текст длиннее, в строку не влезет).
    const turnBannerInner = myTurn ? (
        <>
            {/* Пульсирует бело↔зелёным всё время, пока myTurn (весь этот блок
                рендерится только тогда) — по прямому запросу пользователя,
                2026-09-14, тем же общим механизмом, что и подсказки "что
                делать дальше" (см. usePulse/PulseText, CLAUDE.md). */}
            <PulseText active baseColor={colors.textOnDark} toColor={colors.success} style={styles.turnTitleMine}>
                Твой ход
            </PulseText>
            {!pendingReaperPlacement && pendingSelect && !busy ? (
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
                <View style={styles.turnHintRow}>
                    <Text style={[styles.turnHint, styles.turnHintFlex]} noGlobalTint>{turnHintText}</Text>
                    <Button title="Пропустить" variant="muted" onPress={handleAbilitySkip} style={styles.turnSkipBtnCompact} />
                </View>
            ) : (
                // Центрировано (по прямому запросу пользователя, 2026-09-14) —
                // ТОЛЬКО этот, безкнопочный случай (MOVE/SHOOT/ABILITY heal-
                // reaper и т.п.). Строки с кнопками (turnHintFlex выше) не
                // трогали — там текст рядом с кнопкой, левое выравнивание там
                // читается естественнее.
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
            {/* Направление выстрела Жнеца — теперь тап по подсвеченной клетке
                (см. highlightedCells/handleCellPress выше), а не кнопки
                ↖/↑/↗ (по прямому запросу пользователя, 2026-09-07, "такое же
                отображение, как для обычных бегунов"). "Без выстрела"
                остаётся кнопкой — это не клетка на доске. Доступна сразу
                (не ждёт reaperPreviewReady) — пропустить выстрел можно и не
                дожидаясь, пока доиграет анимация прилёта.

                Кнопка СКРЫТА, когда автоэффект выше (см. autoNoShotAttemptedRef)
                и так уже примет то же решение сам — по прямому запросу
                пользователя, 2026-09-09: раньше диалог "Без выстрела/Отмена"
                показывался ДАЖЕ когда выбора физически нет (round===0 или
                нет цели), хотя игроку нечего решать. Условие СИММЕТРИЧНО
                автоэффекту (canReaperShoot||!reaperPreviewReady) — до того,
                как preview settled, кнопка ещё видна (можно пропустить
                выстрел не дожидаясь анимации, как и раньше), settled+нет
                выбора → эффект уже сам всё решил, лишняя кнопка не нужна. */}
            {pendingReaperPlacement && !busy && (
                <View style={styles.turnBtnRow}>
                    {(canReaperShoot || !reaperPreviewReady) && (
                        <Button title="Без выстрела" variant="muted" onPress={() => handleReaperShoot(undefined)} style={styles.turnSkipBtn} />
                    )}
                    {/* "Отмена" — живой тест, 2026-09-08, поймал реальный
                        тупик: если размещение отклонено бэком (например,
                        невалидный positionX — см. фикс highlightedCells
                        выше), pendingReaperPlacement не сбрасывается сам
                        (runAction молча ловит ошибку, .then(()=>...) не
                        вызывается), а других способов вернуться к выбору
                        клетки не было — игрок застревал, раз за разом
                        повторяя ту же обречённую попытку. Видна БЕЗУСЛОВНО
                        (не гейтится canReaperShoot) — общий аварийный выход
                        и для авто-случая тоже, если сам авто-вызов вдруг
                        зависнет/упадёт. */}
                    <Button title="Отмена" variant="danger" onPress={() => setPendingReaperPlacement(null)} style={styles.turnSkipBtn} />
                </View>
            )}
            {/* Бонус дороги и усиление теперь в строке с текстом выше (см.
                showRoadBonusChoice/showAbilitySkip в ветке turnHintRow) —
                здесь остался только выстрел. */}
            {!pendingSelect && !showRoadBonusChoice && !showAbilitySkip && showShootSkip && (
                <Button
                    title="Пропустить выстрел"
                    variant="muted"
                    onPress={handleShootSkip}
                    style={styles.turnSkipBtn}
                />
            )}
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
                    : runners
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

            {/* Кат-сцена сдвига фрагментов (см. эффект у trackShiftPhase выше) —
                видна ВСЕМ игрокам одновременно, не только тому, кто вызвал сдвиг:
                камера прыгает без спроса, доска на это время неинтерактивна
                (см. highlightedCells), banner объясняет почему. */}
            {trackShiftPhase && (
                <View style={[styles.collisionBanner, { top: insets.top + spacing.md }]} pointerEvents="none">
                    <Text style={styles.collisionText} noGlobalTint>Трасса смещается…</Text>
                </View>
            )}

            {/* width = leftPanelW (2026-09-14, по прямому запросу пользователя) —
                раньше был отдельный, НЕ связанный с шириной панели maxWidth:280
                (turnBanner — position:'absolute', плавает НАД доской, это не
                часть PlayerInfoPanel и не подхватывает её ширину сама по себе;
                правка ширины RunnerCard этим же днём тут ни при чём — другой
                компонент). Теперь плитка "Твой ход"/"Ход игрока" всегда РОВНО
                той же ширины, что и левая панель под ней. */}
            {!isPortrait && <View style={[styles.turnBanner, { width: leftPanelW }]}>{turnBannerInner}</View>}

            {game.extraTurnPlayer != null && (
                <View style={[styles.collisionBanner, { top: insets.top + spacing.md }]}>
                    <View style={styles.collisionTextColumn}>
                        <Text style={styles.collisionText} noGlobalTint>
                            {/* Столкновение происходит в любом случае — отказаться от него
                                нельзя (по правилам выбор есть только у более крупного бегуна
                                при столкновении разных размеров, см. myCollision выше). Выбор
                                здесь — использовать уже брошенный кубик или перебросить его
                                заново, а не "принять/отклонить само столкновение" — прежняя
                                формулировка вводила в заблуждение (жалоба пользователя,
                                2026-09-02). Имя победителя (collisionWinnerPlayer) — по
                                прямому запросу пользователя, 2026-09-10: раньше баннер не
                                говорил, КТО именно получил выбор, только сам факт "ожидаем
                                реакцию игрока". Столкновение с "мячом" (препятствием) теперь
                                идёт ЭТИМ ЖЕ путём, без отдельной ветки — по прямому запросу
                                пользователя, у победителя (тот, чей бегун крупнее — мяч
                                никогда структурно не бывает крупной стороной, см. коммент у
                                collisionWinnerPlayer) должен быть тот же выбор, что и при
                                столкновении с другим игроком. */}
                            {myCollision
                                ? `Столкновение — ${collisionWinnerPlayer?.name ?? 'вы'} крупнее`
                                : `Столкновение — ждём ${collisionWinnerPlayer?.name ?? 'игрока'}`}
                        </Text>
                        {/* Результат УЖЕ брошенного кубика (см. pendingCollisionRoll выше) —
                            по прямому запросу пользователя, 2026-09-10: "не вижу результат
                            первого столкновения, чтобы принять решение". Показывается ВСЕМ
                            (не только решающему) синхронно с кнопками — до этого момента
                            решение принималось вслепую. "меньший/больший" — категория
                            размера из самого броска (Collision::LOWER/TOP), не "мой/чужой"
                            бегун — см. коммент у pendingCollisionRoll про известный баг
                            порядка lowRunner/topRunner на бэке в одной из веток. */}
                        {pendingCollisionRoll && collisionDecisionReady && (
                            <Text style={styles.collisionRollText} noGlobalTint>
                                Бросок: {pendingCollisionRoll.collision === COLLISION_TOP ? 'больший' : 'меньший'} → {directionLabel(pendingCollisionRoll.direction)}
                            </Text>
                        )}
                    </View>
                    {myCollision && !busy && collisionDecisionReady && (
                        <>
                            <Button title="Использовать" variant="success" onPress={() => handleCollision(true)} style={styles.collisionBtn} textStyle={styles.collisionBtnText} />
                            <Button title="Перебросить" variant="danger" onPress={() => handleCollision(false)} style={styles.collisionBtn} textStyle={styles.collisionBtnText} />
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
                                setPendingDeathRunnerIds(new Set());
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
                    roadBonusValue={game.trackGain}
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
                            {/* Появление/исчезновение фрагмента при сдвиге трассы теперь
                                рисует САМ BoardGrid (columnOpacities — см. эффект у
                                trackShiftPhase выше) — обёртка тут не нужна,
                                boardGridStack остался чисто layout-контейнером. */}
                            <View style={styles.boardGridStack}>
                                {boardGridEl}
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
                        headerContent={<View style={styles.panelTurnBanner}>{turnBannerInner}</View>}
                        roadBonusValue={game.trackGain}
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
    // Чисто layout-обёртка вокруг boardGridEl — появление/исчезновение
    // фрагмента (хореография сдвига) рисует сам BoardGrid (columnOpacities),
    // отдельного Animated.View тут не нужно.
    // position:'relative' оставлен для консистентности с остальными
    // stack-обёртками в этом файле.
    boardGridStack: { position: 'relative' },
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
    collisionBanner: {
        // right (не alignSelf:'center') — абсолютно спозиционированные дети в RN
        // не центрируются через alignSelf надёжно, нужны явные координаты.
        // top — задаётся динамически (insets.top+spacing.md, см. компонент).
        position: 'absolute', right: spacing.md, zIndex: 20, elevation: 20,
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.bgLight, borderRadius: radius.pill,
        paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    },
    // flex:1 — забирает всю ширину, оставшуюся ПОСЛЕ кнопок (которые не
    // должны сжиматься), не наоборот — иначе длинный текст с результатом
    // броска мог бы вытолкнуть кнопки за пределы баннера.
    collisionTextColumn: { flex: 1 },
    collisionText: { color: colors.textOnDark, fontSize: font.tiny },
    // Чуть тусклее основного текста — вспомогательная информация, не
    // основной вопрос баннера.
    collisionRollText: { color: colors.textOnDark, fontSize: font.tiny, opacity: 0.75, marginTop: 2 },
    // Уменьшено по прямому запросу пользователя, 2026-09-11 — диалог
    // столкновения на Android был слишком крупным (минимальная высота
    // Button по умолчанию — 52, шрифт 18 жирным; тут явно меньше через
    // collisionBtnText).
    collisionBtn: { minHeight: 26, paddingVertical: 2, paddingHorizontal: spacing.sm },
    collisionBtnText: { fontSize: font.tiny, fontWeight: '600' },
    turnBanner: {
        // left:0, было spacing.md (2026-09-14) — панель под ней начинается
        // РОВНО у левого края экрана (wrapper), а ширина банера теперь =
        // leftPanelW (см. место рендера) — старый отступ слева сдвигал ВЕСЬ
        // блок вправо, из-за чего справа он вылезал за пределы панели ровно
        // на ту же величину (живая жалоба пользователя, скриншот с разметкой).
        position: 'absolute', top: spacing.md, left: 0, zIndex: 20, elevation: 20,
        // maxWidth убран (2026-09-14) — width теперь передаётся явно
        // (={leftPanelW}) в месте рендера; maxWidth:280, оставленный тут,
        // ограничивал бы её сверху и на широких панелях (leftPanelW обычно
        // заметно больше 280) банер продолжал бы выглядеть узким.
        backgroundColor: colors.bgLight, borderRadius: radius.md,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    },
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
    // Та же величина, что уже используется для компактных кнопок в этом
    // файле (см. collisionBtn).
    turnSkipBtnCompact: { minHeight: 26, paddingVertical: 2, paddingHorizontal: spacing.md },
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
