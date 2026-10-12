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
// Родной (неотмасштабированный) размер уголка в самом PNG — нужен отдельно
// от FRAME_SCALE с 2026-10-10 (см. targetCornerSize ниже).
const CORNER_NATIVE = 26;
// Экспортируется — RunnerCard.js использует ТО ЖЕ значение для borderRadius
// своих оверлеев (tintColor/activeRing/PulseHighlight), которые должны
// визуально совпадать со скруглением корпуса, см. их комментарии. Это
// ВСЕГДА дефолтный (FRAME_SCALE=1.3, "карточный") размер — НЕ меняется
// пропом targetCornerSize (см. его докстринг ниже), тот масштаб считается
// отдельно, локально внутри компонента, не трогая этот экспорт.
export const CORNER_SIZE = Math.round(CORNER_NATIVE * FRAME_SCALE);
// Глубина диагональной фаски декоративного уголка (не весь CORNER_SIZE!) —
// измерено по alpha-каналу `person_panel_top_corner.png`/`_bottom_corner.png`
// на нативном 26px масштабе (см. комментарий у styles.wrap ниже за полным
// разбором). НЕ путать с CORNER_SIZE — та величина описывает БОКС, в который
// вписан весь декоративный уголок (для позиционирования/размера картинок),
// эта — только глубину среза угла, нужную для CSS-клипа под ним.
// 2026-09-26: попытка ЗАМЕНИТЬ это сдвигом самой дуги (CORNER_SHIFT) вместо
// подгонки радиуса дала живую жалобу "стало ужасно хуже" — откачено обратно
// на этот подход (радиус, подобранный под глубину фаски). Значение 8 всё
// ещё чуть торчало по словам пользователя — увеличено до 11 (по прямому
// запросу "еще чуть увеличим"). Если возвращаться к сдвигу дуги — делать
// ОЧЕНЬ аккуратно и показывать промежуточный результат, не сразу всё целиком.
const NOTCH_NATIVE = 11;
export const NOTCH_RADIUS = Math.round(NOTCH_NATIVE * FRAME_SCALE);
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
 * **Грани перекрашены программно (2026-10-10)**, исходники
 * (`person_panel_top/bottom_hor_line.png`, `person_panel_vert_line.png`)
 * больше не те, что были изначально — живая жалоба пользователя: "верхняя и
 * нижняя части панелей отличаются по прозрачности с промежуточными частями",
 * у активных панелей — "левая и правая рамки по цветам будто отличаются от
 * углов". Измерено по пикселям: альфа везде была 255 (дело не в
 * прозрачности), а в самих гранях была зашита почти чёрная линия-паз (до
 * ~40% площади у нижней грани) — на фоне сплошной сине-серой заливки и углов
 * (без единого чёрного пикселя) это читалось как резкий шов.
 * Первая попытка — убрать грани целиком — дала живую жалобу "а чего левая и
 * правая рамки вообще исчезли" (грани были ЕДИНСТВЕННЫМ, что визуально
 * соединяло угловые дуги в сплошную рамку по прямым участкам — те занимают
 * только CORNER_SIZE в каждом углу). По прямому выбору пользователя —
 * перекрасить старые ассеты, не убирать: HSL-колоризация (Hue/Saturation
 * заменены на фоновые 210°/27.4%, тот же приём, что уже применялся в проекте
 * для других ассетов), но с ЗАЖАТОЙ светлотой (clamp L в [фон−12%, фон+12%])
 * — обычная colorize-с-сохранением-L тут не работала: у почти чёрных
 * пикселей L≈0, Hue на них не виден. Зажатый пол поднимает их до тёмно-синего
 * (не чёрного), паттерн паза/тени остаётся виден как текстура, но без
 * контраста с фоном. Оригиналы (PNG ДО перекраски) не сохранены в
 * репозитории — если понадобится другой порог, пересчитывать с нуля тем же
 * методом (см. эту сессию за точный скрипт, был в scratchpad).
 *
 * React.memo (2026-09-19, живая жалоба "тормозит при перетаскивании кубика
 * по плиткам") — ~30 дочерних `<Image>` на инстанс, а `size` (RunnerCard.js
 * — `cardSize` из measureInWindow) остаётся ТОЙ ЖЕ ссылкой между рендерами,
 * пока карточку не перемерили заново — без memo эта реконсиляция заново
 * прогонялась при КАЖДОМ ре-рендере родителя (hoverState/pulse и т.п.),
 * даже когда сам корпус карточки визуально не менялся вообще.
 *
 * `targetCornerSize` (2026-10-10, по прямому запросу пользователя — тонкая
 * версия этой же рамки для мелких кнопок навигации/настроек/лога под швом
 * дороги/панели, см. GameBoardScreen.js) — ОПЦИОНАЛЬНОЕ переопределение
 * толщины угла/граней, тот же принцип, что уже есть у FramePanel.js (которая
 * ВСЕГДА параметризована по толщине — см. её докстринг). По умолчанию (проп
 * не передан) — поведение ПОЛНОСТЬЮ как раньше, фиксированный FRAME_SCALE=
 * 1.3 ("карточный" размер, используется RunnerCard/PlayerSwitcher/RoundPanel/
 * RoadBonusPanel и т.д., там НИЧЕГО не изменилось). Когда передан — масштаб
 * считается ЛОКАЛЬНО (`scale = targetCornerSize/CORNER_NATIVE`, зажат снизу
 * размером самого бокса, чтобы угол не вылез за маленький size), не трогая
 * модульные константы/экспорты (CORNER_SIZE/NOTCH_RADIUS остаются как были).
 *
 * `showBackground` (2026-10-10, по прямому запросу пользователя — рамка для
 * кнопок навигации/настроек/лога, у которых ассет сам по себе уже целиком
 * нарисован со своим фоном/формой, см. FramedSquare.js) — `false` отключает
 * И фоновую Tiled-плитку, И угловые подложки под ней (`PERSON_PANEL_
 * BACKGROUND_CORNER` — те существуют только затем, чтобы фон не просвечивал
 * прямоугольным углом сквозь скруглённый вырез декоративной дуги; без
 * собственного фона подложка не нужна). Остаются ТОЛЬКО декоративные
 * грани+уголки (сама рамка) — честный 9-slice оверлей поверх чужого
 * контента, без дублирующего фона под ним (раньше здесь оборачивали в
 * ПОЛНЫЙ PersonPanel поверх уже готовой плашки с собственным фоном/рамкой —
 * двойная рамка, живая жалоба; альтернативная попытка — утолщать рамку
 * прямо на растровом PNG — тоже отклонена пользователем, "не честные
 * слайсы"). По умолчанию `true` — остальные места (RunnerCard и т.д.)
 * не затронуты.
 */

/**
 * Радиус скругления, которым PersonPanel сам обрезает свой `wrap` (см. её
 * тело ниже — `notchRadius`) — 2026-10-11, тот же приём, что уже есть у
 * FramePanel.js#frameNotchRadius (докстринг там же за назначением) — нужен
 * внешнему коду (FramedSquare.js — свечение NeonGlow должно совпадать со
 * скруглением самой рамки), который рисует что-то РЯДОМ с PersonPanel, а не
 * внутри неё.
 */
export function personPanelNotchRadius(size, targetCornerSize = null) {
    if (!size) return 0;
    const scale = targetCornerSize != null
        ? Math.min(targetCornerSize / CORNER_NATIVE, size.width / (CORNER_NATIVE * 2), size.height / (CORNER_NATIVE * 2))
        : FRAME_SCALE;
    return targetCornerSize != null ? Math.round(NOTCH_NATIVE * scale) : NOTCH_RADIUS;
}

function PersonPanel({ size, style, targetCornerSize = null, showBackground = true }) {
    const scale = targetCornerSize != null && size
        ? Math.min(targetCornerSize / CORNER_NATIVE, size.width / (CORNER_NATIVE * 2), size.height / (CORNER_NATIVE * 2))
        : FRAME_SCALE;
    const cornerSize = targetCornerSize != null ? Math.round(CORNER_NATIVE * scale) : CORNER_SIZE;
    const notchRadius = targetCornerSize != null ? Math.round(NOTCH_NATIVE * scale) : NOTCH_RADIUS;
    const topEdgeH = targetCornerSize != null ? Math.round(6 * scale) : TOP_EDGE_H;
    const topTileW = targetCornerSize != null ? Math.round(13 * scale) : TOP_TILE_W;
    const bottomEdgeH = targetCornerSize != null ? Math.round(5 * scale) : BOTTOM_EDGE_H;
    const bottomTileW = targetCornerSize != null ? Math.round(17 * scale) : BOTTOM_TILE_W;
    const vertEdgeW = targetCornerSize != null ? Math.round(5 * scale) : VERT_EDGE_W;
    const vertTileH = targetCornerSize != null ? Math.round(12 * scale) : VERT_TILE_H;
    const bgTile = targetCornerSize != null ? Math.max(1, Math.round(BG_TILE * (scale / FRAME_SCALE))) : BG_TILE;

    const edgeW = size ? Math.max(0, size.width - cornerSize * 2) : 0;
    const edgeH = size ? Math.max(0, size.height - cornerSize * 2) : 0;

    return (
        <View
            style={[styles.wrap, { borderRadius: notchRadius }, size && { width: size.width, height: size.height }, style]}
            pointerEvents="none"
        >
            {size && (
                <>
                    {showBackground && (
                        <>
                            <Tiled
                                source={PERSON_PANEL_BACKGROUND}
                                tileW={bgTile}
                                tileH={bgTile}
                                width={size.width}
                                height={size.height}
                                style={{ top: 0, left: 0 }}
                            />
                            <Image
                                source={PERSON_PANEL_BACKGROUND_CORNER}
                                resizeMode="stretch"
                                style={{ position: 'absolute', top: 0, left: 0, width: cornerSize, height: cornerSize }}
                            />
                            <Image
                                source={PERSON_PANEL_BACKGROUND_CORNER}
                                resizeMode="stretch"
                                style={{
                                    position: 'absolute', top: 0, right: 0, width: cornerSize, height: cornerSize,
                                    transform: [{ scaleX: -1 }],
                                }}
                            />
                            <Image
                                source={PERSON_PANEL_BACKGROUND_CORNER}
                                resizeMode="stretch"
                                style={{
                                    position: 'absolute', bottom: 0, left: 0, width: cornerSize, height: cornerSize,
                                    transform: [{ scaleY: -1 }],
                                }}
                            />
                            <Image
                                source={PERSON_PANEL_BACKGROUND_CORNER}
                                resizeMode="stretch"
                                style={{
                                    position: 'absolute', bottom: 0, right: 0, width: cornerSize, height: cornerSize,
                                    transform: [{ scaleX: -1 }, { scaleY: -1 }],
                                }}
                            />
                        </>
                    )}

                    <Tiled
                        source={PERSON_PANEL_TOP_EDGE}
                        tileW={topTileW}
                        tileH={topEdgeH}
                        width={edgeW}
                        height={topEdgeH}
                        style={{ top: 0, left: cornerSize }}
                    />
                    <Tiled
                        source={PERSON_PANEL_BOTTOM_EDGE}
                        tileW={bottomTileW}
                        tileH={bottomEdgeH}
                        width={edgeW}
                        height={bottomEdgeH}
                        style={{ bottom: 0, left: cornerSize }}
                    />
                    <Tiled
                        source={PERSON_PANEL_LEFT_EDGE}
                        tileW={vertEdgeW}
                        tileH={vertTileH}
                        width={vertEdgeW}
                        height={edgeH}
                        style={{ left: 0, top: cornerSize }}
                    />
                    <Tiled
                        source={PERSON_PANEL_LEFT_EDGE}
                        tileW={vertEdgeW}
                        tileH={vertTileH}
                        width={vertEdgeW}
                        height={edgeH}
                        style={{ right: 0, top: cornerSize, transform: [{ scaleX: -1 }] }}
                    />

                    <Image
                        source={PERSON_PANEL_TOP_CORNER}
                        resizeMode="stretch"
                        style={{ position: 'absolute', top: 0, left: 0, width: cornerSize, height: cornerSize }}
                    />
                    <Image
                        source={PERSON_PANEL_TOP_CORNER}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', top: 0, right: 0, width: cornerSize, height: cornerSize,
                            transform: [{ scaleX: -1 }],
                        }}
                    />
                    <Image
                        source={PERSON_PANEL_BOTTOM_CORNER}
                        resizeMode="stretch"
                        style={{ position: 'absolute', bottom: 0, left: 0, width: cornerSize, height: cornerSize }}
                    />
                    <Image
                        source={PERSON_PANEL_BOTTOM_CORNER}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', bottom: 0, right: 0, width: cornerSize, height: cornerSize,
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
    // borderRadius — 2026-09-26, живая жалоба ("задний фон торчит по углам
    // треугольником"): раньше был захардкожен в 6 — судя по всему, остался
    // от ДО FRAME_SCALE (30%-е увеличение декоративного угла, 2026-09-19),
    // когда CORNER_SIZE был меньше. Радиус на весь CORNER_SIZE (34px) оказался
    // ЧРЕЗМЕРНЫМ (резал саму рамку, живая жалоба), сдвиг самой дуги
    // (CORNER_SHIFT-подход) — ЕЩЁ ХУЖЕ (живая жалоба "всё стало ужасно",
    // откачено). NOTCH_RADIUS (глубина диагональной фаски дуги по
    // alpha-каналу, не весь CORNER_SIZE) — лучший из проверенных вариантов:
    // не идеален (чуть торчит по словам пользователя), но заметно лучше
    // остальных попыток. Если возвращаться к правке этого угла — делать
    // маленькими шагами с промежуточной проверкой, не менять несколько
    // слоёв сразу.
    wrap: { position: 'absolute', top: 0, left: 0, borderRadius: NOTCH_RADIUS, overflow: 'hidden' },
});
