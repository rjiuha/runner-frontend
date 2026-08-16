// src/components/game/PlayerInfoPanel.js
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import PlayerSwitcher from './PlayerSwitcher';
import DiceTray from './DiceTray';
import DiceFace from './DiceFace';
import AbilityZones from './AbilityZones';
import RunnerCard from './RunnerCard';
import RunnerToken from './RunnerToken';
import { PLAYER_ABILITIES, PLAYER_STEP, RUNNER_ORDER, RUNNER_TYPES } from '../../constants/GameConstants';
import { colors, font, radius, spacing } from '../../theme';

// Ghost-превью кубика при драге — только веб (см. dragGhost ниже). Те же
// размеры, что DiceTray рисует в состоянии покоя (см. DEFAULT_SIZE/size=48).
const DRAG_GHOST_SIZE_NORMAL = 72;
const DRAG_GHOST_SIZE_COMPACT = 48;

/**
 * Левая панель: переключатель игроков, кубики активного игрока, зоны
 * усилений (перетаскивание кубика) и карточки бегунов. Хит-тестинг
 * перетаскивания (какая зона под пальцем и подходит ли ей текущий кубик)
 * живёт здесь: зоны измеряют себя через measureInWindow и репортят сюда,
 * а DiceDie шлёт сюда координаты жеста в оконных же координатах.
 *
 * "Что назначено" панель НЕ хранит сама — читает прямо из live-данных
 * (runner.dice/player.ability/player.diceN), которые GameBoardScreen строит
 * из game (см. Фазу 2 в CLAUDE.md). Наружу панель только сообщает НАМЕРЕНИЕ
 * (onDropOnAbility/onDropOnRunner/onRunnerCardPress/onPressAbilityZone) —
 * вызывать бэк или нет решает GameBoardScreen.
 */
