// src/components/ui/PersonPanel.js
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Tiled from './TiledImage';
import {
    PERSON_PANEL_BACKGROUND,
    PERSON_PANEL_BACKGROUND_CORNER,
    PERSON_PANEL_BOTTOM_CORNER,
    PERSON_PANEL_BOTTOM_EDGE,
    PERSON_PANEL_LEFT_EDGE,
    PERSON_PANEL_TOP_CORNER,
    PERSON_PANEL_TOP_EDGE,
} from '../../constants/GameConstants';

// Родные пиксельные размеры ассетов (см. GameConstants.js за путями) —
// НЕ выдуманы, сняты с реальных PNG. Углы (26x26) И background_corner (26x26)
// совпадают ДРУГ С ДРУГОМ впритык, по прямому требованию пользователя.
// TOP/BOTTOM/VERT — родные размеры плиток граней; T_TILE_W/B_TILE_W/
// V_TILE_H — их родной шаг повтора вдоль оси тайлинга, BG_TILE — родной
// размер плитки фона (39x39, квадратная).
//
// FRAME_SCALE (2026-09-19, по прямому запросу пользователя — "рамку плитки
// персонажа на 30% шире") — масштабирует ТОЛЬКО декоративную рамку (углы +
// грани), НЕ фон (BG_TILE не трогаем — "рамка" по докстрингу компонента ниже
// это именно 9-slice углов/граней, фон — отдельный слой ПОД ней). Масштаб
// применён РАВНОМЕРНО к обеим осям каждого тайла (не только к толщине грани)
// — иначе `resizeMode="stretch"` в TiledImage.js растягивал бы исходную
// картинку тайла с искажением пропорций (source и dest-box для tileW/tileH
// там ВСЕГДА совпадающая пара, см. TiledImage.js — если увеличить только
// толщину, а ширину тайла вдоль оси повтора оставить родной, узор на грани
// сплющится/растянется).
// Math.round(...) на КАЖДОЙ величине (2026-09-19, живая жалоба пользователя
// на Android — "вижу стыки бэкграунд кусочков на плитках") — БЕЗ округления
// FRAME_SCALE=1.3 давал НЕЦЕЛЫЕ пиксельные размеры/позиции тайлов (26*1.3=
// 33.8, 13*1.3=16.9 и т.д.). TiledImage.js кладёт много мелких `<Image>`
// впритык друг к другу (`top: r*tileH, left: c*tileW`) — при дробных
// tileW/tileH Android округляет позицию И размер КАЖДОГО тайла НЕЗАВИСИМО
// (Skia/Fabric), и эти округления не гарантированно компенсируют друг
// друга — сосед может лечь на пол-пикселя левее/правее, чем кончается
// предыдущий, обнажая шов (либо просвет фона, либо задвоение). Целые
// пиксели у tileW/tileH/позиции устраняют этот источник рассинхрона
// полностью — тайлы кладутся ровно край-в-край.
const FRAME_SCALE = 1.3;
const CORNER_SIZE = Math.round(26 * FRAME_SCALE);
const TOP_EDGE_H = Math.round(6 * FRAME_SCALE);
const TOP_TILE_W = Math.round(13 * FRAME_SCALE);
const BOTTOM_EDGE_H = Math.round(5 * FRAME_SCALE);
const BOTTOM_TILE_W = Math.round(17 * FRAME_SCALE);
const VERT_EDGE_W = Math.round(5 * FRAME_SCALE);
const VERT_TILE_H = Math.round(12 * FRAME_SCALE);
const BG_TILE = 39;

/**
 * Декоративная рамка КОРПУСА карточки бегуна (RunnerCard) — 9-slice из угла +
 * пары граней (см. константы выше). Зеркалирование — ОДИН файл на угол/грань,
 * остальные 3 получены `scaleX`/`scaleY` (у граней — на обёртке `Tiled`,
 * зеркалит сразу весь замощённый блок, включая позиции тайлов внутри).
 *
 * `size` — {width, height} области, которую нужно заполнить рамкой,
 * ОБЯЗАТЕЛЬНО измеренный СНАРУЖИ (RunnerCard.js — через уже работающий
 * `measureInWindow`), НЕ через собственный `onLayout` этого компонента —
 * тут раньше стоял `onLayout` на абсолютно спозиционированном `wrap`
 * (родитель без явной высоты, auto из flow-контента), и живая проверка на
 * Android (лог: `onLayout fired 158.85 0` — высота НАВСЕГДА 0, при этом
 * `measureInWindow` того же самого родителя тут же честно даёт 174.85x80)
 * подтвердила: для absolutely-positioned ребёнка с auto-height родителем
 * `onLayout` на Android стабильно ловит высоту 0 — родитель ещё не
 * "устаканился" на момент этого конкретного measure-пути. `measureInWindow`
 * — другой, уже проверенный в этом же файле механизм (годами используется
 * для drag-n-drop зоны), поэтому размер теперь ЦЕЛИКОМ приходит извне.
 * Пока `size` не задан (самый первый рендер, до первого measureInWindow) —
 * рамка не рисуется вообще, тот же компромисс, что раньше был у onLayout.
 *
 * Порядок слоёв (снизу вверх): фон-плитка на весь прямоугольник → угловые
 * подложки (person_panel_background_corner, ТОЧНО под декоративным углом, тот
 * же размер/позиция) → грани-плитки → декоративные дуги углов поверх всего.
 * Без угловой подложки сквозь скруглённый вырез дуги было бы видно
 * прямоугольный край общего фона (см. FRAME_PANEL_BACKGROUND_CORNER в
 * GameConstants.js — тот же класс проблемы).
 *
 * React.memo (2026-09-19, живая жалоба "тормозит при перетаскивании кубика
 * по плиткам") — ~30 дочерних `<Image>` на инстанс, а `size` (RunnerCard.js
 * — `cardSize` из measureInWindow) остаётся ТОЙ ЖЕ ссылкой между рендерами,
 * пока карточку не перемерили заново — без memo эта реконсиляция заново
 * прогонялась при КАЖДОМ ре-рендере родителя (hoverState/pulse и т.п.),
 * даже когда сам корпус карточки визуально не менялся вообще.
 */
