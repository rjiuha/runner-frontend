// src/constants/runnerSounds.js
import { RUNNER_TYPES } from './GameConstants';

/**
 * Озвучка бегунов — 2026-09-03, реструктурировано 2026-10-14 (по прямому
 * запросу пользователя — папки по ТИПУ бегуна мешали в одну кучу voice-
 * реплики и action-звуки одного и того же регулятора громкости). Теперь
 * voice-реплики (active/damagedActive) лежат в assets/sounds/voice/<type>/,
 * шаги/выстрелы/появление (move/shoot/start) — в assets/sounds/action/<type>/
 * (та же сама on-disk структура, что и у audioSettings-каналов, см. её
 * докстринг). См. lib/runnerSoundTriggers.js за тем, ЧТО именно триггерит
 * каждую из этих категорий.
 *
 * Набор ассетов НЕСИММЕТРИЧЕН между типами (не все типы имеют все категории):
 *  - move есть у ВСЕХ движущихся типов (Скаут/Атлет/Танк/Жнец) — у Атлета
 *    (папка "athlet", RUNNER_TYPES.ATHLETE) своего звука шага не было до
 *    2026-10-14, пользователь добавил athlet_move.mp3, старый пробел
 *    (fallback на lazer.mp3) закрыт. FALLBACK_MOVE_SOUND остался только как
 *    безопасный плейсхолдер для начального значения useAudioPlayer в
 *    GameBoardScreen (до того, как известен тип реально двигающегося
 *    бегуна) — по факту каждый реальный тип всегда находит свой move.
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
            require('../assets/sounds/voice/scout/scout_active_1.wav'),
            require('../assets/sounds/voice/scout/scout_active_2.wav'),
            require('../assets/sounds/voice/scout/scout_active_3.wav'),
        ],
        damagedActive: [
            require('../assets/sounds/voice/scout/scout_damaged_1.wav'),
            require('../assets/sounds/voice/scout/scout_damaged_2.wav'),
            require('../assets/sounds/voice/scout/scout_damaged_3.wav'),
        ],
        move: require('../assets/sounds/action/scout/scout_move.wav'),
        shoot: [require('../assets/sounds/action/scout/scout_shoot.mp3')],
    },
    [RUNNER_TYPES.ATHLETE]: {
        active: [
            require('../assets/sounds/voice/athlet/athlet_active_1.mp3'),
            require('../assets/sounds/voice/athlet/athlet_active_2.mp3'),
            require('../assets/sounds/voice/athlet/athlet_active_3.mp3'),
        ],
        damagedActive: [
            require('../assets/sounds/voice/athlet/athlet_damaged_active_1.mp3'),
            require('../assets/sounds/voice/athlet/athlet_damaged_active_2.mp3'),
            require('../assets/sounds/voice/athlet/athlet_damaged_active_3.mp3'),
        ],
        shoot: [require('../assets/sounds/action/athlet/athlet_shoot_1.mp3')],
        // move — добавлен пользователем (athlet_move.mp3), закрывает старый
        // пробел (раньше у Атлета не было своего шага, см. FALLBACK_MOVE_SOUND).
        move: require('../assets/sounds/action/athlet/athlet_move.mp3'),
    },
    [RUNNER_TYPES.TANK]: {
        active: [
            require('../assets/sounds/voice/tank/tank_active_1.wav'),
            require('../assets/sounds/voice/tank/tank_active_2.wav'),
            require('../assets/sounds/voice/tank/tank_active_3.wav'),
        ],
        damagedActive: [
            require('../assets/sounds/voice/tank/tank_damaged_active_1.wav'),
            require('../assets/sounds/voice/tank/tank_damaged_active_2.wav'),
        ],
        move: require('../assets/sounds/action/tank/tank_move.wav'),
        shoot: [require('../assets/sounds/action/tank/tank_shoot_1.mp3')],
    },
    [RUNNER_TYPES.REAPER]: {
        move: require('../assets/sounds/action/drone/drone_move.wav'),
        shoot: [require('../assets/sounds/action/drone/drone_shoot.mp3')],
        start: require('../assets/sounds/action/drone/drone_start.wav'),
    },
    [RUNNER_TYPES.BALL]: {
        start: require('../assets/sounds/action/obstacle/obstacle_start.wav'),
    },
};

/** Общий звук столкновения (не привязан к типу) — играет ВСЕМ клиентам одновременно, см. GameBoardScreen. */
export const COLLISION_SOUND = require('../assets/sounds/action/common/collision.wav');

/** Плейсхолдер начального значения useAudioPlayer (см. доку выше) — по факту сейчас не подменяет ничей move. */
export const FALLBACK_MOVE_SOUND = require('../assets/sounds/action/scout/scout_move.wav');

/** Случайный элемент массива — используется для voice-реплик (active/damagedActive) и shoot (когда вариантов >1). */
export function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
