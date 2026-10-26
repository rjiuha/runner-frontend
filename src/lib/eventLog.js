// src/lib/eventLog.js
import { getLocale, LOCALES } from './i18n';

/**
 * Человеко-читаемое описание Mercure-события runner_game_{id} — для
 * отладочного лога на экране (см. components/game/EventLogPanel.js).
 * Без доступа к текущему game (только поля самого события) — этого
 * достаточно, чтобы понять ПОРЯДОК происходящего, id всё равно видны
 * в панели/на доске рядом. Неизвестные события — fallback (raw JSON).
 *
 * 2026-10-26, переключение языка UI: `describeEvent(e, t)` теперь принимает
 * `t` (из useI18n() вызывающей стороны, см. GameBoardScreen.js#pushLog) —
 * весь текст собирается через словарь game.eventLogEvents.* (ru.js/en.js).
 */

// ВАЖНО: LEFT_UP визуально ведёт ВПРАВО, RIGHT_UP — ВЛЕВО (подтверждено
// живьём и задокументировано в resolveMoveAssetDirection, constants/
// runnerAnimations.js, isEast = direction === 'LEFT_UP' — та же путаница
// в названиях направлений backend'а). Стрелки здесь зеркалят это тем же
// образом (LEFT_UP → ↗, RIGHT_UP → ↖ и симметрично для *_DOWN), иначе
// диалог переброса столкновения показывает направление, обратное
// реальному движению на доске. Сами стрелки — универсальные глиф-символы,
// НЕ текст, в переводе не участвуют.
const DIRECTION_LABEL = { LEFT_UP: '↗', UP: '↑', RIGHT_UP: '↖', LEFT_DOWN: '↘', DOWN: '↓', RIGHT_DOWN: '↙' };
const dir = (d) => (d == null ? '—' : DIRECTION_LABEL[d] ?? d);
// Экспортирован отдельно — переиспользуется в GameBoardScreen.js для показа
// результата броска столкновения в баннере "Использовать/Перебросить" (см.
// pendingCollisionRoll там), не только в отладочном логе.
export const directionLabel = dir;

// Та же техника, что у constants/gameplayTips.js — не через t() (массив, не
// строка/функция), читает текущую локаль напрямую.
const STEP_NAMES_RU = ['начало', 'выбор', 'усиление', 'движение', 'выстрел', 'бонус дороги'];
const STEP_NAMES_EN = ['start', 'select', 'ability', 'move', 'shoot', 'road bonus'];
function stepName(s) {
    const names = getLocale() === LOCALES.EN ? STEP_NAMES_EN : STEP_NAMES_RU;
    return names[s] ?? s;
}

