// src/constants/runnerSounds.js
import { RUNNER_TYPES } from './GameConstants';

/**
 * Озвучка бегунов, добавлена пользователем в assets/sounds/{scout,tank,
 * athlet,drone,obstacle}/ + общий assets/sounds/collision.wav — 2026-09-03.
 * См. lib/runnerSoundTriggers.js за тем, ЧТО именно триггерит каждую из
 * этих категорий (voice-реплика/шаг/выстрел/появление/столкновение).
 *
 * Набор ассетов НЕСИММЕТРИЧЕН между типами (не все типы имеют все категории):
 *  - move.wav есть только у Скаута/Танка(=RUNNER_TYPES.TANK)/Жнеца — у
 *    Атлета (папка "athlet", RUNNER_TYPES.ATHLETE) своего звука шага нет
 *    вообще, для него используется общий FALLBACK_MOVE_SOUND (тот же
 *    lazer.mp3, что раньше был звуком шага для ВСЕХ типов до этой правки).
 *  - voice-реплики (active/damagedActive) есть только у 3 обычных бегунов
 *    (Скаут/Атлет/Танк) — у Жнеца и Мяча их нет вообще (ability-based
 *    юниты, не участвуют в обычном SELECT).
 *  - у Скаута damaged-реплики названы БЕЗ "_active_" в файле (scout_damaged_N,
 *    не scout_damaged_active_N, как у Атлета/Танка) — учтено при require().
 *  - у Танка(RUNNER_TYPES.TANK) damaged-реплик только 2 (не 3, как у Скаута/Атлета).
 *  - shoot есть у ВСЕХ 4 "стреляющих" типов (Скаут/Атлет/Танк/Жнец) — Мяч
 *    не стреляет, shoot для него не нужен.
 *  - start (звук появления) есть только у Жнеца (прилёт сбоку) и Мяча
 *    (появление из danger-клетки) — обычные бегуны выходят из резерва без
 *    отдельного звука (только визуальный "start"-gif, см.
 *    constants/runnerAnimations).
 */
export const RUNNER_SOUNDS = {
    [RUNNER_TYPES.SPRINTER]: {
        active: [
            require('../assets/sounds/scout/scout_active_1.wav'),
            require('../assets/sounds/scout/scout_active_2.wav'),
            require('../assets/sounds/scout/scout_active_3.wav'),
        ],
        damagedActive: [
            require('../assets/sounds/scout/scout_damaged_1.wav'),
            require('../assets/sounds/scout/scout_damaged_2.wav'),
            require('../assets/sounds/scout/scout_damaged_3.wav'),
        ],
        move: require('../assets/sounds/scout/scout_move.wav'),
        shoot: [require('../assets/sounds/scout/scout_shoot.wav')],
    },
    [RUNNER_TYPES.ATHLETE]: {
        active: [
            require('../assets/sounds/athlet/athlet_active_1.mp3'),
            require('../assets/sounds/athlet/athlet_active_2.mp3'),
            require('../assets/sounds/athlet/athlet_active_3.mp3'),
        ],
        damagedActive: [
            require('../assets/sounds/athlet/athlet_damaged_active_1.mp3'),
            require('../assets/sounds/athlet/athlet_damaged_active_2.mp3'),
            require('../assets/sounds/athlet/athlet_damaged_active_3.mp3'),
        ],
        shoot: [require('../assets/sounds/athlet/athlet_shoot_1.mp3')],
        // move — нет, см. доку выше, использует FALLBACK_MOVE_SOUND.
    },
    [RUNNER_TYPES.TANK]: {
        active: [
            require('../assets/sounds/tank/tank_active_1.wav'),
            require('../assets/sounds/tank/tank_active_2.wav'),
            require('../assets/sounds/tank/tank_active_3.wav'),
        ],
        damagedActive: [
            require('../assets/sounds/tank/tank_damaged_active_1.wav'),
            require('../assets/sounds/tank/tank_damaged_active_2.wav'),
        ],
        move: require('../assets/sounds/tank/tank_move.wav'),
        shoot: [require('../assets/sounds/tank/tank_shoot.wav')],
    },
    [RUNNER_TYPES.REAPER]: {
        move: require('../assets/sounds/drone/drone_move.wav'),
        shoot: [require('../assets/sounds/drone/drone_shoot.wav')],
        start: require('../assets/sounds/drone/drone_start.wav'),
    },
    [RUNNER_TYPES.BALL]: {
        start: require('../assets/sounds/obstacle/obstacle_start.wav'),
    },
};

/** Общий звук столкновения (не привязан к типу) — играет ВСЕМ клиентам одновременно, см. GameBoardScreen. */
export const COLLISION_SOUND = require('../assets/sounds/collision.wav');

/** Заменяет отсутствующий move-звук у типа (сейчас — только Атлет/ATHLETE, см. доку выше). */
export const FALLBACK_MOVE_SOUND = require('../assets/sounds/lazer.mp3');

/** Случайный элемент массива — используется для voice-реплик (active/damagedActive) и shoot (когда вариантов >1). */
export function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
