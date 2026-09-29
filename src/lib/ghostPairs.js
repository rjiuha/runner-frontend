// src/lib/ghostPairs.js
// "Призрак" (PlayerAbility::GHOST на бэке) — активный бегун проходит СКВОЗЬ
// другого бегуна на своей клетке (мирно стоят рядом в idle, не коллизионная
// поза).
//
// **2026-09-27 — упрощено под обогащённый `ghost_consumed`** (см.
// `2_backend_todo.md`, п.2.2, реализовано бэкендером): событие теперь несёт
// `runnerId`/`otherRunnerId` явно (`GhostConsumedEvent.php`,
// `GhostCollisionResolver::tryConsume()` — оба бегуна уже были в скоупе,
// просто не передавались раньше). Реконструировать "кто вообще участвовал"
// эвристикой (активный бегун игрока + кто ещё на его клетке) больше не
// нужно — только клетку, на которой они сейчас вместе, всё ещё приходится
// брать из game-стейта (событие координаты не несёт).
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
 * Смотрит на версионное событие 'ghost_consumed' и, если применимо,
 * возвращает {key} для записи в стор (см. hooks/useGhostPairs.js). Чистая
 * функция — единственный побочный эффект через возвращаемое значение, сам
 * стейт не трогает. `prevGame` — стейт ДО применения этого события
 * редьюсером (само 'ghost_consumed' позицию не меняет, так что "до"/"после"
 * тут равнозначны, но следуем общему соглашению файла).
 */
export function identifyGhostConsumption(prevGame, e) {
    if (e.event !== 'ghost_consumed') return null;
    const runner = prevGame?.runners?.find((r) => String(r.id) === String(e.runnerId));
    if (!runner || runner.segment == null) return null;
    return { key: ghostPairKey(e.runnerId, e.otherRunnerId, runner.segment, runner.positionX, runner.positionY) };
}