export function describeEvent(e, t) {
    const ev = (key, params) => t(`game.eventLogEvents.${key}`, params);
    switch (e.event) {
        // 'game_active'/'player_active'/'player_roll_move_dice' удалены
        // бэком целиком, 2026-09-18 (см. runnerGameReducer.js) — партия
        // теперь всегда приходит уже активной первым REST-снапшотом, эти
        // события больше никогда не появятся в логе.
        case 'game_turn_changed':
            return ev('gameTurnChanged', { playerOrder: e.playerOrder, round: e.round, step: stepName(e.step) })
                + (e.extraTurnPlayer != null ? ev('gameTurnChangedExtra', { extraTurnPlayer: e.extraTurnPlayer }) : '');
        case 'game_track_updated':
            return ev('gameTrackUpdated', { trackNumber: e.trackNumber }) + (e.withFinish ? ev('gameTrackUpdatedFinish') : '');
        case 'game_cell_updated':
            // 2026-10-14: бэк переименовал row/column → positionX/positionY.
            return ev('gameCellUpdated', { segment: e.cell?.segment, x: e.cell?.positionX, y: e.cell?.positionY, type: e.cell?.type });
        case 'game_finish':
            return ev('gameFinish', { status: e.status });
        case 'player_out':
            return ev('playerOut', { name: e.player?.username ?? e.player?.id });
        case 'player_step':
            return ev('playerStep', { id: e.player?.id, step: stepName(e.player?.step), activeRunner: e.player?.activeRunner ?? '—' });
        case 'player_reset':
            return ev('playerReset', { id: e.player?.id, ability: e.player?.ability ?? '—' });
        case 'step_begin':
            return ev('stepBegin', { playerOrder: e.playerOrder, step: e.step, trackGain: e.trackGain ?? '—' });
        case 'step_selection':
            return ev('stepSelection', { player: e.player?.id, runner: e.runner?.id, dice: e.runner?.dice ?? e.runner?.rollDice });
        case 'step_move':
            return ev('stepMove', { player: e.player, runner: e.activeRunner })
                + (e.direction ? dir(e.direction) : ev('stepMoveStart', { col: e.firstPosition }));
        case 'step_collision':
            return ev('stepCollision', { player: e.player, result: e.accept ? ev('accepted') : ev('declined') });
        case 'step_road_bonus':
            return ev('stepRoadBonus', { player: e.player, result: e.accept ? ev('accepted') : ev('declined') });
        case 'step_shoot':
            return ev('stepShoot', { player: e.player, runner: e.activeRunner })
                + (e.accept ? ev('stepShootDirection', { direction: dir(e.direction) }) : ev('stepShootSkipped'));
        case 'step_ability':
            return ev('stepAbility', { player: e.player, result: e.accept ? e.details?.ability ?? '?' : ev('stepAbilitySkipped') });
        case 'ability_boost':
            return ev('abilityBoost', { id: e.runner?.id, dice: e.runner?.dice });
        case 'ability_ghost':
            return ev('abilityGhost');
        case 'ability_heal':
            return ev('abilityHeal', { id: e.runner?.id, status: e.runner?.status });
        case 'ability_reaper':
            // 2026-10-14: бэк переименовал attack → attackDirection.
            return ev('abilityReaper', { segment: e.reaper?.segment, x: e.reaper?.positionX, y: e.reaper?.positionY })
                + (e.attackDirection ? ev('abilityReaperAttack', { direction: dir(e.attackDirection) }) : '');
        case 'runner_save':
            return ev('runnerSave', {
                id: e.runnerId?.id, type: e.runnerId?.type, segment: e.runnerId?.segment,
                x: e.runnerId?.positionX, y: e.runnerId?.positionY, dice: e.runnerId?.dice ?? e.runnerId?.rollDice ?? '—',
            });
        case 'runner_damage':
            return ev('runnerDamage', { id: e.runnerId?.id, status: e.runnerId?.status });
        case 'runner_destroy':
            // 2026-10-14: reason теперь всегда DestroyReason-enum ('terrain' вместо
            // прежних прямых 'fire'/'acid'/'wall'/'edge') — конкретная клетка, если
            // причина terrain, лежит отдельно в terrainType.
            return ev('runnerDestroy', { id: e.runnerId?.id })
                + (e.reason ? ev('runnerDestroyReason', { reason: e.reason, terrainType: e.terrainType }) : '');
        case 'runner_ball':
            return ev('runnerBall', { id: e.runnerId?.id });
        case 'danger':
            return ev('danger', { danger: e.danger });
        case 'collision':
            // 2026-10-14: бэк заменил enum collision (LOWER/TOP) + сырые runnerId/
            // otherRunnerId на явные flyingRunnerId/stayingRunnerId/resolution.
            return ev('collision', { flyingRunnerId: e.flyingRunnerId, direction: dir(e.direction) })
                + (e.resolution === 'pending' ? ev('collisionPending', { decisionPlayerId: e.decisionPlayerId }) : '');
        case 'damage':
            return ev('damage', { damage: e.damage });
        case 'ricochet':
            return ev('ricochet', { direction: dir(e.direction) });
        case 'rocket':
            return ev('rocket', { n: e.stunt, direction: dir(e.direction) });
        case 'stupor':
            return ev('stupor', { n: e.stunt, direction: dir(e.direction) });
        case 'anomaly':
            return ev('anomaly', { direction: dir(e.direction) });
        case 'attack':
            // 2026-10-14: бэк переименовал target → targetId.
            return ev('attack', { type: e.attack, target: e.targetId, result: e.hit ? ev('hit') : ev('miss') });
        // 'ghost_pass' убран 2026-09-26 — такого события на бэке нет и не было
        // (см. lib/ghostPairs.js за полным разбором), реальное имя — ниже.
        case 'ghost_consumed':
            return ev('ghostConsumed', { player: e.player });
        default:
            return null; // неизвестное событие — вызывающий код сам решает fallback
    }
}

/** Fallback для событий без спец-форматтера — сырые поля без служебных gameId/version. */
export function rawEventFallback(e) {
    const { event, version, gameId, ...rest } = e;
    return `${event} ${JSON.stringify(rest)}`;
}
