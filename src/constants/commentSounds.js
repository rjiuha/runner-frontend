// src/constants/commentSounds.js
/**
 * "Комментарии" — голосовая озвучка ключевых игровых результатов, играет
 * один раз за событие (не привязана к типу бегуна, в отличие от
 * constants/runnerSounds.js). Добавлено пользователем в
 * assets/sounds/action/comments/, 2026-09-11 (папка переехала туда
 * 2026-10-14 вместе с остальной реструктуризацией — канал "Комментатор"
 * объединён с "Игровыми звуками", см. lib/audioSettings.js). Тот же
 * static-require паттерн, что и у RUNNER_SOUNDS/BACKGROUND_MUSIC_TRACKS —
 * при добавлении новых вариантов (start_3.wav и т.п.) дописывать сюда
 * вручную, Metro не читает директорию целиком.
 */
export const COMMENT_SOUNDS = {
    // Игра стартовала, игроки получили кубики на самом первом ходу партии
    // (см. GameBoardScreen — триггерится на первом 'player_roll_move_dice',
    // это событие бэк шлёт ТОЛЬКО из StepBeginService::start(), никогда из
    // startNewRound()/resetPlayer(), так что оно уникально для старта игры).
    start: [
        require('../assets/sounds/action/comments/start_1.wav'),
        require('../assets/sounds/action/comments/start_2.wav'),
    ],
    // Бегун уничтожен (любой способ — выстрел/стена/ловушка Жнеца/отброс за
    // край и т.п., см. statusWorsened('destroyed') в lib/runnerAnimTriggers).
    destroyed: [require('../assets/sounds/action/comments/destroyed_1.wav')],
    // Игрок выбыл (player_out) — НЕ играть, если это выбывание последнего
    // соперника и партия тут же завершилась (см. GameBoardScreen).
    lost: [require('../assets/sounds/action/comments/lost_1.wav')],
    // Столкновение — играет ОДИН РАЗ поверх зацикленного COLLISION_SOUND
    // (см. runnerSounds.js), синхронно с появлением позы столкновения.
    collision: [require('../assets/sounds/action/comments/collision_1.wav')],
    // Опасная клетка вскрылась как Аномалия (чёрная дыра) — транзиентное
    // 'anomaly'-событие, см. lib/runnerAnimTriggers#handleSequenceItem.
    anomalyHole: [require('../assets/sounds/action/comments/anomaly_hole_1.wav')],
    // Выстрел (обычный ИЛИ атака Жнеца при размещении, оба идут через
    // AttackResolutionService::resolve() на бэке, read-only) не попал —
    // бэк ВСЕГДА публикует транзиентный 'attack' ({attack, target, hit}),
    // даже если урон не применяется (hit:false), см. GameBoardScreen#onTransient.
    miss: [
        require('../assets/sounds/action/comments/miss_1.wav'),
        require('../assets/sounds/action/comments/miss_2.wav'),
        require('../assets/sounds/action/comments/miss_3.mp3'),
    ],
    // Опасная клетка вскрылась как Рикошет — транзиентное 'ricochet'-событие
    // (та же категория "исход опасности", что и anomaly/rocket/stupor, см.
    // Damage.php на бэке), своего анимационного case не имеет — визуальный
    // эффект (fly того runnerId, которого рикошет реально задел) даёт
    // последующий 'runner_save' с явным reason через handleSequenceItem.
    // Голосовая реплика тут; сам SFX удара — RICOCHET_HIT_SOUNDS ниже,
    // играет ОДНОВРЕМЕННО, см. GameBoardScreen.
    ricochet: [require('../assets/sounds/action/comments/ricochet_1.wav')],
    // Партия завершилась победой НАБЛЮДАЮЩЕГО игрока (game_finish,
    // winnerPlayer.id === myPlayer.id) — добавлено 2026-10-14. Для
    // проигравшего отдельного "финишного" звука нет (его собственное
    // выбывание уже озвучено через 'lost' раньше, см. GameBoardScreen).
    victory: [
        require('../assets/sounds/action/comments/victory_1.wav'),
        require('../assets/sounds/action/comments/victory_2.wav'),
    ],
};
