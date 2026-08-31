// src/lib/runnerDamageTokens.js
import { statusWorsened } from '../constants/runnerAnimations';

/**
 * Бэк не отдаёт тип жетона повреждения — `Runner::toArray()` шлёт только
 * `status` (healthy/damaged/broken/destroyed), без того, ЧЕМ конкретно
 * ударило (Вмятина/Рикошет/Занос/Ракета/Аномалия, см. DAMAGE_TOKENS в
 * constants/GameConstants.js). До этого захода (2026-08-31) `RunnerCard`
 * читал `runner.damageTokens` напрямую — поле, которого в реальной партии
 * НИКОГДА не бывает (заглушка только в constants/mockGameData.js) — кружки
 * повреждений на карточке были ВСЕГДА пустыми (жалоба пользователя: "при
 * получении повреждений не закрашиваются кружочки, это разве нормально?").
 * См. TODO в CLAUDE.md — было заранее известно, вариант "фронт копит типы из
 * потока событий" выбран вместо ожидания правки бэка.
 *
 * **Важно (найдено ЖИВЬЮМ, не по чтению кода)**: транзиентное событие с ТИПОМ
 * жетона (damage/ricochet/rocket/stupor/anomaly, см. Damage.php на бэке) —
 * НЕ гарантирует реальный удар по здоровью! Конкретно 'anomaly' публикуется
 * ДВАЖДЫ разными путями: (1) `Damage::anomaly()` — вскрыт жетон опасности,
 * тип оказался "Аномалия" → РЕАЛЬНО зовёт `RunnerDamageService::run()` (урон
 * есть) И запускает редирект; (2) `Anomaly::handle()` (сам орchestrator-
 * обработчик редиректа) — если редирект приземлил бегуна ПРЯМО на клетку
 * ТИПА "anomaly" на карте (`Move.php`, независимый путь через
 * `RoadType::ANOMALY`), публикует ТОТ ЖЕ 'anomaly'-транзиент, но БЕЗ вызова
 * RunnerDamageService — чистое перемещение, статус не меняется. Живой тест
 * (2026-08-31, curl-партия, danger-клетка → каскад из 2 подряд 'anomaly') —
 * статус бегуна остался healthy, а первая версия этого файла (считавшая
 * КАЖДЫЙ транзиент жетоном) ошибочно закрасила ОБА кружка.
 *
 * Фикс — двухшаговая корреляция, тот же приём, что уже применяется в
 * lib/runnerAnimTriggers.js для `pending`-слияния step_move/runner_save:
 * транзиентный тип-событие только ЗАПОМИНАЕТ "если для этого бегуна прямо
 * сейчас придёт runner_damage — вот какого он типа" (см. `notePendingType`),
 * а реальный жетон создаётся ТОЛЬКО когда версионное `runner_damage`
 * ДЕЙСТВИТЕЛЬНО приходит с ухудшением статуса (см. `consumePendingType`,
 * вызывается из reduceAndLog — porядок публикации на бэке: транзиент всегда
 * ставится в очередь Mercure ПЕРЕД версионным `RunnerSaveEvent('damage')` в
 * одном и том же коде-пути `Damage::damage()`/`RunnerDamageService::run()`).
 * "Чистые" anomaly-редиректы (без damage) просто остаются невостребованными
 * pending-записями — ничего не портят, следующий вызов `notePendingType` для
 * того же бегуна их перезатирает.
 *
 * Слабое место (то же самое уже принято для 'fly'-триггера аномалии в
 * lib/runnerAnimTriggers.js) — транзиентное событие не несёт id бегуна, берём
 * `activeRunner` ТЕКУЩЕГО ходящего игрока (`game.playerOrder`). Достаточно
 * надёжно: жетон повреждения срабатывает именно когда ДВИЖУЩИЙСЯ бегун
 * наступает на клетку опасности, других участников тут не бывает.
 */
const DAMAGE_TOKEN_EVENTS = new Set(['damage', 'ricochet', 'rocket', 'stupor', 'anomaly']);

/**
 * Транзиентное событие → `{runnerId, type}` | `null` (не про жетон
 * повреждения, либо не удалось определить бегуна из текущего game-стейта).
 * `gameRef` — актуальный `game` НА МОМЕНТ события (см. GameBoardScreen).
 */
export function identifyPendingDamageType(e, gameRef) {
    if (!DAMAGE_TOKEN_EVENTS.has(e.event)) return null;
    const game = gameRef.current;
    const mover = game?.gamePlayers?.find((p) => String(p.id) === String(game.playerOrder));
    if (mover?.activeRunner == null) return null;
    return { runnerId: mover.activeRunner, type: e.event };
}

/**
 * Версионное событие → id бегуна, если это 'runner_damage' с РЕАЛЬНЫМ
 * ухудшением статуса (не лечение, не дубль) — сигнал вызывающему коду:
 * "сходи забери pending-тип этого бегуна (см. hooks/useRunnerDamageTokens
 * #consumePendingType) и запиши жетон, если он там есть". `null` — либо не
 * 'runner_damage', либо статус не ухудшился (см. ту же проверку в
 * lib/runnerAnimTriggers.js#handleVersionedRunnerAnimEvent — статус НЕ
 * ухудшился, например, для дублей события после реконнекта).
 */
export function getWorsenedDamageRunnerId(prevGame, e) {
    if (e.event !== 'runner_damage') return null;
    const patch = e.runnerId;
    const prev = prevGame?.runners?.find((r) => r.id === patch.id);
    if (!prev || !statusWorsened(prev.status, patch.status)) return null;
    return patch.id;
}
