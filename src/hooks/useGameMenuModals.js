// src/hooks/useGameMenuModals.js
import { useCallback, useState } from 'react';

/**
 * 2026-10-16, вынесено из GameBoardScreen.js по итогам аудита лучших
 * практик (пункт "г") — состояние игрового меню/хаба настроек было
 * разнесено по трём участкам файла (стейт/хендлеры/JSX за тысячи строк
 * друг от друга).
 *
 * Три уровня: GameMenuModal → GameSettingsHubModal ("Игра"/"Звук") →
 * GameSettingsModal | GameGeneralSettingsModal. "Назад" из звука/игры
 * возвращает В ХАБ, а не закрывает всё целиком, по прямому запросу
 * пользователя — чтобы переключаться между разделами настроек без
 * повторного похода через игровое меню.
 *
 * Чисто навигационное состояние "какая панель открыта сейчас" — никакой
 * игровой логики тут нет. "Покинуть игру" (реальный вызов `/surrender`)
 * остаётся в GameBoardScreen.js — этот хук только закрывает меню перед тем,
 * как отдать управление наружу (см. `closeGameMenu`, вызывается оттуда
 * перед `handleSurrender`).
 */
export function useGameMenuModals() {
    const [gameMenuOpen, setGameMenuOpen] = useState(false);
    const [settingsHubOpen, setSettingsHubOpen] = useState(false);
    const [gameSettingsOpen, setGameSettingsOpen] = useState(false);
    const [gameGeneralSettingsOpen, setGameGeneralSettingsOpen] = useState(false);

    const openGameMenu = useCallback(() => setGameMenuOpen(true), []);
    const closeGameMenu = useCallback(() => setGameMenuOpen(false), []);
    // "Настройки" (GameMenuModal) — ведёт в хаб, не сразу в звук.
    const openSettingsFromMenu = useCallback(() => {
        setGameMenuOpen(false);
        setSettingsHubOpen(true);
    }, []);
    const closeSettingsHub = useCallback(() => setSettingsHubOpen(false), []);
    const openSoundSettingsFromHub = useCallback(() => {
        setSettingsHubOpen(false);
        setGameSettingsOpen(true);
    }, []);
    const openGeneralSettingsFromHub = useCallback(() => {
        setSettingsHubOpen(false);
        setGameGeneralSettingsOpen(true);
    }, []);
    const closeSettings = useCallback(() => {
        setGameSettingsOpen(false);
        setSettingsHubOpen(true);
    }, []);
    const closeGeneralSettings = useCallback(() => {
        setGameGeneralSettingsOpen(false);
        setSettingsHubOpen(true);
    }, []);

    return {
        gameMenuOpen, openGameMenu, closeGameMenu, openSettingsFromMenu,
        settingsHubOpen, closeSettingsHub, openSoundSettingsFromHub, openGeneralSettingsFromHub,
        gameSettingsOpen, closeSettings,
        gameGeneralSettingsOpen, closeGeneralSettings,
    };
}
