// src/store/runnerGameReducer.js
import { GAME_STATUS } from '../constants/GameConstants';

const SEGMENT_KEY_BY_INDEX = ['trackBegin', 'trackMiddle', 'trackEnd'];

function patchPlayer(game, playerId, patch) {
    return {
        ...game,
        gamePlayers: game.gamePlayers.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
    };
}

/** runnerPatch должен содержать id — по нему ищем существующего бегуна (иначе добавляем, см. runner_ball). */
function patchRunner(game, runnerPatch) {
    const exists = game.runners.some((r) => r.id === runnerPatch.id);
    return {
        ...game,
        runners: exists
            ? game.runners.map((r) => (r.id === runnerPatch.id ? { ...r, ...runnerPatch } : r))
            : [...game.runners, runnerPatch],
    };
}

function patchPlayerRunners(game, runnerPatches) {
    return runnerPatches.reduce((g, patch) => patchRunner(g, patch), game);
}

/**
 * game_cell_updated шлёт {segment, row, column} — row/column это positionX(0-7)/positionY(0-5)
 * (см. Cell::getRow()/getColumn() и TrackSegment::getCellInfo($row,$col) на бэке), то есть те же
 * индексы, что и в самом grid[][] сегмента — патчим напрямую по ним, без перестановки осей.
 */
function patchCell(game, cell) {
    const key = SEGMENT_KEY_BY_INDEX[cell.segment];
    const segment = game[key];
    if (!key || !segment?.grid) return game;

    const grid = segment.grid.map((line, x) =>
        x === cell.row ? line.map((v, y) => (y === cell.column ? cell.type : v)) : line,
    );
    return { ...game, [key]: { ...segment, grid } };
}

/**
 * Чистая функция: состояние партии + версионное Mercure-событие → новое состояние.
 * Только "плоское" абсолютное слияние полей — без очереди/анимации (это Фаза 3, см. план в CLAUDE.md).
 * Транзиентные события без version (step_*, danger/collision/damage/ricochet/rocket/stupor/anomaly)
 * сюда не попадают — useMercure отправляет их в onTransient.
 */
export function runnerGameReducer(game, e) {
    switch (e.event) {
        // GameActiveEvent шлёт status через ->name ("ACTIVE"), а не ->value как везде
        // остальные — сознательно берём константу, а не e.status.
        case 'game_active':
            return { ...game, status: GAME_STATUS.ACTIVE };

        case 'game_turn_changed':
            return {
                ...game,
                step: e.step,
                round: e.round,
                playerOrder: e.playerOrder,
                extraTurnPlayer: e.extraTurnPlayer,
            };

        case 'game_track_updated':
            return {
                ...game,
                trackBegin: e.trackBegin,
                trackMiddle: e.trackMiddle,
                trackEnd: e.trackEnd,
                trackNumber: e.trackNumber,
                withFinish: e.withFinish,
            };

        case 'game_cell_updated':
            return patchCell(game, e.cell);

        case 'game_finish':
            return {
                ...game,
                status: GAME_STATUS.FINISH,
                finishedAt: e.finishedAt,
                gamePlayers: game.gamePlayers.map((p) => {
                    const found = e.players?.find((ep) => ep.id === p.id);
                    return found ? { ...p, status: found.status } : p;
                }),
            };

        case 'player_active':
            return patchPlayer(game, e.player.id, { status: e.player.status });

        case 'player_out':
            return patchPlayer(game, e.player.id, {
                status: e.player.status,
                activeRunner: e.player.activeRunner,
            });

        // Единственный источник activeRunner на снапшоте нет этого поля вовсе.
        case 'player_step':
            return patchPlayer(game, e.player.id, {
                step: e.player.step,
                activeRunner: e.player.activeRunner,
            });

        // Единственное событие, которое возвращает НАЗНАЧЕННЫЙ бегуну кубик
        // сразу после успешного /select — без этого случая runner.dice не
        // обновлялся до следующего runner_save (при первом MOVE), и подтверждённый
        // выбор визуально выглядел как "кубик откатился обратно" (см. CLAUDE.md).
        // ⚠ поля игрока тут БЕЗ подчёркивания (dice1, не dice_1 как в остальных
        // player_*-событиях) — сверено построчно с StepSelectionEvent.php.
        case 'step_selection': {
            const withPlayer = patchPlayer(game, e.player.id, {
                step: e.player.step,
                activeRunner: e.player.activeRunner,
                dice1: e.player.dice1,
                dice2: e.player.dice2,
                dice3: e.player.dice3,
                dice4: e.player.dice4,
            });
            return patchRunner(withPlayer, e.runner);
        }

        // Публикуется в начале хода/раунда — по факту дублирует game_turn_changed
        // для game-полей, но приходит РАНЬШЕ него в некоторых переходах (новый
        // раунд), так что применяем и это событие, а не полагаемся только на
        // game_turn_changed.
        case 'step_begin':
            return patchPlayer(
                { ...game, step: e.step, playerOrder: e.playerOrder, trackGain: e.trackGain },
                e.player.id,
                { step: e.player.step },
            );

        case 'player_roll_move_dice':
            return patchPlayer(game, e.player.id, {
                dice1: e.player.dice_1,
                dice2: e.player.dice_2,
                dice3: e.player.dice_3,
                dice4: e.player.dice_4,
            });

        case 'player_reset': {
            const withPlayer = patchPlayer(game, e.player.id, {
                dice1: e.player.dice_1,
                dice2: e.player.dice_2,
                dice3: e.player.dice_3,
                dice4: e.player.dice_4,
                ability: e.player.ability,
            });
            return patchPlayerRunners(withPlayer, e.player.runners ?? []);
        }

        case 'runner_save':
        case 'runner_damage':
        case 'runner_destroy':
        case 'runner_ball':
            return patchRunner(game, e.runnerId);

        case 'ability_boost':
            return patchRunner(
                patchPlayer(game, e.player.id, {
                    ability: e.player.ability,
                    dice1: e.player.dice_1,
                    dice2: e.player.dice_2,
                    dice3: e.player.dice_3,
                    dice4: e.player.dice_4,
                }),
                e.runner,
            );

        case 'ability_ghost':
            return patchPlayer(game, e.player.id, {
                ability: e.player.ability,
                dice1: e.player.dice_1,
                dice2: e.player.dice_2,
                dice3: e.player.dice_3,
                dice4: e.player.dice_4,
            });

        case 'ability_heal':
            return patchRunner(
                patchPlayer(game, e.player.id, {
                    ability: e.player.ability,
                    dice1: e.player.dice_1,
                    dice2: e.player.dice_2,
                    dice3: e.player.dice_3,
                    dice4: e.player.dice_4,
                }),
                e.runner,
            );

        case 'ability_reaper':
            return patchRunner(
                patchPlayer(game, e.player.id, {
                    ability: e.player.ability,
                    dice1: e.player.dice_1,
                    dice2: e.player.dice_2,
                    dice3: e.player.dice_3,
                    dice4: e.player.dice_4,
                }),
                { id: e.reaper.id, positionX: e.reaper.positionX, positionY: e.reaper.positionY, segment: e.reaper.segment },
            );

        default:
            return game;
    }
}
