// src/constants/mockGameData.js

/**
 * Заглушка в форме РЕАЛЬНОГО ответа GET /api/runner_game (см. RunnerGame::toArray()
 * на бэке и README проекта бэкенда). Когда экран подключится к API, этот объект
 * просто заменяется на данные запроса/Mercure — переписывать компоненты не придётся,
 * они уже читают именно эту форму полей.
 *
 * trackBegin/trackMiddle/trackEnd — копии реальных карт из
 * D:\Programming\runner-game-backend\assets\tracks (start.json, bend.json, gorge.json),
 * чтобы дефолтный вид доски был похож на настоящий, а не на случайный узор.
 *
 * ВАЖНО (расхождение с реальным контрактом): поле runners[].damageTokens ниже —
 * ЗАГЛУШКА. Runner::toArray() на бэке отдаёт только status (healthy/damaged/broken/
 * destroyed), БЕЗ типов конкретных жетонов повреждения. Чтобы на карточке бегуна
 * можно было показать тип повреждения (это прямое требование ТЗ), бэку нужно будет
 * либо добавить это поле, либо фронт будет получать типы из потока событий
 * (danger/damage/ricochet/rocket/stupor/anomaly) и копить их сам. Пока — мок.
 */

const START_GRID = [
    ['road', 'road', 'road', 'road', 'road', 'road'],
    ['road', 'road', 'danger_3', 'road', 'road', 'road'],
    ['sand', 'road', 'road', 'danger_3', 'road', 'sand'],
    ['sand', 'danger_2', 'road', 'road', 'road', 'mud'],
    ['sand', 'road', 'road', 'danger_2', 'road', 'sand'],
    ['mud', 'danger_2', 'road', 'danger', 'danger', 'mud'],
    ['sand', 'road', 'road', 'road', 'sand', 'sand'],
    ['sand', 'sand', 'road', 'road', 'sand', 'sand'],
];

const BEND_GRID = [
    ['sand', 'sand', 'road', 'road', 'sand', 'sand'],
    ['sand', 'road', 'danger', 'road', 'sand', 'sand'],
    ['sand', 'danger', 'road', 'sand', 'sand', 'sand'],
    ['sand', 'road', 'danger', 'wall', 'mud', 'mud'],
    ['sand', 'danger', 'road', 'sand', 'sand', 'mud'],
    ['wall', 'sand', 'wall', 'road', 'sand', 'sand'],
    ['sand', 'sand', 'danger', 'danger', 'sand', 'sand'],
    ['sand', 'sand', 'road', 'road', 'sand', 'sand'],
];

const GORGE_GRID = [
    ['sand', 'sand', 'road', 'road', 'sand', 'sand'],
    ['wall', 'sand', 'danger', 'danger', 'sand', 'wall'],
    ['wall', 'sand', 'mud', 'road', 'sand', 'wall'],
    ['wall', 'wall', 'road', 'danger', 'wall', 'wall'],
    ['wall', 'wall', 'road', 'road', 'wall', 'wall'],
    ['wall', 'wall', 'mud', 'danger', 'wall', 'wall'],
    ['wall', 'sand', 'danger', 'road', 'sand', 'wall'],
    ['sand', 'sand', 'road', 'danger', 'sand', 'sand'],
];

function player(id, username, opts) {
    return {
        id,
        user: { id, username },
        step: opts.step ?? 0,
        fine: 0,
        status: opts.status ?? 'active',
        ability: opts.ability ?? null,
        color: opts.color,
        dice1: opts.dice[0],
        dice2: opts.dice[1],
        dice3: opts.dice[2],
        dice4: opts.dice[3],
    };
}

function runner(id, playerId, type, opts = {}) {
    return {
        id,
        playerId,
        type,
        status: opts.status ?? 'healthy',
        segment: opts.segment ?? null,
        positionX: opts.positionX ?? null,
        positionY: opts.positionY ?? null,
        dice: opts.dice ?? null,
        rollDice: null,
        rollMoves: null,
        // мок, см. предупреждение в шапке файла
        damageTokens: opts.damageTokens ?? [null, null],
    };
}

export const MOCK_GAME = {
    id: 1,
    status: 'active',
    createdAt: null,
    updatedAt: null,
    finishedAt: null,
    playerOrder: '101',
    extraTurnPlayer: null,
    round: 2,
    step: 1,
    trackQueue: ['hell', 'interest', 'monument', 'mud', 'ruin', 'wasteland', 'serenity'],
    trackNumber: 3,
    trackGain: 3, // кубик дороги этого раунда
    withFinish: false,
    trackBegin: { name: 'start', grid: START_GRID },
    trackMiddle: { name: 'bend', grid: BEND_GRID },
    trackEnd: { name: 'gorge', grid: GORGE_GRID },
    maxPlayer: 4,

    gamePlayers: [
        player(101, 'Ева', { dice: [3, 6, 1, null], ability: null, step: 1, color: 'red' }),
        player(102, 'Марк', { dice: [null, 2, 5, 4], ability: 'boost', color: 'blue' }),
        player(103, 'Ирина', { dice: [6, 6, 3, 1], ability: null, color: 'yellow' }),
        player(104, 'Дамир', { dice: [2, null, null, 5], ability: 'heal', color: 'green' }),
    ],

    runners: [
        // Ева (101)
        runner(1, 101, 'tank', { segment: 0, positionX: 2, positionY: 1 }),
        runner(2, 101, 'athlete', {
            segment: 0, positionX: 2, positionY: 3,
            status: 'damaged', damageTokens: [{ type: 'ricochet' }, null],
        }),
        runner(3, 101, 'sprinter', {}),
        runner(4, 101, 'reaper', {}),

        // Марк (102)
        runner(5, 102, 'tank', { segment: 1, positionX: 4, positionY: 0 }),
        runner(6, 102, 'athlete', {
            segment: 1, positionX: 1, positionY: 5,
            status: 'broken', damageTokens: [{ type: 'stupor' }, { type: 'damage' }],
        }),
        runner(7, 102, 'sprinter', { segment: 0, positionX: 6, positionY: 4 }),
        runner(8, 102, 'reaper', {}),

        // Ирина (103)
        runner(9, 103, 'tank', { segment: 2, positionX: 3, positionY: 2 }),
        runner(10, 103, 'athlete', {}),
        runner(11, 103, 'sprinter', {
            segment: 1, positionX: 7, positionY: 1,
            status: 'damaged', damageTokens: [{ type: 'rocket' }, null],
        }),
        runner(12, 103, 'reaper', { segment: 2, positionX: 0, positionY: 0 }),

        // Дамир (104)
        runner(13, 104, 'tank', {}),
        runner(14, 104, 'athlete', { segment: 2, positionX: 5, positionY: 3 }),
        runner(15, 104, 'sprinter', {}),
        runner(16, 104, 'reaper', {}),
    ],
};
