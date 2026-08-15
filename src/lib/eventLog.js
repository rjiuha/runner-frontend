// src/lib/eventLog.js

/**
 * Человеко-читаемое описание Mercure-события runner_game_{id} — для
 * отладочного лога на экране (см. components/game/EventLogPanel.js).
 * Без доступа к текущему game (только поля самого события) — этого
 * достаточно, чтобы понять ПОРЯДОК происходящего, id всё равно видны
 * в панели/на доске рядом. Неизвестные события — fallback (raw JSON).
 */

const DIRECTION_LABEL = { LEFT_UP: '↖', UP: '↑', RIGHT_UP: '↗', LEFT_DOWN: '↙', DOWN: '↓', RIGHT_DOWN: '↘' };
const dir = (d) => (d == null ? '—' : DIRECTION_LABEL[d] ?? d);

const STEP_LABEL = ['начало', 'выбор', 'усиление', 'движение', 'выстрел', 'бонус дороги'];
const step = (s) => STEP_LABEL[s] ?? s;

export function describeEvent(e) {
    switch (e.event) {
        case 'game_active':
            return 'Партия началась';
        case 'game_turn_changed':
            return `Ход игрока ${e.playerOrder}, раунд ${e.round}, шаг «${step(e.step)}»`
                + (e.extraTurnPlayer != null ? ` — ждём столкновение от игрока ${e.extraTurnPlayer}` : '');
        case 'game_track_updated':
            return `Новый фрагмент трассы №${e.trackNumber}${e.withFinish ? ' (это финишный!)' : ''}`;
        case 'game_cell_updated':
            return `Клетка (сегм.${e.cell?.segment}, ${e.cell?.row}/${e.cell?.column}) → ${e.cell?.type}`;
        case 'game_finish':
            return `Игра завершена, статус: ${e.status}`;
        case 'player_active':
            return `Игрок ${e.player?.id} готов (статус ${e.player?.status})`;
        case 'player_out':
            return `Игрок ${e.player?.username ?? e.player?.id} выбыл из партии`;
        case 'player_step':
            return `Игрок ${e.player?.id}: шаг → «${step(e.player?.step)}», активный бегун ${e.player?.activeRunner ?? '—'}`;
        case 'player_roll_move_dice':
            return `Игрок ${e.player?.id}: новые кубики [${e.player?.dice_1},${e.player?.dice_2},${e.player?.dice_3},${e.player?.dice_4}]`;
        case 'player_reset':
            return `Игрок ${e.player?.id}: сброс на новый раунд (усиление ${e.player?.ability ?? '—'})`;
        case 'step_begin':
            return `Ход/раунд начат: игрок ${e.playerOrder}, шаг игры ${e.step}, кубик дороги ${e.trackGain ?? '—'}`;
        case 'step_selection':
            return `Игрок ${e.player?.id} выбрал бегуна ${e.runner?.id}, кубик ${e.runner?.dice ?? e.runner?.rollDice}`;
        case 'step_move':
            return `Игрок ${e.player} двигает бегуна ${e.activeRunner}: `
                + (e.direction ? dir(e.direction) : `старт, столбец ${e.firstPosition}`);
        case 'step_collision':
            return `Игрок ${e.player}: столкновение — ${e.accept ? 'принял' : 'отклонил'}`;
        case 'step_road_bonus':
            return `Игрок ${e.player}: бонус кубика дороги — ${e.accept ? 'принял' : 'отклонил'}`;
        case 'step_shoot':
            return `Игрок ${e.player}: выстрел бегуном ${e.activeRunner} — `
                + (e.accept ? `в направлении ${dir(e.direction)}` : 'пропущен');
        case 'step_ability':
            return `Игрок ${e.player}: усиление — ${e.accept ? e.details?.ability ?? '?' : 'пропущено'}`;
        case 'ability_boost':
            return `Буст: бегуну ${e.runner?.id} добавлены очки (теперь ${e.runner?.dice})`;
        case 'ability_ghost':
            return 'Призрак активирован';
        case 'ability_heal':
            return `Лечение: бегун ${e.runner?.id} → ${e.runner?.status}`;
        case 'ability_reaper':
            return `Жнец выставлен: сегм.${e.reaper?.segment}, (${e.reaper?.positionX}/${e.reaper?.positionY})`
                + (e.attack ? `, атака ${dir(e.attack)}` : '');
        case 'runner_save':
            return `Бегун ${e.runnerId?.id} (${e.runnerId?.type}) → сегм.${e.runnerId?.segment}, `
                + `(${e.runnerId?.positionX}/${e.runnerId?.positionY}), очков ${e.runnerId?.dice ?? e.runnerId?.rollDice ?? '—'}`;
        case 'runner_damage':
            return `Бегун ${e.runnerId?.id} повреждён → статус ${e.runnerId?.status}`;
        case 'runner_destroy':
            return `Бегун ${e.runnerId?.id} уничтожен`;
        case 'runner_ball':
            return `Появился шар (бегун ${e.runnerId?.id})`;
        case 'danger':
            return `Опасность: ${e.danger}`;
        case 'collision':
            return `Столкновение: ${e.collision}, направление ${dir(e.direction)}`;
        case 'damage':
            return `Урон: ${e.damage}`;
        case 'ricochet':
            return `Рикошет → ${dir(e.direction)}`;
        case 'rocket':
            return `Ракета: ${e.stunt} клеток → ${dir(e.direction)}`;
        case 'stupor':
            return `Занос: ${e.stunt} клеток → ${dir(e.direction)}`;
        case 'anomaly':
            return `Аномалия → ${dir(e.direction)}`;
        default:
            return null; // неизвестное событие — вызывающий код сам решает fallback
    }
}

/** Fallback для событий без спец-форматтера — сырые поля без служебных gameId/version. */
export function rawEventFallback(e) {
    const { event, version, gameId, ...rest } = e;
    return `${event} ${JSON.stringify(rest)}`;
}
