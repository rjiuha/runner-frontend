// src/components/game/GameMenuButton.js
import React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { SETTINGS_BUTTON_IMAGES } from '../../constants/GameConstants';

/**
 * Кнопка-тоггл игрового меню — живёт в panelHeaderRow рядом с кнопкой лога
 * событий (инлайн в GameBoardScreen.js, см. её докстринг за тем, почему
 * список лога больше не часть EventLogPanel.js) и RoadNavButton, тот же
 * квадратный размер (`size` — вызывающий код передаёт arrowBtnSize).
 * Открывает GameMenuModal ("Покинуть игру"/"Настройки"), см. GameBoardScreen.js.
 *
 * `active` — pressed-ассет, пока открыто ХОТЬ ОДНО из меню (GameMenuModal
 * или выросший из него GameSettingsModal) — та же семантика
 * "pressed = сейчас открыто", что и у лог-тоггла рядом, не состояние
 * нажатия пальцем.
 */
function GameMenuButton({ size, active, onPress }) {
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

// React.memo — 2026-10-16, см. FramedSquare.js за полным разбором (та же
// причина: рендерится внутри гигантского GameBoardScreen, который во время
// партии перерисовывается часто). `onPress` (handleOpenGameMenu) — уже
// useCallback с пустыми deps в GameBoardScreen.js, стабильная ссылка — memo
// тут работает чисто, без оговорок про children (их у этого компонента нет).
export default React.memo(GameMenuButton);
