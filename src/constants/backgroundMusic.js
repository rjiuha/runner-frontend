// src/constants/backgroundMusic.js
/**
 * Фоновая музыка активной игровой сессии — добавлена пользователем в
 * assets/sounds/background_music/, 2026-09-11. Metro не умеет
 * require() по маске/директории целиком (та же причина, по которой
 * SEGMENT_IMAGES/RUNNER_SOUNDS и т.п. — статические массивы require()),
 * поэтому при добавлении новой дорожки в эту папку её нужно ВРУЧНУЮ
 * дописать сюда отдельной строкой.
 */
export const BACKGROUND_MUSIC_TRACKS = [
    require('../assets/sounds/background_music/game_1.mp3'),
    require('../assets/sounds/background_music/game_3.mp3'),
    require('../assets/sounds/background_music/game_4.mp3'),
    require('../assets/sounds/background_music/game_5.mp3'),
];

/**
 * Фоновая музыка меню/лобби (2026-09-19) — играет на MainMenu/LobbySearch/
 * Lobby, останавливается при входе в RunnerGame. См. hooks/useMenuMusic.js.
 */
export const MENU_MUSIC_TRACKS = [
    require('../assets/sounds/background_music/main_menu_1.mp3'),
    require('../assets/sounds/background_music/main_menu_2.mp3'),
];

/**
 * Индекс случайного трека, отличного от excludeIndex (если треков больше
 * одного) — не даёт одной и той же дорожке сыграть дважды подряд.
 */
export function pickRandomTrackIndex(excludeIndex) {
    const count = BACKGROUND_MUSIC_TRACKS.length;
    if (count <= 1) return 0;
    let idx;
    do {
        idx = Math.floor(Math.random() * count);
    } while (idx === excludeIndex);
    return idx;
}
