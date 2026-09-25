// src/screens/MockRoadScreen.js
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BoardGrid from '../components/game/BoardGrid';
import { useBoardLayout } from '../hooks/useBoardLayout';
import { useBoardScroll } from '../hooks/useBoardScroll';
import { useRunnerAnimations } from '../hooks/useRunnerAnimations';
import { useAdaptiveOrientation } from '../hooks/useAdaptiveOrientation';
import { useMineBlasts } from '../hooks/useMineBlasts';
import { runnerGameReducer } from '../store/runnerGameReducer';
import { handleVersionedRunnerAnimEvent, handleTransientRunnerAnimEvent } from '../lib/runnerAnimTriggers';
import { flattenTrackSegments, flattenPeekColumn } from '../lib/board';
import { forwardNeighbors, neighborPosition, cellKey } from '../lib/hexDirection';
import { BOARD_LAYOUT, RUNNER_TYPES, RUNNER_DISPLAY, PLAYER_COLORS } from '../constants/GameConstants';
import { MOCK_GAME } from '../constants/mockGameData';
import { colors, spacing, font, radius } from '../theme';

/**
 * Песочница для проверки анимаций/рендера бегунов — 2026-09-25, по прямому
 * запросу пользователя ("сделай кнопку с переходом на мок-дорогу... чтобы
 * все операции были чисто на фронте, без привязки к вызовам бэка"). Смысл —
 * дать возможность гонять move/fly/attack/collision/death-анимации на живом
 * устройстве БЕЗ реальной партии (без Docker/бэка/ходов по правилам), чтобы
 * можно было быстро воспроизводить и перепроверять баги вроде "телепорт при
 * старте движения" (см. CLAUDE.md — TODO) сколько угодно раз подряд.
 *
 * Архитектура: НЕ отдельная, параллельная реализация рендера — этот экран
 * гоняет ТЕ ЖЕ функции, что и настоящая партия (GameBoardScreen):
 * `runnerGameReducer` (применяет "событие" к состоянию) и
 * `handleVersionedRunnerAnimEvent`/`handleTransientRunnerAnimEvent` (решают,
 * какую анимацию завести). Разница только в ИСТОЧНИКЕ событий — вместо
 * реальных Mercure-событий с бэка тут их собирают руками локальные функции
 * ниже (`moveRunnerTo`/`applyDamage`/`shootFrom`) в ТОЧНО ТОЙ ЖЕ форме
 * (`{event:'runner_save', runnerId:{...}}` и т.п., см. RunnerGame::toArray()
 * на бэке/CLAUDE.md за контракт). Это не "почти как настоящее" — это тот же
 * самый код, что и в бою, поэтому баги, воспроизводимые здесь, будут теми же
 * багами, что и в реальной игре.
 *
 * Трасса — те же 3 фрагмента (start/bend/gorge), что и в constants/mockGameData
 * (визуально похожи на настоящие карты бэка), просто с собственным набором
 * бегунов (2 "игрока" для проверки коллизий разных цветов + мяч-препятствие).
 */

const PLAYER_A = { id: 1, color: PLAYER_COLORS[0] };
const PLAYER_B = { id: 2, color: PLAYER_COLORS[1] };

function makeInitialRunners() {
    return [
        { id: 1, playerId: PLAYER_A.id, type: RUNNER_TYPES.TANK, status: 'healthy', segment: 0, positionX: 2, positionY: 2 },
        { id: 2, playerId: PLAYER_A.id, type: RUNNER_TYPES.ATHLETE, status: 'healthy', segment: 0, positionX: 2, positionY: 3 },
        { id: 3, playerId: PLAYER_A.id, type: RUNNER_TYPES.SPRINTER, status: 'healthy', segment: 0, positionX: 2, positionY: 1 },
        { id: 4, playerId: PLAYER_A.id, type: RUNNER_TYPES.REAPER, status: 'healthy', segment: 0, positionX: 1, positionY: 4 },
        { id: 5, playerId: PLAYER_B.id, type: RUNNER_TYPES.TANK, status: 'healthy', segment: 0, positionX: 5, positionY: 2 },
        { id: 6, playerId: PLAYER_B.id, type: RUNNER_TYPES.ATHLETE, status: 'healthy', segment: 0, positionX: 5, positionY: 3 },
        { id: 7, playerId: PLAYER_B.id, type: RUNNER_TYPES.SPRINTER, status: 'healthy', segment: 0, positionX: 5, positionY: 1 },
        { id: 8, playerId: null, type: RUNNER_TYPES.BALL, status: 'healthy', segment: 1, positionX: 3, positionY: 2 },
    ];
}

