// src/constants/spritePacks.js
import { RUNNER_STATUS, RUNNER_TYPES } from './GameConstants';
import { resolveMoveAssetDirection } from './runnerAnimHelpers';
import { STRIP_PACKS } from './spritePackStrips';

/**
 * Новый AI-сгенерированный спрайт-пак (assets/sprites/, добавлен
 * пользователем 2026-09-21, перекрашен во все цвета игрока 2026-09-23, см.
 * CLAUDE.md) — заменяет старую gif-анимацию (constants/runnerAnimations.js)
 * И старый комбинированный gif-спрайт-хак только для Скаута/Android
 * (constants/scoutSpriteSheets.js — оставлен в репозитории нетронутым,
 * больше никем не используется из боевого кода после этой миграции, только
 * screens/__SpriteSheetPreview.js).
 *
 * **Формат исходного пака**: один PNG на тип+статус+цвет — ЕДИНАЯ сетка
 * cell_size×cell_size (одна ячейка на ВЕСЬ файл), рядом .json с разметкой
 * (spritesheet.cell_size/rows[] — `type:'rotations'` (8 направлений по
 * одному кадру, "south" — аватар в панели) или `type:'animation'`
 * (animation+direction+frame_count)).
 *
 * **НО этот файл больше НЕ читает исходные .json/.png напрямую** (2026-09-24,
 * см. SpritePackAnimation.js за причину) — цельный многострочный лист
 * Android рендерит размыто НЕЗАВИСИМО от масштаба/DP/transform (подтверждено
 * методичным исключением переменных и живым сравнением на устройстве).
 * Реальный источник картинок теперь — `spritePackStrips.js` (АВТОСГЕНЕРИРОВАН
 * одноразовым scratch-скриптом, который порезал каждую строку исходного
 * листа на СВОЙ маленький PNG-файл, "полоску" — скрипт не в репозитории, при
 * повторной перезаливке пака придётся написать заново по тому же рецепту:
 * для каждой строки взять `crop(0, row*cellH, cellW*frameCount, cellH)` из
 * исходного листа и сохранить отдельным файлом). Разметка (какая строка —
 * какая анимация/направление) не изменилась — `buildIndex` ниже просто
 * читает её из `rowsMeta`, которую `spritePackStrips.js` тоже несёт (скопирована
 * из исходных .json один в один). Сами исходные ЦЕЛЬНЫЕ .png/.json пака
 * ОСТАЮТСЯ на диске в `assets/sprites/<pack>/` (не удалялись — источник для
 * возможной перенарезки), просто этот файл их больше не требует.
 *
 * **Проверено сверкой всех 8 файлов** (2026-09-23): у некоторых — дублирующиеся
 * строки на одну и ту же анимацию+направление (напр. scout-healthy — ДВЕ
 * строки "attack north", tank-damaged — ШЕСТЬ строк "move south-west") —
 * похоже на артефакт самой AI-генерации пака, не наша ошибка. buildIndex()
 * ниже берёт ПЕРВОЕ вхождение, остальные молча игнорирует — не пытались
 * понять, зачем дубликаты существуют.
 *
 * **Известные пробелы контента (не мои — так наrisован пак)**, компенсированы
 * фолбэками в resolveSpriteRef так же, как старый gif-путь уже фолбэчился на
 * idle для отсутствующих клипов:
 *  - Athlete (оба статуса) и Tank-damaged, Athlete-damaged — нет строки
 *    "start" вообще (у старого gif-набора атлета start БЫЛ) — откатится на
 *    idle через тот же `bucket.start ?? bucket.move?.[side] ?? idle`
 *    принцип, что и раньше.
 *  - Drone — нет строк "fly"/"destroyed" (у старого набора тоже их не было —
 *    не регрессия, тот же fallback на idle, что и раньше).
 *  - Attack есть только на 3 "вперёд" направлениях (northEast/north/
 *    northWest) у всех типов кроме drone — 1-в-1 совпадает с тем, что уже
 *    было у старого gif-набора (southEast/southWest атака никогда не
 *    рисовалась, откатывалась на idle).
 *
 * **НЕ реализовано в этой миграции**: scaleCorrection (см. старый
 * scoutSpriteSheets.js#start — там была измеренная численно поправка на то,
 * что персонаж занимает разную долю своего холста в разных клипах). Для
 * нового пака такое несоответствие не измерялось (нет живого доступа к
 * устройству в этой сессии) — если какой-то клип визуально будет казаться
 * крупнее/мельче соседних, разбираться тем же методом (bbox непрозрачных
 * пикселей по кадрам), что и в прошлый раз.
 */

