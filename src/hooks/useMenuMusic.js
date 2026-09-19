// src/hooks/useMenuMusic.js
import { useCallback, useEffect, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';

import { MENU_MUSIC_TRACKS, pickRandomTrackIndex } from '../constants/backgroundMusic';
import { ROUTES } from '../navigation/routes';

const MENU_MUSIC_VOLUME = 0.1;

// Экраны, на которых должна играть меню-музыка (см. запись 2026-09-19 в
// CLAUDE.md — пользователь выбрал «главное меню + лобби»). RunnerGame сам
// заводит собственный канал (constants/backgroundMusic#BACKGROUND_MUSIC_TRACKS,
// GameBoardScreen), Auth — тишина (до логина музыки быть не должно).
const MENU_MUSIC_ROUTES = new Set([ROUTES.MAIN_MENU, ROUTES.LOBBY_SEARCH, ROUTES.LOBBY]);

/**
 * Фоновая музыка меню/лобби — принимает ИМЯ ТЕКУЩЕГО РОУТА снаружи, а не
 * читает навигацию сама. `useNavigationState`/`useRoute` работают только у
 * компонента, физически рендерящегося ВНУТРИ `<Stack.Navigator>` (тот сам
 * создаёт нужный контекст через useNavigationBuilder) — `RootNavigator`
 * этому условию не удовлетворяет, он этот навигатор ОПРЕДЕЛЯЕТ, а не
 * является его потомком. Поэтому текущий роут отслеживается в App.js через
 * `navigationRef.getCurrentRoute()` (onReady/onStateChange, см. App.js) и
 * прокидывается сюда параметром — хук вызывается прямо в App(), выше
 * NavigationContainer, поэтому живёт весь жизненный цикл приложения и трек
 * не перезапускается при переходах между MainMenu/LobbySearch/Lobby.
 *
 * Тот же паттерн канала/тайминга, что и у игровой музыки в GameBoardScreen —
 * volume ставится ПОСЛЕ каждого .replace() (см. история бага в тех
 * комментариях, тот же класс на вебе актуален и тут), следующий трек — на
 * 'playbackStatusUpdate'.didJustFinish, без повтора одного трека подряд.
 */
export function useMenuMusic(routeName) {
    const musicSound = useAudioPlayer(null);
    const trackIndexRef = useRef(-1);

    const playRandomTrack = useCallback(() => {
        const idx = pickRandomTrackIndex(trackIndexRef.current);
        trackIndexRef.current = idx;
        musicSound.replace(MENU_MUSIC_TRACKS[idx]);
        musicSound.volume = MENU_MUSIC_VOLUME;
        musicSound.play();
    }, [musicSound]);

    useEffect(() => {
        const sub = musicSound.addListener('playbackStatusUpdate', (status) => {
            if (status.didJustFinish) playRandomTrack();
        });
        return () => sub.remove();
    }, [musicSound, playRandomTrack]);

    useEffect(() => {
        if (MENU_MUSIC_ROUTES.has(routeName)) {
            // Повторный вход в этот же набор экранов (напр. Lobby→LobbySearch→
            // Lobby) НЕ должен перезапускать трек — .replace() тут не звать,
            // если плеер уже реально играет что-то из этого плейлиста.
            if (trackIndexRef.current === -1) playRandomTrack();
        } else {
            musicSound.pause();
            musicSound.seekTo(0);
            trackIndexRef.current = -1;
        }
    }, [routeName, playRandomTrack, musicSound]);
}
