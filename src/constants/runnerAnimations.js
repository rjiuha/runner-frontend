// src/constants/runnerAnimations.js
import { PLAYER_COLOR_HEX, RUNNER_STATUS, RUNNER_TYPES } from './GameConstants';

/**
 * Ассеты анимаций бегунов — Скаут/Атлет/Танк (RUNNER_TYPES.SPRINTER/
 * ATHLETE/TANK), добавлены пользователем в assets/images/runners/
 * {scout,athlet,tank}/{healthy,damaged}/. Жнец пока без набора —
 * getRunnerAnimationImage/getRunnerAvatarImage возвращают null, RunnerToken
 * откатывается на старую статичную иконку.
 *
 * **Реверс-маскинг вместо base+mask+tintColor** (2026-09-02): раньше каждая
 * анимация была ПАРОЙ {base, mask} — base с десатурированным неоном, mask с
 * чистым белым неоном на прозрачном фоне, RunnerToken рисовал ДВА
 * наложенных <Image> (mask поверх с tintColor цвета игрока). Это означало
 * ДВОЙНОЙ decode на Android при каждой смене анимации — подозревался как
 * одна из причин "мигания" между анимациями (не единственная, см. CLAUDE.md).
 * Новая схема — ОДИН заранее перекрашенный gif НА КАЖДЫЙ из 4 цветов игрока
 * (red/blue/green/yellow, см. PLAYER_COLOR_HEX): неон НЕ трогается (остаётся
 * родным голубым), "стальное" покрытие тонируется ПОЛУПРОЗРАЧНО (30% —
 * пользователь запросил "70% прозрачности") в цвет команды поверх исходной
 * текстуры (alpha-blend, не плоская заливка). Один <Image> на смену состояния
 * вместо двух — вдвое меньше работы декодеру. Плюс все board-состояния (не
 * avatar) уменьшены до 120px по большей стороне под реальный размер токена
 * на доске (оригиналы 168-216px) — быстрее декодировать, тот же приём, что
 * уже применялся для тайлов дороги (-ez варианты).
 *
 * Сгенерировано скриптом (gifwrap+jimp, порог неона: hue 150-255°,
 * saturation>=20%, lightness 35-96% — тот же, что и раньше) из ОРИГИНАЛЬНЫХ
 * (без суффикса) gif пользователя, которые остаются в assets как исходники.
 * Старые _base/_mask пары удалены как более не используемые.
 */

const scoutHealthyRed = {
    attack: {
        northEast: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-east_red.gif'),
        northWest: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-west_red.gif'),
        north: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north_red.gif'),
        southEast: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-east_red.gif'),
        southWest: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-west_red.gif'),
    },
    avatar: require('../assets/images/runners/scout/healthy/scout_healthy_avatar_red.gif'),
    acid: require('../assets/images/runners/scout/healthy/scout_healthy_acid_red.gif'),
    burn: require('../assets/images/runners/scout/healthy/scout_healthy_burn_red.gif'),
    start: require('../assets/images/runners/scout/healthy/scout_healthy_start_red.gif'),
    collision: {
        east: require('../assets/images/runners/scout/healthy/scout_healthy_collision_east_red.gif'),
        west: require('../assets/images/runners/scout/healthy/scout_healthy_collision_west_red.gif'),
    },
    destroyed: require('../assets/images/runners/scout/healthy/scout_healthy_destroyed_red.gif'),
    fly: require('../assets/images/runners/scout/healthy/scout_healthy_fly_red.gif'),
    gotShot: require('../assets/images/runners/scout/healthy/scout_healthy_got_shot_red.gif'),
    idle: require('../assets/images/runners/scout/healthy/scout_healthy_idle_red.gif'),
    move: {
        northEast: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-east_red.gif'),
        northWest: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-west_red.gif'),
        north: require('../assets/images/runners/scout/healthy/scout_healthy_move_north_red.gif'),
        southEast: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-east_red.gif'),
        southWest: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-west_red.gif'),
    },
};

const scoutHealthyBlue = {
    attack: {
        northEast: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-east_blue.gif'),
        northWest: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-west_blue.gif'),
        north: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north_blue.gif'),
        southEast: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-east_blue.gif'),
        southWest: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-west_blue.gif'),
    },
    avatar: require('../assets/images/runners/scout/healthy/scout_healthy_avatar_blue.gif'),
    acid: require('../assets/images/runners/scout/healthy/scout_healthy_acid_blue.gif'),
    burn: require('../assets/images/runners/scout/healthy/scout_healthy_burn_blue.gif'),
    start: require('../assets/images/runners/scout/healthy/scout_healthy_start_blue.gif'),
    collision: {
        east: require('../assets/images/runners/scout/healthy/scout_healthy_collision_east_blue.gif'),
        west: require('../assets/images/runners/scout/healthy/scout_healthy_collision_west_blue.gif'),
    },
    destroyed: require('../assets/images/runners/scout/healthy/scout_healthy_destroyed_blue.gif'),
    fly: require('../assets/images/runners/scout/healthy/scout_healthy_fly_blue.gif'),
    gotShot: require('../assets/images/runners/scout/healthy/scout_healthy_got_shot_blue.gif'),
    idle: require('../assets/images/runners/scout/healthy/scout_healthy_idle_blue.gif'),
    move: {
        northEast: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-east_blue.gif'),
        northWest: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-west_blue.gif'),
        north: require('../assets/images/runners/scout/healthy/scout_healthy_move_north_blue.gif'),
        southEast: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-east_blue.gif'),
        southWest: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-west_blue.gif'),
    },
};

const scoutHealthyGreen = {
    attack: {
        northEast: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-east_green.gif'),
        northWest: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-west_green.gif'),
        north: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north_green.gif'),
        southEast: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-east_green.gif'),
        southWest: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-west_green.gif'),
    },
    avatar: require('../assets/images/runners/scout/healthy/scout_healthy_avatar_green.gif'),
    acid: require('../assets/images/runners/scout/healthy/scout_healthy_acid_green.gif'),
    burn: require('../assets/images/runners/scout/healthy/scout_healthy_burn_green.gif'),
    start: require('../assets/images/runners/scout/healthy/scout_healthy_start_green.gif'),
    collision: {
        east: require('../assets/images/runners/scout/healthy/scout_healthy_collision_east_green.gif'),
        west: require('../assets/images/runners/scout/healthy/scout_healthy_collision_west_green.gif'),
    },
    destroyed: require('../assets/images/runners/scout/healthy/scout_healthy_destroyed_green.gif'),
    fly: require('../assets/images/runners/scout/healthy/scout_healthy_fly_green.gif'),
    gotShot: require('../assets/images/runners/scout/healthy/scout_healthy_got_shot_green.gif'),
    idle: require('../assets/images/runners/scout/healthy/scout_healthy_idle_green.gif'),
    move: {
        northEast: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-east_green.gif'),
        northWest: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-west_green.gif'),
        north: require('../assets/images/runners/scout/healthy/scout_healthy_move_north_green.gif'),
        southEast: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-east_green.gif'),
        southWest: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-west_green.gif'),
    },
};

