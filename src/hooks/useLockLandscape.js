// src/hooks/useLockLandscape.js
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Блокирует альбомную ориентацию на весь срок жизни экрана.
 * На вебе expo-screen-orientation не поддерживается — молча выходим.
 */
export function useLockLandscape() {
    useEffect(() => {
        if (Platform.OS === 'web') return;
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }, []);
}
