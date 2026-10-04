// src/hooks/useAudioSettings.js
import { useEffect, useState } from 'react';
import {
    ensureAudioSettingsLoaded,
    getAudioSettings,
    subscribeAudioSettings,
} from '../lib/audioSettings';

/**
 * Живые (см. lib/audioSettings.js — `current`, не `saved`) значения
 * громкости по каналам — перерендеривает подписчика на КАЖДОЕ изменение
 * (включая превью при перетаскивании слайдера в GameSettingsModal, ещё до
 * "Сохранить"). Используется и звуковыми каналами (GameBoardScreen,
 * useMenuMusic — применяют значение к .volume плеера), и самим
 * GameSettingsModal (чтобы слайдер показывал актуальную позицию).
 */
export function useAudioSettings() {
    const [settings, setSettings] = useState(getAudioSettings());

    useEffect(() => {
        ensureAudioSettingsLoaded().then(setSettings);
        return subscribeAudioSettings(setSettings);
    }, []);

    return settings;
}
