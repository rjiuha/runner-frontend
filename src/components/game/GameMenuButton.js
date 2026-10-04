// src/components/game/GameMenuButton.js
import React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { SETTINGS_BUTTON_IMAGES } from '../../constants/GameConstants';

/**
 * Кнопка-тоггл игрового меню — живёт в seam-ряду рядом с EventLogPanel
 * (position="seam") и RoadNavButton, тот же квадратный размер (`size` —
 * вызывающий код передаёт arrowBtnSize). Открывает GameMenuModal
 * ("Покинуть игру"/"Настройки"), см. GameBoardScreen.js.
 *
 * `active` — pressed-ассет, пока открыто ХОТЬ ОДНО из меню (GameMenuModal
 * или выросший из него GameSettingsModal) — та же семантика
 * "pressed = сейчас открыто", что и у EventLogPanel'ного лог-тоггла рядом,
 * не состояние нажатия пальцем.
 */
export default function GameMenuButton({ size, active, onPress }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <Image
                source={active ? SETTINGS_BUTTON_IMAGES.pressed : SETTINGS_BUTTON_IMAGES.unpressed}
                style={{ width: size, height: size }}
                resizeMode="contain"
            />
        </TouchableOpacity>
    );
}
