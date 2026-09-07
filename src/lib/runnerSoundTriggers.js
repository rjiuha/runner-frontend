// src/lib/runnerSoundTriggers.js
import { RUNNER_SOUNDS, FALLBACK_MOVE_SOUND, pickRandom } from '../constants/runnerSounds';
import { RUNNER_STATUS } from '../constants/GameConstants';

/**
 * Голосовая реплика при выборе бегуна активным (SELECT прошёл, стал
 * activeRunner игрока, см. GameBoardScreen#reduceAndLog — диффит
 * player.activeRunner до/после применения события). Только 3 обычных типа
 * (Скаут/Солдат/Атлет) имеют voice-реплики — Жнец/Мяч возвращают null, вызывающий
 * код просто ничего не играет.
 *
 * damagedActive — 30% шанс, ТОЛЬКО если бегун сейчас повреждён (damaged/broken),
 * иначе (70% случаев при повреждении, и всегда при healthy) — обычная active-
 * реплика (по прямому запросу пользователя, 2026-09-03).
 */
export function pickActiveSoundSource(type, status) {
    const set = RUNNER_SOUNDS[type];
    if (!set?.active?.length) return null;
    const isDamaged = status === RUNNER_STATUS.DAMAGED || status === RUNNER_STATUS.BROKEN;
    if (isDamaged && set.damagedActive?.length && Math.random() < 0.30) {
        return pickRandom(set.damagedActive);
    }
    return pickRandom(set.active);
}

/** Звук выстрела ('attack'-триггер) — есть у всех 4 "стреляющих" типов (Скаут/Солдат/Атлет/Жнец). */
export function pickShootSoundSource(type) {
    const set = RUNNER_SOUNDS[type];
    return set?.shoot?.length ? pickRandom(set.shoot) : null;
}

/**
 * Звук шага ('move'-триггер, зацикленно пока идёт анимация) — заменяет
 * общий lazer.mp3, который раньше был звуком шага ДЛЯ ВСЕХ типов (2026-09-03,
 * прямой запрос пользователя). У Солдата (RUNNER_TYPES.ATHLETE) своего
 * move.wav нет — используем тот же lazer.mp3 как фолбэк ИМЕННО для него.
 */
export function pickMoveSoundSource(type) {
    const set = RUNNER_SOUNDS[type];
    return set?.move ?? FALLBACK_MOVE_SOUND;
}

/** Звук появления ('start'-триггер) — только у Жнеца (прилёт) и Мяча (спавн из danger-клетки). */
export function pickStartSoundSource(type) {
    return RUNNER_SOUNDS[type]?.start ?? null;
}
