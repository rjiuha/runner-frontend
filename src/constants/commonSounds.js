// src/constants/commonSounds.js
import { preload } from 'expo-audio';

/**
 * Общие игровые SFX (не привязаны к типу бегуна и не являются голосовым
 * комментарием) — assets/sounds/action/common/, добавлены пользователем
 * 2026-10-14. Канал громкости — action ("Игровые звуки"), см.
 * lib/audioSettings.js.
 *
 * `preload()` на каждый экспорт — см. docstring в constants/uiSounds.js за
 * полным разбором (живая жалоба: звук срабатывает не с первого раза, а со
 * второго — `useAudioPlayer`/`.replace()` грузит исходник асинхронно,
 * `preload()` прогревает его заранее, на уровне модуля).
 */

/** Взрыв мины — синхронно с визуальным mineBlasts.trigger(), см. GameBoardScreen#triggerWithSound. */
export const LAND_MINE_SOUND = require('../assets/sounds/action/common/land_mine.mp3');
preload(LAND_MINE_SOUND);

/**
 * Фоновый эффект гибели на acid/burn-клетке (wall) — играет синхронно с
 * терминальной acid/burn-позой (тот же onStart-момент, что и
 * COMMENT_SOUNDS.destroyed), см. GameBoardScreen#triggerWithSound.
 */
export const RADIATION_SOUND = require('../assets/sounds/action/common/radiation.mp3');
preload(RADIATION_SOUND);

/**
 * Сам SFX удара рикошета (в отличие от COMMENT_SOUNDS.ricochet — это
 * голосовая реплика) — играет ОДНОВРЕМЕННО с ней, см. GameBoardScreen.
 */
export const RICOCHET_HIT_SOUNDS = [
    require('../assets/sounds/action/common/rikochet_1.mp3'),
    require('../assets/sounds/action/common/rikochet_2.mp3'),
];
RICOCHET_HIT_SOUNDS.forEach(preload);