const scoutHealthyYellow = {
    attack: {
        northEast: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north-west_yellow.gif'),
        north: require('../assets/images/runners/scout/healthy/scout_healthy_attack_north_yellow.gif'),
        southEast: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/scout/healthy/scout_healthy_attack_south-west_yellow.gif'),
    },
    avatar: require('../assets/images/runners/scout/healthy/scout_healthy_avatar_yellow.gif'),
    acid: require('../assets/images/runners/scout/healthy/scout_healthy_acid_yellow.gif'),
    burn: require('../assets/images/runners/scout/healthy/scout_healthy_burn_yellow.gif'),
    start: require('../assets/images/runners/scout/healthy/scout_healthy_start_yellow.gif'),
    collision: {
        east: require('../assets/images/runners/scout/healthy/scout_healthy_collision_east_yellow.gif'),
        west: require('../assets/images/runners/scout/healthy/scout_healthy_collision_west_yellow.gif'),
    },
    destroyed: require('../assets/images/runners/scout/healthy/scout_healthy_destroyed_yellow.gif'),
    fly: require('../assets/images/runners/scout/healthy/scout_healthy_fly_yellow.gif'),
    gotShot: require('../assets/images/runners/scout/healthy/scout_healthy_got_shot_yellow.gif'),
    idle: require('../assets/images/runners/scout/healthy/scout_healthy_idle_yellow.gif'),
    move: {
        northEast: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/scout/healthy/scout_healthy_move_north-west_yellow.gif'),
        north: require('../assets/images/runners/scout/healthy/scout_healthy_move_north_yellow.gif'),
        southEast: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/scout/healthy/scout_healthy_move_south-west_yellow.gif'),
    },
};

const scoutDamagedRed = {
    attack: {
        northEast: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-east_red.gif'),
        northWest: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-west_red.gif'),
        north: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north_red.gif'),
        southEast: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-east_red.gif'),
        southWest: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-west_red.gif'),
    },
    avatar: require('../assets/images/runners/scout/damaged/scout_damaged_avatar_red.gif'),
    broken: require('../assets/images/runners/scout/damaged/scout_damaged_broken_red.gif'),
    heal: require('../assets/images/runners/scout/damaged/scout_damaged_heal_red.gif'),
    collision: {
        east: require('../assets/images/runners/scout/damaged/scout_damaged_collision_east_red.gif'),
        west: require('../assets/images/runners/scout/damaged/scout_damaged_collision_west_red.gif'),
    },
    destroyed: require('../assets/images/runners/scout/damaged/scout_damaged_destroyed_red.gif'),
    fly: require('../assets/images/runners/scout/damaged/scout_damaged_fly_red.gif'),
    gotShot: require('../assets/images/runners/scout/damaged/scout_damaged_got_shot_red.gif'),
    idle: require('../assets/images/runners/scout/damaged/scout_damaged_idle_red.gif'),
    move: {
        northEast: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-east_red.gif'),
        northWest: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-west_red.gif'),
        north: require('../assets/images/runners/scout/damaged/scout_damaged_move_north_red.gif'),
        southEast: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-east_red.gif'),
        southWest: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-west_red.gif'),
    },
};

const scoutDamagedBlue = {
    attack: {
        northEast: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-east_blue.gif'),
        northWest: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-west_blue.gif'),
        north: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north_blue.gif'),
        southEast: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-east_blue.gif'),
        southWest: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-west_blue.gif'),
    },
    avatar: require('../assets/images/runners/scout/damaged/scout_damaged_avatar_blue.gif'),
    broken: require('../assets/images/runners/scout/damaged/scout_damaged_broken_blue.gif'),
    heal: require('../assets/images/runners/scout/damaged/scout_damaged_heal_blue.gif'),
    collision: {
        east: require('../assets/images/runners/scout/damaged/scout_damaged_collision_east_blue.gif'),
        west: require('../assets/images/runners/scout/damaged/scout_damaged_collision_west_blue.gif'),
    },
    destroyed: require('../assets/images/runners/scout/damaged/scout_damaged_destroyed_blue.gif'),
    fly: require('../assets/images/runners/scout/damaged/scout_damaged_fly_blue.gif'),
    gotShot: require('../assets/images/runners/scout/damaged/scout_damaged_got_shot_blue.gif'),
    idle: require('../assets/images/runners/scout/damaged/scout_damaged_idle_blue.gif'),
    move: {
        northEast: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-east_blue.gif'),
        northWest: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-west_blue.gif'),
        north: require('../assets/images/runners/scout/damaged/scout_damaged_move_north_blue.gif'),
        southEast: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-east_blue.gif'),
        southWest: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-west_blue.gif'),
    },
};

const scoutDamagedGreen = {
    attack: {
        northEast: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-east_green.gif'),
        northWest: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-west_green.gif'),
        north: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north_green.gif'),
        southEast: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-east_green.gif'),
        southWest: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-west_green.gif'),
    },
    avatar: require('../assets/images/runners/scout/damaged/scout_damaged_avatar_green.gif'),
    broken: require('../assets/images/runners/scout/damaged/scout_damaged_broken_green.gif'),
    heal: require('../assets/images/runners/scout/damaged/scout_damaged_heal_green.gif'),
    collision: {
        east: require('../assets/images/runners/scout/damaged/scout_damaged_collision_east_green.gif'),
        west: require('../assets/images/runners/scout/damaged/scout_damaged_collision_west_green.gif'),
    },
    destroyed: require('../assets/images/runners/scout/damaged/scout_damaged_destroyed_green.gif'),
    fly: require('../assets/images/runners/scout/damaged/scout_damaged_fly_green.gif'),
    gotShot: require('../assets/images/runners/scout/damaged/scout_damaged_got_shot_green.gif'),
    idle: require('../assets/images/runners/scout/damaged/scout_damaged_idle_green.gif'),
    move: {
        northEast: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-east_green.gif'),
        northWest: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-west_green.gif'),
        north: require('../assets/images/runners/scout/damaged/scout_damaged_move_north_green.gif'),
        southEast: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-east_green.gif'),
        southWest: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-west_green.gif'),
    },
};

const scoutDamagedYellow = {
    attack: {
        northEast: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north-west_yellow.gif'),
        north: require('../assets/images/runners/scout/damaged/scout_damaged_attack_north_yellow.gif'),
        southEast: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/scout/damaged/scout_damaged_attack_south-west_yellow.gif'),
    },
    avatar: require('../assets/images/runners/scout/damaged/scout_damaged_avatar_yellow.gif'),
    broken: require('../assets/images/runners/scout/damaged/scout_damaged_broken_yellow.gif'),
    heal: require('../assets/images/runners/scout/damaged/scout_damaged_heal_yellow.gif'),
    collision: {
        east: require('../assets/images/runners/scout/damaged/scout_damaged_collision_east_yellow.gif'),
        west: require('../assets/images/runners/scout/damaged/scout_damaged_collision_west_yellow.gif'),
    },
    destroyed: require('../assets/images/runners/scout/damaged/scout_damaged_destroyed_yellow.gif'),
    fly: require('../assets/images/runners/scout/damaged/scout_damaged_fly_yellow.gif'),
    gotShot: require('../assets/images/runners/scout/damaged/scout_damaged_got_shot_yellow.gif'),
    idle: require('../assets/images/runners/scout/damaged/scout_damaged_idle_yellow.gif'),
    move: {
        northEast: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/scout/damaged/scout_damaged_move_north-west_yellow.gif'),
        north: require('../assets/images/runners/scout/damaged/scout_damaged_move_north_yellow.gif'),
        southEast: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/scout/damaged/scout_damaged_move_south-west_yellow.gif'),
    },
};

