// src/components/game/RunnerToken.js
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { RUNNER_DISPLAY } from '../../constants/GameConstants';
import { colorKeyForHex, getRunnerAnimationImage, getRunnerAvatarImage } from '../../constants/runnerAnimations';

/**
 * Иконка бегуна в цветном кольце владельца. Один и тот же компонент рисует
 * бегуна и на доске (BoardGrid), и в панели игрока (RunnerCard) — так фишки
 * на поле и карточки в панели выглядят одинаково и легко узнаются.
 *
 * `anim` — { kind: 'move'|'attack'|'fly'|'gotShot'|'destroyed'|'collision', direction?, side?, fromStatus? } | null
 * (idle), см. constants/runnerAnimations#getRunnerAnimationImage — доска
 * передаёт сюда текущее анимационное состояние бегуна (useRunnerAnimations в
 * GameBoardScreen), карточка в панели — не передаёт (там `avatar`).
 *
 * `avatar` — карточка бегуна в панели игрока (RunnerCard) использует
 * отдельный статичный ассет "avatar" вместо игровых анимаций — не связан с
 * `anim` вообще.
 *
 * Для типов без набора анимаций (constants/runnerAnimations — сейчас Скаут/
 * Солдат/Атлет, Жнец пока без набора) обе функции возвращают null, и
 * рендерится старая статичная иконка (RUNNER_DISPLAY[type].icon) — новый тип
 * бегуна получает анимации просто добавлением записи в RUNNER_ANIMATION_SETS,
 * без правок этого компонента.
 *
 * **Перекраска под цвет игрока — готовые ассеты, не рантайм-tintColor**
 * (2026-09-02): раньше каждая анимация была ПАРОЙ {base, mask} — два
 * наложенных `<Image>`, mask с `tintColor` цвета игрока поверх base. Это
 * означало ДВОЙНОЙ decode на Android при каждой смене анимации. Теперь
 * `getRunnerAnimationImage`/`getRunnerAvatarImage` принимают `colorKey`
 * ('red'/'blue'/'green'/'yellow', см. colorKeyForHex) и возвращают ОДИН уже
 * заранее перекрашенный (реверс-маскинг: неон родной, "сталь" тонирована
 * полупрозрачно в цвет команды) require()-ассет — один `<Image>` вместо двух.
 * `color` проп остаётся HEX (как и был, для кольца-обводки) — colorKeyForHex
 * резолвит его в ключ ассета внутри этого компонента, вызывающий код
 * (BoardGrid/RunnerCard) не меняется.
 *
 * `imageScale` — доля `size`, которую занимает картинка ВНУТРИ кольца
 * (по умолчанию 0.68, как было изначально). По прямому запросу пользователя,
 * доска увеличивает персонажа независимо от кольца ("окружность вокруг
 * персонажа не увеличивай") — кольцо по-прежнему = `size`, картинка может
 * быть даже БОЛЬШЕ кольца (imageScale > 1), выходя за его пределы — это
 * осознанный эффект, не баг.
 *
 * `showRing` — цветной кружок-обводка (цвет игрока + полупрозрачная заливка).
 * По умолчанию `true` (карточка в панели — там он всё ещё нужен для быстрой
 * идентификации). На доске (BoardGrid) передаётся `false` — сама перекраска
 * уже показывает, чей это бегун, отдельная обводка избыточна. Белая рамка
 * `selected` (сейчас выбран для хода/выстрела) — другая, никак не связанная
 * с цветом игрока сущность, рисуется независимо от `showRing`.
 *
 * `imageAlign` — 'center' (по умолчанию) или 'bottom'. Определяет, как
 * картинка (которая может быть БОЛЬШЕ кольца, см. imageScale выше)
 * позиционируется ВНУТРИ кольца по вертикали. 'bottom' — ТОЛЬКО для доски на
 * native (BoardGrid) — низ картинки прижат к низу кольца, лишний размер
 * выпирает только ВВЕРХ, не поровну на все 4 стороны. Кольцо само по себе
 * тоже должно быть прижато к низу своего родителя — за это отвечает ВНЕШНИЙ
 * контейнер (см. BoardGrid#styles.tokenLayerBottom), этот проп красит только
 * внутреннее позиционирование картинки относительно кольца.
 */
export default function RunnerToken({
    type, status, color = '#fff', size = 32, selected = false, anim = null, avatar = false, imageScale = 0.68,
    showRing = true, imageAlign = 'center', style,
}) {
    const display = RUNNER_DISPLAY[type];
    const colorKey = colorKeyForHex(color);
    const source = display
        ? (avatar ? getRunnerAvatarImage(type, status, colorKey) : getRunnerAnimationImage(type, status, anim, colorKey)) ?? display.icon
        : null;

    if (!display) return null;

    const imgBoxStyle = { width: size * imageScale, height: size * imageScale };

    return (
        <View
            style={[
                styles.ring,
                imageAlign === 'bottom' && styles.ringBottom,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
                showRing && { borderWidth: 2, borderColor: color, backgroundColor: `${color}33` },
                selected && styles.selected,
                style,
            ]}
        >
            <Image source={source} style={imgBoxStyle} resizeMode="contain" />
        </View>
    );
}

const styles = StyleSheet.create({
    ring: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringBottom: {
        justifyContent: 'flex-end',
    },
    // Известный баг Android: `elevation` на View БЕЗ явного backgroundColor
    // иногда рисует тень/контур по ПРЯМОУГОЛЬНОЙ границе вида, игнорируя
    // borderRadius (Android считает форму от заливки, а не только от
    // borderRadius) — у токенов на доске (showRing=false) кольцо обычно без
    // фона вообще, отсюда "у некоторых персонажей квадрат вместо кружка".
    // backgroundColor:'transparent' даёт Android нужную явную форму для
    // расчёта тени, ничего визуально не меняя (сама заливка прозрачная).
    selected: {
        borderWidth: 3,
        borderColor: '#fff',
        backgroundColor: 'transparent',
        shadowColor: '#fff',
        shadowOpacity: 0.9,
        shadowRadius: 4,
        elevation: 4,
    },
});