export default function PlayerInfoPanel({
    players,
    activePlayerId,
    onSelectPlayer,
    myPlayerId,
    canAct,
    myStep,
    pendingAbility,
    pendingSelect,
    canSelectRunner,
    onDropOnAbility,
    onPressAbilityZone,
    onDropOnRunner,
    onRunnerCardPress,
    width,
    height,
    switcherHeight,
    switcherAtBottom = false,
    headerContent = null,
    compactColumns = false,
    onDiceTrayMeasured,
    rollingPlayerId = null,
}) {
    // compactColumns: левая колонка (бегуны) может не поместиться на маленьких
    // экранах (по прямому запросу пользователя — "не думаю, что на маленьких
    // экранах всё будет влезать", после того как один из бегунов уехал за
    // низ экрана) — даём ScrollView, но onLayout зон дропа не перевызывается
    // при простой прокрутке контента, поэтому remeasureTick (растёт на конец
    // скролла/флика) триггерит принудительный повторный measureInWindow в
    // каждой карточке (см. RunnerCard) — иначе закешированные оконные
    // координаты устареют относительно прокрутки и хит-тестинг дропа кубика
    // снова начнёт промахиваться (та же болезнь, что уже была с общим
    // ScrollView до перехода на compactColumns).
    const [remeasureTick, setRemeasureTick] = useState(0);
    const bumpRemeasure = useCallback(() => setRemeasureTick((t) => t + 1), []);

    // Позиция трея на экране (оконные координаты) — точка "прилёта" для
    // DiceRollOverlay (крупное окошко броска летит именно сюда). Трей не
    // внутри ScrollView ни в одной из раскладок (см. columns/infoColumn
    // ниже), позиция не меняется при скролле/переключении вкладки игрока —
    // достаточно померить один раз на onLayout, отдельный remeasureTick не нужен.
    const diceTrayRef = useRef(null);
    const measureDiceTray = useCallback(() => {
        if (!onDiceTrayMeasured) return;
        requestAnimationFrame(() => {
            diceTrayRef.current?.measureInWindow((x, y, width, height) => {
                onDiceTrayMeasured({ x, y, width, height });
            });
        });
    }, [onDiceTrayMeasured]);

    // Ghost-превью перетаскиваемого кубика — ТОЛЬКО веб. Жалоба пользователя:
    // в веб-версии сам кубик во время драга рисуется ЗА карточкой бегуна
    // (не поверх), хотя на Android рисуется поверх нормально. DiceDie уже
    // поднимает zIndex на себе при драге — на native этого достаточно, но на
    // вебе, судя по всему, карточка (внутри ScrollView) всё равно красится
    // выше по какой-то причине, связанной со стекингом (не удалось
    // стопроцентно подтвердить конкретный механизм без визуальной отладки —
    // нет рабочего браузера в этой сессии). Вместо попыток подобрать
    // правильный zIndex вслепую — надёжный обходной путь: на вебе поверх
    // ВСЕГО рисуется независимая копия кубика (`position:'fixed'`, не зависит
    // ни от какого родительского стекинга) в реальных оконных координатах
    // жеста (e.absoluteX/Y уже в этих координатах, без пересчёта). Сам
    // оригинальный DiceDie не трогаем — его временная невидимость под
    // карточкой на вебе теперь не важна, потому что поверх едет этот ghost.
    const [dragGhost, setDragGhost] = useState(null); // { value, x, y } | null, только веб
    // Тот же size, что и у DiceTray ниже (compactColumns — 34, иначе 44) —
    // иначе ghost визуально крупнее/мельче реального кубика в трее.
    const dragGhostSize = compactColumns ? DRAG_GHOST_SIZE_COMPACT : DRAG_GHOST_SIZE_NORMAL;

    const activePlayer = players.find((p) => p.id === activePlayerId) ?? players[0];
    const isMyPanel = canAct && activePlayer.id === myPlayerId;
    // Что можно тащить прямо сейчас: SELECT — на карточку бегуна, ABILITY — на зону усиления.
    const dragMode = isMyPanel
        ? myStep === PLAYER_STEP.SELECT
            ? 'select'
            : myStep === PLAYER_STEP.ABILITY
                ? 'ability'
                : null
        : null;

    // Пока для этого игрока летит DiceRollOverlay (крупные грани ещё не
    // "долетели" до трея — см. DevPlaygroundScreen.rollingPlayerId/onArrive),
    // реальный трей показывает пустые слоты вместо готовых значений — иначе
    // они синхронно всплывают в момент броска, ЗАДОЛГО до того, как
    // декоративная анимация долетит, и выглядит как две несвязанные вещи
    // вместо одной "долетело — стало маленьким". String() — та же защита от
    // string/number расхождения id, что и везде в проекте (см. CLAUDE.md).
    const isRollingThisPlayer = rollingPlayerId != null && String(rollingPlayerId) === String(activePlayer.id);

    // Кубик, зарезервированный под pending heal/reaper/select, ещё не consumed
    // бэком (реальный вызов уйдёт только после подтверждения/второго тапа) —
    // визуально прячем его из трея пораньше, чтобы не тащили дважды. Актуально
    // только для СВОЕЙ панели — pending-стейты относятся к myPlayer, не к тому,
    // чью панель сейчас листают через переключатель.
    const trayDice = activePlayer.dice.map((v, i) =>
        isRollingThisPlayer || (isMyPanel && (pendingAbility?.diceIndex === i || pendingSelect?.diceIndex === i))
            ? null
            : v,
    );

    const abilityAssignments = useMemo(() => {
        const map = {};
        for (const key of Object.keys(PLAYER_ABILITIES)) {
            if (isMyPanel && pendingAbility?.ability === key) map[key] = pendingAbility.diceIndex;
            else if (activePlayer.ability === key) map[key] = 'used';
            else map[key] = null;
        }
        return map;
    }, [isMyPanel, pendingAbility, activePlayer.ability]);

    const zoneLayoutsRef = useRef({});
    const [hover, setHover] = useState({ key: null, valid: false });

    const findZoneAt = useCallback((x, y) => {
        for (const [key, rect] of Object.entries(zoneLayoutsRef.current)) {
            if (!rect) continue;
            if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
                return key;
            }
        }
        return null;
    }, []);

    const handleMeasured = useCallback((key, rect) => {
        zoneLayoutsRef.current[key] = rect;
    }, []);

    // Зоны кубика хода на карточках бегунов ("move:<runnerId>") мерятся и
    // хит-тестятся тем же реестром, что и зоны усилений — правил на номинал
    // кубика у них нет (любой кубик годится любому бегуну), поэтому наведение
    // всегда "valid", но только пока разрешён drag-режим 'select'.
    const handleDragMove = useCallback(
        (_index, x, y, value) => {
            if (Platform.OS === 'web') setDragGhost({ value, x, y });
            if (!dragMode) return;
            const key = findZoneAt(x, y);
            if (!key) {
                setHover((h) => (h.key === null ? h : { key: null, valid: false }));
                return;
            }
            if (key.startsWith('move:')) {
                const runnerId = Number(key.slice('move:'.length));
                const valid = dragMode === 'select' && canSelectRunner(runnerId);
                setHover((h) => (h.key === key && h.valid === valid ? h : { key, valid }));
                return;
            }
            if (dragMode !== 'ability') {
                setHover((h) => (h.key === key && h.valid === false ? h : { key, valid: false }));
                return;
            }
            const ability = PLAYER_ABILITIES[key];
            const valid = value >= ability.min && value <= ability.max;
            setHover((h) => (h.key === key && h.valid === valid ? h : { key, valid }));
        },
        [findZoneAt, dragMode, canSelectRunner],
    );

    const handleDrop = useCallback(
        (index, x, y, value) => {
            setHover({ key: null, valid: false });
            if (Platform.OS === 'web') setDragGhost(null);
            if (!dragMode) return;
            const key = findZoneAt(x, y);
            if (!key) return;

            if (key.startsWith('move:')) {
                if (dragMode !== 'select') return;
                const runnerId = Number(key.slice('move:'.length));
                onDropOnRunner(activePlayer.id, runnerId, index);
                return;
            }

            if (dragMode !== 'ability') return;
            const ability = PLAYER_ABILITIES[key];
            if (value < ability.min || value > ability.max) return; // не по правилам — дроп просто не принимается
            onDropOnAbility(activePlayer.id, key, index);
        },
        [findZoneAt, dragMode, onDropOnRunner, onDropOnAbility, activePlayer.id],
    );

    const trackedRunners = useMemo(
        () => RUNNER_ORDER.map((type) => activePlayer.runners.find((r) => r.type === type)).filter(Boolean),
        [activePlayer.runners],
    );
    const reaper = useMemo(
        () => activePlayer.runners.find((r) => r.type === RUNNER_TYPES.REAPER),
        [activePlayer.runners],
    );

    const switcher = (
        <View style={[styles.switcherBox, { height: switcherHeight }]}>
            <PlayerSwitcher
                players={players.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
                activeId={activePlayer.id}
                onSelect={onSelectPlayer}
            />
        </View>
    );

    const reaperNode = reaper && (
        <View style={[styles.reaperRow, compactColumns && styles.reaperRowCompact]}>
            <RunnerToken
                type={RUNNER_TYPES.REAPER}
                color={activePlayer.color}
                size={compactColumns ? 22 : 30}
                selected={String(reaper.id) === String(activePlayer.activeRunnerId)}
            />
            <Text style={styles.reaperText} numberOfLines={1}>
                {reaper.segment != null ? 'Жнец — на поле' : 'Жнец — в резерве'}
            </Text>
        </View>
    );

    const runnerCards = trackedRunners.map((runner) => {
        const zoneKey = `move:${runner.id}`;
        const isPending = isMyPanel && pendingSelect?.runnerId === runner.id;
        // Пока выбор не подтверждён, кубик ещё не consumed бэком (runner.dice/
        // rollDice не менялись) — берём значение из трея игрока по индексу
        // pendingSelect, и кладём его в квадрат, соответствующий типу
        // (обычный ход или накат — см. handleDropOnRunner в GameBoardScreen).
        const pendingValue = isPending ? activePlayer.dice[pendingSelect.diceIndex] : null;
        const moveDiceValue = isPending && pendingSelect.type === 'DICE' ? pendingValue : runner.dice ?? null;
        const rollDiceValue = isPending && pendingSelect.type === 'ROLL' ? pendingValue : runner.rollDice ?? null;
        return (
            <RunnerCard
                key={runner.id}
                runner={runner}
                color={activePlayer.color}
                active={String(runner.id) === String(activePlayer.activeRunnerId)}
                pending={isPending}
                healTarget={isMyPanel && pendingAbility?.ability === 'heal'}
                onPress={() => onRunnerCardPress(runner)}
                moveDiceValue={moveDiceValue}
                rollDiceValue={rollDiceValue}
                hoverState={hover.key === zoneKey ? (hover.valid ? 'valid' : 'invalid') : null}
                onMoveDiceMeasured={handleMeasured}
                compact={compactColumns}
                remeasureTick={remeasureTick}
            />
        );
    });

    const abilitiesNode = (
        <>
            <Text style={styles.sectionTitle}>
                {compactColumns ? 'Усиления' : 'Усиления — перетащи кубик на зону'}
            </Text>
            <AbilityZones
                assignments={abilityAssignments}
                hoverKey={hover.key}
                hoverValid={hover.valid}
                onMeasured={handleMeasured}
                onPressZone={onPressAbilityZone}
                remeasureTick={remeasureTick}
            />
        </>
    );

    return (
        <View style={[styles.panel, { width, height }]}>
            <View style={styles.body}>
                {!switcherAtBottom && switcher}

                {/* headerContent — место баннера хода в портретной раскладке
                    (GameBoardScreen передаёт его сюда вместо отдельного
                    плавающего баннера над доской — см. GameBoardScreen). Раньше
                    тут был крупный Text с именем игрока — убран по запросу:
                    имя уже видно в кнопках переключателя, дублировать незачем. */}
                {headerContent}

                {/* Альбомная раскладка — кубики закреплены НАД скроллом (не внутри
                    ScrollView), полной ширины панели, как и раньше. В
                    compactColumns кубики переехали в правую колонку, НАД
                    усилениями (см. ниже) — по прямому запросу пользователя:
                    левая колонка (бегуны) должна начинаться сразу под
                    шапкой, не терять место под общий на всю ширину трей. */}
                {!compactColumns && (
                    <>
                        <Text style={styles.sectionTitle}>Кубики перемещения</Text>
                        <View ref={diceTrayRef} onLayout={measureDiceTray}>
                            <DiceTray
                                dice={trayDice}
                                draggable={dragMode != null}
                                onDragMove={handleDragMove}
                                onDrop={handleDrop}
                                color={activePlayer.color}
                            />
                        </View>
                    </>
                )}

                {/* compactColumns (портретная раскладка) — бегуны+жнец слева (шире,
                    основное пространство отдано им по прямому запросу
                    пользователя), кубики+усиления справа (уже, кубики сверху —
                    "над зоной усилений, но не над зоной плиток бегунов").
                    Карточки ужаты (compact), чтобы влезло как можно больше, но
                    гарантии на ЛЮБОМ экране нет — левая колонка поэтому со
                    своим ScrollView (по прямому запросу пользователя после того,
                    как один из бегунов уехал за нижний край экрана). Зона дропа
                    кубика хода — теперь ВСЯ карточка целиком (см. RunnerCard,
                    сама меряет и репортит себя), а не маленький вложенный
                    элемент — раньше именно его маленький размер плюс устаревающее
                    при скролле measureInWindow ловили промах дропа "куда ни
                    кинь". remeasureTick (см. bumpRemeasure) перемеряет карточки
                    после каждого скролла/флика этой колонки. */}
                {compactColumns ? (
                    <View style={styles.columns}>
                        <ScrollView
                            style={styles.leftColumn}
                            contentContainerStyle={styles.leftColumnContent}
                            showsVerticalScrollIndicator={false}
                            onScrollEndDrag={bumpRemeasure}
                            onMomentumScrollEnd={bumpRemeasure}
                        >
                            {reaperNode}
                            {runnerCards}
                        </ScrollView>
                        <View style={styles.rightColumn}>
                            <Text style={styles.sectionTitle}>Кубики</Text>
                            <View ref={diceTrayRef} onLayout={measureDiceTray}>
                                <DiceTray
                                    dice={trayDice}
                                    draggable={dragMode != null}
                                    onDragMove={handleDragMove}
                                    onDrop={handleDrop}
                                    color={activePlayer.color}
                                    // Правая колонка теперь заметно уже — мельче кубики
                                    // и разрешаем им переноситься в 2 ряда (см. DiceTray).
                                    // Жалоба "не видно" — увеличено (было 36).
                                    size={48}
                                />
                            </View>
                            {abilitiesNode}
                        </View>
                    </View>
                ) : (
                    // Живой прогон (веб) вскрыл тот же баг устаревающего measureInWindow
                    // тут — зоны усилений и карточки бегунов делят один ScrollView,
                    // и после прокрутки хит-тестинг дропа промахивался в СОСЕДНЮЮ зону
                    // (подсвечивалось усиление, которое физически ниже перетащенного).
                    // Тот же remeasureTick, что уже чинит это для compactColumns.
                    <ScrollView
                        style={styles.infoColumn}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        onScrollEndDrag={bumpRemeasure}
                        onMomentumScrollEnd={bumpRemeasure}
                    >
                        {abilitiesNode}
                        {reaperNode}
                        <Text style={styles.sectionTitle}>Бегуны — перетащи кубик хода на бегуна</Text>
                        {runnerCards}
                    </ScrollView>
                )}

                {switcherAtBottom && switcher}
            </View>

            {/* Ghost перетаскиваемого кубика — только веб, см. комментарий у
                dragGhost выше. x/y — уже визуальный ЦЕНТР кубика (см. DiceDie —
                origin от measureInWindow + дельта жеста), поэтому рисуем ghost
                центрированным РОВНО на этой точке, без искусственного сдвига:
                раньше был сдвиг вверх на size+14px "чтобы не закрывать
                курсор" — из-за него видимый ghost и реальная точка хит-теста
                (та же x/y) расходились, и подсветка зоны срабатывала не там,
                где визуально был кубик. position:'fixed' — координаты уже
                оконные, пересчёт под какого-то родителя не нужен. */}
            {Platform.OS === 'web' && dragGhost != null && (
                <View
                    pointerEvents="none"
                    style={[
                        styles.dragGhost,
                        { left: dragGhost.x - dragGhostSize / 2, top: dragGhost.y - dragGhostSize / 2 },
                    ]}
                >
                    <DiceFace value={dragGhost.value} color={activePlayer.color} size={dragGhostSize} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        backgroundColor: '#00000055',
        borderRadius: radius.lg,
        padding: spacing.md,
    },
    // 'fixed' — только веб (см. dragGhost); на native этот стиль определяется,
    // но никогда не применяется (JSX за Platform.OS==='web'), 'absolute' —
    // просто безопасный фолбэк на случай ошибки в этом условии.
    dragGhost: {
        // width/height заданы инлайн (dragGhostSize зависит от compactColumns).
        position: Platform.OS === 'web' ? 'fixed' : 'absolute',
        zIndex: 9999,
    },
    // Переключатель игроков остаётся НАД зоной информации (вертикальный стек
    // секций, не колонки рядом). Высота switcherBox — ФИКСИРОВАННЫЙ пиксельный
    // размер (switcherHeight, ~15% высоты окна — см. useBoardLayout.switcherH),
    // а не flex-пропорция: на вебе цепочка height:100% от корня навигатора до
    // панели рвётся (обычная проблема RN Web без явного height на каждом
    // уровне), из-за чего flex:1/flex:4 между switcherBox и infoColumn не
    // распределялся как задумано и переключатель расползался почти на пол-
    // экрана. Фиксированный пиксель не зависит от этой цепочки. infoColumn
    // забирает flex:1 — весь остаток, какой бы он ни оказался.
    body: { flex: 1, flexDirection: 'column' },
    switcherBox: { justifyContent: 'center' },
    infoColumn: { flex: 1, marginTop: spacing.xs },
    scrollContent: { paddingBottom: spacing.md },
    sectionTitle: {
        color: colors.textOnDarkSecondary,
        fontSize: font.tiny,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
    },
    reaperRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
    reaperRowCompact: { marginTop: 2, marginBottom: 4 },
    reaperText: { color: colors.textOnDark, fontSize: font.small, marginLeft: spacing.sm, flex: 1 },
    // compactColumns (портретная раскладка) — бегуны+жнец слева (основное
    // пространство — flex:2), кубики+усиления справа, заметно уже (flex:1 —
    // по прямому запросу пользователя "сделать зону усилений поуже, дать
    // место плиткам бегунов", было 3:2). leftColumn — ScrollView (см.
    // комментарий у места использования про remeasureTick), rightColumn —
    // обычный View (кубики+усиления, судя по фидбеку, влезают и без скролла;
    // если тоже не влезут на каком-то экране — тот же паттерн).
    columns: { flex: 1, flexDirection: 'row', marginTop: spacing.xs },
    leftColumn: { flex: 2, marginRight: spacing.sm },
    leftColumnContent: { paddingBottom: spacing.sm },
    rightColumn: { flex: 1 },
});
