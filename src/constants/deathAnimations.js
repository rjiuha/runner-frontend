// src/constants/deathAnimations.js
/**
 * "Смерть" на клетках типа wall (2026-09-12, по прямому запросу пользователя)
 * — заменяет прежний плоский wall_base-тайл двумя вариантами (acid/burn),
 * выбор ДЕТЕРМИНИРОВАННЫЙ по id клетки (см. lib/board.js#pickDeathVariant —
 * та же схема, что уже используется для pickSegmentImage, стабильно на всю
 * партию, не перевыбирается на каждый рендер). НЕ тонируется под цвет игрока
 * — это не бегун, ничейная сущность с фиксированным на всю игру видом (тот
 * же принцип, что у Мяча/RUNNER_TYPES.BALL, см. runnerAnimations.js#ballFixed).
 *
 * idle — 2 варианта на цвет (см. DeathTile в BoardGrid.js: обычное состояние
 * — случайный idle_1/idle_2, статичная картинка). collision — играет ОДИН
 * раз, когда бегун гибнет на этой клетке (см. lib/runnerAnimTriggers.js —
 * тот же момент, когда бегун сам получает терминальную позу 'burn'/'acid').
 *
 * **`idleStatic` — статичный PNG (первый кадр `idle_N.gif`), НЕ анимация**
 * (2026-09-12, живая жалоба: "вернулась старая проблема на android — блики
 * с телепортами при движении бегунов"). Причина — не код (проверено: box-size
 * инвариант токенов и кросс-фейд RunnerToken не менялись), а нагрузка: idle —
 * САМОЕ ЧАСТОЕ состояние Death (по факту — почти всегда, между редкими
 * collision), и НА ОТЛИЧИЕ от него это НЕПРЕРЫВНО анимирующийся gif — при
 * десятке+ Death-тайлов на экране разом это ПОСТОЯННАЯ decode-нагрузка на
 * Fresco (Android). Тот же класс проблемы, что уже полностью убивал
 * производительность в этом проекте (см. CLAUDE.md, "Track 1", 2026-09-02 —
 * прелоад/одновременное проигрывание ~240 анимаций разом). Раз idle-поза
 * САМА ПО СЕБЕ статична (существо просто стоит), анимация тут не нужна
 * вообще — DeathTile теперь рисует ПЕРВЫЙ кадр idle_N как обычный `<Image>`
 * (декодируется ОДИН раз, кэшируется, никакого продолжающегося decode-цикла),
 * а НЕ сам `idle_N.gif`. `collision` остаётся анимированным (короткий, не
 * постоянный).
 *
 * **`prepare`-цикл (случайные короткие "разминки" между idle) убран целиком**
 * (2026-09-12, по прямому запросу пользователя, см. DeathTile в BoardGrid.js
 * за подробным разбором причины) — многократные попытки подогнать
 * длительность JS-таймера под реальную длину gif-файла (то обрыв анимации
 * раньше конца, то риск зацикливания) продолжали давать сбои живьём —
 * фундаментальная причина в том, что JS `setTimeout` не гарантированно
 * синхронизирован с "часами" нативного gif-плеера. Обсудили альтернативы
 * (flipbook по отдельным PNG-кадрам — даёт точный контроль, но кадры вместе
 * весят в 2.5+ раза больше исходного gif, измерено живьём, и требуют
 * собственного JS-таймера на каждый кадр вместо одного нативного decode —
 * больше нагрузки именно там, где уже боролись с производительностью) —
 * решили, что `idle` (статика) + `collision` (уже работает без жалоб)
 * достаточно, `prepare` не стоит цены починки. `prepare_N.gif`-файлы удалены
 * из assets, экспорт `DEATH_PREPARE_MS` тоже (был здесь до этого захода).
 */
export const DEATH_VARIANTS = {
    acid: {
        idle: [
            require('../assets/images/runners/death/acid/death_acid_idle_1.gif'),
            require('../assets/images/runners/death/acid/death_acid_idle_2.gif'),
        ],
        idleStatic: [
            require('../assets/images/runners/death/acid/death_acid_idle_1_static.png'),
            require('../assets/images/runners/death/acid/death_acid_idle_2_static.png'),
        ],
        collision: require('../assets/images/runners/death/acid/death_acid_collision.gif'),
    },
    burn: {
        idle: [
            require('../assets/images/runners/death/burn/death_burn_idle_1.gif'),
            require('../assets/images/runners/death/burn/death_burn_idle_2.gif'),
        ],
        idleStatic: [
            require('../assets/images/runners/death/burn/death_burn_idle_1_static.png'),
            require('../assets/images/runners/death/burn/death_burn_idle_2_static.png'),
        ],
        collision: require('../assets/images/runners/death/burn/death_burn_collision.gif'),
    },
};

// Синхронизация с терминальной позой бегуна (2026-09-12, живая жалоба —
// "collision у death и burn/acid у бегуна должны быть синхронны, бегун
// исчезает чуть раньше") — см. useRunnerAnimations#TERMINAL_HIDE_DELAY_MS
// (2200мс, обе позы бегуна). Раньше тут стояла "естественная" длина ОДНОГО
// проигрывания gif (1800/3400) — для acid это ЗАМЕТНО короче, чем поза
// бегуна, из-за чего Death успевал вернуться в idle, пока бегун ещё горел.
// Теперь оба варианта — единое значение БОЛЬШЕ времени показа бегуна (не
// тютелька-в-тютельку — держим Death в позе collision чуть ДОЛЬШЕ, чтобы
// бегун успел исчезнуть раньше, а не наоборот). gif сам по себе
// ЗАЦИКЛИВАЕТСЯ (native gif-плеер), лишний неполный проигрыш последнего
// цикла — не проблема (целимся не в "один проигрыш", а в "чуть дольше
// терминальной позы бегуна").
export const DEATH_COLLISION_MS = { acid: 2900, burn: 2900 };
