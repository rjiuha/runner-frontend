// src/constants/gameplayTips.js
import { getLocale, LOCALES } from '../lib/i18n';

/**
 * Короткие подсказки/фразы для экранов со спиннером (лобби/ожидание старта
 * партии/любая пере-синхронизация) — см. components/ui/LoadingTip.js.
 * Утверждено пользователем построчно, 2026-09-12 — не менять формулировки
 * без явного запроса, факты по игровым механикам сверены с бэком (см.
 * CLAUDE.md за разбором каждого пункта). RU-массив НЕ трогался при переводе
 * (2026-10-26) — EN рядом, НЕ через словари lib/i18n.js#t() (там значение
 * ожидается строкой/функцией, не массивом) — читает текущую локаль прямо
 * через lib/i18n.js#getLocale().
 */
const GAMEPLAY_TIPS_RU = [
    'Урон одинаков для всех типов — Танк не крепче Скаута.',
    'В Танка выстрел попадает чаще всех — у него хуже шансы при столкновении.',
    'Атлет реже всех попадает под выстрел — самый безопасный.',
    'Жнеца нельзя подстрелить.',
    'Жнец никогда не уничтожается — просто возвращается в резерв.',
    'Призрак спасает один раз за раунд, но не на последнем шаге.',
    'Призрак не нужен против Жнеца — с ним не сталкиваются.',
    'При столкновении выбор переброса за более крупным бегуном.',
    'Лечение снимает только одно повреждение.',
    'Накат доступен, когда все твои бегуны сходили, и есть свободный кубик.',
    'Танк думал, что живучий — калибр думает иначе.',
    'Скаут и Танк получают один урон — Скаут просто обижается громче.',
    'Шестёрка лечит — остальные грани кубика молча сочувствуют.',
    'Накат разрешают, только когда деваться уже некуда.',
    'При столкновении решает не тот, кто прав, а тот, кто крупнее.',
    'Дроид не нарушает правила — он же просто дроид.',
];

const GAMEPLAY_TIPS_EN = [
    "Damage is the same for every type — the Tank isn't tougher than the Scout.",
    'The Tank gets hit by shots the most often — it has worse odds in a collision.',
    'The Athlete gets shot the least often — the safest one.',
    "The Reaper can't be shot.",
    'The Reaper is never destroyed — it just returns to reserve.',
    "The Ghost saves you once per round, but not on the last step.",
    "The Ghost is useless against the Reaper — you don't collide with it.",
    'In a collision, the bigger runner decides whether to reroll.',
    'Healing removes only one point of damage.',
    'A roll move is available once all your runners have moved and a die is free.',
    'The Tank thought it was tough — the caliber disagrees.',
    'The Scout and the Tank take the same damage — the Scout just complains louder.',
    'A six heals — the other faces of the die just offer silent sympathy.',
    "A roll move is only allowed when there's nowhere else to go.",
    "In a collision, it's not who's right that decides — it's who's bigger.",
    "The drone doesn't break the rules — it's just a drone.",
];

function currentTips() {
    return getLocale() === LOCALES.EN ? GAMEPLAY_TIPS_EN : GAMEPLAY_TIPS_RU;
}

/** Случайный элемент, отличный от excludeValue (если элементов больше одного). */
export function pickRandomTip(excludeValue) {
    const tips = currentTips();
    if (tips.length <= 1) return tips[0];
    let tip;
    do {
        tip = tips[Math.floor(Math.random() * tips.length)];
    } while (tip === excludeValue);
    return tip;
}