function PersonPanel({ size, style }) {
    const edgeW = size ? Math.max(0, size.width - CORNER_SIZE * 2) : 0;
    const edgeH = size ? Math.max(0, size.height - CORNER_SIZE * 2) : 0;

    return (
        <View
            style={[styles.wrap, size && { width: size.width, height: size.height }, style]}
            pointerEvents="none"
        >
            {size && (
                <>
                    <Tiled
                        source={PERSON_PANEL_BACKGROUND}
                        tileW={BG_TILE}
                        tileH={BG_TILE}
                        width={size.width}
                        height={size.height}
                        style={{ top: 0, left: 0 }}
                    />
                    <Image
                        source={PERSON_PANEL_BACKGROUND_CORNER}
                        resizeMode="stretch"
                        style={{ position: 'absolute', top: 0, left: 0, width: CORNER_SIZE, height: CORNER_SIZE }}
                    />
                    <Image
                        source={PERSON_PANEL_BACKGROUND_CORNER}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', top: 0, right: 0, width: CORNER_SIZE, height: CORNER_SIZE,
                            transform: [{ scaleX: -1 }],
                        }}
                    />
                    <Image
                        source={PERSON_PANEL_BACKGROUND_CORNER}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', bottom: 0, left: 0, width: CORNER_SIZE, height: CORNER_SIZE,
                            transform: [{ scaleY: -1 }],
                        }}
                    />
                    <Image
                        source={PERSON_PANEL_BACKGROUND_CORNER}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', bottom: 0, right: 0, width: CORNER_SIZE, height: CORNER_SIZE,
                            transform: [{ scaleX: -1 }, { scaleY: -1 }],
                        }}
                    />

                    <Tiled
                        source={PERSON_PANEL_TOP_EDGE}
                        tileW={TOP_TILE_W}
                        tileH={TOP_EDGE_H}
                        width={edgeW}
                        height={TOP_EDGE_H}
                        style={{ top: 0, left: CORNER_SIZE }}
                    />
                    <Tiled
                        source={PERSON_PANEL_BOTTOM_EDGE}
                        tileW={BOTTOM_TILE_W}
                        tileH={BOTTOM_EDGE_H}
                        width={edgeW}
                        height={BOTTOM_EDGE_H}
                        style={{ bottom: 0, left: CORNER_SIZE }}
                    />
                    <Tiled
                        source={PERSON_PANEL_LEFT_EDGE}
                        tileW={VERT_EDGE_W}
                        tileH={VERT_TILE_H}
                        width={VERT_EDGE_W}
                        height={edgeH}
                        style={{ left: 0, top: CORNER_SIZE }}
                    />
                    <Tiled
                        source={PERSON_PANEL_LEFT_EDGE}
                        tileW={VERT_EDGE_W}
                        tileH={VERT_TILE_H}
                        width={VERT_EDGE_W}
                        height={edgeH}
                        style={{ right: 0, top: CORNER_SIZE, transform: [{ scaleX: -1 }] }}
                    />

                    <Image
                        source={PERSON_PANEL_TOP_CORNER}
                        resizeMode="stretch"
                        style={{ position: 'absolute', top: 0, left: 0, width: CORNER_SIZE, height: CORNER_SIZE }}
                    />
                    <Image
                        source={PERSON_PANEL_TOP_CORNER}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', top: 0, right: 0, width: CORNER_SIZE, height: CORNER_SIZE,
                            transform: [{ scaleX: -1 }],
                        }}
                    />
                    <Image
                        source={PERSON_PANEL_BOTTOM_CORNER}
                        resizeMode="stretch"
                        style={{ position: 'absolute', bottom: 0, left: 0, width: CORNER_SIZE, height: CORNER_SIZE }}
                    />
                    <Image
                        source={PERSON_PANEL_BOTTOM_CORNER}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', bottom: 0, right: 0, width: CORNER_SIZE, height: CORNER_SIZE,
                            transform: [{ scaleX: -1 }],
                        }}
                    />
                </>
            )}
        </View>
    );
}

export default React.memo(PersonPanel);

const styles = StyleSheet.create({
    wrap: { position: 'absolute', top: 0, left: 0, borderRadius: 6, overflow: 'hidden' },
});
