// src/components/game/RunnerToken.js
import React, { useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { RUNNER_DISPLAY } from '../../constants/GameConstants';
import { getRunnerAnimationImage, getRunnerAvatarImage } from '../../constants/runnerAnimations';

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
 * отдельный статичный ассет "avatar" вместо игровых анимаций (по прямому
 * запросу пользователя, 2026-08-31) — не связан с `anim` вообще.
 *
 * Для типов без набора анимаций (constants/runnerAnimations — пока только
 * Скаут) обе функции возвращают null, и рендерится старая статичная иконка
 * (RUNNER_DISPLAY[type].icon) — новый тип бегуна получает анимации просто
 * добавлением записи в RUNNER_ANIMATION_SETS, без правок этого компонента.
 *
 * `imageScale` — доля `size`, которую занимает картинка ВНУТРИ кольца
 * (по умолчанию 0.68, как было изначально). По прямому запросу пользователя,
 * 2026-08-31, доска увеличивает персонажа независимо от кольца ("окружность
 * вокруг персонажа не увеличивай") — кольцо по-прежнему = `size`, картинка
 * может быть даже БОЛЬШЕ кольца (imageScale > 1), выходя за его пределы —
 * это осознанный эффект, не баг.
 */
export default function RunnerToken({
    type, status, color = '#fff', size = 32, selected = false, anim = null, avatar = false, imageScale = 0.68, style,
}) {
    // ref до любого early return — правила хуков требуют звать хуки на
    // каждый рендер одинаково, а display может оказаться пустым ниже.
    const prevSourceRef = useRef(null);

    const display = RUNNER_DISPLAY[type];
    if (!display) return null;

    const source = avatar
        ? getRunnerAvatarImage(type, status) ?? display.icon
        : getRunnerAnimationImage(type, status, anim) ?? display.icon;

    // key форсирует ремонт <Image> — но ТОЛЬКО когда source буквально тот же
    // require-ассет, что уже отображался (два move в направлении UP подряд
    // при многошаговом ходе, например) — иначе gif не перезапустился бы с
    // первого кадра, native-слой не считает "тот же файл" сменой картинки.
    // Если source РЕАЛЬНО другой (обычный случай: idle→move, move→attack и
    // т.п.) — key НЕ меняем: полный размонт/монтаж <Image> на Android даёт
    // заметный "пустой" кадр, пока новый gif декодируется с нуля (жалоба
    // пользователя, 2026-08-31 — "персонаж исчезает на короткое мгновение").
    // Обычная смена prop `source` на уже смонтированной Image перезапускает
    // анимацию сама, без разрушения нативной view.
    const sameSourceAsBefore = prevSourceRef.current === source;
    prevSourceRef.current = source;
    const animKey = avatar
        ? 'avatar'
        : sameSourceAsBefore && anim
            ? `repeat-${anim.kind}-${anim.direction ?? anim.side ?? ''}-${anim.nonce ?? ''}`
            : 'stable';

    return (
        <View
            style={[
                styles.ring,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderColor: color,
                    backgroundColor: `${color}33`,
                },
                selected && styles.selected,
                style,
            ]}
        >
            <Image key={animKey} source={source} style={{ width: size * imageScale, height: size * imageScale }} resizeMode="contain" />
        </View>
    );
}

const styles = StyleSheet.create({
    ring: {
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selected: {
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#fff',
        shadowOpacity: 0.9,
        shadowRadius: 4,
        elevation: 4,
    },
});
