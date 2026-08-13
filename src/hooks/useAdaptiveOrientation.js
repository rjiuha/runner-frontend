// src/hooks/useAdaptiveOrientation.js
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Раньше (useLockLandscape) жёстко блокировала альбомную ориентацию на весь
 * срок жизни экрана — GameBoardScreen был только альбомным. Теперь раскладка
 * адаптивная (см. useBoardLayout — переключается по фактическому screenW/screenH),
 * поэтому вместо лока снимаем ограничение ориентации на время экрана сессии
 * (app.json на уровне всего приложения жёстко ставит "portrait" — это лочит
 * ротацию на ВСЕХ остальных экранах, которые эту раскладку не поддерживают).
 * На выходе с экрана возвращаем portrait-лок, как и на остальном приложении.
 * На вебе expo-screen-orientation не поддерживается — молча выходим (там
 * ориентацию и так определяет форма окна, а не системный поворот).
 */
export function useAdaptiveOrientation() {
    useEffect(() => {
        if (Platform.OS === 'web') return;
        ScreenOrientation.unlockAsync();
        return () => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        };
    }, []);
}
