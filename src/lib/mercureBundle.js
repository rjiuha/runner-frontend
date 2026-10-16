// src/lib/mercureBundle.js

/**
 * 2026-10-16, вынесено по итогам аудита лучших практик — разворачивание
 * бэкового конверта `{event:'action_result', sequence:[...]}` (см. README
 * бэка/GameBoardScreen.js#reduceAndLog за полным разбором контракта)
 * было продублировано ОДИНАКОВЫМ кодом в 4 местах (GameBoardScreen.js#
 * reduceAndLog/onTransient, LobbyScreen.js#reduce/onTransient) — живой баг
 * 2026-09-29 ("андроид не видит зашедшего с веба") случился именно из-за
 * рассинхрона этой логики между экранами при миграции на бандлинг, когда
 * LobbyScreen.js о ней просто забыли.
 *
 * `bundle.sequence ?? [bundle]` — одиночные (не забандленные) события и
 * транзиенты без `sequence` обрабатываются тем же циклом, как бандл из
 * одного элемента. `item.type ?? item.event` — элементы `sequence` несут имя
 * события в поле `type`, транзиентный одиночный `bundle` — в `event` (та же
 * несогласованность контракта, не трогаем, просто нормализуем на границе).
 *
 * `extra` — поля, которые нужно смешать в КАЖДЫЙ развёрнутый элемент (у
 * GameBoardScreen.js это `gameId: bundle.gameId`, нужен debug-логу) — опционально.
 */
export function unwrapBundle(bundle, extra) {
    return (bundle.sequence ?? [bundle]).map((item) => ({ ...item, event: item.type ?? item.event, ...extra }));
}
