// src/constants/uiSounds.js
import { preload } from 'expo-audio';

/**
 * Звуки интерфейса партии (не голос, не музыка) — assets/sounds/action/ui/,
 * добавлены пользователем 2026-10-14. Канал громкости — тот же action
 * ("Игровые звуки"), что и у остальных игровых SFX (см.
 * lib/audioSettings.js) — пользователь сознательно не стал заводить под них
 * отдельный регулятор.
 *
 * `preload()` на каждый экспорт (2026-10-14, живая жалоба пользователя:
 * "звук срабатывает не в первый раз после нажатия, а со второго") —
 * `useAudioPlayer(source)` в местах использования (Button.js и т.п.) грузит
 * исходник АСИНХРОННО; если `.play()` вызвать раньше, чем плеер успел
 * задекодировать его (`player.isLoaded`), первый вызов тихо игнорируется.
 * `preload()` — штатная функция expo-audio ровно под этот случай ("near-
 * instant playback"), вызывается на уровне МОДУЛЯ (до рендера любого
 * компонента, как и требует её докстринг в библиотеке) — к моменту первого
 * реального тапа пользователя источник уже должен быть прогрет.
 */

/** Тоггл панели лога событий (EventLogPanel) — играет на каждое открытие/закрытие. */
export const LOG_TOGGLE_SOUND = require('../assets/sounds/action/ui/log.mp3');
preload(LOG_TOGGLE_SOUND);

/** Переключатель игрока (PlayerSwitchPanel) / кнопка "Готов" в лобби — играет при переходе НА этот слот/состояние. */
export const SWITCH_ON_SOUND = require('../assets/sounds/action/ui/switch_on.mp3');
preload(SWITCH_ON_SOUND);
/** Переключатель игрока / кнопка "Не готов" в лобби — играет при уходе С этого слота/состояния. */
export const SWITCH_OFF_SOUND = require('../assets/sounds/action/ui/switch_off.mp3');
preload(SWITCH_OFF_SOUND);

/** Клик по ЛЮБОЙ кнопке приложения (components/ui/Button.js) — 2026-10-14, по прямому запросу пользователя. */
export const CLICK_SOUND = require('../assets/sounds/action/ui/click.mp3');
preload(CLICK_SOUND);

/** Дроп кубика на карточку бегуна в СВОЙ ход (handleDropOnRunner, GameBoardScreen.js) — 2026-10-14. */
export const RUNNER_PICKED_SOUND = require('../assets/sounds/action/ui/runner_picked.mp3');
preload(RUNNER_PICKED_SOUND);
