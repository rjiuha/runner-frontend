// src/lib/ghostPairs.js
// "Призрак" (PlayerAbility::GHOST на бэке, Move.php#isGhostPass) — активный
// бегун проходит СКВОЗЬ другого бегуна на своей клетке (мирно стоят рядом в
// idle, не коллизионная поза), пока не исчерпал кубик хода в этот ход; на
// последнем шаге срабатывает обычная коллизия. Бэк шлёт транзиентный
// 'ghost_pass' {runnerId, otherRunnerId} БЕЗ позиции — сама позиция мовера
// берётся из АКТУАЛЬНОГО game.runners на момент события (его собственный
// runner_save публикуется РАНЬШЕ этого события в том же батче, см. Move.php,
// так что к этому моменту позиция уже свежая).
//
// Ключ пары — id ОБОИХ бегунов (меньший первым, тот же порядок сравнения,
// что уже используется в BoardGrid#tokenOverlay для pairKey реальных
// коллизий) + КОНКРЕТНАЯ клетка, на которой они сейчас вместе. Привязка к
// клетке, а не только к паре id — намеренная: если те же двое ПОЗЖЕ окажутся
// вместе на СОВСЕМ ДРУГОЙ клетке через настоящую (не ghost) коллизию, старая
// метка не должна случайно погасить её в мирную idle-позу — ключ сам
// "протухает", как только кто-то из пары покидает эту клетку, отдельная
// очистка не нужна.
export function ghostPairKey(idA, idB, segment, positionX, positionY) {
    const pair = idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
    return `${pair}@${segment}-${positionX}-${positionY}`;
}

/**
 * Смотрит на транзиентное событие 'ghost_pass' и, если применимо, возвращает
 * {key} для записи в стор (см. hooks/useGhostPairs.js). Чистая функция —
 * единственный побочный эффект через возвращаемое значение, сам стейт не
 * трогает (тот же паттерн, что lib/runnerDamageTokens.js#identifyPendingDamageType).
 */
export function identifyGhostPass(e, gameRef) {
    if (e.event !== 'ghost_pass') return null;
    const runner = gameRef.current?.runners?.find((r) => String(r.id) === String(e.runnerId));
    if (!runner || runner.segment == null) return null;
    return {
        key: ghostPairKey(e.runnerId, e.otherRunnerId, runner.segment, runner.positionX, runner.positionY),
    };
}
