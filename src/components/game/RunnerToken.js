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
 * Для типов без набора анимаций (constants/runnerAnimations — сейчас Скаут/
 * Солдат/Атлет, Жнец пока без набора) обе функции возвращают null, и
 * рендерится старая статичная иконка (RUNNER_DISPLAY[type].icon) — новый тип
 * бегуна получает анимации просто добавлением записи в RUNNER_ANIMATION_SETS,
 * без правок этого компонента.
 *
 * **Перекраска неона под цвет игрока** (2026-08-31): для типов с набором
 * анимаций `getRunnerAnimationImage`/`getRunnerAvatarImage` возвращают не
 * один ассет, а пару `{base, mask}` (см. constants/runnerAnimations) — base
 * рисуется как есть, mask поверх него ВТОРЫМ `<Image>` с `tintColor={color}`
 * (неон в mask — чистый белый на прозрачном, tintColor красит именно его, а
 * не весь спрайт). Для типов без набора (просто `display.icon`, обычный
 * require одной картинки) — старый однослойный рендер, как было.
 *
 * `imageScale` — доля `size`, которую занимает картинка ВНУТРИ кольца
 * (по умолчанию 0.68, как было изначально). По прямому запросу пользователя,
 * 2026-08-31, доска увеличивает персонажа независимо от кольца ("окружность
 * вокруг персонажа не увеличивай") — кольцо по-прежнему = `size`, картинка
 * может быть даже БОЛЬШЕ кольца (imageScale > 1), выходя за его пределы —
 * это осознанный эффект, не баг.
 *
 * `showRing` — цветной кружок-обводка (цвет игрока + полупрозрачная заливка).
 * По умолчанию `true` (карточка в панели — там он всё ещё нужен для быстрой
 * идентификации). На доске (BoardGrid) с 2026-08-31 передаётся `false` — сама
 * перекраска неона под цвет игрока уже показывает, чей это бегун, отдельная
 * обводка стала избыточной (прямой запрос пользователя). Белая рамка
 * `selected` (сейчас выбран для хода/выстрела) — другая, никак не связанная
 * с цветом игрока сущность, рисуется независимо от `showRing`.
 */
export default function RunnerToken({
    type, status, color = '#fff', size = 32, selected = false, anim = null, avatar = false, imageScale = 0.68,
    showRing = true, style,
}) {
    // ref до любого early return — правила хуков требуют звать хуки на
    // каждый рендер одинаково, а display может оказаться пустым ниже.
    const prevSourceRef = useRef(null);

    const display = RUNNER_DISPLAY[type];
    if (!display) return null;

    const raw = avatar ? getRunnerAvatarImage(type, status) : getRunnerAnimationImage(type, status, anim);
    // {base, mask} — объект, а не обычный require-ассет (тот на вебе тоже
    // объект вида {uri,width,height}, поэтому проверяем именно свои поля).
    const isDualLayer = raw != null && typeof raw === 'object' && 'base' in raw && 'mask' in raw;
    const source = isDualLayer ? raw : (raw ?? display.icon);

    // key форсирует ремонт <Image> — но ТОЛЬКО когда source буквально тот же
    // require-ассет, что уже отображался (два move в направлении UP подряд
    // при многошаговом ходе, например) — иначе gif не перезапустился бы с
    // первого кадра, native-слой не считает "тот же файл" сменой картинки.
    // Если source РЕАЛЬНО другой (обычный случай: idle→move, move→attack и
    // т.п.) — key НЕ меняем: полный размонт/монтаж <Image> на Android даёт
    // заметный "пустой" кадр, пока новый gif декодируется с нуля (жалоба
    // пользователя, 2026-08-31 — "персонаж исчезает на короткое мгновение").
    // Обычная смена prop `source` на уже смонтированной Image перезапускает
    // анимацию сама, без разрушения нативной view. Для dual-layer сравниваем
    // объект {base,mask} целиком — он один и тот же require-литерал модуля
    // (стабильная ссылка) на каждый повторный выбор той же анимации.
    const sameSourceAsBefore = prevSourceRef.current === source;
    prevSourceRef.current = source;
    const animKey = avatar
        ? 'avatar'
        : sameSourceAsBefore && anim
            ? `repeat-${anim.kind}-${anim.direction ?? anim.side ?? ''}-${anim.nonce ?? ''}`
            : 'stable';

    const imgBoxStyle = { width: size * imageScale, height: size * imageScale };
    // НЕ StyleSheet.absoluteFillObject (top/left/right/bottom:0, без явных
    // width/height) — на react-native-web это НЕ растягивает <Image> на
    // размер родителя, он откатывается на натуральный пиксельный размер
    // самого gif-файла (тот же баг, что уже ловили на MobileFrameOverlay,
    // см. CLAUDE.md, 2026-08-29: "ширина через противоположные left/right без
    // width" не работает у Image на вебе). Даём те же width/height, что и
    // родителю — тогда оба слоя (base/mask) гарантированно совпадают с ним
    // и друг с другом на любой платформе.
    const imgLayerStyle = { position: 'absolute', top: 0, left: 0, ...imgBoxStyle };

    return (
        <View
            style={[
                styles.ring,
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
            {isDualLayer ? (
                <View style={imgBoxStyle}>
                    <Image
                        key={`${animKey}-base`}
                        source={source.base}
                        style={imgLayerStyle}
                        resizeMode="contain"
                    />
                    <Image
                        key={`${animKey}-mask`}
                        source={source.mask}
                        style={imgLayerStyle}
                        tintColor={color}
                        resizeMode="contain"
                    />
                </View>
            ) : (
                <Image key={animKey} source={source} style={imgBoxStyle} resizeMode="contain" />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    ring: {
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
