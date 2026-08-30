// src/screens/GameBoardScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ArrowButton from '../components/game/ArrowButton';
import RoadNavButton from '../components/game/RoadNavButton';
import MobileFrameOverlay from '../components/game/MobileFrameOverlay';
import RoadArea from '../components/game/RoadArea';
import BoardGrid from '../components/game/BoardGrid';
import FragmentLabelStrip from '../components/game/FragmentLabelStrip';
import PlayerInfoPanel from '../components/game/PlayerInfoPanel';
import GameWaitingRoom from '../components/game/GameWaitingRoom';
import EventLogPanel from '../components/game/EventLogPanel';
import ParallaxBackground from '../components/ui/ParallaxBackground';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useMercure } from '../hooks/useMercure';
import { useAdaptiveOrientation } from '../hooks/useAdaptiveOrientation';
import { ROAD_AREA_SPACING, useBoardLayout } from '../hooks/useBoardLayout';
import { useBoardScroll } from '../hooks/useBoardScroll';
import { flattenTrackSegments, computeFragmentBands } from '../lib/board';
import { forwardNeighbors, cellKey } from '../lib/hexDirection';
import { describeEvent, rawEventFallback } from '../lib/eventLog';
import { notify } from '../lib/notify';
import { runnerGameApi } from '../api/runnerGame';
import { runnerGameReducer } from '../store/runnerGameReducer';
import {
    GAME_STATUS, MOBILE_FRAME_BLEED, PLAYER_COLOR_HEX, PLAYER_COLORS, PLAYER_STEP, RUNNER_DISPLAY,
    RUNNER_STATUS, RUNNER_TYPES,
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
function stepInstruction(step, activeRunner, pendingAbility, pendingSelect, pendingRunnerName, trackGain) {
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
            return activeRunner?.segment == null
                ? 'Тапни подсвеченную клетку в заднем ряду — это выход на трассу'
                : 'Тапни подсвеченную клетку, чтобы переместиться';
        case PLAYER_STEP.SHOOT:
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
export default function GameBoardScreen({ route }) {
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

    // Логируем И версионные события (через reduce — вызывается ровно по разу
    // на применённое событие, дубли уже отфильтрованы useMercure), И
    // транзиентные (step_*/orchestrator без version) — теперь они хоть куда-то
    // попадают, а не просто отбрасываются.
    const reduceAndLog = useCallback(
        (state, e) => {
            pushLog(e);
            return runnerGameReducer(state, e);
        },
        [pushLog],
    );

    const { state: game, status, resync } = useMercure({
        topic: gameId ? `runner_game_${gameId}` : null,
        fetchSnapshot,
        reduce: reduceAndLog,
        onTransient: pushLog,
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
    } = useBoardLayout();
    const isPortrait = orientation === 'portrait';
    // RoadNavButton (ассет пользователя вместо круглой ArrowButton) — только
    // мобильное приложение, НЕ веб ("не совсем понимаю, как это будет
    // выглядеть для браузера"), и только портретная раскладка. Декоративную
    // sci-fi рамку вокруг дороги/панели (MobileFrameOverlay) пробовали и
    // откатили — на реальном Android-эмуляторе рамки оказались слишком
    // большими и с искажёнными углами, пользователь попросил убрать рамку,
    // но оставить кнопки.
    const useMobileNavButtons = isPortrait && Platform.OS !== 'web';

    const { windowStart, backButtonProps, forwardButtonProps } = useBoardScroll({ cols: viewportCols });

    const runners = game?.runners ?? [];
    const gamePlayers = game?.gamePlayers ?? [];

    const [activePlayerId, setActivePlayerId] = useState(null);
    // { ability: 'heal'|'reaper', diceIndex } — ждём второй тап (карточка/клетка), см. шапку файла
    const [pendingAbility, setPendingAbility] = useState(null);
    // { runnerId, diceIndex, type: 'DICE'|'ROLL' } — SELECT ждёт подтверждения, см. шапку файла
    const [pendingSelect, setPendingSelect] = useState(null);
    const [busy, setBusy] = useState(false);

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
                runners: runners.filter((r) => r.playerId === p.id),
            })),
        [gamePlayers, runners],
    );

    const playerColorById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.color])), [players]);

    // Чей сейчас ход — на экране раньше не было видно вообще (см. CLAUDE.md,
    // живой прогон). game.playerOrder хранит RunnerPlayer.id как строку.
    const currentTurnPlayer = useMemo(
        () => gamePlayers.find((p) => String(p.id) === String(game?.playerOrder)) ?? null,
        [gamePlayers, game?.playerOrder],
    );

    const gridData = useMemo(
        () => flattenTrackSegments([game?.trackBegin, game?.trackMiddle, game?.trackEnd], rows, cols),
        [game?.trackBegin, game?.trackMiddle, game?.trackEnd, rows, cols],
    );

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

        if (myStep === PLAYER_STEP.MOVE && activeRunner) {
            if (activeRunner.segment == null) {
                // Ещё не на трассе — любая клетка заднего края trackBegin (positionX=0)
                const cells = new Set();
                for (let positionY = 0; positionY <= 5; positionY++) {
                    cells.add(cellKey({ segment: 0, positionX: 0, positionY }));
                }
                return { highlightedCells: cells, tapMode: 'start' };
            }
            const neighbors = forwardNeighbors(activeRunner);
            return {
                highlightedCells: new Set(neighbors.map(cellKey)),
                tapMode: 'move',
            };
        }

        if (myStep === PLAYER_STEP.SHOOT && activeRunner) {
            const targets = forwardNeighbors(activeRunner).filter((pos) => {
                const occupant = findRunnerAt(runners, pos);
                return occupant && occupant.type !== RUNNER_TYPES.REAPER && !DEAD_STATUSES.includes(occupant.status);
            });
            return { highlightedCells: new Set(targets.map(cellKey)), tapMode: 'shoot' };
        }

        if (pendingAbility?.ability === 'reaper') {
            // Любая пустая проходимая клетка на всех трёх загруженных сегментах —
            // бэк это не проверяет (см. CLAUDE.md про ReaperService::validateCell),
            // так что и занятость, и проходимость (не wall/anomaly) считаем сами.
            const cells = new Set();
            for (let segment = 0; segment < totalBlocks; segment++) {
                for (let positionX = 0; positionX <= 7; positionX++) {
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
    }, [myTurn, myStep, activeRunner, busy, pendingAbility, runners, totalBlocks, game]);

    const shotSound = useAudioPlayer(require('../assets/sounds/lazer.mp3'));

    const runAction = useCallback(async (fn) => {
        setBusy(true);
        try {
            await fn();
        } catch (e) {
            notify('Не удалось выполнить действие', e.userMessage ?? e.message);
        } finally {
            setBusy(false);
        }
    }, []);

    const handleCellPress = useCallback(
        (cell) => {
            shotSound.seekTo(0);
            shotSound.play();

            if (!tapMode) return;
            const key = cell.id; // "segment-row-col" = "segment-positionY-positionX", см. lib/board.js
            if (!highlightedCells.has(key)) return;

            if (tapMode === 'start') {
                runAction(() => runnerGameApi.move(cell.row, null));
                return;
            }
            if (tapMode === 'move') {
                const target = { segment: cell.blockIndex, positionX: cell.col - cell.blockIndex * cols, positionY: cell.row };
                const neighbor = forwardNeighbors(activeRunner).find((n) => cellKey(n) === cellKey(target));
                if (!neighbor) return;
                runAction(() => runnerGameApi.move(null, neighbor.direction));
                return;
            }
            if (tapMode === 'shoot') {
                const target = { segment: cell.blockIndex, positionX: cell.col - cell.blockIndex * cols, positionY: cell.row };
                const neighbor = forwardNeighbors(activeRunner).find((n) => cellKey(n) === cellKey(target));
                if (!neighbor) return;
                runAction(() => runnerGameApi.shoot(true, neighbor.direction));
                return;
            }
            if (tapMode === 'reaper' && pendingAbility) {
                const { diceIndex } = pendingAbility;
                const positionX = cell.col - cell.blockIndex * cols;
                const positionY = cell.row;
                runAction(() =>
                    runnerGameApi
                        .ability(true, {
                            ability: 'reaper',
                            dice: diceIndex + 1,
                            positionX,
                            positionY,
                            segment: cell.blockIndex,
                        })
                        .then(() => setPendingAbility(null)),
                );
            }
        },
        [shotSound, tapMode, highlightedCells, activeRunner, cols, pendingAbility, runAction],
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
        return (
            <View style={styles.wrapper}>
                <ParallaxBackground />
                <GameWaitingRoom gamePlayers={gamePlayers} />
                <EventLogPanel entries={eventLog} />
            </View>
        );
    }

    const showShootSkip = myTurn && myStep === PLAYER_STEP.SHOOT && !busy;
    const showAbilitySkip = myTurn && myStep === PLAYER_STEP.ABILITY && !busy && !pendingAbility;
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
                {stepInstruction(myStep, activeRunner, pendingAbility, pendingSelect, pendingRunnerName, game.trackGain)}
            </Text>
            {pendingSelect && !busy && (
                <View style={styles.turnBtnRow}>
                    <Button title="Подтвердить" variant="success" onPress={handleConfirmSelect} style={styles.turnSkipBtn} />
                    <Button title="Отмена" variant="muted" onPress={handleCancelSelect} style={styles.turnSkipBtn} />
                </View>
            )}
            {!pendingSelect && showRoadBonusChoice && (
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

    return (
        <View style={[styles.wrapper, isPortrait && styles.wrapperPortrait]}>
            <ParallaxBackground />

            {!isPortrait && <View style={styles.turnBanner}>{turnBannerInner}</View>}

            {game.extraTurnPlayer != null && (
                <View style={[styles.collisionBanner, { top: insets.top + spacing.md }]}>
                    <Text style={styles.collisionText}>
                        {myCollision ? 'Столкновение! Принять?' : 'Ожидаем реакцию игрока на столкновение…'}
                    </Text>
                    {myCollision && !busy && (
                        <>
                            <Button title="Принять" variant="success" onPress={() => handleCollision(true)} style={styles.collisionBtn} />
                            <Button title="Отклонить" variant="danger" onPress={() => handleCollision(false)} style={styles.collisionBtn} />
                        </>
                    )}
                    {!myCollision && showStuckRefresh && (
                        <Button title="Обновить состояние" variant="info" onPress={resync} style={styles.collisionBtn} />
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
                    width={leftPanelW}
                    switcherHeight={switcherH}
                />
            )}

            {/* Портретная раскладка: доска сверху (статичная сетка, стрелки вверх/вниз
                мгновенно сдвигают видимое окно на 1 сегмент/удержание — см.
                useBoardScroll/BoardGrid), панель игрока снизу с фиксированной высотой
                (panelH из useBoardLayout) — см. BoardGrid про "снизу вверх" и
                useBoardLayout про геометрию. Альбомная — как была: панель слева
                (см. выше), доска с боку. */}
            <View
                style={[
                    isPortrait ? styles.roadZonePortrait : styles.roadZone,
                    // Без этого верхняя стрелка (первый flow-элемент в портретной
                    // раскладке, экран без SafeAreaView) рисовалась под статус-баром/
                    // вырезом камеры — не видна и не тапабельна (жалоба пользователя).
                    isPortrait && { paddingTop: insets.top },
                ]}
            >
                {/* Портрет: у стрелок СВОЯ логика, ОБРАТНАЯ направлению прежнего свайпа
                    (подтверждено пользователем явно) — "вверх" = дальше по треку,
                    "вниз" = назад к началу. В альбомной раскладке — как было:
                    left=back, right=forward. С 2026-08-30 обе — мгновенный посегментный
                    сдвиг видимого окна (onPressIn: сразу шаг +повтор каждые 500мс, пока
                    удержана; onPressOut: стоп — см. useBoardScroll), сетка на экране
                    физически не двигается вообще (ни скролла, ни анимации позиции).
                    useMobileNavButtons: обе RoadNavButton (ассет пользователя,
                    анимация нажатия) стоят РЯДОМ в нижнем слоте, а не одна
                    сверху/одна снизу — по прямому запросу пользователя. Верхний
                    слот раньше оставался ПУСТЫМ распорным View той же высоты
                    (arrowBtnSize) — кнопки там больше нет, а useBoardLayout
                    по-прежнему резервировал под него бюджет высоты, из-за чего
                    над доской оставалась настоящая пустая полоса (жалоба
                    пользователя, 2026-08-30). Слот убран совсем (рендерим
                    null) — useBoardLayout для mobileNav-случая теперь не
                    вычитает этот резерв вообще (см. reservedArrowsH там),
                    высота уходит доске. paddingTop:insets.top на
                    roadZonePortrait по-прежнему даёт клиренс под статус-бар/
                    вырез, bleed.top ниже подправлен под убранный слот. */}
                {useMobileNavButtons ? null : isPortrait ? (
                    <ArrowButton
                        direction="up"
                        size={arrowBtnSize}
                        handlers={forwardButtonProps}
                        style={styles.selfCenter}
                    />
                ) : (
                    // Альбомная раскладка (веб) — обе кнопки одной колонкой слева от
                    // дороги (не по краям, как раньше), чтобы отдать освободившуюся
                    // ширину сетке (по запросу пользователя) — см. useBoardLayout,
                    // roadBudgetW теперь резервирует один arrowBtnSize, не два.
                    // RoadNavButton (ассет пользователя) вместо кружочной ArrowButton —
                    // тоже по прямому запросу; left/right — те же up/down-ассеты,
                    // повёрнутые на 90° (см. компонент).
                    <View style={styles.navBtnColumn}>
                        <RoadNavButton direction="right" size={arrowBtnSize} handlers={forwardButtonProps} />
                        <RoadNavButton direction="left" size={arrowBtnSize} handlers={backButtonProps} />
                    </View>
                )}

                <View style={styles.roadFrameWrap}>
                    <RoadArea spacing={ROAD_AREA_SPACING} backgroundColor="#3a034b00">
                        {isPortrait ? (
                            // Полоса с именем фрагмента(ов) слева от сетки — доступна только
                            // в портретной раскладке, где под неё зарезервирована ширина
                            // (labelStripW, см. useBoardLayout) вместо того, чтобы центрировать
                            // сетку и оставлять пустые поля по бокам.
                            <View style={styles.roadRowPortrait}>
                                <FragmentLabelStrip
                                    bands={fragmentBands}
                                    width={labelStripW}
                                    segmentSize={segmentH}
                                    totalHeight={roadContainerH}
                                />
                                <BoardGrid
                                    gridData={gridData}
                                    rows={rows}
                                    cols={viewportCols}
                                    segmentW={segmentW}
                                    segmentH={segmentH}
                                    windowStart={windowStart}
                                    orientation={orientation}
                                    containerWidth={roadContainerW}
                                    containerHeight={roadContainerH}
                                    runners={runners}
                                    playerColorById={playerColorById}
                                    selectedRunnerId={activeRunner?.id ?? null}
                                    highlightedCells={highlightedCells}
                                    onCellPress={handleCellPress}
                                />
                            </View>
                        ) : (
                            <BoardGrid
                                gridData={gridData}
                                rows={rows}
                                cols={viewportCols}
                                segmentW={segmentW}
                                segmentH={segmentH}
                                windowStart={windowStart}
                                orientation={orientation}
                                containerWidth={roadContainerW}
                                containerHeight={roadContainerH}
                                runners={runners}
                                playerColorById={playerColorById}
                                selectedRunnerId={activeRunner?.id ?? null}
                                highlightedCells={highlightedCells}
                                onCellPress={handleCellPress}
                            />
                        )}
                    </RoadArea>
                    {/* bleed.top закрывает И вырез/статус-бар (insets.top), плюс
                        небольшой запас — так рамка реально доходит до истинного верха
                        экрана. Раньше добавлялся ещё +arrowBtnSize (под пустой верхний
                        слот) — слота больше нет (см. комментарий выше), убрано отсюда
                        тоже. Лево/право — чуть за край экрана. Низ — 0 (шов с панелью,
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
                    {/* Кнопки навигации у этого блока БОЛЬШЕ НЕТ (до 2026-08-30, третий
                        заход того же дня, они были отдельным View между roadFrameWrap и
                        panelFrameWrap высотой arrowBtnSize — рамки не смыкались,
                        оставалась голая полоса фона под кнопками). Убрав этот слот,
                        roadFrameWrap (flex:1) сам забирает освободившуюся высоту —
                        рамки теперь стоят вплотную без зазора. Кнопки (вместе с кнопкой
                        лога) переехали в отдельный seamRow ниже — единый ряд,
                        отцентрированный ровно НА стыке рамок (по запросу пользователя),
                        а не внутри одной из них. */}
                </View>

                {!useMobileNavButtons && isPortrait && (
                    <ArrowButton
                        direction="down"
                        size={arrowBtnSize}
                        handlers={backButtonProps}
                        style={styles.selfCenter}
                    />
                )}
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
                useMobileNavButtons (мобильная рамка) — на вебе/альбомной раскладке
                лог остаётся в прежнем углу (position ниже), кнопки — прежние
                ArrowButton в потоке. */}
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
    roadZone: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    // БЕЗ alignItems:'center' (было раньше) — roadFrameWrap должен СТРЕТЧИТЬСЯ на
    // всю ширину (иначе рамка вокруг дороги сжималась бы до ширины самой сетки,
    // когда сегмент ограничен высотой, а не шириной, см. useBoardLayout — рамка
    // не доставала бы до боковых краёв экрана). Верхний спейсер/ArrowButton внутри
    // всё равно имеют явный width, стретч на них не влияет.
    roadZonePortrait: { flex: 1, flexDirection: 'column', justifyContent: 'space-between' },
    // roadZonePortrait больше не центрирует детей по кросс-оси (см. выше) — этим
    // двум ArrowButton (веб-портрет, useMobileNavButtons=false) нужно вернуть
    // центрирование персонально, иначе они прилипнут к левому краю экрана.
    selfCenter: { alignSelf: 'center' },
    // Альбомная раскладка (веб) — обе кнопки навигации одной колонкой слева
    // от дороги (см. комментарий в JSX и useBoardLayout.roadBudgetW).
    navBtnColumn: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    statusText: { fontSize: font.small, color: colors.textOnDarkSecondary, marginTop: spacing.sm },
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
