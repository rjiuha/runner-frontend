// src/constants/runnerAnimations.js
import { RUNNER_STATUS, RUNNER_TYPES } from './GameConstants';

/**
 * Ассеты анимаций бегунов — Скаут/Солдат/Атлет (RUNNER_TYPES.SPRINTER/
 * ATHLETE/TANK), добавлены пользователем в assets/images/runners/
 * {scout,trooper,athlet}/{healthy,damaged}/. Остальные типы (пока только
 * Жнец) намеренно не описаны здесь — getRunnerAnimationImage/
 * getRunnerAvatarImage возвращают null, когда для типа нет записи, и
 * RunnerToken сам откатывается на старую статичную иконку
 * (RUNNER_DISPLAY[type].icon) — добавление следующего типа - это только
 * новая запись тут, без правок компонентов.
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
 *
 * **Перекраска неона под цвет игрока** (2026-08-31): каждая анимация — не
 * один gif, а ПАРА {base, mask}. base — тот же кадр, но неоновые вставки
 * обесцвечены (десатурированы с сохранением светлоты) в тон тёмного костюма.
 * mask — те же кадры, только неон залит чистым белым на прозрачном фоне, а
 * всё остальное прозрачно. RunnerToken рисует их ДВУМЯ наложенными <Image>:
 * base как есть, mask поверх с tintColor={color игрока} — так неон становится
 * цветом команды, а не перекрашивается весь спрайт целиком. Обе гифки
 * сгенерированы автоматически (порог по HSL: hue 150–255°, saturation ≥20%,
 * lightness 35–96% — подобран и проверен визуально на всех типах/статусах/
 * кадрах, см. историю в CLAUDE.md) из оригинальных ассетов пользователя —
 * сами оригиналы (без суффикса _base/_mask) больше в коде не используются,
 * но оставлены в assets на случай, если порог придётся пересчитать.
 */

const scoutHealthy = {
    idle: { base: require('../assets/images/runners/scout/healthy/scout_healthy_idle_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_idle_mask.gif') },
    avatar: { base: require('../assets/images/runners/scout/healthy/scout_healthy_avatar_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_avatar_mask.gif') },
    fly: { base: require('../assets/images/runners/scout/healthy/scout_healthy_fly_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_fly_mask.gif') },
    gotShot: { base: require('../assets/images/runners/scout/healthy/scout_healthy_got_shot_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_got_shot_mask.gif') },
    destroyed: { base: require('../assets/images/runners/scout/healthy/scout_healthy_destroyed_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_destroyed_mask.gif') },
    move: {
        north: { base: require('../assets/images/runners/scout/healthy/scout_healthy_move_north_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_move_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-west_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-east_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-west_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-east_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-east_mask.gif') },
    },
    attack: {
        north: { base: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-west_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-east_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-west_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-east_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-east_mask.gif') },
    },
    collision: {
        east: { base: require('../assets/images/runners/scout/healthy/scout_healthy_collision_east_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_collision_east_mask.gif') },
        west: { base: require('../assets/images/runners/scout/healthy/scout_healthy_collision_west_base.gif'), mask: require('../assets/images/runners/scout/healthy/scout_healthy_collision_west_mask.gif') },
    },
};

const scoutDamaged = {
    idle: { base: require('../assets/images/runners/scout/damaged/scout_damaged_idle_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_idle_mask.gif') },
    avatar: { base: require('../assets/images/runners/scout/damaged/scout_damaged_avatar_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_avatar_mask.gif') },
    fly: { base: require('../assets/images/runners/scout/damaged/scout_damaged_fly_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_fly_mask.gif') },
    gotShot: { base: require('../assets/images/runners/scout/damaged/scout_damaged_got_shot_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_got_shot_mask.gif') },
    destroyed: { base: require('../assets/images/runners/scout/damaged/scout_damaged_destroyed_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_destroyed_mask.gif') },
    broken: { base: require('../assets/images/runners/scout/damaged/scout_damaged_broken_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_broken_mask.gif') },
    move: {
        north: { base: require('../assets/images/runners/scout/damaged/scout_damaged_move_north_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_move_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-west_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-east_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-west_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-east_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-east_mask.gif') },
    },
    attack: {
        north: { base: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-west_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-east_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-west_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-east_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-east_mask.gif') },
    },
    collision: {
        east: { base: require('../assets/images/runners/scout/damaged/scout_damaged_collision_east_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_collision_east_mask.gif') },
        west: { base: require('../assets/images/runners/scout/damaged/scout_damaged_collision_west_base.gif'), mask: require('../assets/images/runners/scout/damaged/scout_damaged_collision_west_mask.gif') },
    },
};

const trooperHealthy = {
    idle: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_idle_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_idle_mask.gif') },
    avatar: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_avatar_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_avatar_mask.gif') },
    fly: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_fly_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_fly_mask.gif') },
    gotShot: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_got_shot_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_got_shot_mask.gif') },
    destroyed: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_destroyed_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_destroyed_mask.gif') },
    move: {
        north: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-west_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-east_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-west_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-east_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-east_mask.gif') },
    },
    attack: {
        north: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-west_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-east_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-west_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-east_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-east_mask.gif') },
    },
    collision: {
        east: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_east_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_east_mask.gif') },
        west: { base: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_west_base.gif'), mask: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_west_mask.gif') },
    },
};

const trooperDamaged = {
    idle: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_idle_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_idle_mask.gif') },
    avatar: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_avatar_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_avatar_mask.gif') },
    fly: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_fly_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_fly_mask.gif') },
    gotShot: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_got_shot_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_got_shot_mask.gif') },
    destroyed: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_destoyed_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_destoyed_mask.gif') },
    broken: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_broken_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_broken_mask.gif') },
    move: {
        north: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-west_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-east_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-west_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-east_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-east_mask.gif') },
    },
    attack: {
        north: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-west_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-east_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-west_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-east_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-east_mask.gif') },
    },
    collision: {
        east: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_east_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_east_mask.gif') },
        west: { base: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_west_base.gif'), mask: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_west_mask.gif') },
    },
};

