// src/components/ui/FramePanel.js
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Tiled from './TiledImage';
import {
    FRAME_PANEL_BOTTOM_CORNER,
    FRAME_PANEL_BOTTOM_EDGE,
    FRAME_PANEL_LEFT_EDGE,
    FRAME_PANEL_TOP_CORNER,
    FRAME_PANEL_TOP_EDGE,
    PERSON_PANEL_BACKGROUND,
    PERSON_PANEL_BACKGROUND_CORNER,
} from '../../constants/GameConstants';

// Родные пиксельные размеры decorативных дуг/граней (frame_panel_*, см.
// GameConstants.js) — угол ВСЕГДА 32x32 (frame_panel_top/bottom_corner,
// НЕ зависит от backgroundSource — та подменяется только для заливки, дуги
// жёстко frame_panel_*). Грани — родной размер плитки/шаг повтора.
const CORNER_NATIVE = 32;
const TOP_EDGE_H_NATIVE = 17;
const TOP_TILE_W_NATIVE = 22;
const BOTTOM_EDGE_H_NATIVE = 15;
const BOTTOM_TILE_W_NATIVE = 25;
const VERT_EDGE_W_NATIVE = 14;
const VERT_TILE_H_NATIVE = 14;

/**
 * Декоративная sci-fi рамка (9-slice) — тот же приём, что MobileFrameOverlay
 * (assets/images/ui/mobile) и PersonPanel.js: один угол на пару (верх/низ —
 * РАЗНЫЕ изображения) + одна вертикальная планка, остальные стороны —
 * `scaleX:-1`/`scaleY:-1` того же файла.
 *
 * `size` — {width, height} ОБЯЗАТЕЛЬНЫЙ проп (без него ничего не рисуется).
 * Раньше рамка растягивала `StyleSheet.absoluteFillObject`/`left+right без
 * width` под родителя — тот же класс проблем, что уже чинили в PersonPanel.js
 * (на Android `<Image>` с только top/left/right/bottom:0 без явных width/
 * height либо коллапсирует, либо не рендерится вовсе — живая жалоба
 * пользователя 2026-09-19: "рамки аватарки нет вообще"). Теперь размер
 * приходит явно от вызывающего кода (RunnerCard — константы AVATAR_SIZE/
 * DICE_SIZE, не нужно измерять; AbilityZone — через уже работающий у него
 * measureInWindow, зона переменной ширины).
 *
 * **Масштабирование, не родной пиксельный размер** (в отличие от
 * PersonPanel.js, где корпус карточки всегда достаточно большой) — родной
 * угол 32×32 слишком ТОЛСТЫЙ для мелких контейнеров этого компонента (слот
 * кубика 44×44, аватар 64×64, зона усиления) — живая жалоба пользователя
 * сразу после первого варианта ("жирные рамки... капец"), когда рамка
 * рисовалась родным размером (32px) везде, где влезала. Поэтому целевая
 * толщина угла — `targetCornerSize` (проп, по умолчанию 12 — та же
 * толщина, что была ДО этого раунда правок, просто раньше её просто
 * растягивали без учёта реальных пропорций ассета). Весь набор (угол+обе
 * грани) масштабируется ОДНИМ общим коэффициентом от этой цели (`scale =
 * targetCornerSize / CORNER_NATIVE`, зажат снизу — если контейнер СОВСЕМ
 * маленький, ужимаем дальше, чтобы угол не вылез за размер контейнера, но
 * НИКОГДА не растягиваем крупнее цели) — все пропорции между углом и гранью
 * сохраняются как у художника при любой толщине, ту самую жалобу "не в
 * масштабе друг относительно друга" (см. PersonPanel.js) это решает
 * структурно, не отдельными cornerSize/edgeSize пропсами вразнобой, как
 * было до всего этого раунда правок (произвольные 12/4, никак не связанные
 * с реальными пропорциями ассета).
 *
 * `resizeMode="repeat"` НЕ используется нигде (тайлинг граней — через
 * TiledImage.js, копиями `stretch` — см. её докстринг за подробным разбором,
 * почему `repeat` на Android игнорирует плотность экрана).
 *
 * `backgroundSource`/`backgroundCornerSource`/`backgroundTileSize` —
 * заливка КОРПУСА настраиваемая (по умолчанию PERSON_PANEL_BACKGROUND/
 * _CORNER, 39px тайл — просят использовать для плиток усилий/слота кубика),
 * FRAME_PANEL_BACKGROUND/_CORNER (60px тайл) пользователь оставил
 * ИСКЛЮЧИТЕЛЬНО под аватар бегуна (см. RunnerCard.js — единственное место,
 * передающее переопределение и backgroundTileSize={60}).
 *
 * React.memo (2026-09-19, живая жалоба "тормозит при перетаскивании кубика
 * по плиткам") — до ~20 дочерних `<Image>` на инстанс (используется ТРИЖДЫ
 * на одну карточку бегуна — аватар, слот кубика — и один раз на зону
 * усиления), без memo вся эта реконсиляция заново прогонялась на каждый
 * ре-рендер родителя. Работает корректно только если `size` (и остальные
 * пропсы) стабильны между рендерами — см. AVATAR_FRAME_SIZE/DICE_FRAME_SIZE
 * в RunnerCard.js (были инлайн-объектами, пересоздавались каждый рендер) и
 * zoneSize в AbilityZone.js (уже стабильный state, менялся только раньше).
 */
