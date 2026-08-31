// src/constants/runnerAnimations.js
import { RUNNER_STATUS, RUNNER_TYPES } from './GameConstants';

/**
 * Ассеты анимаций бегунов — пока только Скаут (RUNNER_TYPES.SPRINTER),
 * добавлены пользователем в assets/images/runners/scout/{healthy,damaged}/,
 * 2026-08-31. Остальные типы намеренно не описаны здесь —
 * getRunnerAnimationImage/getRunnerAvatarImage возвращают null, когда для
 * типа нет записи, и RunnerToken сам откатывается на старую статичную
 * иконку (RUNNER_DISPLAY[type].icon) — добавление следующего типа - это
 * только новая запись тут, без правок компонентов.
 *
 * Схема имён, которую задал пользователь: {name}_{status}_{action}
 * [_{direction}].gif. Статусов-папок всего 2 (healthy/damaged) — RUNNER_STATUS
 * их 4 (healthy/damaged/broken/destroyed), см. statusFolder() ниже про то,
 * как они сводятся к 2 папкам (broken/destroyed — тоже "damaged"-набор, со
 * своими отдельными клипами broken/destroyed внутри).
 *
 * Направлений в ассетах 5 (north/north-west/north-east/south-west/
 * south-east) — но в игре есть только 3 "вперёд"-направления (UP/LEFT_UP/
 * RIGHT_UP, см. lib/hexDirection#MOVE_DIRECTIONS), назад бегун никогда не
 * ходит и не стреляет — south-west/south-east в GAME_DIRECTION_TO_ASSET_KEY
 * снизу осознанно не задействованы.
 */

const scoutHealthy = {
    idle: require('../assets/images/runners/scout/healthy/scout_healthy_idle.gif'),
    avatar: require('../assets/images/runners/scout/healthy/scout_healthy_avatar.gif'),
    fly: require('../assets/images/runners/scout/healthy/scout_healthy_fly.gif'),
    gotShot: require('../assets/images/runners/scout/healthy/scout_healthy_got_shot.gif'),
    destroyed: require('../assets/images/runners/scout/healthy/scout_healthy_destroyed.gif'),
    move: {
        north: require('../assets/images/runners/scout/healthy/scout_healthy_move_north.gif'),
        northWest: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-west.gif'),
        northEast: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-east.gif'),
        southWest: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-west.gif'),
        southEast: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-east.gif'),
    },
    attack: {
        north: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north.gif'),
        northWest: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-west.gif'),
        northEast: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-east.gif'),
        southWest: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-west.gif'),
        southEast: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-east.gif'),
    },
    collision: {
        east: require('../assets/images/runners/scout/healthy/scout_healthy_collision_east.gif'),
        west: require('../assets/images/runners/scout/healthy/scout_healthy_collision_west.gif'),
    },
};

const scoutDamaged = {
    idle: require('../assets/images/runners/scout/damaged/scout_damaged_idle.gif'),
    avatar: require('../assets/images/runners/scout/damaged/scout_damaged_avatar.gif'),
    fly: require('../assets/images/runners/scout/damaged/scout_damaged_fly.gif'),
    gotShot: require('../assets/images/runners/scout/damaged/scout_damaged_got_shot.gif'),
    broken: require('../assets/images/runners/scout/damaged/scout_damaged_broken.gif'),
    destroyed: require('../assets/images/runners/scout/damaged/scout_damaged_destroyed.gif'),
    move: {
        north: require('../assets/images/runners/scout/damaged/scout_damaged_move_north.gif'),
        northWest: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-west.gif'),
        northEast: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-east.gif'),
        southWest: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-west.gif'),
        southEast: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-east.gif'),
    },
    attack: {
        north: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north.gif'),
        northWest: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-west.gif'),
        northEast: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-east.gif'),
        southWest: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-west.gif'),
        southEast: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-east.gif'),
    },
    collision: {
        east: require('../assets/images/runners/scout/damaged/scout_damaged_collision_east.gif'),
        west: require('../assets/images/runners/scout/damaged/scout_damaged_collision_west.gif'),
    },
};