const athletHealthy = {
    idle: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_idle_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_idle_mask.gif') },
    avatar: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_avatar_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_avatar_mask.gif') },
    fly: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_fly_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_fly_mask.gif') },
    gotShot: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_got_shot_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_got_shot_mask.gif') },
    destroyed: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_destroyed_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_destroyed_mask.gif') },
    move: {
        north: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-west_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-east_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-west_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-east_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-east_mask.gif') },
    },
    attack: {
        north: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-west_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-east_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-west_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-east_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-east_mask.gif') },
    },
    collision: {
        east: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_east_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_east_mask.gif') },
        west: { base: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_west_base.gif'), mask: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_west_mask.gif') },
    },
};

const athletDamaged = {
    idle: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_idle_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_idle_mask.gif') },
    avatar: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_avatar_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_avatar_mask.gif') },
    fly: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_fly_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_fly_mask.gif') },
    gotShot: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_got_shot_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_got_shot_mask.gif') },
    destroyed: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_destroyed_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_destroyed_mask.gif') },
    broken: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_broken_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_broken_mask.gif') },
    move: {
        north: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-west_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-east_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-west_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-east_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-east_mask.gif') },
    },
    attack: {
        north: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north_mask.gif') },
        northWest: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-west_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-west_mask.gif') },
        northEast: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-east_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-east_mask.gif') },
        southWest: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-west_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-west_mask.gif') },
        southEast: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-east_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-east_mask.gif') },
    },
    collision: {
        east: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_east_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_east_mask.gif') },
        west: { base: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_west_base.gif'), mask: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_west_mask.gif') },
    },
};

export const RUNNER_ANIMATION_SETS = {
    [RUNNER_TYPES.SPRINTER]: { healthy: scoutHealthy, damaged: scoutDamaged },
    [RUNNER_TYPES.ATHLETE]: { healthy: trooperHealthy, damaged: trooperDamaged },
    [RUNNER_TYPES.TANK]: { healthy: athletHealthy, damaged: athletDamaged },
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
 * Пара {base, mask} для текущего анимационного состояния бегуна на доске.
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

/** Пара {base, mask} для карточки бегуна в панели игрока (RunnerCard) — всегда avatar, без анимационного стейта. */
export function getRunnerAvatarImage(type, status) {
    const set = RUNNER_ANIMATION_SETS[type];
    if (!set) return null;
    return set[statusFolder(status)].avatar;
}
