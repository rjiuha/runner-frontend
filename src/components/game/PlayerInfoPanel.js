// src/components/game/PlayerInfoPanel.js
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import PlayerSwitcher from './PlayerSwitcher';
import DiceTray from './DiceTray';
import AbilityZones from './AbilityZones';
import RunnerCard from './RunnerCard';
import ReaperCard from './ReaperCard';
import PulseText from '../ui/PulseText';
import PulseHighlight from '../ui/PulseHighlight';
import PersonPanel from '../ui/PersonPanel';
import FramePanel from '../ui/FramePanel';
import {
    DICE_FACE_IMAGES,
    PLAYER_ABILITIES,
    PLAYER_STEP,
    RUNNER_ORDER,
    RUNNER_TYPES,
} from '../../constants/GameConstants';
import { colors, font, radius, spacing } from '../../theme';

// Ghost-превью кубика при драге — только веб (см. dragGhost ниже).
const DRAG_GHOST_SIZE_NORMAL = 44;
const DRAG_GHOST_SIZE_COMPACT = 34;

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
    currentTurnPlayerId = null,
    canAct,
    myStep,
    pendingAbility,
    pendingSelect,
    canSelectRunner,
    onDropOnAbility,
    onPressAbilityZone,
    onDropOnRunner,
    onRunnerCardPress,
    onRunnerCardDoubleTap,
    highlightSelectIdle = false,
    highlightAbilityIdle = false,
    width,
    height,
    switcherHeight,
    switcherAtBottom = false,
    headerContent = null,
    compactColumns = false,
    // Бонус хода (2026-09-20, по прямому решению пользователя — "пока не
    // трогаем бэк, просто отобрази, когда данные приходят") — game.trackGain
    // с GameBoardScreen. Бэк ХРАНИТ per-runner флаг наличия бонуса
    // (Runner::$trackGain), но НЕ отдаёт его в Runner::toArray() — фронт
    // физически видит бонус только В ОДИН момент: пока у ЭТОГО игрока
    // player.step===ROAD_BONUS (см. runnerCards ниже) — до и после этого
    // шага для любого бегуна тут всегда null (пусто), не потому что бонуса
    // нет, а потому что бэк об этом не сообщает.
    roadBonusValue = null,
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
    //
    // **Позиция — `Animated.ValueXY` через `.setValue()`, НЕ React state**
    // (2026-09-19, живая жалоба "при нажатии на кубики начинает сильно
    // тормозить" — усугубилось именно ПОСЛЕ переверстки карточек на
    // PersonPanel/FramePanel, подтверждено пользователем: "до доработок с
    // плитками всё работало без тормозов"). `onDragMove` стреляет на КАЖДОЕ
    // движение указателя (десятки-сотни раз за секунду драга, без троттлинга)
    // — раньше это был `setDragGhost({value,x,y})`, React-state-апдейт,
    // перерендеривавший ВСЮ `PlayerInfoPanel` (включая все карточки бегунов
    // — теперь тяжёлые, ~70+ `<Image>` на карточку из-за 9-slice рамок) на
    // каждый такой тик. `.setValue()` на `Animated.ValueXY` обновляет стиль
    // ghost-картинки НАПРЯМУЮ (imperatively), в обход React reconciliation
    // целиком — тот же приём, что уже применяется в проекте для непрерывных
    // позиций (см. `RunnerTokenSlide.js`). Сам ФАКТ значения на кубике
    // (какую грань показывать) меняется только на старте/конце драга, не на
    // каждое движение — это осталось обычным state (`dragGhostValue`),
    // безопасно, т.к. меняется редко.
    const dragGhostPos = useRef(new Animated.ValueXY({ x: -9999, y: -9999 })).current;
    const [dragGhostValue, setDragGhostValue] = useState(null); // грань кубика | null, только веб
    // Тот же size, что и у DiceTray ниже (compactColumns — 34, иначе 44) —
    // иначе ghost визуально крупнее/мельче реального кубика в трее.
    const dragGhostSize = compactColumns ? DRAG_GHOST_SIZE_COMPACT : DRAG_GHOST_SIZE_NORMAL;

    const activePlayer = players.find((p) => p.id === activePlayerId) ?? players[0];
    const isMyPanel = canAct && activePlayer.id === myPlayerId;
    // Панель показывает игрока activePlayer (переключатель), а не обязательно
    // того, чей сейчас реальный игровой ход (game.playerOrder) — см.
    // RunnerCard#turnActive, зелёное имя бегуна должно гаснуть, как только ход
    // уходит к другому игроку, даже если player.activeRunner у ЭТОГО игрока
    // ещё не сброшен (бэк не чистит его автоматически при смене хода).
    const isActivePlayerTurn = currentTurnPlayerId != null && String(activePlayer.id) === String(currentTurnPlayerId);
    // Что можно тащить прямо сейчас: SELECT — на карточку бегуна, ABILITY — на зону усиления.
    const dragMode = isMyPanel
        ? myStep === PLAYER_STEP.SELECT
            ? 'select'
            : myStep === PLAYER_STEP.ABILITY
                ? 'ability'
                : null
        : null;

    // Кубик, зарезервированный под pending heal/reaper/select, ещё не consumed
    // бэком (реальный вызов уйдёт только после подтверждения/второго тапа) —
    // визуально прячем его из трея пораньше, чтобы не тащили дважды. Актуально
    // только для СВОЕЙ панели — pending-стейты относятся к myPlayer, не к тому,
    // чью панель сейчас листают через переключатель.
    const trayDice = activePlayer.dice.map((v, i) =>
        isMyPanel && (pendingAbility?.diceIndex === i || pendingSelect?.diceIndex === i) ? null : v,
    );

    // Подсказка "что делать дальше" (2026-09-14, по прямому запросу
    // пользователя) — `draggingValue` живёт ЗДЕСЬ (не в GameBoardScreen):
    // всё, что от неё зависит (заголовки/панель кубиков, рамки карточек
    // бегунов, рамки зон усилений), рендерится внутри этой же панели.
    // `null` — кубик сейчас НЕ тащат, число — значение того, что тащат
    // (см. onDragStart/onDragEnd, проброшенные в DiceTray ниже).
    const [draggingValue, setDraggingValue] = useState(null);
    const handleDieDragStart = useCallback((value) => {
        setDraggingValue(value);
        // Грань ghost-кубика — только меняется здесь (старт драга), не на
        // каждое движение, см. dragGhostPos/dragGhostValue выше.
        if (Platform.OS === 'web') setDragGhostValue(value);
    }, []);
    const handleDieDragEnd = useCallback(() => {
        setDraggingValue(null);
        if (Platform.OS === 'web') setDragGhostValue(null);
    }, []);

    // Пока кубик НЕ тащат — подсвечиваем ИСТОЧНИК (фон вокруг трея кубиков
    // внутри общей плитки, см. diceAbilitiesTile) — на SELECT и на ABILITY
    // (плюс кнопка "Пропустить усиление", см. GameBoardScreen,
    // highlightAbilityIdle туда и сюда — одно и то же условие). Как только
    // кубик взяли в драг — подсветка ПЕРЕКЛЮЧАЕТСЯ на ЦЕЛЬ (бегуны/усиления,
    // см. runnersHighlight/abilityPulseKeys ниже) — источник гаснет, там
    // уже давно всё понятно (кубик виден зажатым под пальцем).
    const diceHighlight = isMyPanel && draggingValue == null && (
        (dragMode === 'select' && highlightSelectIdle) ||
        (dragMode === 'ability' && highlightAbilityIdle)
    );
    // SELECT, кубик в драге — подсветка ВСЕХ карточек, куда его реально можно
    // бросить (любой кубик годится любому бегуну, см. handleDragMove выше —
    // конкретное ЗНАЧЕНИЕ роли не играет, только canSelectRunner(runnerId)).
    const runnersHighlight = isMyPanel && draggingValue != null && dragMode === 'select';

    const abilityAssignments = useMemo(() => {
        const map = {};
        for (const key of Object.keys(PLAYER_ABILITIES)) {
            if (isMyPanel && pendingAbility?.ability === key) map[key] = pendingAbility.diceIndex;
            else if (activePlayer.ability === key) map[key] = 'used';
            else map[key] = null;
        }
        return map;
    }, [isMyPanel, pendingAbility, activePlayer.ability]);

    // ABILITY, кубик в драге — какие зоны реально примут ИМЕННО ЭТО значение
    // (min/max, та же формула, что уже использует handleDragMove/handleDrop
    // выше) и ещё не заняты ('used') — Set ключей, AbilityZones сам решает,
    // какую из своих 4 зон подсветить.
    const abilityPulseKeys = useMemo(() => {
        if (!isMyPanel || draggingValue == null || dragMode !== 'ability') return null;
        const keys = new Set();
        for (const key of Object.keys(PLAYER_ABILITIES)) {
            const ability = PLAYER_ABILITIES[key];
            if (abilityAssignments[key] === 'used') continue;
            if (draggingValue >= ability.min && draggingValue <= ability.max) keys.add(key);
        }
        return keys;
    }, [isMyPanel, draggingValue, dragMode, abilityAssignments]);

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
            // .setValue() — НЕ React state, не триггерит ре-рендер панели на
            // каждое движение (см. dragGhostPos выше).
            if (Platform.OS === 'web') dragGhostPos.setValue({ x, y });
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
            if (Platform.OS === 'web') setDragGhostValue(null);
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

    // Плитка Жнеца — по аналогии с плиткой бегуна (RunnerCard, через новый
    // ReaperCard.js, см. её докстринг), по прямому запросу пользователя
    // 2026-09-20: "avatar анимация жнеца во фрейме, рядом просто текст, на
    // поле он или в резерве". Раньше тут была голая строка (маленький
    // RunnerToken без рамки + Text) — заменена целиком.
    const reaperNode = reaper && (
        <ReaperCard
            reaper={reaper}
            color={activePlayer.color}
            active={String(reaper.id) === String(activePlayer.activeRunnerId)}
        />
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
        // Бонус хода — см. roadBonusValue выше: видим его ТОЛЬКО пока у
        // ЭТОГО игрока (activePlayer, не обязательно "моего" — панель
        // переключаемая) реально идёт шаг ROAD_BONUS И именно ЭТОТ бегун
        // только что закончил ход (activeRunnerId). Остальное время —
        // null (пусто), бэк больше ничего не сообщает.
        const hasRoadBonus = activePlayer.step === PLAYER_STEP.ROAD_BONUS
            && String(runner.id) === String(activePlayer.activeRunnerId)
            && roadBonusValue != null;
        // onPress={onRunnerCardPress} — СТАБИЛЬНАЯ ссылка, НЕ инлайн-замыкание
        // (было `() => onRunnerCardPress(runner)`) — 2026-09-19, живая жалоба
        // "тормозит при перетаскивании кубика по плиткам", см. докстринг
        // RunnerCard.js#React.memo. RunnerCard сам вызывает onPress?.(runner)
        // — см. её handlePress.
        return (
            <RunnerCard
                key={runner.id}
                runner={runner}
                color={activePlayer.color}
                active={String(runner.id) === String(activePlayer.activeRunnerId)}
                turnActive={isActivePlayerTurn && String(runner.id) === String(activePlayer.activeRunnerId)}
                pulseHighlight={runnersHighlight && canSelectRunner(runner.id)}
                pending={isPending}
                healTarget={isMyPanel && pendingAbility?.ability === 'heal'}
                onPress={onRunnerCardPress}
                onDoubleTap={onRunnerCardDoubleTap}
                moveDiceValue={moveDiceValue}
                rollDiceValue={rollDiceValue}
                roadBonus={hasRoadBonus ? roadBonusValue : null}
                hoverState={hover.key === zoneKey ? (hover.valid ? 'valid' : 'invalid') : null}
                onMoveDiceMeasured={handleMeasured}
                compact={compactColumns}
                remeasureTick={remeasureTick}
            />
        );
    });

    // Текст-заголовок ("УСИЛЕНИЯ"/"Усиления — перетащи кубик на зону") убран
    // по прямому запросу пользователя (2026-09-20), вместе с "КУБИКИ"/"Кубики
    // перемещения" (см. diceAbilitiesTile ниже) — обе секции объединены в
    // одну декоративную плитку (PersonPanel, тот же приём, что уже красит
    // корпус RunnerCard), сама плитка даёт визуальную группировку без подписей.
    const abilitiesNode = (
        <AbilityZones
            assignments={abilityAssignments}
            hoverKey={hover.key}
            hoverValid={hover.valid}
            onMeasured={handleMeasured}
            onPressZone={onPressAbilityZone}
            remeasureTick={remeasureTick}
            compact={compactColumns}
            color={activePlayer.color}
            pulseKeys={abilityPulseKeys}
        />
    );

    // "Кубики" и "Усиления" — теперь ОДНА плитка (декоративная рамка
    // PersonPanel), по прямому запросу пользователя "аналогично плитке
    // персонажа". Размер — ОБЯЗАТЕЛЬНО измеренный СНАРУЖИ через
    // measureInWindow (см. докстринг PersonPanel.js/RunnerCard.js за полным
    // разбором, почему PersonPanel сам себя мерить не может).
    //
    // **RAF+setTimeout(150), не только RAF** (2026-09-20, живая жалоба
    // "усиления на Android выпирают за границу общей рамки") — настоящая
    // причина: одного requestAnimationFrame НЕ хватало, чтобы поймать
    // ФИНАЛЬНУЮ (устаканившуюся) ширину этой плитки на Android — она
    // растягивается по родителю (rightColumn/панель), а не по своему
    // контенту, и на Android разрешение процентной/flex-ширины родителя
    // иногда занимает лишний проход layout'а. `PersonPanel`, нарисованный по
    // СТАРОЙ (более узкой) ширине с первого RAF, оставался мельче, чем
    // реально заняла сетка усилений (та отрисовывается обычным flow, не по
    // этому state, поэтому её ширина не зависит от того, успел ли измериться
    // dATileSize) — визуально казалось, что плитки усилений "вылезают" за
    // край декоративной рамки. Тот же класс проблемы уже задокументирован в
    // AbilityZone.js#measure — там та же пара RAF+setTimeout(150) уже
    // применяется по аналогичной причине (у неё — рост бокса от иконки).
    // `overflow:'hidden'` на styles.dATile — доп. страховка НА СЛУЧАЙ, если
    // измерение всё-таки на мгновение отстанет: контент физически не сможет
    // нарисоваться за пределами плитки, даже пока PersonPanel её ещё не
    // "догнал".
    const dATileRef = useRef(null);
    const [dATileSize, setDATileSize] = useState(null);
    const measureDATile = useCallback(() => {
        const run = () => {
            dATileRef.current?.measureInWindow((x, y, width, height) => {
                setDATileSize({ width, height });
            });
        };
        requestAnimationFrame(run);
        setTimeout(run, 150);
    }, []);

    // Кубики — теперь ТОЖЕ в декоративной рамке (FramePanel, тот же приём,
    // что и у КАЖДОЙ зоны усиления, см. AbilityZone.js) — по прямому запросу
    // пользователя "сделай, чтобы кубики тоже были в рамке, как усиления".
    // ОДНА рамка на ВЕСЬ трей (все 4 кубика вместе), не по рамке на кубик —
    // пользователь явно уточнил "все кубики в одной рамке". Тот же
    // RAF+setTimeout(150) паттерн, что и у dATile выше — по той же причине
    // (эта обёртка тоже растягивается по родителю, не по контенту).
    const diceTrayRef = useRef(null);
    const [diceTraySize, setDiceTraySize] = useState(null);
    const measureDiceTray = useCallback(() => {
        const run = () => {
            diceTrayRef.current?.measureInWindow((x, y, width, height) => {
                setDiceTraySize({ width, height });
            });
        };
        requestAnimationFrame(run);
        setTimeout(run, 150);
    }, []);

    const diceAbilitiesTile = (
        <View
            ref={dATileRef}
            onLayout={measureDATile}
            style={[styles.dATile, compactColumns && styles.dATileCompact]}
        >
            <PersonPanel size={dATileSize} />
            <View ref={diceTrayRef} onLayout={measureDiceTray} style={styles.diceTrayWrap}>
                {/* targetCornerSize=8 (было 12, дефолт FramePanel) — 2026-09-20,
                    живая жалоба "рамка кубиков/усилений касается рамки общей
                    плитки на Android, на вебе норм". НЕ трогаем padding/размер
                    ОБЩЕЙ плитки (dATile) — тот прошлый вариант фикса пользователь
                    отклонил явно ("надо было менять размер фреймов, а не общей
                    плитки", "зачем увеличил высоту общей плитки"): dATile — auto-
                    height от контента, ЛЮБОЙ доп. зазор (padding на dATile ИЛИ
                    margin вокруг diceTrayWrap — геометрически одно и то же)
                    неизбежно раздувает её итоговую высоту, это не обходной путь.
                    Вместо этого — тоньше сама декоративная дуга ВНУТРЕННЕГО
                    фрейма (FramePanel.js#targetCornerSize масштабирует ВЕСЬ
                    набор угол+грани одним коэффициентом, см. её докстринг) —
                    её видимая "краска" короче, меньше заходит в тот же
                    небольшой зазор, где раньше обе рамки накладывались друг на
                    друга. Сам бокс diceTrayWrap/зоны — ТОТ ЖЕ размер, что и был,
                    высота/ширина плитки не меняется ни на пиксель.
                    Фон — ДЕФОЛТ FramePanel (PERSON_PANEL_BACKGROUND/_CORNER,
                    тайл 39) — тот же самый фон, что рисует PersonPanel у
                    самой карточки-плитки (dATile), явных backgroundSource/
                    backgroundCornerSource/backgroundTileSize больше нет
                    (2026-09-20, по прямому запросу пользователя "сделай задний
                    фон для фрейма с кубиками как у плиток" — было переопределено
                    на чёрный фон аватара чуть раньше в тот же день, решение
                    пересмотрено). */}
                <FramePanel
                    size={diceTraySize}
                    targetCornerSize={8}
                />
                {/* borderRadius=4 — та же величина, что у FramePanel.js#styles.wrap
                    (тот же фикс "рамка/заливка острым углом поверх скруглённой
                    дуги", что уже применён в AbilityZone.js/RunnerCard.js). */}
                <PulseHighlight active={diceHighlight} borderRadius={4} showBackground showBorder={false} />
                <DiceTray
                    dice={trayDice}
                    draggable={dragMode != null}
                    onDragStart={handleDieDragStart}
                    onDragMove={handleDragMove}
                    onDrop={handleDrop}
                    onDragEnd={handleDieDragEnd}
                    // Размер кубика в compactColumns — 28→40 (2026-09-20, по
                    // прямому запросу пользователя "сделай кубики побольше",
                    // сразу после того, как они переехали в 2×2-сетку внутри
                    // общей рамки, см. DiceTray.js). Раньше 28 было нужно,
                    // чтобы влезли 4 кубика В ОДИН РЯД — 2×2 занимает вдвое
                    // меньше по ширине на ряд, места с запасом хватает на
                    // заметно более крупный размер (проверено живьём на
                    // Android — не выпирает).
                    {...(compactColumns ? { size: 40 } : {})}
                />
            </View>
            <View style={styles.abilitiesWrap}>{abilitiesNode}</View>
        </View>
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

                {/* Альбомная раскладка — плитка кубики+усиления закреплена НАД
                    скроллом (не внутри ScrollView), полной ширины панели, как
                    и раньше стоял отдельный трей кубиков. В compactColumns та
                    же плитка переехала в правую колонку целиком (см. ниже) —
                    по прямому запросу пользователя: левая колонка (бегуны)
                    должна начинаться сразу под шапкой, не терять место под
                    общий на всю ширину трей. */}
                {!compactColumns && diceAbilitiesTile}

                {/* compactColumns (портретная раскладка) — бегуны+жнец слева (шире,
                    основное пространство отдано им по прямому запросу
                    пользователя), плитка кубики+усиления справа. Жнец — сверху,
                    3 карточки бегунов — В РЯД, вертикально ориентированные
                    (RunnerCard#compact, см. её докстринг) — 2026-09-20, по
                    прямому запросу пользователя: высота ряда теперь равна
                    высоте ОДНОЙ плитки, а не трёх стопкой, чтобы все 4 плитки
                    (Жнец+3) помещались без прокрутки. ScrollView оставлен
                    структурной подстраховкой (по прямому запросу пользователя
                    после того, как раньше один из бегунов уехал за нижний край
                    экрана) — в обычных условиях ряд короче колонки и скроллить
                    нечего. Зона дропа кубика хода — вся карточка целиком (см.
                    RunnerCard, сама меряет и репортит себя). remeasureTick
                    (см. bumpRemeasure) перемеряет карточки после каждого
                    скролла/флика этой колонки. */}
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
                            <View style={styles.runnerRow}>{runnerCards}</View>
                        </ScrollView>
                        {/* ScrollView, не голый View (было раньше) — при сжатом panelH
                            (см. useBoardLayout/PANEL_MAX_H, 2026-08-30) контент правой
                            колонки (плитка кубики+усиления) может не поместиться по
                            высоте; без ScrollView лишнее просто визуально вылезало за
                            пределы колонки и перекрывало переключатель игроков под ней
                            (жалоба пользователя со скриншотом). Тот же remeasure-
                            паттерн, что и у leftColumn. */}
                        <ScrollView
                            style={styles.rightColumn}
                            contentContainerStyle={styles.rightColumnContent}
                            showsVerticalScrollIndicator={false}
                            onScrollEndDrag={bumpRemeasure}
                            onMomentumScrollEnd={bumpRemeasure}
                        >
                            {diceAbilitiesTile}
                        </ScrollView>
                    </View>
                ) : (
                    // Живой прогон (веб) вскрыл тот же баг устаревающего measureInWindow
                    // тут — карточки бегунов лежат в СВОЁМ ScrollView (плитка кубики+
                    // усиления теперь закреплена отдельно, см. выше), но остаток
                    // (Бегуны) всё ещё может прокручиваться.
                    <ScrollView
                        style={styles.infoColumn}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        onScrollEndDrag={bumpRemeasure}
                        onMomentumScrollEnd={bumpRemeasure}
                    >
                        {reaperNode}
                        {/* Текст "— перетащи кубик хода на бегуна" убран (по прямому
                            запросу пользователя) — то же самое теперь показывает
                            подсказка-пульсация (см. runnersHighlight выше), отдельная
                            инструкция в заголовке стала избыточна. */}
                        <PulseText active={runnersHighlight} style={styles.sectionTitle}>Бегуны</PulseText>
                        {runnerCards}
                    </ScrollView>
                )}

                {switcherAtBottom && switcher}
            </View>

            {/* Ghost перетаскиваемого кубика — только веб, см. комментарий у
                dragGhostPos/dragGhostValue выше. x/y — уже визуальный ЦЕНТР
                кубика (см. DiceDie — origin от measureInWindow + дельта
                жеста), поэтому рисуем ghost центрированным РОВНО на этой
                точке, без искусственного сдвига: раньше был сдвиг вверх на
                size+14px "чтобы не закрывать курсор" — из-за него видимый
                ghost и реальная точка хит-теста (та же x/y) расходились, и
                подсветка зоны срабатывала не там, где визуально был кубик.
                position:'fixed' — координаты уже оконные, пересчёт под
                какого-то родителя не нужен. `left:0,top:0` (в styles.dragGhost)
                + `translateX/Y` вместо прямых `left`/`top` — позиция теперь
                идёт через `dragGhostPos.setValue()` (см. выше), а Animated
                умеет обновлять `transform` в обход React state, `left`/`top`
                так дёшево не обновить. */}
            {Platform.OS === 'web' && dragGhostValue != null && (
                <Animated.Image
                    source={DICE_FACE_IMAGES[dragGhostValue]}
                    pointerEvents="none"
                    resizeMode="contain"
                    style={[
                        styles.dragGhost,
                        {
                            width: dragGhostSize,
                            height: dragGhostSize,
                            transform: [
                                { translateX: Animated.subtract(dragGhostPos.x, dragGhostSize / 2) },
                                { translateY: Animated.subtract(dragGhostPos.y, dragGhostSize / 2) },
                            ],
                        },
                    ]}
                />
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
        // left/top:0 — точка отсчёта для translateX/Y (см. место рендера),
        // сама позиция идёт через transform, не через left/top напрямую.
        position: Platform.OS === 'web' ? 'fixed' : 'absolute',
        left: 0,
        top: 0,
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
    // Обёртка вокруг DiceTray — теперь САМА декоративная рамка (FramePanel,
    // см. diceAbilitiesTile), не просто носитель для PulseHighlight. padding
    // — тот же приём, что у AbilityZone.js#styles.zone (иначе кубики упирались
    // бы в декоративную дугу рамки).
    //
    // БЕЗ overflow:'hidden' (2026-09-20, живая жалоба пользователя — "кубики
    // при передвижении на android заходят ЗА фрейм усиления") — раньше тут
    // стоял тот же приём, что у styles.dATile ("страховка от вылезания
    // контента за раму"), но это ТОЧКА, ИЗ КОТОРОЙ кубик перетаскивают —
    // overflow:'hidden' на источнике драга в принципе неверен: пока кубик
    // тащат, он ДОЛЖЕН визуально покидать эту рамку, чтобы долететь до
    // усиления/карточки бегуна где-то ещё в панели. На Android transform
    // (Animated, см. DiceDie.js) поверх overflow:'hidden' — известная
    // кросс-платформенная особенность RN: трансформированный потомок иногда
    // всё равно "прорывается" визуально сквозь родительский клип, но при
    // этом ТЕРЯЕТ приоритет z-порядка (elevation/zIndex считаются
    // относительно исходного, уже "обрезающего" родителя) — отсюда кубик
    // оказывался виден, но НИЖЕ декоративной рамки усилений, а не поверх
    // неё, как задумано. Сама декоративная дуга (FramePanel) не пострадает
    // — она сидит НЕ внутри diceTrayWrap как контент, который надо
    // обрезать, а сама и есть первый слой этой View, ей клип не нужен.
    diceTrayWrap: { borderRadius: 4, padding: spacing.xs },
    // Общая плитка "Кубики+Усиления" (2026-09-20, PersonPanel-рамка, см.
    // diceAbilitiesTile) — padding, чтобы контент не упирался в декоративную
    // дугу рамки (тот же приём, что и у RunnerCard.js#styles.card).
    // overflow:'hidden' — страховка на случай, если PersonPanel хоть на
    // мгновение отстанет от реальной ширины плитки (см. комментарий у
    // measureDATile) — без неё контент рисовался бы поверх/за пределами уже
    // готовой декоративной рамки, а не просто ждал бы её. В compactColumns
    // плитка — ЕДИНСТВЕННЫЙ контент своей колонки (рядом больше ничего не
    // рендерится), поэтому marginBottom не нужен; в альбомной раскладке
    // плитка стоит НАД отдельным скроллящимся списком бегунов — небольшой
    // отступ отделяет её от него.
    dATile: { padding: spacing.sm, marginBottom: spacing.sm, overflow: 'hidden' },
    // paddingHorizontal/paddingVertical РАЗДЕЛЬНО (не общий `padding`,
    // 2026-09-20) — dATile НЕ имеет своей фиксированной ширины (растянута
    // родителем — правой колонкой), поэтому paddingHorizontal просто
    // перераспределяет УЖЕ имеющуюся ширину контенту, ничего не добавляя к
    // итоговому размеру плитки — безопасно увеличен посильнее (md), чинит
    // касание рамок усилений/кубиков с рамкой плитки по бокам БЕЗ побочных
    // эффектов. paddingVertical — другое дело: высота dATile auto-считается
    // ОТ контента, любой лишний вертикальный зазор напрямую её увеличивает
    // (прошлая попытка — единый `padding: spacing.md` — так и сделала,
    // пользователь справедливо отклонил: "зачем увеличил высоту общей
    // плитки", "надо было менять размер фреймов, а не общей плитки").
    // Прирост тут — ТОЛЬКО +spacing.xs (4→8, было бы +11 при md) — и
    // СРАЗУ компенсирован уменьшением зазора кубики/усиления (см.
    // abilitiesWrap ниже, тоже −4), по прямому предложению пользователя
    // "сделать расстояние между фреймами усилений и кубиков меньше, может
    // вернуть правки без увеличения общей плитки" — чистый прирост высоты
    // ~0-4px, а не +22px, как было в откаченной версии.
    dATileCompact: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: 0, overflow: 'hidden' },
    // Зазор между треем кубиков и сеткой усилений внутри общей плитки —
    // раньше его давал marginTop у заголовка "УСИЛЕНИЯ" (убран вместе с
    // текстом, см. abilitiesNode), без него сетка липла вплотную к кубикам.
    // spacing.xs (было spacing.sm) — уменьшен на 2026-09-20, компенсирует
    // прирост paddingVertical у dATileCompact выше (см. её комментарий).
    abilitiesWrap: { marginTop: spacing.xs },
    // compactColumns (портретная раскладка) — бегуны+жнец слева (основное
    // пространство), кубики+усиления справа, заметно уже — по прямому
    // запросу пользователя "сделать зону усилений поуже, дать место плиткам
    // бегунов" (история: было 3:2, потом 2:1). leftColumn — ScrollView (см.
    // комментарий у места использования про remeasureTick), rightColumn —
    // обычный View (кубики+усиления, судя по фидбеку, влезают и без скролла;
    // если тоже не влезут на каком-то экране — тот же паттерн).
    //
    // **Настоящая причина "не помещается имя бегуна на Android"
    // (2026-09-19)** — НЕ размер самой карточки (RunnerCard тут не трогали),
    // а то, что заявленное соотношение 2:1 у leftColumn/rightColumn фактически
    // НЕ ПРИМЕНЯЛОСЬ вообще: `ScrollView` в react-native-web несёт СОБСТВЕННЫЙ
    // базовый стиль (`commonStyle = {flexGrow:1, flexShrink:1}`,
    // node_modules/react-native-web/.../ScrollView/index.js), который на
    // вебе побеждает в CSS-каскаде над нашим `flex:2`/`flex:1` (шорткат
    // сам по себе, судя по всему, не разбирается в единый flexGrow ДО того,
    // как конкурирует с уже атомарным `flexGrow` от ScrollView — порядок
    // React-массива style тут не спасает, картина чисто CSS-специфичности).
    // Живой замер (DOM, `getComputedStyle`) подтвердил: у ОБЕИХ колонок
    // `flexGrow` фактически был `1` (не `2` у leftColumn), несмотря на
    // `flex:2` в JS-стиле — отсюда почти равные 165px/173px вместо ~2:1.
    // Фикс — задавать `flexGrow`/`flexShrink`/`flexBasis` ЯВНЫМИ длинными
    // свойствами (не через шорткат `flex`) — та же самая property-конкуренция
    // с `commonStyle`, но теперь уже точно по ИМЕНИ свойства, где наш стиль
    // однозначно позже/точнее и побеждает. `minWidth:0` — тоже нужен (без него
    // `flexBasis:0` не спасёт от того, что колонка не ужмётся меньше
    // естественного размера контента, та же ловушка, что уже чинилась для
    // `infoCol` в RunnerCard.js) — лишний контент (карточки/усиления) просто
    // скроллится ВНУТРИ своего ScrollView, как и было задумано изначально.
    columns: { flex: 1, flexDirection: 'row', marginTop: spacing.xs },
    // 3:2 (не 2:1) — после фикса flexGrow-конкуренции с ScrollView выше 2:1
    // дало реальную ширину карточки 211px (было 157) — живая жалоба
    // пользователя "слишком широко получилось", 3:2 — более умеренный шаг.
    leftColumn: { flexGrow: 3, flexShrink: 1, flexBasis: 0, minWidth: 0, marginRight: spacing.sm },
    // paddingHorizontal — карточки/кубики+усиления теперь НЕ растянуты
    // впритык к границам своей колонки (по прямому запросу пользователя
    // "уменьшить ширину" обеих зон) — видимый отступ с обеих сторон, сама
    // ширина колонок (2:1) не меняется.
    leftColumnContent: { paddingBottom: spacing.sm, paddingHorizontal: spacing.xs },
    // Ряд из 3 вертикальных плиток бегунов, ПОД Жнецом (2026-09-20, см.
    // RunnerCard.js#compact) — gap, тот же приём, что уже используют columns/
    // DiceTray/turnBtnRow в этом файле/проекте.
    runnerRow: { flexDirection: 'row', gap: spacing.xs },
    rightColumn: { flexGrow: 2, flexShrink: 1, flexBasis: 0, minWidth: 0, paddingHorizontal: spacing.xs },
    rightColumnContent: { paddingBottom: spacing.sm },
});