function FramePanel({
    size,
    style,
    backgroundSource = PERSON_PANEL_BACKGROUND,
    backgroundCornerSource = PERSON_PANEL_BACKGROUND_CORNER,
    backgroundTileSize = 39,
    targetCornerSize = 12,
}) {
    if (!size) return null;

    // Math.round(...) на КАЖДОЙ итоговой величине (2026-09-19, живая жалоба
    // пользователя на Android — "вижу стыки бэкграунд кусочков на плитках",
    // тот же фикс применён и в PersonPanel.js, см. её докстринг за полным
    // разбором механизма) — `scale` тут ПОЧТИ ВСЕГДА дробный (зависит от
    // `size`, которая варьируется: 64 у аватара, 44 у кубика, измеренная
    // ширина зоны у AbilityZone), значит КАЖДАЯ производная величина ниже
    // дробная — TiledImage.js кладёт тайлы впритык по дробным координатам,
    // Android округляет позицию/размер соседних тайлов независимо, отсюда
    // видимый шов. Округляем именно ИТОГОВЫЕ размеры (не сам scale) — так
    // пропорции остаются максимально близки к художественным, но каждый
    // конкретный тайл кладётся уже в целых пикселях.
    const scale = Math.min(
        targetCornerSize / CORNER_NATIVE,
        size.width / (CORNER_NATIVE * 2),
        size.height / (CORNER_NATIVE * 2),
    );
    const cornerSize = Math.round(CORNER_NATIVE * scale);
    const topEdgeH = Math.round(TOP_EDGE_H_NATIVE * scale);
    const topTileW = Math.round(TOP_TILE_W_NATIVE * scale);
    const bottomEdgeH = Math.round(BOTTOM_EDGE_H_NATIVE * scale);
    const bottomTileW = Math.round(BOTTOM_TILE_W_NATIVE * scale);
    const vertEdgeW = Math.round(VERT_EDGE_W_NATIVE * scale);
    const vertTileH = Math.round(VERT_TILE_H_NATIVE * scale);
    const bgTile = Math.round(backgroundTileSize * scale);
    const edgeW = Math.max(0, size.width - cornerSize * 2);
    const edgeH = Math.max(0, size.height - cornerSize * 2);

    return (
        <View
            style={[styles.wrap, { width: size.width, height: size.height }, style]}
            pointerEvents="none"
        >
            <Tiled
                source={backgroundSource}
                tileW={bgTile}
                tileH={bgTile}
                width={size.width}
                height={size.height}
                style={{ top: 0, left: 0 }}
            />
            <Image
                source={backgroundCornerSource}
                resizeMode="stretch"
                style={{ position: 'absolute', top: 0, left: 0, width: cornerSize, height: cornerSize }}
            />
            <Image
                source={backgroundCornerSource}
                resizeMode="stretch"
                style={{
                    position: 'absolute', top: 0, right: 0, width: cornerSize, height: cornerSize,
                    transform: [{ scaleX: -1 }],
                }}
            />
            <Image
                source={backgroundCornerSource}
                resizeMode="stretch"
                style={{
                    position: 'absolute', bottom: 0, left: 0, width: cornerSize, height: cornerSize,
                    transform: [{ scaleY: -1 }],
                }}
            />
            <Image
                source={backgroundCornerSource}
                resizeMode="stretch"
                style={{
                    position: 'absolute', bottom: 0, right: 0, width: cornerSize, height: cornerSize,
                    transform: [{ scaleX: -1 }, { scaleY: -1 }],
                }}
            />

            <Tiled
                source={FRAME_PANEL_TOP_EDGE}
                tileW={topTileW}
                tileH={topEdgeH}
                width={edgeW}
                height={topEdgeH}
                style={{ top: 0, left: cornerSize }}
            />
            <Tiled
                source={FRAME_PANEL_BOTTOM_EDGE}
                tileW={bottomTileW}
                tileH={bottomEdgeH}
                width={edgeW}
                height={bottomEdgeH}
                style={{ bottom: 0, left: cornerSize }}
            />
            <Tiled
                source={FRAME_PANEL_LEFT_EDGE}
                tileW={vertEdgeW}
                tileH={vertTileH}
                width={vertEdgeW}
                height={edgeH}
                style={{ left: 0, top: cornerSize }}
            />
            <Tiled
                source={FRAME_PANEL_LEFT_EDGE}
                tileW={vertEdgeW}
                tileH={vertTileH}
                width={vertEdgeW}
                height={edgeH}
                style={{ right: 0, top: cornerSize, transform: [{ scaleX: -1 }] }}
            />

            <Image
                source={FRAME_PANEL_TOP_CORNER}
                resizeMode="stretch"
                style={{ position: 'absolute', top: 0, left: 0, width: cornerSize, height: cornerSize }}
            />
            <Image
                source={FRAME_PANEL_TOP_CORNER}
                resizeMode="stretch"
                style={{
                    position: 'absolute', top: 0, right: 0, width: cornerSize, height: cornerSize,
                    transform: [{ scaleX: -1 }],
                }}
            />
            <Image
                source={FRAME_PANEL_BOTTOM_CORNER}
                resizeMode="stretch"
                style={{ position: 'absolute', bottom: 0, left: 0, width: cornerSize, height: cornerSize }}
            />
            <Image
                source={FRAME_PANEL_BOTTOM_CORNER}
                resizeMode="stretch"
                style={{
                    position: 'absolute', bottom: 0, right: 0, width: cornerSize, height: cornerSize,
                    transform: [{ scaleX: -1 }],
                }}
            />
        </View>
    );
}

export default React.memo(FramePanel);

const styles = StyleSheet.create({
    wrap: { position: 'absolute', top: 0, left: 0, borderRadius: 4, overflow: 'hidden' },
});