const athletHealthyRed = {
    attack: {
        northEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-east_red.gif'),
        northWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-west_red.gif'),
        north: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north_red.gif'),
        southEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-east_red.gif'),
        southWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-west_red.gif'),
    },
    avatar: require('../assets/images/runners/athlet/healthy/athlet_healthy_avatar_red.gif'),
    acid: require('../assets/images/runners/athlet/healthy/athlet_healthy_acid_red.gif'),
    burn: require('../assets/images/runners/athlet/healthy/athlet_healthy_burn_red.gif'),
    start: require('../assets/images/runners/athlet/healthy/athlet_healthy_start_red.gif'),
    collision: {
        east: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_east_red.gif'),
        west: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_west_red.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/healthy/athlet_healthy_destroyed_red.gif'),
    fly: require('../assets/images/runners/athlet/healthy/athlet_healthy_fly_red.gif'),
    gotShot: require('../assets/images/runners/athlet/healthy/athlet_healthy_got_shot_red.gif'),
    idle: require('../assets/images/runners/athlet/healthy/athlet_healthy_idle_red.gif'),
    move: {
        northEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-east_red.gif'),
        northWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-west_red.gif'),
        north: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north_red.gif'),
        southEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-east_red.gif'),
        southWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-west_red.gif'),
    },
};

const athletHealthyBlue = {
    attack: {
        northEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-east_blue.gif'),
        northWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-west_blue.gif'),
        north: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north_blue.gif'),
        southEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-east_blue.gif'),
        southWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-west_blue.gif'),
    },
    avatar: require('../assets/images/runners/athlet/healthy/athlet_healthy_avatar_blue.gif'),
    acid: require('../assets/images/runners/athlet/healthy/athlet_healthy_acid_blue.gif'),
    burn: require('../assets/images/runners/athlet/healthy/athlet_healthy_burn_blue.gif'),
    start: require('../assets/images/runners/athlet/healthy/athlet_healthy_start_blue.gif'),
    collision: {
        east: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_east_blue.gif'),
        west: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_west_blue.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/healthy/athlet_healthy_destroyed_blue.gif'),
    fly: require('../assets/images/runners/athlet/healthy/athlet_healthy_fly_blue.gif'),
    gotShot: require('../assets/images/runners/athlet/healthy/athlet_healthy_got_shot_blue.gif'),
    idle: require('../assets/images/runners/athlet/healthy/athlet_healthy_idle_blue.gif'),
    move: {
        northEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-east_blue.gif'),
        northWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-west_blue.gif'),
        north: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north_blue.gif'),
        southEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-east_blue.gif'),
        southWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-west_blue.gif'),
    },
};

const athletHealthyGreen = {
    attack: {
        northEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-east_green.gif'),
        northWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-west_green.gif'),
        north: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north_green.gif'),
        southEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-east_green.gif'),
        southWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-west_green.gif'),
    },
    avatar: require('../assets/images/runners/athlet/healthy/athlet_healthy_avatar_green.gif'),
    acid: require('../assets/images/runners/athlet/healthy/athlet_healthy_acid_green.gif'),
    burn: require('../assets/images/runners/athlet/healthy/athlet_healthy_burn_green.gif'),
    start: require('../assets/images/runners/athlet/healthy/athlet_healthy_start_green.gif'),
    collision: {
        east: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_east_green.gif'),
        west: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_west_green.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/healthy/athlet_healthy_destroyed_green.gif'),
    fly: require('../assets/images/runners/athlet/healthy/athlet_healthy_fly_green.gif'),
    gotShot: require('../assets/images/runners/athlet/healthy/athlet_healthy_got_shot_green.gif'),
    idle: require('../assets/images/runners/athlet/healthy/athlet_healthy_idle_green.gif'),
    move: {
        northEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-east_green.gif'),
        northWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-west_green.gif'),
        north: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north_green.gif'),
        southEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-east_green.gif'),
        southWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-west_green.gif'),
    },
};

const athletHealthyYellow = {
    attack: {
        northEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north-west_yellow.gif'),
        north: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_north_yellow.gif'),
        southEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_attack_south-west_yellow.gif'),
    },
    avatar: require('../assets/images/runners/athlet/healthy/athlet_healthy_avatar_yellow.gif'),
    acid: require('../assets/images/runners/athlet/healthy/athlet_healthy_acid_yellow.gif'),
    burn: require('../assets/images/runners/athlet/healthy/athlet_healthy_burn_yellow.gif'),
    start: require('../assets/images/runners/athlet/healthy/athlet_healthy_start_yellow.gif'),
    collision: {
        east: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_east_yellow.gif'),
        west: require('../assets/images/runners/athlet/healthy/athlet_healthy_collision_west_yellow.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/healthy/athlet_healthy_destroyed_yellow.gif'),
    fly: require('../assets/images/runners/athlet/healthy/athlet_healthy_fly_yellow.gif'),
    gotShot: require('../assets/images/runners/athlet/healthy/athlet_healthy_got_shot_yellow.gif'),
    idle: require('../assets/images/runners/athlet/healthy/athlet_healthy_idle_yellow.gif'),
    move: {
        northEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north-west_yellow.gif'),
        north: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_north_yellow.gif'),
        southEast: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/athlet/healthy/athlet_healthy_move_south-west_yellow.gif'),
    },
};

const athletDamagedRed = {
    attack: {
        northEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-east_red.gif'),
        northWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-west_red.gif'),
        north: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north_red.gif'),
        southEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-east_red.gif'),
        southWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-west_red.gif'),
    },
    avatar: require('../assets/images/runners/athlet/damaged/athlet_damaged_avatar_red.gif'),
    broken: require('../assets/images/runners/athlet/damaged/athlet_damaged_broken_red.gif'),
    heal: require('../assets/images/runners/athlet/damaged/athlet_damaged_heal_red.gif'),
    collision: {
        east: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_east_red.gif'),
        west: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_west_red.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/damaged/athlet_damaged_destoyed_red.gif'),
    fly: require('../assets/images/runners/athlet/damaged/athlet_damaged_fly_red.gif'),
    gotShot: require('../assets/images/runners/athlet/damaged/athlet_damaged_got_shot_red.gif'),
    idle: require('../assets/images/runners/athlet/damaged/athlet_damaged_idle_red.gif'),
    move: {
        northEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-east_red.gif'),
        northWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-west_red.gif'),
        north: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north_red.gif'),
        southEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-east_red.gif'),
        southWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-west_red.gif'),
    },
};

const athletDamagedBlue = {
    attack: {
        northEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-east_blue.gif'),
        northWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-west_blue.gif'),
        north: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north_blue.gif'),
        southEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-east_blue.gif'),
        southWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-west_blue.gif'),
    },
    avatar: require('../assets/images/runners/athlet/damaged/athlet_damaged_avatar_blue.gif'),
    broken: require('../assets/images/runners/athlet/damaged/athlet_damaged_broken_blue.gif'),
    heal: require('../assets/images/runners/athlet/damaged/athlet_damaged_heal_blue.gif'),
    collision: {
        east: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_east_blue.gif'),
        west: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_west_blue.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/damaged/athlet_damaged_destoyed_blue.gif'),
    fly: require('../assets/images/runners/athlet/damaged/athlet_damaged_fly_blue.gif'),
    gotShot: require('../assets/images/runners/athlet/damaged/athlet_damaged_got_shot_blue.gif'),
    idle: require('../assets/images/runners/athlet/damaged/athlet_damaged_idle_blue.gif'),
    move: {
        northEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-east_blue.gif'),
        northWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-west_blue.gif'),
        north: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north_blue.gif'),
        southEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-east_blue.gif'),
        southWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-west_blue.gif'),
    },
};

const athletDamagedGreen = {
    attack: {
        northEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-east_green.gif'),
        northWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-west_green.gif'),
        north: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north_green.gif'),
        southEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-east_green.gif'),
        southWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-west_green.gif'),
    },
    avatar: require('../assets/images/runners/athlet/damaged/athlet_damaged_avatar_green.gif'),
    broken: require('../assets/images/runners/athlet/damaged/athlet_damaged_broken_green.gif'),
    heal: require('../assets/images/runners/athlet/damaged/athlet_damaged_heal_green.gif'),
    collision: {
        east: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_east_green.gif'),
        west: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_west_green.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/damaged/athlet_damaged_destoyed_green.gif'),
    fly: require('../assets/images/runners/athlet/damaged/athlet_damaged_fly_green.gif'),
    gotShot: require('../assets/images/runners/athlet/damaged/athlet_damaged_got_shot_green.gif'),
    idle: require('../assets/images/runners/athlet/damaged/athlet_damaged_idle_green.gif'),
    move: {
        northEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-east_green.gif'),
        northWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-west_green.gif'),
        north: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north_green.gif'),
        southEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-east_green.gif'),
        southWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-west_green.gif'),
    },
};

const athletDamagedYellow = {
    attack: {
        northEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north-west_yellow.gif'),
        north: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_north_yellow.gif'),
        southEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_attack_south-west_yellow.gif'),
    },
    avatar: require('../assets/images/runners/athlet/damaged/athlet_damaged_avatar_yellow.gif'),
    broken: require('../assets/images/runners/athlet/damaged/athlet_damaged_broken_yellow.gif'),
    heal: require('../assets/images/runners/athlet/damaged/athlet_damaged_heal_yellow.gif'),
    collision: {
        east: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_east_yellow.gif'),
        west: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_west_yellow.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/damaged/athlet_damaged_destoyed_yellow.gif'),
    fly: require('../assets/images/runners/athlet/damaged/athlet_damaged_fly_yellow.gif'),
    gotShot: require('../assets/images/runners/athlet/damaged/athlet_damaged_got_shot_yellow.gif'),
    idle: require('../assets/images/runners/athlet/damaged/athlet_damaged_idle_yellow.gif'),
    move: {
        northEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north-west_yellow.gif'),
        north: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_north_yellow.gif'),
        southEast: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/athlet/damaged/athlet_damaged_move_south-west_yellow.gif'),
    },
};

const tankHealthyRed = {
    attack: {
        northEast: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north-east_red.gif'),
        northWest: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north-west_red.gif'),
        north: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north_red.gif'),
        southEast: require('../assets/images/runners/tank/healthy/tank_healthy_attack_south-east_red.gif'),
        southWest: require('../assets/images/runners/tank/healthy/tank_healthy_attack_south-west_red.gif'),
    },
    avatar: require('../assets/images/runners/tank/healthy/tank_healthy_avatar_red.gif'),
    acid: require('../assets/images/runners/tank/healthy/tank_healthy_acid_red.gif'),
    burn: require('../assets/images/runners/tank/healthy/tank_healthy_burn_red.gif'),
    start: require('../assets/images/runners/tank/healthy/tank_healthy_start_red.gif'),
    collision: {
        east: require('../assets/images/runners/tank/healthy/tank_healthy_collision_east_red.gif'),
        west: require('../assets/images/runners/tank/healthy/tank_healthy_collision_west_red.gif'),
    },
    destroyed: require('../assets/images/runners/tank/healthy/tank_healthy_destroyed_red.gif'),
    fly: require('../assets/images/runners/tank/healthy/tank_healthy_fly_red.gif'),
    gotShot: require('../assets/images/runners/tank/healthy/tank_healthy_got_shot_red.gif'),
    idle: require('../assets/images/runners/tank/healthy/tank_healthy_idle_red.gif'),
    move: {
        northEast: require('../assets/images/runners/tank/healthy/tank_healthy_move_north-east_red.gif'),
        northWest: require('../assets/images/runners/tank/healthy/tank_healthy_move_north-west_red.gif'),
        north: require('../assets/images/runners/tank/healthy/tank_healthy_move_north_red.gif'),
        southEast: require('../assets/images/runners/tank/healthy/tank_healthy_move_south-east_red.gif'),
        southWest: require('../assets/images/runners/tank/healthy/tank_healthy_move_south-west_red.gif'),
    },
};

const tankHealthyBlue = {
    attack: {
        northEast: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north-east_blue.gif'),
        northWest: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north-west_blue.gif'),
        north: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north_blue.gif'),
        southEast: require('../assets/images/runners/tank/healthy/tank_healthy_attack_south-east_blue.gif'),
        southWest: require('../assets/images/runners/tank/healthy/tank_healthy_attack_south-west_blue.gif'),
    },
    avatar: require('../assets/images/runners/tank/healthy/tank_healthy_avatar_blue.gif'),
    acid: require('../assets/images/runners/tank/healthy/tank_healthy_acid_blue.gif'),
    burn: require('../assets/images/runners/tank/healthy/tank_healthy_burn_blue.gif'),
    start: require('../assets/images/runners/tank/healthy/tank_healthy_start_blue.gif'),
    collision: {
        east: require('../assets/images/runners/tank/healthy/tank_healthy_collision_east_blue.gif'),
        west: require('../assets/images/runners/tank/healthy/tank_healthy_collision_west_blue.gif'),
    },
    destroyed: require('../assets/images/runners/tank/healthy/tank_healthy_destroyed_blue.gif'),
    fly: require('../assets/images/runners/tank/healthy/tank_healthy_fly_blue.gif'),
    gotShot: require('../assets/images/runners/tank/healthy/tank_healthy_got_shot_blue.gif'),
    idle: require('../assets/images/runners/tank/healthy/tank_healthy_idle_blue.gif'),
    move: {
        northEast: require('../assets/images/runners/tank/healthy/tank_healthy_move_north-east_blue.gif'),
        northWest: require('../assets/images/runners/tank/healthy/tank_healthy_move_north-west_blue.gif'),
        north: require('../assets/images/runners/tank/healthy/tank_healthy_move_north_blue.gif'),
        southEast: require('../assets/images/runners/tank/healthy/tank_healthy_move_south-east_blue.gif'),
        southWest: require('../assets/images/runners/tank/healthy/tank_healthy_move_south-west_blue.gif'),
    },
};

const tankHealthyGreen = {
    attack: {
        northEast: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north-east_green.gif'),
        northWest: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north-west_green.gif'),
        north: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north_green.gif'),
        southEast: require('../assets/images/runners/tank/healthy/tank_healthy_attack_south-east_green.gif'),
        southWest: require('../assets/images/runners/tank/healthy/tank_healthy_attack_south-west_green.gif'),
    },
    avatar: require('../assets/images/runners/tank/healthy/tank_healthy_avatar_green.gif'),
    acid: require('../assets/images/runners/tank/healthy/tank_healthy_acid_green.gif'),
    burn: require('../assets/images/runners/tank/healthy/tank_healthy_burn_green.gif'),
    start: require('../assets/images/runners/tank/healthy/tank_healthy_start_green.gif'),
    collision: {
        east: require('../assets/images/runners/tank/healthy/tank_healthy_collision_east_green.gif'),
        west: require('../assets/images/runners/tank/healthy/tank_healthy_collision_west_green.gif'),
    },
    destroyed: require('../assets/images/runners/tank/healthy/tank_healthy_destroyed_green.gif'),
    fly: require('../assets/images/runners/tank/healthy/tank_healthy_fly_green.gif'),
    gotShot: require('../assets/images/runners/tank/healthy/tank_healthy_got_shot_green.gif'),
    idle: require('../assets/images/runners/tank/healthy/tank_healthy_idle_green.gif'),
    move: {
        northEast: require('../assets/images/runners/tank/healthy/tank_healthy_move_north-east_green.gif'),
        northWest: require('../assets/images/runners/tank/healthy/tank_healthy_move_north-west_green.gif'),
        north: require('../assets/images/runners/tank/healthy/tank_healthy_move_north_green.gif'),
        southEast: require('../assets/images/runners/tank/healthy/tank_healthy_move_south-east_green.gif'),
        southWest: require('../assets/images/runners/tank/healthy/tank_healthy_move_south-west_green.gif'),
    },
};

const tankHealthyYellow = {
    attack: {
        northEast: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north-west_yellow.gif'),
        north: require('../assets/images/runners/tank/healthy/tank_healthy_attack_north_yellow.gif'),
        southEast: require('../assets/images/runners/tank/healthy/tank_healthy_attack_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/tank/healthy/tank_healthy_attack_south-west_yellow.gif'),
    },
    avatar: require('../assets/images/runners/tank/healthy/tank_healthy_avatar_yellow.gif'),
    acid: require('../assets/images/runners/tank/healthy/tank_healthy_acid_yellow.gif'),
    burn: require('../assets/images/runners/tank/healthy/tank_healthy_burn_yellow.gif'),
    start: require('../assets/images/runners/tank/healthy/tank_healthy_start_yellow.gif'),
    collision: {
        east: require('../assets/images/runners/tank/healthy/tank_healthy_collision_east_yellow.gif'),
        west: require('../assets/images/runners/tank/healthy/tank_healthy_collision_west_yellow.gif'),
    },
    destroyed: require('../assets/images/runners/tank/healthy/tank_healthy_destroyed_yellow.gif'),
    fly: require('../assets/images/runners/tank/healthy/tank_healthy_fly_yellow.gif'),
    gotShot: require('../assets/images/runners/tank/healthy/tank_healthy_got_shot_yellow.gif'),
    idle: require('../assets/images/runners/tank/healthy/tank_healthy_idle_yellow.gif'),
    move: {
        northEast: require('../assets/images/runners/tank/healthy/tank_healthy_move_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/tank/healthy/tank_healthy_move_north-west_yellow.gif'),
        north: require('../assets/images/runners/tank/healthy/tank_healthy_move_north_yellow.gif'),
        southEast: require('../assets/images/runners/tank/healthy/tank_healthy_move_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/tank/healthy/tank_healthy_move_south-west_yellow.gif'),
    },
};

const tankDamagedRed = {
    attack: {
        northEast: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north-east_red.gif'),
        northWest: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north-west_red.gif'),
        north: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north_red.gif'),
        southEast: require('../assets/images/runners/tank/damaged/tank_damaged_attack_south-east_red.gif'),
        southWest: require('../assets/images/runners/tank/damaged/tank_damaged_attack_south-west_red.gif'),
    },
    avatar: require('../assets/images/runners/tank/damaged/tank_damaged_avatar_red.gif'),
    broken: require('../assets/images/runners/tank/damaged/tank_damaged_broken_red.gif'),
    heal: require('../assets/images/runners/tank/damaged/tank_damaged_heal_red.gif'),
    collision: {
        east: require('../assets/images/runners/tank/damaged/tank_damaged_collision_east_red.gif'),
        west: require('../assets/images/runners/tank/damaged/tank_damaged_collision_west_red.gif'),
    },
    destroyed: require('../assets/images/runners/tank/damaged/tank_damaged_destroyed_red.gif'),
    fly: require('../assets/images/runners/tank/damaged/tank_damaged_fly_red.gif'),
    gotShot: require('../assets/images/runners/tank/damaged/tank_damaged_got_shot_red.gif'),
    idle: require('../assets/images/runners/tank/damaged/tank_damaged_idle_red.gif'),
    move: {
        northEast: require('../assets/images/runners/tank/damaged/tank_damaged_move_north-east_red.gif'),
        northWest: require('../assets/images/runners/tank/damaged/tank_damaged_move_north-west_red.gif'),
        north: require('../assets/images/runners/tank/damaged/tank_damaged_move_north_red.gif'),
        southEast: require('../assets/images/runners/tank/damaged/tank_damaged_move_south-east_red.gif'),
        southWest: require('../assets/images/runners/tank/damaged/tank_damaged_move_south-west_red.gif'),
    },
};

const tankDamagedBlue = {
    attack: {
        northEast: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north-east_blue.gif'),
        northWest: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north-west_blue.gif'),
        north: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north_blue.gif'),
        southEast: require('../assets/images/runners/tank/damaged/tank_damaged_attack_south-east_blue.gif'),
        southWest: require('../assets/images/runners/tank/damaged/tank_damaged_attack_south-west_blue.gif'),
    },
    avatar: require('../assets/images/runners/tank/damaged/tank_damaged_avatar_blue.gif'),
    broken: require('../assets/images/runners/tank/damaged/tank_damaged_broken_blue.gif'),
    heal: require('../assets/images/runners/tank/damaged/tank_damaged_heal_blue.gif'),
    collision: {
        east: require('../assets/images/runners/tank/damaged/tank_damaged_collision_east_blue.gif'),
        west: require('../assets/images/runners/tank/damaged/tank_damaged_collision_west_blue.gif'),
    },
    destroyed: require('../assets/images/runners/tank/damaged/tank_damaged_destroyed_blue.gif'),
    fly: require('../assets/images/runners/tank/damaged/tank_damaged_fly_blue.gif'),
    gotShot: require('../assets/images/runners/tank/damaged/tank_damaged_got_shot_blue.gif'),
    idle: require('../assets/images/runners/tank/damaged/tank_damaged_idle_blue.gif'),
    move: {
        northEast: require('../assets/images/runners/tank/damaged/tank_damaged_move_north-east_blue.gif'),
        northWest: require('../assets/images/runners/tank/damaged/tank_damaged_move_north-west_blue.gif'),
        north: require('../assets/images/runners/tank/damaged/tank_damaged_move_north_blue.gif'),
        southEast: require('../assets/images/runners/tank/damaged/tank_damaged_move_south-east_blue.gif'),
        southWest: require('../assets/images/runners/tank/damaged/tank_damaged_move_south-west_blue.gif'),
    },
};

const tankDamagedGreen = {
    attack: {
        northEast: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north-east_green.gif'),
        northWest: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north-west_green.gif'),
        north: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north_green.gif'),
        southEast: require('../assets/images/runners/tank/damaged/tank_damaged_attack_south-east_green.gif'),
        southWest: require('../assets/images/runners/tank/damaged/tank_damaged_attack_south-west_green.gif'),
    },
    avatar: require('../assets/images/runners/tank/damaged/tank_damaged_avatar_green.gif'),
    broken: require('../assets/images/runners/tank/damaged/tank_damaged_broken_green.gif'),
    heal: require('../assets/images/runners/tank/damaged/tank_damaged_heal_green.gif'),
    collision: {
        east: require('../assets/images/runners/tank/damaged/tank_damaged_collision_east_green.gif'),
        west: require('../assets/images/runners/tank/damaged/tank_damaged_collision_west_green.gif'),
    },
    destroyed: require('../assets/images/runners/tank/damaged/tank_damaged_destroyed_green.gif'),
    fly: require('../assets/images/runners/tank/damaged/tank_damaged_fly_green.gif'),
    gotShot: require('../assets/images/runners/tank/damaged/tank_damaged_got_shot_green.gif'),
    idle: require('../assets/images/runners/tank/damaged/tank_damaged_idle_green.gif'),
    move: {
        northEast: require('../assets/images/runners/tank/damaged/tank_damaged_move_north-east_green.gif'),
        northWest: require('../assets/images/runners/tank/damaged/tank_damaged_move_north-west_green.gif'),
        north: require('../assets/images/runners/tank/damaged/tank_damaged_move_north_green.gif'),
        southEast: require('../assets/images/runners/tank/damaged/tank_damaged_move_south-east_green.gif'),
        southWest: require('../assets/images/runners/tank/damaged/tank_damaged_move_south-west_green.gif'),
    },
};

const tankDamagedYellow = {
    attack: {
        northEast: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north-west_yellow.gif'),
        north: require('../assets/images/runners/tank/damaged/tank_damaged_attack_north_yellow.gif'),
        southEast: require('../assets/images/runners/tank/damaged/tank_damaged_attack_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/tank/damaged/tank_damaged_attack_south-west_yellow.gif'),
    },
    avatar: require('../assets/images/runners/tank/damaged/tank_damaged_avatar_yellow.gif'),
    broken: require('../assets/images/runners/tank/damaged/tank_damaged_broken_yellow.gif'),
    heal: require('../assets/images/runners/tank/damaged/tank_damaged_heal_yellow.gif'),
    collision: {
        east: require('../assets/images/runners/tank/damaged/tank_damaged_collision_east_yellow.gif'),
        west: require('../assets/images/runners/tank/damaged/tank_damaged_collision_west_yellow.gif'),
    },
    destroyed: require('../assets/images/runners/tank/damaged/tank_damaged_destroyed_yellow.gif'),
    fly: require('../assets/images/runners/tank/damaged/tank_damaged_fly_yellow.gif'),
    gotShot: require('../assets/images/runners/tank/damaged/tank_damaged_got_shot_yellow.gif'),
    idle: require('../assets/images/runners/tank/damaged/tank_damaged_idle_yellow.gif'),
    move: {
        northEast: require('../assets/images/runners/tank/damaged/tank_damaged_move_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/tank/damaged/tank_damaged_move_north-west_yellow.gif'),
        north: require('../assets/images/runners/tank/damaged/tank_damaged_move_north_yellow.gif'),
        southEast: require('../assets/images/runners/tank/damaged/tank_damaged_move_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/tank/damaged/tank_damaged_move_south-west_yellow.gif'),
    },
};

// Жнец (RUNNER_TYPES.REAPER) — папка ассетов "drone" (художественное имя,
// как "scout" у Спринтера — не переименовывалось). У Жнеца НЕТ отдельного
// повреждённого статуса (бэк не даёт по нему стрелять — StepShootValidator
// блокирует Reaper как цель, — и своего "damaged"-набора ассетов
// пользователь не добавлял), поэтому healthy/damaged ниже в
// RUNNER_ANIMATION_SETS указывают на ОДИН и тот же набор — statusFolder()
// не пришлось трогать. `move` содержит ВСЕ 8 направлений (не только 5, как у
// обычных бегунов) — north/northEast/northWest/southEast/southWest используются
// (потенциально, бэк пока не поддерживает повторное перемещение уже
// стоящего Жнеца — см. CLAUDE.md) как обычный шаг, а east/west — под
// "прилёт из-за края трассы" при ПЕРВОЙ установке (см. handleReaperPlacement
// в lib/runnerAnimTriggers.js — там же решается, с какой стороны). `attack`
// — только 3 "вперёд" направления (n/ne/nw), Жнец стреляет строго по ходу
// дороги. `bomb` — ловушка: Жнец играет эту анимацию у СЕБЯ, когда другой
// бегун заканчивает ход на его клетке (см. getWorsenedDamageRunnerId-подобная
// эвристика в runnerAnimTriggers.js).
const droneRed = {
    attack: {
        northEast: require('../assets/images/runners/drone/drone_attack_north-east_red.gif'),
        northWest: require('../assets/images/runners/drone/drone_attack_north-west_red.gif'),
        north: require('../assets/images/runners/drone/drone_attack_north_red.gif'),
    },
    avatar: require('../assets/images/runners/drone/drone_avatar_red.gif'),
    bomb: require('../assets/images/runners/drone/drone_bomb_red.gif'),
    idle: require('../assets/images/runners/drone/drone_idle_red.gif'),
    move: {
        east: require('../assets/images/runners/drone/drone_move_east_red.gif'),
        northEast: require('../assets/images/runners/drone/drone_move_north-east_red.gif'),
        northWest: require('../assets/images/runners/drone/drone_move_north-west_red.gif'),
        north: require('../assets/images/runners/drone/drone_move_north_red.gif'),
        southEast: require('../assets/images/runners/drone/drone_move_south-east_red.gif'),
        southWest: require('../assets/images/runners/drone/drone_move_south-west_red.gif'),
        south: require('../assets/images/runners/drone/drone_move_south_red.gif'),
        west: require('../assets/images/runners/drone/drone_move_west_red.gif'),
    },
};

const droneBlue = {
    attack: {
        northEast: require('../assets/images/runners/drone/drone_attack_north-east_blue.gif'),
        northWest: require('../assets/images/runners/drone/drone_attack_north-west_blue.gif'),
        north: require('../assets/images/runners/drone/drone_attack_north_blue.gif'),
    },
    avatar: require('../assets/images/runners/drone/drone_avatar_blue.gif'),
    bomb: require('../assets/images/runners/drone/drone_bomb_blue.gif'),
    idle: require('../assets/images/runners/drone/drone_idle_blue.gif'),
    move: {
        east: require('../assets/images/runners/drone/drone_move_east_blue.gif'),
        northEast: require('../assets/images/runners/drone/drone_move_north-east_blue.gif'),
        northWest: require('../assets/images/runners/drone/drone_move_north-west_blue.gif'),
        north: require('../assets/images/runners/drone/drone_move_north_blue.gif'),
        southEast: require('../assets/images/runners/drone/drone_move_south-east_blue.gif'),
        southWest: require('../assets/images/runners/drone/drone_move_south-west_blue.gif'),
        south: require('../assets/images/runners/drone/drone_move_south_blue.gif'),
        west: require('../assets/images/runners/drone/drone_move_west_blue.gif'),
    },
};

const droneGreen = {
    attack: {
        northEast: require('../assets/images/runners/drone/drone_attack_north-east_green.gif'),
        northWest: require('../assets/images/runners/drone/drone_attack_north-west_green.gif'),
        north: require('../assets/images/runners/drone/drone_attack_north_green.gif'),
    },
    avatar: require('../assets/images/runners/drone/drone_avatar_green.gif'),
    bomb: require('../assets/images/runners/drone/drone_bomb_green.gif'),
    idle: require('../assets/images/runners/drone/drone_idle_green.gif'),
    move: {
        east: require('../assets/images/runners/drone/drone_move_east_green.gif'),
        northEast: require('../assets/images/runners/drone/drone_move_north-east_green.gif'),
        northWest: require('../assets/images/runners/drone/drone_move_north-west_green.gif'),
        north: require('../assets/images/runners/drone/drone_move_north_green.gif'),
        southEast: require('../assets/images/runners/drone/drone_move_south-east_green.gif'),
        southWest: require('../assets/images/runners/drone/drone_move_south-west_green.gif'),
        south: require('../assets/images/runners/drone/drone_move_south_green.gif'),
        west: require('../assets/images/runners/drone/drone_move_west_green.gif'),
    },
};

const droneYellow = {
    attack: {
        northEast: require('../assets/images/runners/drone/drone_attack_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/drone/drone_attack_north-west_yellow.gif'),
        north: require('../assets/images/runners/drone/drone_attack_north_yellow.gif'),
    },
    avatar: require('../assets/images/runners/drone/drone_avatar_yellow.gif'),
    bomb: require('../assets/images/runners/drone/drone_bomb_yellow.gif'),
    idle: require('../assets/images/runners/drone/drone_idle_yellow.gif'),
    move: {
        east: require('../assets/images/runners/drone/drone_move_east_yellow.gif'),
        northEast: require('../assets/images/runners/drone/drone_move_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/drone/drone_move_north-west_yellow.gif'),
        north: require('../assets/images/runners/drone/drone_move_north_yellow.gif'),
        southEast: require('../assets/images/runners/drone/drone_move_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/drone/drone_move_south-west_yellow.gif'),
        south: require('../assets/images/runners/drone/drone_move_south_yellow.gif'),
        west: require('../assets/images/runners/drone/drone_move_west_yellow.gif'),
    },
};

// Мяч (RUNNER_TYPES.BALL) — ничейный обструкт-хазард (RunnerBallInitService
// на бэке, playerId всегда null), НЕ игрок, поэтому НЕТ per-player тонировки
// — один фиксированный вид на всю игру. Цвет — magenta (2026-09-08; исходный
// crimson путался с игроком red, промежуточный white пользователь передумал
// на следующий день — "пожалуй лучше magenta"), выбран из 10 предложенных
// вариантов, специально избегая сходства со всеми 4 цветами игроков
// (red/indigo-blue/yellow/green).
// Сгенерированы ВСЕ 10 кандидатов на диске (obstacle_*_{crimson,orange,gold,
// lime,teal,indigo,violet,magenta,silver,white}.gif) — если понадобится
// сменить ещё раз, достаточно поменять суффикс ниже, картинки уже готовы,
// перегенерировать не нужно. Нет move/attack — мяч не двигается и не
// стреляет сам, только idle/fly (перелёт при столкновении)/collision (пара
// при столкновении с бегуном)/destroyed (после разрешения)/start (момент
// появления из danger-клетки). Один и тот же набор во ВСЕХ 4 цветовых слотах
// — RunnerToken всё равно резолвит colorKeyForHex(color) для КАКОГО-ТО ключа
// (ball token красится в hex, который не совпадает ни с одним
// PLAYER_COLOR_HEX, colorKeyForHex упадёт в дефолтный 'blue' — не важно, все
// 4 слота отдают один и тот же файл).
const ballFixed = {
    idle: require('../assets/images/runners/obstacle/obstacle_idle_magenta.gif'),
    fly: require('../assets/images/runners/obstacle/obstacle_fly_magenta.gif'),
    destroyed: require('../assets/images/runners/obstacle/obstacle_destroyed_magenta.gif'),
    start: require('../assets/images/runners/obstacle/obstacle_start_magenta.gif'),
    collision: {
        east: require('../assets/images/runners/obstacle/obstacle_collision_east_magenta.gif'),
        west: require('../assets/images/runners/obstacle/obstacle_collision_west_magenta.gif'),
    },
};

export const RUNNER_ANIMATION_SETS = {
    [RUNNER_TYPES.BALL]: {
        healthy: { red: ballFixed, blue: ballFixed, green: ballFixed, yellow: ballFixed },
        damaged: { red: ballFixed, blue: ballFixed, green: ballFixed, yellow: ballFixed },
    },
    [RUNNER_TYPES.REAPER]: {
        healthy: { red: droneRed, blue: droneBlue, green: droneGreen, yellow: droneYellow },
        damaged: { red: droneRed, blue: droneBlue, green: droneGreen, yellow: droneYellow },
    },
    [RUNNER_TYPES.SPRINTER]: {
        healthy: {
            red: scoutHealthyRed,
            blue: scoutHealthyBlue,
            green: scoutHealthyGreen,
            yellow: scoutHealthyYellow,
        },
        damaged: {
            red: scoutDamagedRed,
            blue: scoutDamagedBlue,
            green: scoutDamagedGreen,
            yellow: scoutDamagedYellow,
        },
    },
    [RUNNER_TYPES.ATHLETE]: {
        healthy: {
            red: athletHealthyRed,
            blue: athletHealthyBlue,
            green: athletHealthyGreen,
            yellow: athletHealthyYellow,
        },
        damaged: {
            red: athletDamagedRed,
            blue: athletDamagedBlue,
            green: athletDamagedGreen,
            yellow: athletDamagedYellow,
        },
    },
    [RUNNER_TYPES.TANK]: {
        healthy: {
            red: tankHealthyRed,
            blue: tankHealthyBlue,
            green: tankHealthyGreen,
            yellow: tankHealthyYellow,
        },
        damaged: {
            red: tankDamagedRed,
            blue: tankDamagedBlue,
            green: tankDamagedGreen,
            yellow: tankDamagedYellow,
        },
    },
};

/** hex (PLAYER_COLOR_HEX) -> ключ цвета ('red'/'blue'/'green'/'yellow') для выбора готового перекрашенного ассета. */
const HEX_TO_COLOR_KEY = Object.fromEntries(Object.entries(PLAYER_COLOR_HEX).map(([key, hex]) => [hex, key]));
export function colorKeyForHex(hex) {
    return HEX_TO_COLOR_KEY[hex] ?? 'blue';
}

/**
 * Игровое направление (DirectionService, см. lib/hexDirection.js) → ключ в
 * move/attack выше. Единственная точка, где решается, какой ассет играть —
 * ХОДЬБА И СТРЕЛЬБА используют её ОДИНАКОВО (см. историю в CLAUDE.md,
 * 2026-09-01: раньше стрельба ошибочно была исключена).
 *
 * Два независимых нюанса геометрии (см. подробный разбор в CLAUDE.md):
 *  1) LEFT_UP/RIGHT_UP не совпадают с "визуально влево/вправо" — сопоставлено
 *     по факту видимого направления на реальном устройстве.
 *  2) LEFT_UP/RIGHT_UP не всегда "вверх по экрану" — при чётной старой
 *     глубине это чисто боковой шаг/прицел на смещённую "кирпичом" дорожку
 *     без продвижения (south-*), при нечётной — диагональ вперёд (north-*).
 */
export function resolveMoveAssetDirection(direction, depthChanged, targetLaneShifted) {
    if (direction === 'UP') return 'north';
    const isEast = direction === 'LEFT_UP';
    if (depthChanged) return isEast ? 'northEast' : 'northWest';
    if (targetLaneShifted) return isEast ? 'southEast' : 'southWest';
    return isEast ? 'northEast' : 'northWest';
}

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
 * Единственный require()-ассет (не {base,mask} — см. доку выше) для текущего
 * анимационного состояния бегуна на доске, уже перекрашенный в цвет игрока.
 * `anim` — { kind: 'move'|'attack'|'fly'|'gotShot'|'destroyed'|'collision', direction?, side?, fromStatus? } | null (idle).
 * `colorKey` — 'red'|'blue'|'green'|'yellow' (см. colorKeyForHex выше).
 * Возвращает null, если для этого типа нет набора анимаций вообще — вызывающий
 * код (RunnerToken) тогда откатывается на старую статичную иконку.
 */
export function getRunnerAnimationImage(type, status, anim, colorKey) {
    const set = RUNNER_ANIMATION_SETS[type];
    if (!set) return null;
    const colorSet = set[statusFolder(status)];
    const bucket = colorSet[colorKey] ?? colorSet.blue;

    // 'destroyed' — терминальное состояние: используем набор ТОГО статуса, в
    // котором бегун был непосредственно перед уничтожением (fromStatus).
    if (anim?.kind === 'destroyed') {
        const destroyedBucket = (set[statusFolder(anim.fromStatus ?? status)][colorKey]) ?? bucket;
        return destroyedBucket.destroyed;
    }
    // 'heal' — анимация лечения (2026-09-12): ассет лежит в ДАМАЖ-наборе
    // (визуально это переход damaged→healthy), но к моменту, когда триггерится
    // эта анимация, реальный game-стейт (ability_heal уже применён редьюсером)
    // отражает НОВЫЙ статус — обычно уже healthy. Раз statusFolder(status) в
    // этот момент дал бы healthy-бакет (там heal-ассета нет), берём damaged-
    // бакет НАПРЯМУЮ, а не через текущий статус.
    if (anim?.kind === 'heal') {
        return set.damaged[colorKey]?.heal ?? bucket.idle;
    }
    // 'burn'/'acid' — терминальная поза уничтожения при столкновении со
    // "смертью" на клетке типа wall (см. GameBoardScreen — механика Death,
    // 2026-09-12) — САМА ПО СЕБЕ служит финальной позой (по прямому решению
    // пользователя отдельная 'destroyed' после неё не нужна). Ассетов под
    // damaged-статус пользователь не добавлял (итог всё равно уничтожение,
    // текущий статус бегуна в этот момент не важен) — ВСЕГДА берём healthy-
    // бакет, независимо от statusFolder(status).
    if (anim?.kind === 'burn' || anim?.kind === 'acid') {
        return set.healthy[colorKey]?.[anim.kind] ?? bucket.idle;
    }

    if (!anim || anim.kind === 'idle') {
        if (status === RUNNER_STATUS.BROKEN) return bucket.broken;
        if (status === RUNNER_STATUS.DESTROYED) return bucket.destroyed;
        return bucket.idle;
    }
    if (anim.kind === 'move') {
        const dirKey = resolveMoveAssetDirection(anim.direction, anim.depthChanged, anim.targetLaneShifted);
        return bucket.move?.[dirKey] ?? bucket.idle;
    }
    if (anim.kind === 'attack') {
        const dirKey = resolveMoveAssetDirection(anim.direction, anim.depthChanged, anim.targetLaneShifted);
        return bucket.attack?.[dirKey] ?? bucket.idle;
    }
    if (anim.kind === 'fly') return bucket.fly ?? bucket.idle;
    if (anim.kind === 'gotShot') return bucket.gotShot ?? bucket.idle;
    if (anim.kind === 'collision') return bucket.collision?.[anim.side] ?? bucket.idle;
    // 'start' — для обычных бегунов (bucket.start, только healthy-статус —
    // выход из резерва всегда со здоровым бегуном). У Жнеца своего start-ассета
    // нет — первая установка вместо этого "прилетает" сбоку (anim.side —
    // 'east'|'west', см. handleReaperPlacement в lib/runnerAnimTriggers.js),
    // переиспользуем move.east/move.west из ЕГО набора направлений.
    if (anim.kind === 'start') return bucket.start ?? bucket.move?.[anim.side] ?? bucket.idle;
    // 'bomb' — ловушка Жнеца: он сам проигрывает эту анимацию у себя, когда
    // другой бегун заканчивает ход на его клетке (см. lib/runnerAnimTriggers.js).
    if (anim.kind === 'bomb') return bucket.bomb ?? bucket.idle;
    return bucket.idle;
}

/** Единственный require()-ассет для карточки бегуна в панели игрока (RunnerCard) — всегда avatar, без анимационного стейта. */
export function getRunnerAvatarImage(type, status, colorKey) {
    const set = RUNNER_ANIMATION_SETS[type];
    if (!set) return null;
    const colorSet = set[statusFolder(status)];
    const bucket = colorSet[colorKey] ?? colorSet.blue;
    return bucket.avatar;
}
