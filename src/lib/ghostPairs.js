// src/lib/ghostPairs.js
// "Призрак" (PlayerAbility::GHOST на бэке) — активный бегун проходит СКВОЗЬ
// другого бегуна на своей клетке (мирно стоят рядом в idle, не коллизионная
// поза).
//
// **2026-09-26, переписано начисто** — предыдущая версия слушала транзиентное
// событие 'ghost_pass' с полями {runnerId, otherRunnerId}, которого на бэке
// НЕТ И НИКОГДА НЕ БЫЛО (проверено `grep` по всему
// `D:\Programming\runner-game-backend\src` — ноль совпадений). Реальный сигнал
// от `GhostCollisionResolver::tryConsume()` — событие 'ghost_consumed'
// (`MercuryEvent/Orchestrator/GhostConsumedEvent.php`), и оно ВЕРСИОННОЕ
// (несёт `version`), не транзиентное — раньше это тоже слушалось не в том
// коллбэке (`onTransient`, куда версионные события вообще не попадают, см.
// useMercure/store/runnerGameReducer.js). Итог — фича "мирное сосуществование"
// не срабатывала в реальной игре ни разу с момента добавления (2026-09-09).
//
// Payload `ghost_consumed` — `{player, ability}`, id ИГРОКА, не бегуна, и БЕЗ
// клетки вообще (`GhostConsumedEvent.php`, поля ровно эти два плюс версия).
// Реконструируем бегуна и клетку из game-стейта той же эвристикой, что уже
// применяется для anomaly/damage-токенов (lib/runnerDamageTokens.js) — на
// момент столкновения единственный кандидат на "с кем это случилось" —
// АКТИВНЫЙ бегун этого игрока, а "с кем именно" — тот, кто прямо сейчас стоит
// на той же клетке (совпадение позиций — тот же признак, которым и BoardGrid
// определяет "на клетке двое"). Собственный `runner_save` мовера публикуется
// РАНЬШЕ 'ghost_consumed' в том же запросе (см. Move.php — `tryConsume()`
// вызывается уже ПОСЛЕ того, как позиция применена и сохранена), так что к
// этому моменту прочитанный game-стейт уже видит обоих на одной клетке.
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
 * стейт не трогает (тот же паттерн, что
 * lib/runnerDamageTokens.js#identifyPendingDamageType). `prevGame` — стейт
 * ДО применения этого события редьюсером (тот же параметр, что `state` в
 * GameBoardScreen#reduceAndLog) — само 'ghost_consumed' позицию не меняет,
 * так что "до"/"после" тут равнозначны, но следуем общему соглашению файла.
 */
export function identifyGhostConsumption(prevGame, e) {
    if (e.event !== 'ghost_consumed') return null;
    const player = prevGame?.gamePlayers?.find((p) => String(p.id) === String(e.player));
    if (player?.activeRunner == null) return null;
    const runner = prevGame?.runners?.find((r) => String(r.id) === String(player.activeRunner));
    if (!runner || runner.segment == null) return null;
    const other = prevGame?.runners?.find(
        (r) => r.id !== runner.id && r.segment === runner.segment
            && r.positionX === runner.positionX && r.positionY === runner.positionY,
    );
    if (!other) return null;
    return { key: ghostPairKey(runner.id, other.id, runner.segment, runner.positionX, runner.positionY) };
}
