// src/constants/runnerAnimHelpers.js
import { PLAYER_COLOR_HEX, RUNNER_STATUS } from './GameConstants';

/**
 * Чистые, не завязанные ни на какие ассеты (gif ИЛИ спрайт-пак) хелперы,
 * общие для старой и новой анимационных систем — вынесены СЮДА из
 * constants/runnerAnimations.js 2026-09-23 (см. CLAUDE.md), когда
 * выяснилось, что просто импортировать эти 3 функции ИЗ runnerAnimations.js
 * ломает бандлинг: тот файл на верхнем уровне модуля делает require() на
 * сотни gif-файлов (реестр RUNNER_ANIMATION_SETS), и любой импорт хоть
 * одного экспорта оттуда заставляет Metro грузить ВЕСЬ файл целиком —
 * включая эти require(), даже если сами картинки больше нигде не
 * используются. Если какие-то из этих gif-путей на диске окажутся битыми
 * (как и случилось — пользователь независимо переносил avatar-гифки в
 * другую папку), бандл падает целиком для ЛЮБОГО кода, который всего лишь
 * хотел `colorKeyForHex`/`statusWorsened`/`resolveMoveAssetDirection`, даже
 * ни разу не тронув саму gif-анимацию.
 *
 * `runnerAnimations.js` НЕ тронут — оставлен в репозитории нетронутым (на
 * случай отката к gif-системе), просто больше НИКЕМ не импортируется из
 * живого кода (кроме самого себя и мёртвого, никем не импортируемого
 * `constants/scoutSpriteSheets.js`) — его собственные (дублирующиеся)
 * копии этих 3 функций стали просто неиспользуемым кодом внутри мёртвого
 * файла, трогать не пришлось.
 */

/** hex (PLAYER_COLOR_HEX) -> ключ цвета ('red'/'blue'/'green'/'yellow') для выбора готового перекрашенного ассета. */
const HEX_TO_COLOR_KEY = Object.fromEntries(Object.entries(PLAYER_COLOR_HEX).map(([key, hex]) => [hex, key]));
export function colorKeyForHex(hex) {
    return HEX_TO_COLOR_KEY[hex] ?? 'blue';
}

/**
 * Игровое направление (DirectionService, см. lib/hexDirection.js) → ключ
 * направления в наборах move/attack (constants/spritePacks.js). Единственная
 * точка, где решается, какой ассет играть — ХОДЬБА И СТРЕЛЬБА используют её
 * ОДИНАКОВО (см. историю в CLAUDE.md, 2026-09-01).
 *
 * Два независимых нюанса геометрии (см. подробный разбор в CLAUDE.md):
 *  1) LEFT_UP/RIGHT_UP не совпадают с "визуально влево/вправо" — сопоставлено
 *     по факту видимого направления на реальном устройстве.
 *  2) LEFT_UP/RIGHT_UP не всегда "вверх по экрану" — при чётной старой
 *     глубине это чисто боковой шаг/прицел на смещённую "кирпичом" дорожку
 *     без продвижения (south-*), при нечётной — диагональ вперёд (north-*).
 *
 * `direction` в бою — ВСЕГДА одно из 3 "вперёд" (UP/LEFT_UP/RIGHT_UP,
 * MoveDto/ShootDto на бэке других не разрешают) — ветки DOWN/LEFT_DOWN/
 * RIGHT_DOWN ниже физически недостижимы из боевого кода, добавлены ТОЛЬКО
 * ради screens/MockRoadScreen.js ("Шаг" в любую из 6 смежных клеток, не
 * только вперёд) — существующее поведение для 3 боевых направлений не
 * тронуто ни на бит. В паке (spritePackStrips.js) реально ЕСТЬ south/east/
 * west move-клипы (проверено, 2026-09-25) — используем их напрямую, а не
 * приближение через south-east/south-west, как было в первой версии мока.
 */
export function resolveMoveAssetDirection(direction, depthChanged, targetLaneShifted) {
    if (direction === 'UP') return 'north';
    if (direction === 'DOWN') return 'south';
    if (direction === 'LEFT_DOWN') return 'west';
    if (direction === 'RIGHT_DOWN') return 'east';
    const isEast = direction === 'LEFT_UP';
    if (depthChanged) return isEast ? 'northEast' : 'northWest';
    if (targetLaneShifted) return isEast ? 'southEast' : 'southWest';
    return isEast ? 'northEast' : 'northWest';
}

/** Порядок "тяжести" статуса — чтобы отличить "стало хуже" (гот-шот/уничтожен) от улучшения (лечение). */
const STATUS_ORDER = [RUNNER_STATUS.HEALTHY, RUNNER_STATUS.DAMAGED, RUNNER_STATUS.BROKEN, RUNNER_STATUS.DESTROYED];
export function statusWorsened(prevStatus, nextStatus) {
    return STATUS_ORDER.indexOf(nextStatus) > STATUS_ORDER.indexOf(prevStatus);
}