function normalizeAnimName(raw) {
    const n = (raw || '').toLowerCase().replace(/\s+/g, '');
    if (n === 'idlebreathing') return 'idle';
    if (n === 'destroy' || n === 'destoyed') return 'destroyed';
    return n;
}
function normalizeDirection(raw) {
    return (raw || '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// buildIndex/bucket читают METADATA строк из STRIP_PACKS (spritePackStrips.js,
// автосгенерирован из тех же исходных .json, что раньше читались напрямую) —
// сама разметка (имя анимации/направление/frame_count) не изменилась, только
// источник картинки теперь НЕ "весь лист + row", а отдельный PNG-файл на
// каждую строку (см. докстринг spritePackStrips.js — размытие на реальном
// устройстве, независимо от масштаба/transform, оказалось следствием общего
// размера огромного многострочного листа).
function buildIndex(rowsMeta) {
    const index = { byName: {}, rotations: null };
    for (const r of rowsMeta) {
        if (r.type === 'rotations') {
            index.rotations = { row: r.row, frameCount: r.frame_count, directions: (r.directions || []).map(normalizeDirection) };
            continue;
        }
        const name = normalizeAnimName(r.animation);
        const dir = normalizeDirection(r.direction);
        if (!index.byName[name]) index.byName[name] = {};
        if (!(dir in index.byName[name])) {
            index.byName[name][dir] = { row: r.row, frameCount: r.frame_count };
        }
    }
    return index;
}

function bucket(packDir) {
    const pack = STRIP_PACKS[packDir];
    return { cell: pack.cell, strips: pack.strips, index: buildIndex(pack.rowsMeta) };
}

const scoutHealthyBucket = bucket('scout');
const scoutDamagedBucket = bucket('scout-damaged');
const tankHealthyBucket = bucket('tank');
const tankDamagedBucket = bucket('tank-damaged');
const athleteHealthyBucket = bucket('athlete');
const athleteDamagedBucket = bucket('athlete-damaged');
const droneBucket = bucket('drone');
const obstacleBucket = bucket('obstacle');

/** type -> { healthy: bucket, damaged: bucket } — REAPER/BALL используют один и тот же bucket в обоих слотах. */
export const SPRITE_PACKS = {
    [RUNNER_TYPES.SPRINTER]: { healthy: scoutHealthyBucket, damaged: scoutDamagedBucket },
    [RUNNER_TYPES.TANK]: { healthy: tankHealthyBucket, damaged: tankDamagedBucket },
    [RUNNER_TYPES.ATHLETE]: { healthy: athleteHealthyBucket, damaged: athleteDamagedBucket },
    [RUNNER_TYPES.REAPER]: { healthy: droneBucket, damaged: droneBucket },
    [RUNNER_TYPES.BALL]: { healthy: obstacleBucket, damaged: obstacleBucket },
};

function statusFolder(status) {
    return status === RUNNER_STATUS.HEALTHY ? 'healthy' : 'damaged';
}

/** Ищет строку по имени анимации + направлению; без направления или без
 * совпадения по направлению — берёт первую попавшуюся строку с этим именем
 * (для одно-направленных клипов вроде shot/heal/broken/destroyed/bomb,
 * которые в паке иногда помечены "north", иногда "south" без разницы). */
function pickRow(index, name, direction) {
    const byDir = index.byName[name];
    if (!byDir) return null;
    if (direction && byDir[direction]) return byDir[direction];
    const keys = Object.keys(byDir);
    return keys.length ? byDir[keys[0]] : null;
}

function frameRef(b, name, direction) {
    const hit = pickRow(b.index, name, direction);
    if (!hit) return null;
    return { cell: b.cell, row: hit.row, frameCount: hit.frameCount, _strips: b.strips };
}

// Известные art-несостыковки МЕЖДУ КЛИПАМИ одного бакета (2026-09-25, живая
// жалоба пользователя + числовое подтверждение) — `cell` у всех клипов
// бакета ОДИН (см. bucket()/withSource ниже), но персонаж может быть
// нарисован в РАЗНЫХ местах внутри своей ячейки в разных клипах (разная
// обрезка исходников AI-пака под каждый клип) — НЕ баг кода, зафиксированный
// пробел ("scaleCorrection... не реализовано в этой миграции", см. докстринг
// модуля выше). Измерено bbox непрозрачных пикселей (pngjs, одноразовый
// scratch-скрипт сессии, не в репозитории): scout-healthy 'start' (последний
// кадр) — персонаж на 13px НИЖЕ, чем в 'idle'/'move' (те двое между собой
// практически совпадают, 2px — обычное "дыхание" самого idle между кадрами,
// не расхождение) — на переходе start→idle это читалось как "бегун
// подскакивает вверх". offsetY (px в исходных координатах файла,
// масштабируется вместе с cell в SpritePackAnimation) — сдвигает ОТОБРАЖЕНИЕ
// клипа, не сам кроп: отрицательное значение поднимает картинку, чтобы
// скомпенсировать то, что персонаж на этом клипе нарисован ниже, чем на
// соседних. Пофиксил ТОЛЬКО эту пару (по прямому решению пользователя —
// остальные типы/клипы не промерены, если всплывёт похожее в другом месте,
// разбираться тем же методом).
// 2026-09-26: файлы scout-healthy физически увеличены ×1.25 (см. CLAUDE.md,
// spritePackStrips.js#scoutStrips.cell) — значение ниже пересчитано в тех же
// координатах (-13 * 1.25 = -16.25, округлено).
const CLIP_OFFSET_Y = {
    [RUNNER_TYPES.SPRINTER]: { healthy: { start: -16 } },
};

// Полоска — ОДНА строка (высота = cell.h), кадры уложены подряд по ширине
// (sheet.w = cell.w * frameCount) — `row` в возвращаемом `frame` для
// SpritePackAnimation теперь ВСЕГДА 0 (полоска физически не содержит других
// строк, вырезать по вертикали больше нечего).
function withSource(ref, colorKey, offsetY = 0) {
    if (!ref) return null;
    const rowStrips = ref._strips[ref.row];
    const source = rowStrips[colorKey] ?? Object.values(rowStrips)[0];
    return {
        source,
        cell: ref.cell,
        sheet: { w: ref.cell.w * ref.frameCount, h: ref.cell.h },
        row: 0,
        frameCount: ref.frameCount,
        offsetY,
    };
}

/**
 * Единственная точка резолва анимационного кадра для нового спрайт-пака —
 * зеркалит ветвление getRunnerAnimationImage (constants/runnerAnimations.js)
 * 1-в-1 (та же логика destroyed/heal/burn/acid/broken/start/bomb), но
 * возвращает {source, cell:{w,h}, columns, row, frameCount} вместо готового
 * require()-ассета — сам кадр внутри строки выбирает
 * SpritePackAnimation/SpritePackFrame по текущему времени.
 * Возвращает null, если для этого типа нет пака вообще (сейчас такого нет —
 * все 5 типов покрыты, оставлено на случай нового типа в будущем).
 */
export function resolveSpriteRef(type, status, anim, colorKey) {
    const pack = SPRITE_PACKS[type];
    if (!pack) return null;
    const folder = statusFolder(status);
    const b = pack[folder];

    const idleRef = () => {
        const idle = frameRef(b, 'idle');
        if (idle) return withSource(idle, colorKey);
        // Совсем крайний случай (не должен случаться ни у одного из 5 типов) —
        // первый кадр rotations/south как статичная поза.
        return withSource({ cell: b.cell, row: b.index.rotations.row, frameCount: 1, _strips: b.strips }, colorKey);
    };

    if (anim?.kind === 'destroyed') {
        const fromFolder = statusFolder(anim.fromStatus ?? status);
        const fromBucket = pack[fromFolder];
        const ref = frameRef(fromBucket, 'destroyed');
        return ref ? withSource(ref, colorKey) : idleRef();
    }
    if (anim?.kind === 'heal') {
        const ref = frameRef(pack.damaged, 'heal');
        return ref ? withSource(ref, colorKey) : idleRef();
    }
    if (anim?.kind === 'burn' || anim?.kind === 'acid') {
        const ref = frameRef(pack.healthy, anim.kind);
        return ref ? withSource(ref, colorKey) : idleRef();
    }
    if (!anim || anim.kind === 'idle') {
        if (status === RUNNER_STATUS.BROKEN) {
            const ref = frameRef(b, 'broken');
            return ref ? withSource(ref, colorKey) : idleRef();
        }
        if (status === RUNNER_STATUS.DESTROYED) {
            const ref = frameRef(b, 'destroyed');
            return ref ? withSource(ref, colorKey) : idleRef();
        }
        return idleRef();
    }
    if (anim.kind === 'move') {
        const dirKey = resolveMoveAssetDirection(anim.direction, anim.depthChanged, anim.targetLaneShifted);
        const ref = frameRef(b, 'move', dirKey);
        return ref ? withSource(ref, colorKey) : idleRef();
    }
    if (anim.kind === 'attack') {
        const dirKey = resolveMoveAssetDirection(anim.direction, anim.depthChanged, anim.targetLaneShifted);
        const ref = frameRef(b, 'attack', dirKey);
        return ref ? withSource(ref, colorKey) : idleRef();
    }
    if (anim.kind === 'fly') { const ref = frameRef(b, 'fly'); return ref ? withSource(ref, colorKey) : idleRef(); }
    if (anim.kind === 'gotShot') { const ref = frameRef(b, 'shot'); return ref ? withSource(ref, colorKey) : idleRef(); }
    if (anim.kind === 'collision') { const ref = frameRef(b, 'collision', anim.side); return ref ? withSource(ref, colorKey) : idleRef(); }
    if (anim.kind === 'start') {
        const ref = frameRef(b, 'start') ?? (anim.side ? frameRef(b, 'move', anim.side) : null);
        // offsetY — ТОЛЬКО когда реально нашёлся собственный 'start'-клип
        // (см. CLAUDE_OFFSET_Y выше) — фолбэк на 'move' (когда у типа вообще
        // нет 'start', см. Жнец) уже использует move-геометрию, поправку
        // применять не к чему.
        const offsetY = frameRef(b, 'start') ? (CLIP_OFFSET_Y[type]?.[folder]?.start ?? 0) : 0;
        return ref ? withSource(ref, colorKey, offsetY) : idleRef();
    }
    if (anim.kind === 'bomb') { const ref = frameRef(b, 'bomb'); return ref ? withSource(ref, colorKey) : idleRef(); }
    return idleRef();
}

/**
 * Список ВСЕХ .source-ассетов, которые resolveSpriteRef МОЖЕТ вернуть для
 * этого type+status+colorKey (move во всех направлениях, attack, fly,
 * gotShot, start, bomb, collision east/west, idle/broken/destroyed из
 * ТЕКУЩЕГО бакета) — только для прогрева (см. RunnerToken.js#prewarmedCombos,
 * 2026-09-25, по прямому запросу пользователя: "мигание при смене idle на
 * move" — гипотеза: конкретное направление move/attack на native декодируется
 * ВПЕРВЫЕ ровно в момент первого реального использования, и SpritePackAnimation
 * держит старый (idle, почти всегда уже тёплый) кадр, пока идёт декод — токен
 * успевает физически сдвинуться (слайд не ждёт декод позы), а поза потом
 * резко "прыгает" на move уже на середине пути. Прогрев ВСЕХ вариантов заранее
 * убирает именно этот первый-раз-холодный декод).
 *
 * heal/burn/acid добавлены ОТДЕЛЬНО, не через общий проход по текущему
 * бакету — resolveSpriteRef резолвит их из ФИКСИРОВАННОГО бакета независимо
 * от статуса ЭТОГО бегуна (heal — всегда damaged, burn/acid — всегда healthy,
 * см. ветки выше) — просто добавить `pack.damaged`/`pack.healthy` целиком
 * означало бы прогревать и ЧУЖИЕ (текущему статусу не нужные) move/attack/...
 * клипы того бакета, впустую тратя decode-время на то, что этот конкретный
 * бегун может вообще никогда не показать.
 */
export function listAllSpriteSources(type, status, colorKey) {
    const pack = SPRITE_PACKS[type];
    if (!pack) return [];
    const sources = new Set();
    const addRef = (ref) => {
        const withSrc = ref ? withSource(ref, colorKey) : null;
        if (withSrc?.source) sources.add(withSrc.source);
    };
    const b = pack[statusFolder(status)];
    addRef(frameRef(b, 'idle'));
    for (const name of Object.keys(b.index.byName)) {
        for (const dir of Object.keys(b.index.byName[name])) {
            addRef(frameRef(b, name, dir));
        }
    }
    addRef(frameRef(pack.damaged, 'heal'));
    addRef(frameRef(pack.healthy, 'burn'));
    addRef(frameRef(pack.healthy, 'acid'));
    return Array.from(sources);
}

/**
 * Статичный кадр для аватарки в панели игрока (RunnerCard/ReaperCard) — в
 * паке нет отдельного "avatar"-арта (в отличие от старой gif-системы, где
 * это был свой, более детальный портретный рендер) — используем кадр
 * "south" из строки rotations (индекс берётся из meta.directions, а не
 * захардкожен — на случай, если порядок направлений когда-нибудь изменится
 * в новой перезаливке пака).
 */
export function resolveSpriteAvatarFrame(type, status, colorKey) {
    const pack = SPRITE_PACKS[type];
    if (!pack) return null;
    const b = pack[statusFolder(status)];
    const southIdx = b.index.rotations.directions.indexOf('south');
    const rowStrips = b.strips[b.index.rotations.row];
    const source = rowStrips[colorKey] ?? Object.values(rowStrips)[0];
    return {
        source,
        cell: b.cell,
        sheet: { w: b.cell.w * b.index.rotations.frameCount, h: b.cell.h },
        row: 0,
        frameIndex: southIdx >= 0 ? southIdx : 0,
    };
}