export const RUNNER_ANIMATION_SETS = {
    [RUNNER_TYPES.SPRINTER]: { healthy: scoutHealthy, damaged: scoutDamaged },
};

/**
 * Игровое направление (DirectionService, см. lib/hexDirection.js) → ключ в
 * move/attack выше. LEFT_UP/RIGHT_UP НЕ совпадают с "визуально влево/вправо"
 * — в портретной раскладке дорожки идут слева направо по возрастанию
 * positionY (см. BoardGrid), а LEFT_UP как раз УВЕЛИЧИВАЕТ positionY (см.
 * hexDirection#neighborPosition) — то есть визуально ведёт бегуна ВПРАВО по
 * экрану, RIGHT_UP — влево. Названия достались от бэковой геометрии (другая
 * система координат), не от экрана. Сопоставлено ассетам по факту видимого
 * направления (жалоба пользователя после живого теста на Android, 2026-08-31
 * — "перепутаны анимации влево и вправо", было наоборот).
 */
export const GAME_DIRECTION_TO_ASSET_KEY = { UP: 'north', LEFT_UP: 'northEast', RIGHT_UP: 'northWest' };

/** RUNNER_STATUS → какая из 2 папок ассетов (healthy/damaged) используется. */
function statusFolder(status) {
    return status === RUNNER_STATUS.HEALTHY ? 'healthy' : 'damaged';
}

/** Порядок "тяжести" статуса — чтобы отличить "стало хуже" (гот-шот/уничтожен) от улучшения (лечение). */
const STATUS_ORDER = [RUNNER_STATUS.HEALTHY, RUNNER_STATUS.DAMAGED, RUNNER_STATUS.BROKEN, RUNNER_STATUS.DESTROYED];
export function statusWorsened(prevStatus, nextStatus) {
    return STATUS_ORDER.indexOf(nextStatus) > STATUS_ORDER.indexOf(prevStatus);
}

/**
 * Картинка для текущего анимационного состояния бегуна на доске.
 * `anim` — { kind: 'move'|'attack'|'fly'|'gotShot'|'destroyed'|'collision', direction?, side?, fromStatus? } | null (idle).
 * Возвращает null, если для этого типа нет набора анимаций вообще — вызывающий
 * код (RunnerToken) тогда откатывается на старую статичную иконку.
 */
export function getRunnerAnimationImage(type, status, anim) {
    const set = RUNNER_ANIMATION_SETS[type];
    if (!set) return null;

    // 'destroyed' — терминальное состояние: используем набор ТОГО статуса, в
    // котором бегун был непосредственно перед уничтожением (fromStatus,
    // проставляется триггером в lib/runnerAnimTriggers), не текущий (он уже
    // 'destroyed', statusFolder свёл бы его к 'damaged' всегда).
    if (anim?.kind === 'destroyed') return set[statusFolder(anim.fromStatus ?? status)].destroyed;

    const bucket = set[statusFolder(status)];
    if (!anim || anim.kind === 'idle') {
        if (status === RUNNER_STATUS.BROKEN) return bucket.broken;
        if (status === RUNNER_STATUS.DESTROYED) return bucket.destroyed; // холодный старт/reconnect без анимации перехода
        return bucket.idle;
    }
    if (anim.kind === 'move' || anim.kind === 'attack') {
        const dirKey = GAME_DIRECTION_TO_ASSET_KEY[anim.direction] ?? 'north';
        return bucket[anim.kind]?.[dirKey] ?? bucket.idle;
    }
    if (anim.kind === 'fly') return bucket.fly;
    if (anim.kind === 'gotShot') return bucket.gotShot;
    if (anim.kind === 'collision') return bucket.collision?.[anim.side] ?? bucket.idle;
    return bucket.idle;
}

/** Картинка для карточки бегуна в панели игрока (RunnerCard) — всегда avatar, без анимационного стейта. */
export function getRunnerAvatarImage(type, status) {
    const set = RUNNER_ANIMATION_SETS[type];
    if (!set) return null;
    return set[statusFolder(status)].avatar;
}