function makeInitialGame() {
    return {
        // Переиспользуем готовые тестовые карты (константы бэка/мок, см.
        // mockGameData.js) — только чтобы дорога выглядела похоже на настоящую
        // (danger/wall/mud/sand вперемешку), сам этот экран их не читает.
        trackBegin: MOCK_GAME.trackBegin,
        trackMiddle: MOCK_GAME.trackMiddle,
        trackEnd: MOCK_GAME.trackEnd,
        trackNext: null,
        runners: makeInitialRunners(),
    };
}

const DAMAGE_OUTCOMES = [
    { key: 'damage', label: 'Урон' },
    { key: 'destroy', label: 'Уничтожить' },
    { key: 'fire', label: 'Огонь' },
    { key: 'acid', label: 'Кислота' },
];

const MOVE_MODES = [
    { key: 'move', label: 'Шаг' },
    { key: 'jump', label: 'Прыжок' },
    { key: 'shoot', label: 'Стрелять' },
];

const IS_WEB = Platform.OS === 'web';

const ALL_DIRECTIONS = ['UP', 'LEFT_UP', 'RIGHT_UP', 'LEFT_DOWN', 'RIGHT_DOWN', 'DOWN'];

/**
 * `lib/hexDirection#neighborPosition` (фронтовая!) считает ТОЛЬКО 3 "вперёд"
 * направления (`default: return null` для остальных) — это НЕ то же самое,
 * что бэковый `DirectionService::run()` (PHP, тот действительно знает все 6,
 * но по СВОЕЙ, другой чётности — фронт сознательно её не зеркалит, см.
 * докстринг в hexDirection.js). Для песочницы нужны и "назад"-направления —
 * зеркалим формулу LEFT_UP/RIGHT_UP (тот же критерий чётности дорожки
 * `positionY%2!==0`, тот же "кирпичный" сдвиг), просто с обратным знаком
 * смещения глубины. НЕ трогаем сам hexDirection.js (общий с боевым кодом).
 */
function backwardNeighborPosition({ positionX, positionY, segment }, direction) {
    const advanceDiagonal = positionY % 2 !== 0;
    let next;
    switch (direction) {
        case 'DOWN':
            next = { positionX: positionX - 1, positionY };
            break;
        case 'LEFT_DOWN':
            next = advanceDiagonal
                ? { positionX: positionX - 1, positionY: positionY + 1 }
                : { positionX, positionY: positionY + 1 };
            break;
        case 'RIGHT_DOWN':
            next = advanceDiagonal
                ? { positionX: positionX - 1, positionY: positionY - 1 }
                : { positionX, positionY: positionY - 1 };
            break;
        default:
            return null;
    }
    let nextSegment = segment;
    if (next.positionX > 7) { nextSegment += 1; next.positionX = 0; } else if (next.positionX < 0) { nextSegment -= 1; next.positionX = 7; }
    return { segment: nextSegment, positionX: next.positionX, positionY: next.positionY };
}

/**
 * Соседи ПО ВСЕМ 6 направлениям, не только 3 "вперёд" — по прямому запросу
 * пользователя для мок-дороги ("двигать бегунов в любую смежную клетку, а
 * не только вперёд"). `lib/hexDirection#forwardNeighbors` НАРОЧНО ограничен
 * тремя (боевая логика подсветки/тапа, трогать нельзя — она общая с
 * GameBoardScreen) — это локальный аналог, ТОЛЬКО для песочницы: для 3
 * "вперёд" переиспользует ТУ ЖЕ `neighborPosition`, что и боевой код (единый
 * источник истины для них), для 3 "назад" — локальный backwardNeighborPosition
 * выше.
 */
