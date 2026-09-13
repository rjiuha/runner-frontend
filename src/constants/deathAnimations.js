// src/constants/deathAnimations.js
/**
 * "Смерть" на клетках типа wall (2026-09-13, откат к точечной анимации по
 * прямому запросу пользователя — постоянно стоящее существо на каждой
 * клетке wall, введённое 2026-09-12, убрано). Клетка wall теперь ВСЕГДА
 * показывает обычный wall_base-тайл (см. BoardGrid.js) — единственное, что
 * тут осталось, это ОДНОРАЗОВАЯ анимация 'collision' (acid/burn), которая
 * проигрывается, когда бегун гибнет на такой клетке (см.
 * lib/runnerAnimTriggers.js — бегун получает терминальную позу 'acid'/'burn'
 * ВМЕСТО обычной 'destroyed', и GameBoardScreen/BoardGrid#DeathTile
 * синхронно показывают ту же анимацию поверх скрытого на это время wall-тайла,
 * см. BoardGrid#activeDeathCells). Выбор acid/burn — ДЕТЕРМИНИРОВАННЫЙ по id
 * клетки (см. lib/board.js#pickDeathVariant, та же схема, что и
 * pickSegmentImage) — оба потребителя (тайл клетки и поза бегуна) обязаны
 * получать ОДИН И ТОТ ЖЕ вариант для одной и той же клетки. НЕ тонируется под
 * цвет игрока — ничейная сущность с фиксированным на всю партию видом (тот
 * же принцип, что у Мяча/RUNNER_TYPES.BALL, см. runnerAnimations.js#ballFixed).
 *
 * `idle`/`idleStatic` (постоянно стоящее существо) — убраны вместе с самими
 * ассетами (idle_N.gif/idle_N_static.png удалены с диска, 2026-09-13, по
 * прямому запросу пользователя). Файлы `collision` заодно переехали из
 * подпапок acid/burn на верхний уровень `death/`.
 */
export const DEATH_VARIANTS = {
    acid: {
        collision: require('../assets/images/runners/death/death_acid_collision.gif'),
    },
    burn: {
        collision: require('../assets/images/runners/death/death_burn_collision.gif'),
    },
};

// Длительность показа collision-позы на клетке — держим её ЧУТЬ ДОЛЬШЕ, чем
// терминальная поза самого бегуна (useRunnerAnimations#TERMINAL_HIDE_DELAY_MS,
// 2200мс для acid/burn), чтобы бегун успел исчезнуть раньше, а не наоборот
// (см. CLAUDE.md, 2026-09-12). gif сам по себе зацикливается (native
// gif-плеер) — лишний неполный повторный проигрыш последнего цикла не
// проблема, целимся не в "один точный проигрыш", а в "не короче терминальной
// позы бегуна".
export const DEATH_COLLISION_MS = { acid: 2900, burn: 2900 };
