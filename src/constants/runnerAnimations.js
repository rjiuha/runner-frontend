// src/constants/runnerAnimations.js
import { PLAYER_COLOR_HEX, RUNNER_STATUS, RUNNER_TYPES } from './GameConstants';

/**
 * Ассеты анимаций бегунов — Скаут/Солдат/Атлет (RUNNER_TYPES.SPRINTER/
 * ATHLETE/TANK), добавлены пользователем в assets/images/runners/
 * {scout,trooper,athlet}/{healthy,damaged}/. Жнец пока без набора —
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

const trooperHealthyRed = {
    attack: {
        northEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-east_red.gif'),
        northWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-west_red.gif'),
        north: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north_red.gif'),
        southEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-east_red.gif'),
        southWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-west_red.gif'),
    },
    avatar: require('../assets/images/runners/trooper/healthy/trooper_healthy_avatar_red.gif'),
    collision: {
        east: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_east_red.gif'),
        west: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_west_red.gif'),
    },
    destroyed: require('../assets/images/runners/trooper/healthy/trooper_healthy_destroyed_red.gif'),
    fly: require('../assets/images/runners/trooper/healthy/trooper_healthy_fly_red.gif'),
    gotShot: require('../assets/images/runners/trooper/healthy/trooper_healthy_got_shot_red.gif'),
    idle: require('../assets/images/runners/trooper/healthy/trooper_healthy_idle_red.gif'),
    move: {
        northEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-east_red.gif'),
        northWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-west_red.gif'),
        north: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north_red.gif'),
        southEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-east_red.gif'),
        southWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-west_red.gif'),
    },
};

const trooperHealthyBlue = {
    attack: {
        northEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-east_blue.gif'),
        northWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-west_blue.gif'),
        north: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north_blue.gif'),
        southEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-east_blue.gif'),
        southWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-west_blue.gif'),
    },
    avatar: require('../assets/images/runners/trooper/healthy/trooper_healthy_avatar_blue.gif'),
    collision: {
        east: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_east_blue.gif'),
        west: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_west_blue.gif'),
    },
    destroyed: require('../assets/images/runners/trooper/healthy/trooper_healthy_destroyed_blue.gif'),
    fly: require('../assets/images/runners/trooper/healthy/trooper_healthy_fly_blue.gif'),
    gotShot: require('../assets/images/runners/trooper/healthy/trooper_healthy_got_shot_blue.gif'),
    idle: require('../assets/images/runners/trooper/healthy/trooper_healthy_idle_blue.gif'),
    move: {
        northEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-east_blue.gif'),
        northWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-west_blue.gif'),
        north: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north_blue.gif'),
        southEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-east_blue.gif'),
        southWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-west_blue.gif'),
    },
};

const trooperHealthyGreen = {
    attack: {
        northEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-east_green.gif'),
        northWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-west_green.gif'),
        north: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north_green.gif'),
        southEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-east_green.gif'),
        southWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-west_green.gif'),
    },
    avatar: require('../assets/images/runners/trooper/healthy/trooper_healthy_avatar_green.gif'),
    collision: {
        east: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_east_green.gif'),
        west: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_west_green.gif'),
    },
    destroyed: require('../assets/images/runners/trooper/healthy/trooper_healthy_destroyed_green.gif'),
    fly: require('../assets/images/runners/trooper/healthy/trooper_healthy_fly_green.gif'),
    gotShot: require('../assets/images/runners/trooper/healthy/trooper_healthy_got_shot_green.gif'),
    idle: require('../assets/images/runners/trooper/healthy/trooper_healthy_idle_green.gif'),
    move: {
        northEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-east_green.gif'),
        northWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-west_green.gif'),
        north: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north_green.gif'),
        southEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-east_green.gif'),
        southWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-west_green.gif'),
    },
};

const trooperHealthyYellow = {
    attack: {
        northEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north-west_yellow.gif'),
        north: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_north_yellow.gif'),
        southEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_attack_south-west_yellow.gif'),
    },
    avatar: require('../assets/images/runners/trooper/healthy/trooper_healthy_avatar_yellow.gif'),
    collision: {
        east: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_east_yellow.gif'),
        west: require('../assets/images/runners/trooper/healthy/trooper_healthy_collision_west_yellow.gif'),
    },
    destroyed: require('../assets/images/runners/trooper/healthy/trooper_healthy_destroyed_yellow.gif'),
    fly: require('../assets/images/runners/trooper/healthy/trooper_healthy_fly_yellow.gif'),
    gotShot: require('../assets/images/runners/trooper/healthy/trooper_healthy_got_shot_yellow.gif'),
    idle: require('../assets/images/runners/trooper/healthy/trooper_healthy_idle_yellow.gif'),
    move: {
        northEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north-west_yellow.gif'),
        north: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_north_yellow.gif'),
        southEast: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/trooper/healthy/trooper_healthy_move_south-west_yellow.gif'),
    },
};

const trooperDamagedRed = {
    attack: {
        northEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-east_red.gif'),
        northWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-west_red.gif'),
        north: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north_red.gif'),
        southEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-east_red.gif'),
        southWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-west_red.gif'),
    },
    avatar: require('../assets/images/runners/trooper/damaged/trooper_damaged_avatar_red.gif'),
    broken: require('../assets/images/runners/trooper/damaged/trooper_damaged_broken_red.gif'),
    collision: {
        east: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_east_red.gif'),
        west: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_west_red.gif'),
    },
    destroyed: require('../assets/images/runners/trooper/damaged/trooper_damaged_destoyed_red.gif'),
    fly: require('../assets/images/runners/trooper/damaged/trooper_damaged_fly_red.gif'),
    gotShot: require('../assets/images/runners/trooper/damaged/trooper_damaged_got_shot_red.gif'),
    idle: require('../assets/images/runners/trooper/damaged/trooper_damaged_idle_red.gif'),
    move: {
        northEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-east_red.gif'),
        northWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-west_red.gif'),
        north: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north_red.gif'),
        southEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-east_red.gif'),
        southWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-west_red.gif'),
    },
};

const trooperDamagedBlue = {
    attack: {
        northEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-east_blue.gif'),
        northWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-west_blue.gif'),
        north: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north_blue.gif'),
        southEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-east_blue.gif'),
        southWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-west_blue.gif'),
    },
    avatar: require('../assets/images/runners/trooper/damaged/trooper_damaged_avatar_blue.gif'),
    broken: require('../assets/images/runners/trooper/damaged/trooper_damaged_broken_blue.gif'),
    collision: {
        east: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_east_blue.gif'),
        west: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_west_blue.gif'),
    },
    destroyed: require('../assets/images/runners/trooper/damaged/trooper_damaged_destoyed_blue.gif'),
    fly: require('../assets/images/runners/trooper/damaged/trooper_damaged_fly_blue.gif'),
    gotShot: require('../assets/images/runners/trooper/damaged/trooper_damaged_got_shot_blue.gif'),
    idle: require('../assets/images/runners/trooper/damaged/trooper_damaged_idle_blue.gif'),
    move: {
        northEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-east_blue.gif'),
        northWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-west_blue.gif'),
        north: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north_blue.gif'),
        southEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-east_blue.gif'),
        southWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-west_blue.gif'),
    },
};

const trooperDamagedGreen = {
    attack: {
        northEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-east_green.gif'),
        northWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-west_green.gif'),
        north: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north_green.gif'),
        southEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-east_green.gif'),
        southWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-west_green.gif'),
    },
    avatar: require('../assets/images/runners/trooper/damaged/trooper_damaged_avatar_green.gif'),
    broken: require('../assets/images/runners/trooper/damaged/trooper_damaged_broken_green.gif'),
    collision: {
        east: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_east_green.gif'),
        west: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_west_green.gif'),
    },
    destroyed: require('../assets/images/runners/trooper/damaged/trooper_damaged_destoyed_green.gif'),
    fly: require('../assets/images/runners/trooper/damaged/trooper_damaged_fly_green.gif'),
    gotShot: require('../assets/images/runners/trooper/damaged/trooper_damaged_got_shot_green.gif'),
    idle: require('../assets/images/runners/trooper/damaged/trooper_damaged_idle_green.gif'),
    move: {
        northEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-east_green.gif'),
        northWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-west_green.gif'),
        north: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north_green.gif'),
        southEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-east_green.gif'),
        southWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-west_green.gif'),
    },
};

const trooperDamagedYellow = {
    attack: {
        northEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north-west_yellow.gif'),
        north: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_north_yellow.gif'),
        southEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_attack_south-west_yellow.gif'),
    },
    avatar: require('../assets/images/runners/trooper/damaged/trooper_damaged_avatar_yellow.gif'),
    broken: require('../assets/images/runners/trooper/damaged/trooper_damaged_broken_yellow.gif'),
    collision: {
        east: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_east_yellow.gif'),
        west: require('../assets/images/runners/trooper/damaged/trooper_damaged_collision_west_yellow.gif'),
    },
    destroyed: require('../assets/images/runners/trooper/damaged/trooper_damaged_destoyed_yellow.gif'),
    fly: require('../assets/images/runners/trooper/damaged/trooper_damaged_fly_yellow.gif'),
    gotShot: require('../assets/images/runners/trooper/damaged/trooper_damaged_got_shot_yellow.gif'),
    idle: require('../assets/images/runners/trooper/damaged/trooper_damaged_idle_yellow.gif'),
    move: {
        northEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-east_yellow.gif'),
        northWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north-west_yellow.gif'),
        north: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_north_yellow.gif'),
        southEast: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-east_yellow.gif'),
        southWest: require('../assets/images/runners/trooper/damaged/trooper_damaged_move_south-west_yellow.gif'),
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
    collision: {
        east: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_east_red.gif'),
        west: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_west_red.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/damaged/athlet_damaged_destroyed_red.gif'),
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
    collision: {
        east: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_east_blue.gif'),
        west: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_west_blue.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/damaged/athlet_damaged_destroyed_blue.gif'),
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
    collision: {
        east: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_east_green.gif'),
        west: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_west_green.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/damaged/athlet_damaged_destroyed_green.gif'),
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
    collision: {
        east: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_east_yellow.gif'),
        west: require('../assets/images/runners/athlet/damaged/athlet_damaged_collision_west_yellow.gif'),
    },
    destroyed: require('../assets/images/runners/athlet/damaged/athlet_damaged_destroyed_yellow.gif'),
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

export const RUNNER_ANIMATION_SETS = {
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
            red: trooperHealthyRed,
            blue: trooperHealthyBlue,
            green: trooperHealthyGreen,
            yellow: trooperHealthyYellow,
        },
        damaged: {
            red: trooperDamagedRed,
            blue: trooperDamagedBlue,
            green: trooperDamagedGreen,
            yellow: trooperDamagedYellow,
        },
    },
    [RUNNER_TYPES.TANK]: {
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
    if (anim.kind === 'fly') return bucket.fly;
    if (anim.kind === 'gotShot') return bucket.gotShot;
    if (anim.kind === 'collision') return bucket.collision?.[anim.side] ?? bucket.idle;
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