function allNeighbors(runner) {
    if (runner?.segment == null || runner.positionX == null || runner.positionY == null) return [];
    const result = [];
    for (const direction of ALL_DIRECTIONS) {
        const cell = neighborPosition(runner, direction) ?? backwardNeighborPosition(runner, direction);
        if (!cell) continue;
        if (cell.segment < 0 || cell.segment > 3) continue;
        if (cell.positionY < 0 || cell.positionY > 5) continue;
        result.push({ direction, ...cell });
    }
    return result;
}

// Чуть больше COLLISION_MIN_HOLD_MS в BoardGrid.js (600мс) — поза
// столкновения успевает реально показаться на экране, прежде чем одного из
// пары отбросит (см. applyMove ниже, по прямому запросу пользователя —
// "коллизия срабатывает один раз, потом одного из бегунов отбрасывает").
const COLLISION_AUTO_RESOLVE_MS = 700;
// Взрыв мины виден, ПОТОМ отброс — не одновременно со слайдом приезда на
// клетку (иначе поза взрыва и полёт наложились бы друг на друга).
const MINE_KNOCKBACK_DELAY_MS = 500;

export default function MockRoadScreen({ navigation }) {
    useAdaptiveOrientation();
    const insets = useSafeAreaInsets();

    const [game, setGame] = useState(makeInitialGame);
    const gameRef = useRef(game);
    useEffect(() => { gameRef.current = game; }, [game]);

    const runnerAnim = useRunnerAnimations();

    const [activeRunnerId, setActiveRunnerId] = useState(null);
    const [mode, setMode] = useState('move');
    const [damageOutcome, setDamageOutcome] = useState('damage');

    const activeRunner = useMemo(
        () => game.runners.find((r) => r.id === activeRunnerId) ?? null,
        [game.runners, activeRunnerId],
    );

    const {
        segmentW, segmentH, rows, viewportCols, roadContainerW, roadContainerH,
    } = useBoardLayout();
    const { windowStart, backButtonProps, forwardButtonProps, jumpTo } = useBoardScroll({ cols: viewportCols });

    // Камера НЕ следует за бегуном сама (в отличие от GameBoardScreen, где
    // есть jumpTo-эффект на выбор/ход) — 2026-09-25, живая жалоба:
    // "срабатывает анимация взрыва, но не срабатывает анимация для бегуна,
    // он тупо исчезает с карты". Настоящая причина — НЕ анимация вообще не
    // играет, а BoardGrid.js молча ИСКЛЮЧАЕТ токен из рендера целиком (ни
    // слайда, ни позы — компонент просто не монтируется), как только его
    // целевая клетка оказывается ВНЕ текущего окна прокрутки (windowStart..
    // windowStart+viewportCols) — см. `if (globalCol < windowStart ||
    // globalCol >= windowEnd) continue;` в её tokenOverlay. Отброс на ОДИН
    // СЕГМЕНТ (мина) или соседнюю клетку с другим индексом positionX
    // (коллизия) вполне может вывести бегуна за пределы узкого окна —
    // выглядит как "тупо исчез", хотя формально ничего не сломано, просто
    // нечем это увидеть. Вызывается ПОСЛЕ применения любого перемещения
    // (flyTo/applyMove ниже) — подцентровывает окно на целевую клетку,
    // ТОЛЬКО если она реально вне текущего окна (не дёргает камеру на каждый
    // обычный шаг внутри уже видимой области).
    const ensureVisible = useCallback((target) => {
        const globalCol = target.segment * BOARD_LAYOUT.COLS + target.positionX;
        if (globalCol < windowStart || globalCol >= windowStart + viewportCols) {
            jumpTo(globalCol);
        }
    }, [jumpTo, windowStart, viewportCols]);

    const gridData = useMemo(() => {
        const base = flattenTrackSegments([game.trackBegin, game.trackMiddle, game.trackEnd], rows, BOARD_LAYOUT.COLS);
        const peek = flattenPeekColumn(game.trackNext, rows, BOARD_LAYOUT.COLS * BOARD_LAYOUT.TOTAL_BLOCKS);
        return [...base, ...peek];
    }, [game.trackBegin, game.trackMiddle, game.trackEnd, game.trackNext, rows]);

    const playerColorById = useMemo(() => ({ [PLAYER_A.id]: PLAYER_A.color, [PLAYER_B.id]: PLAYER_B.color }), []);

    const mineBlasts = useMineBlasts();

    // Мины — каждая третья клетка типа 'danger' на первых 3 фрагментах
    // (детерминированно, не Math.random — иначе набор мин "прыгал" бы на
    // каждый ре-рендер). Визуально это те же "?"-клетки danger, что уже есть
    // в мок-картах (constants/mockGameData.js) — отдельного ассета/типа
    // клетки для мины не заводим, по прямому запросу пользователя важен
    // РЕЗУЛЬТАТ наступания (взрыв+отброс), не то, как это выглядит ДО тапа.
    const mineCellKeys = useMemo(() => {
        const dangerCells = gridData.filter((c) => c.type === 'danger' && c.blockIndex < 3);
        return new Set(
            dangerCells
                .filter((_, i) => i % 3 === 0)
                .map((c) => cellKey({ segment: c.blockIndex, positionX: c.col - c.blockIndex * BOARD_LAYOUT.COLS, positionY: c.row })),
        );
    }, [gridData]);

    const highlightedCells = useMemo(() => {
        if (!activeRunner || mode === 'jump') return new Set();
        const neighbors = mode === 'move' ? allNeighbors(activeRunner) : forwardNeighbors(activeRunner);
        return new Set(neighbors.map(cellKey));
    }, [activeRunner, mode]);

    /** Применяет "событие" ТЕМ ЖЕ путём, что и настоящий live-поток (GameBoardScreen):
     * сначала решаем анимацию по СТАРОМУ состоянию, потом патчим состояние. */
    const applyEvent = useCallback((event) => {
        setGame((prevGame) => {
            handleVersionedRunnerAnimEvent(prevGame, event, runnerAnim.trigger, {
                onceStepDone: runnerAnim.onceStepDone,
                completeWaitStep: runnerAnim.completeWaitStep,
            });
            return runnerGameReducer(prevGame, event);
        });
    }, [runnerAnim]);

    // Форсит 'fly' НАПРЯМУЮ (не через forwardNeighbors-эвристику
    // production-кода) — для отбросов (коллизия/мина/кнопка "Оттолкнуть"),
    // где семантически ВСЕГДА нужен именно облёт, а не обычный шаг, даже
    // если случайная соседняя клетка формально оказалась "вперёд".
    // runPostMoveEffectsRef — см. докстринг у runPostMoveEffects ниже: ЛЮБОЕ
    // перемещение (не только тап игрока) обязано проверяться на цепочку
    // (коллизия/мина), иначе отброс НА мину не взрывался бы сам (живая
    // жалоба пользователя, 2026-09-25 — "если отбросило на danger с миной,
    // он не отлетает"). Через ref, не прямую зависимость useCallback —
    // knockbackOneCell (ниже) сама вызывается ИЗ runPostMoveEffects, прямая
    // ссылка была бы циклической.
    const runPostMoveEffectsRef = useRef(null);
    const flyTo = useCallback((runnerId, target) => {
        setGame((prevGame) => {
            runnerAnim.trigger(runnerId, 'fly', { toPosition: target });
            return runnerGameReducer(prevGame, { event: 'runner_save', runnerId: { id: runnerId, ...target } });
        });
        runPostMoveEffectsRef.current?.(runnerId, target);
    }, [runnerAnim]);

    // Отброс на ОДНУ смежную клетку в случайную сторону (любое из 6
    // направлений) — авторазрешение коллизии И мины, см. runPostMoveEffects
    // ниже.
    const knockbackOneCell = useCallback((runnerId) => {
        const runner = gameRef.current.runners.find((r) => r.id === runnerId);
        if (!runner || runner.segment == null) return;
        const options = allNeighbors(runner);
        if (!options.length) return;
        const choice = options[Math.floor(Math.random() * options.length)];
        flyTo(runnerId, { segment: choice.segment, positionX: choice.positionX, positionY: choice.positionY });
    }, [flyTo]);

    /** Побочные эффекты ЛЮБОГО перемещения — вынесено из applyMove ОТДЕЛЬНОЙ
     * общей точкой (2026-09-25, живая жалоба — цепочка не работала, потому
     * что раньше эту проверку делал только applyMove, а knockback/flyTo её
     * не делали вообще: коллизия честно отбрасывала бегуна, но если он
     * приземлялся НА мину — взрыв никогда не срабатывал). Теперь ЛЮБОЕ
     * перемещение (тап игрока через applyMove ИЛИ уже автоматический отброс
     * через flyTo/knockbackOneCell) проверяется на: (1) занятую клетку —
     * авторазрешение коллизии через COLLISION_AUTO_RESOLVE_MS; (2) мину —
     * взрыв + отброс на клетку через MINE_KNOCKBACK_DELAY_MS. Оба пути сами
     * вызывают flyTo → снова эту же функцию — цепочка (коллизия→отброс→
     * мина→взрыв→новый отброс→...) продолжается сама, пока не кончатся
     * триггеры, в точности как каскады в реальной игре (см. CLAUDE.md про
     * danger→anomaly→mine). Читает `gameRef.current` (актуален на момент
     * вызова — вызывается синхронно сразу после setGame, до commit/эффекта). */
    const runPostMoveEffects = useCallback((runnerId, target) => {
        ensureVisible(target);
        const occupant = gameRef.current.runners.find(
            (r) => r.id !== runnerId && r.segment === target.segment
                && r.positionX === target.positionX && r.positionY === target.positionY
                && !runnerAnim.hiddenIds.has(r.id),
        );
        if (occupant) {
            const loserId = Math.random() < 0.5 ? runnerId : occupant.id;
            setTimeout(() => knockbackOneCell(loserId), COLLISION_AUTO_RESOLVE_MS);
        }
        if (mineCellKeys.has(cellKey(target))) {
            mineBlasts.trigger(cellKey(target));
            setTimeout(() => knockbackOneCell(runnerId), MINE_KNOCKBACK_DELAY_MS);
        }
    }, [ensureVisible, runnerAnim.hiddenIds, mineCellKeys, mineBlasts, knockbackOneCell]);

    useEffect(() => { runPostMoveEffectsRef.current = runPostMoveEffects; }, [runPostMoveEffects]);

    /** Единственная точка перемещения тапом/прыжком — решает анимацию (по
     * известному направлению напрямую для "Шаг" ЛЮБОГО из 6 направлений, или
     * через ту же эвристику, что и в бою, для "Прыжка"), патчит позицию, и
     * передаёт управление в runPostMoveEffects (см. выше). */
    const applyMove = useCallback((runnerId, target, direction) => {
        setGame((prevGame) => {
            const runner = prevGame.runners.find((r) => r.id === runnerId);
            if (!runner) return prevGame;
            if (direction) {
                // direction — любое из 6 (см. allNeighbors выше), не только 3
                // боевых — resolveMoveAssetDirection (runnerAnimHelpers.js)
                // теперь сама знает DOWN/LEFT_DOWN/RIGHT_DOWN (south/west/
                // east), подмены тут больше не нужны.
                runnerAnim.trigger(runnerId, 'move', {
                    direction,
                    depthChanged: target.positionX !== runner.positionX,
                    targetLaneShifted: target.positionY % 2 === 0,
                    toPosition: target,
                });
            } else {
                handleVersionedRunnerAnimEvent(prevGame, { event: 'runner_save', runnerId: { id: runnerId, ...target } }, runnerAnim.trigger, {
                    onceStepDone: runnerAnim.onceStepDone,
                    completeWaitStep: runnerAnim.completeWaitStep,
                });
            }
            return runnerGameReducer(prevGame, { event: 'runner_save', runnerId: { id: runnerId, ...target } });
        });
        runPostMoveEffects(runnerId, target);
    }, [runnerAnim, runPostMoveEffects]);

    const applyDamage = useCallback((runnerId, outcome) => {
        const runner = gameRef.current.runners.find((r) => r.id === runnerId);
        if (!runner) return;
        if (outcome === 'destroy') {
            applyEvent({ event: 'runner_destroy', runnerId: { id: runnerId, type: runner.type, status: 'destroyed', playerId: runner.playerId }, reason: 'damage' });
            return;
        }
        if (outcome === 'fire' || outcome === 'acid') {
            applyEvent({ event: 'runner_destroy', runnerId: { id: runnerId, type: runner.type, status: 'destroyed', playerId: runner.playerId }, reason: outcome });
            return;
        }
        const next = runner.status === 'healthy' ? 'damaged' : runner.status === 'damaged' ? 'broken' : 'destroyed';
        if (next === 'destroyed') {
            applyEvent({ event: 'runner_destroy', runnerId: { id: runnerId, type: runner.type, status: next, playerId: runner.playerId }, reason: 'damage' });
        } else {
            applyEvent({ event: 'runner_damage', runnerId: { id: runnerId, type: runner.type, status: next, playerId: runner.playerId } });
        }
    }, [applyEvent]);

    const shootAt = useCallback((shooterId, direction, targetCell) => {
        handleTransientRunnerAnimEvent(
            { event: 'step_shoot', accept: true, activeRunner: shooterId, direction },
            gameRef,
            runnerAnim.trigger,
        );
        const occupant = gameRef.current.runners.find(
            (r) => r.id !== shooterId && r.segment === targetCell.segment
                && r.positionX === targetCell.positionX && r.positionY === targetCell.positionY,
        );
        if (occupant) applyDamage(occupant.id, damageOutcome);
    }, [runnerAnim, applyDamage, damageOutcome]);

    const handleCellPress = useCallback((cell) => {
        if (!activeRunnerId) return;
        const target = { segment: cell.blockIndex, positionX: cell.col - cell.blockIndex * BOARD_LAYOUT.COLS, positionY: cell.row };

        if (mode === 'shoot') {
            const neighbor = forwardNeighbors(activeRunner).find((n) => cellKey(n) === cellKey(target));
            if (!neighbor) return;
            shootAt(activeRunnerId, neighbor.direction, target);
            return;
        }
        if (mode === 'move') {
            // Любая из 6 смежных клеток (не только 3 "вперёд", как в бою) — по
            // прямому запросу пользователя. Направление известно заранее —
            // передаём его в applyMove напрямую, не полагаясь на forwardNeighbors-
            // эвристику production-кода (та распознаёт только 3 "вперёд").
            const neighbor = allNeighbors(activeRunner).find((n) => cellKey(n) === cellKey(target));
            if (!neighbor) return;
            applyMove(activeRunnerId, target, neighbor.direction);
            return;
        }
        // jump — свободное перемещение куда угодно (в т.ч. в другой сегмент);
        // если целевая клетка занята другим бегуном, естественно воспроизводит
        // коллизионную позу (BoardGrid сам рисует пару, когда двое на клетке),
        // applyMove сам разрешит её через COLLISION_AUTO_RESOLVE_MS.
        applyMove(activeRunnerId, target);
    }, [activeRunnerId, activeRunner, mode, shootAt, applyMove]);

    const triggerPoseDirect = useCallback((kind) => {
        if (!activeRunner) return;
        const toPosition = activeRunner.segment != null
            ? { segment: activeRunner.segment, positionX: activeRunner.positionX, positionY: activeRunner.positionY }
            : undefined;
        runnerAnim.trigger(activeRunnerId, kind, { toPosition });
    }, [activeRunner, activeRunnerId, runnerAnim]);

    const handleKnockback = useCallback(() => {
        // "Оттолкнуть" — ручной тест fly НА ПРОИЗВОЛЬНОЕ расстояние (в
        // отличие от knockbackOneCell выше, который используется автоматически
        // коллизией/миной) — flyTo форсит 'fly' напрямую, адрес назначения не
        // обязан быть не-соседним.
        if (!activeRunner || activeRunner.segment == null) return;
        const target = {
            segment: activeRunner.segment,
            positionX: activeRunner.positionX >= 6 ? Math.max(0, activeRunner.positionX - 2) : Math.min(7, activeRunner.positionX + 2),
            positionY: activeRunner.positionY,
        };
        flyTo(activeRunnerId, target);
    }, [activeRunner, activeRunnerId, flyTo]);

    const handleReset = useCallback(() => {
        runnerAnim.reset();
        setActiveRunnerId(null);
        setGame(makeInitialGame());
    }, [runnerAnim]);

    const boardEl = (
        <View style={styles.boardRow}>
            <View style={styles.navCol}>
                <TouchableOpacity style={styles.navBtn} {...backButtonProps}>
                    <Text style={styles.navBtnText} noGlobalTint>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navBtn} {...forwardButtonProps}>
                    <Text style={styles.navBtnText} noGlobalTint>▼</Text>
                </TouchableOpacity>
            </View>
            <View style={{ width: roadContainerW, height: roadContainerH }}>
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
                    runners={game.runners}
                    playerColorById={playerColorById}
                    selectedRunnerId={activeRunnerId}
                    highlightedCells={highlightedCells}
                    runnerAnims={runnerAnim.anims}
                    runnerVisualPositions={runnerAnim.visualPositions}
                    hiddenRunnerIds={runnerAnim.hiddenIds}
                    mineBlasts={mineBlasts.blasts}
                    onAnimStepEnd={runnerAnim.completeStep}
                    onCellPress={handleCellPress}
                />
            </View>
        </View>
    );

    const controlsBody = (
        <>
            <Text style={styles.sectionLabel} noGlobalTint>Бегун</Text>
            <View style={styles.chipsRow}>
                {game.runners.map((r) => {
                    const display = RUNNER_DISPLAY[r.type];
                    const color = r.playerId ? playerColorById[r.playerId] : colors.muted;
                    const selected = r.id === activeRunnerId;
                    const dead = runnerAnim.hiddenIds.has(r.id);
                    return (
                        <TouchableOpacity
                            key={r.id}
                            onPress={() => setActiveRunnerId(r.id)}
                            style={[
                                styles.chip,
                                { borderColor: color },
                                selected && { backgroundColor: color },
                                dead && styles.chipDead,
                            ]}
                        >
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]} noGlobalTint>
                                {display?.label ?? r.type}{dead ? ' ✕' : ''}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.sectionLabel} noGlobalTint>Режим тапа по клетке</Text>
            <View style={styles.chipsRow}>
                {MOVE_MODES.map((m) => (
                    <TouchableOpacity
                        key={m.key}
                        onPress={() => setMode(m.key)}
                        style={[styles.chip, { borderColor: colors.info }, mode === m.key && { backgroundColor: colors.info }]}
                    >
                        <Text style={[styles.chipText, mode === m.key && styles.chipTextSelected]} noGlobalTint>{m.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {mode === 'shoot' && (
                <>
                    <Text style={styles.sectionLabel} noGlobalTint>Результат выстрела</Text>
                    <View style={styles.chipsRow}>
                        {DAMAGE_OUTCOMES.map((o) => (
                            <TouchableOpacity
                                key={o.key}
                                onPress={() => setDamageOutcome(o.key)}
                                style={[styles.chip, { borderColor: colors.danger }, damageOutcome === o.key && { backgroundColor: colors.danger }]}
                            >
                                <Text style={[styles.chipText, damageOutcome === o.key && styles.chipTextSelected]} noGlobalTint>{o.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            <Text style={styles.sectionLabel} noGlobalTint>Прямой запуск позы (без перемещения)</Text>
            <View style={styles.chipsRow}>
                {['attack', 'gotShot', 'bomb', 'start', 'fly'].map((kind) => (
                    <TouchableOpacity key={kind} onPress={() => triggerPoseDirect(kind)} style={[styles.chip, { borderColor: colors.warning }]}>
                        <Text style={styles.chipText} noGlobalTint>{kind}</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={handleKnockback} style={[styles.chip, { borderColor: colors.warning }]}>
                    <Text style={styles.chipText} noGlobalTint>Оттолкнуть</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.hint} noGlobalTint>
                Выбери бегуна, режим "Шаг" двигает его в ЛЮБУЮ из 6 смежных
                клеток (не только вперёд) — на этом воспроизводится баг с
                телепортом при старте хода. "Прыжок" — перенос в любую клетку/
                сегмент (для проверки fly). "Стрелять" — атака в выбранном
                направлении. Приземление на клетку с другим бегуном (любым
                способом) само рисует позу столкновения и через ~0.7с
                отбрасывает одного из пары на клетку в сторону. Клетки типа
                "danger" — часть из них заминирована: наступил → взрыв +
                отброс на клетку в случайную сторону.
            </Text>
        </>
    );

    return (
        <View style={[styles.wrapper, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText} noGlobalTint>← Назад</Text>
                </TouchableOpacity>
                <Text style={styles.title} noGlobalTint>Тест-дорога (без бэка)</Text>
                <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                    <Text style={styles.resetBtnText} noGlobalTint>Сброс</Text>
                </TouchableOpacity>
            </View>

            {IS_WEB ? (
                // Веб — доска и панель кнопок БОК О БОК (2026-09-25, по прямому
                // запросу пользователя "расположи кнопки справа от дороги") —
                // на вебе обычно широкое окно (ландшафтная ветка useBoardLayout,
                // см. докстринг модуля выше), горизонтального места достаточно,
                // не нужно скроллить вниз мимо доски, чтобы добраться до
                // управления. Обе колонки — СВОИ независимые ScrollView (на
                // случай, если доска всё же не влезет по высоте на каком-то
                // окне, см. риск в докстринге выше) — конфликта жестов между
                // ними нет, это два раздельных элемента, не вложенные скроллы.
                <View style={styles.webRow}>
                    <ScrollView style={styles.boardColWeb} contentContainerStyle={styles.boardColContent}>
                        {boardEl}
                    </ScrollView>
                    <ScrollView style={styles.controlsWeb} contentContainerStyle={styles.controlsContent}>
                        {controlsBody}
                    </ScrollView>
                </View>
            ) : (
                // Native — доска и кнопки ОДНИМ общим скроллом (см. докстринг
                // выше про исходную живую жалобу "кнопки за пределами экрана") —
                // портретные экраны телефонов узкие, бок о бок тесно, прокрутка
                // вниз привычнее.
                <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
                    {boardEl}
                    {controlsBody}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    backBtn: { padding: spacing.xs },
    backBtnText: { color: colors.textOnDark, fontSize: font.body },
    title: { color: colors.textOnDark, fontSize: font.h3, fontWeight: 'bold' },
    resetBtn: { padding: spacing.xs, backgroundColor: colors.danger, borderRadius: radius.sm },
    resetBtnText: { color: colors.textOnDark, fontSize: font.small },
    boardRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.sm },
    webRow: { flex: 1, flexDirection: 'row' },
    boardColWeb: { flexGrow: 0, flexShrink: 0 },
    boardColContent: { paddingVertical: spacing.sm },
    controlsWeb: { flex: 1, marginTop: 0 },
    navCol: { marginRight: spacing.xs, justifyContent: 'center' },
    navBtn: {
        width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.overlayPlate,
        alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs,
    },
    navBtnText: { color: colors.textOnDark, fontSize: font.body },
    controls: { flex: 1, marginTop: spacing.sm },
    controlsContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
    sectionLabel: {
        color: colors.textOnDarkSecondary, fontSize: font.tiny, textTransform: 'uppercase',
        marginTop: spacing.md, marginBottom: spacing.xs, letterSpacing: 1,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
        borderWidth: 2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
        backgroundColor: colors.overlayPlate,
    },
    chipDead: { opacity: 0.4 },
    chipText: { color: colors.textOnDark, fontSize: font.small },
    chipTextSelected: { fontWeight: 'bold' },
    hint: { color: colors.textOnDarkSecondary, fontSize: font.tiny, marginTop: spacing.lg, lineHeight: 18 },
});
