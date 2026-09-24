// src/constants/avatarGifs.js
import { RUNNER_STATUS, RUNNER_TYPES } from './GameConstants';

/**
 * Аватарки бегунов в панели игрока (RunnerCard/ReaperCard) — по прямому
 * запросу пользователя, 2026-09-24, ОТДЕЛЬНЫЙ набор анимированных GIF
 * (assets/images/avatars/), НЕ статичный кадр из нового спрайт-пака
 * (spritePacks.js#resolveSpriteAvatarFrame — тот факт, что новый пак вообще
 * не имеет отдельного портретного арта, был известным пробелом с самого его
 * подключения, см. CLAUDE.md 2026-09-23). Обычные `<Image>` — Fresco/RN сами
 * анимируют gif "из коробки", своего покадрового рендера тут не нужно (в
 * отличие от SpritePackAnimation — та существует именно потому, что PNG не
 * умеет анимироваться сама).
 *
 * **Drone (Жнец) — только один сет, без healthy/damaged разделения** (тот же
 * принцип, что и у его боевых анимаций в spritePacks.js — Жнец физически не
 * получает статус damaged по игровым правилам). **Мяч (BALL) не имеет
 * аватарки вообще** (не в RUNNER_ORDER, RunnerCard его не рендерит) — тут
 * просто нет записи, `hasAvatarGif` для него всегда false.
 */
const avatarGifSources = {
    [RUNNER_TYPES.SPRINTER]: {
        healthy: {
            red: require('../assets/images/avatars/scout_healthy_avatar_red.gif'),
            blue: require('../assets/images/avatars/scout_healthy_avatar_blue.gif'),
            green: require('../assets/images/avatars/scout_healthy_avatar_green.gif'),
            yellow: require('../assets/images/avatars/scout_healthy_avatar_yellow.gif'),
        },
        damaged: {
            red: require('../assets/images/avatars/scout_damaged_avatar_red.gif'),
            blue: require('../assets/images/avatars/scout_damaged_avatar_blue.gif'),
            green: require('../assets/images/avatars/scout_damaged_avatar_green.gif'),
            yellow: require('../assets/images/avatars/scout_damaged_avatar_yellow.gif'),
        },
    },
    [RUNNER_TYPES.TANK]: {
        healthy: {
            red: require('../assets/images/avatars/tank_healthy_avatar_red.gif'),
            blue: require('../assets/images/avatars/tank_healthy_avatar_blue.gif'),
            green: require('../assets/images/avatars/tank_healthy_avatar_green.gif'),
            yellow: require('../assets/images/avatars/tank_healthy_avatar_yellow.gif'),
        },
        damaged: {
            red: require('../assets/images/avatars/tank_damaged_avatar_red.gif'),
            blue: require('../assets/images/avatars/tank_damaged_avatar_blue.gif'),
            green: require('../assets/images/avatars/tank_damaged_avatar_green.gif'),
            yellow: require('../assets/images/avatars/tank_damaged_avatar_yellow.gif'),
        },
    },
    [RUNNER_TYPES.ATHLETE]: {
        healthy: {
            red: require('../assets/images/avatars/athlet_healthy_avatar_red.gif'),
            blue: require('../assets/images/avatars/athlet_healthy_avatar_blue.gif'),
            green: require('../assets/images/avatars/athlet_healthy_avatar_green.gif'),
            yellow: require('../assets/images/avatars/athlet_healthy_avatar_yellow.gif'),
        },
        damaged: {
            red: require('../assets/images/avatars/athlet_damaged_avatar_red.gif'),
            blue: require('../assets/images/avatars/athlet_damaged_avatar_blue.gif'),
            green: require('../assets/images/avatars/athlet_damaged_avatar_green.gif'),
            yellow: require('../assets/images/avatars/athlet_damaged_avatar_yellow.gif'),
        },
    },
    [RUNNER_TYPES.REAPER]: {
        healthy: {
            red: require('../assets/images/avatars/drone_avatar_red.gif'),
            blue: require('../assets/images/avatars/drone_avatar_blue.gif'),
            green: require('../assets/images/avatars/drone_avatar_green.gif'),
            yellow: require('../assets/images/avatars/drone_avatar_yellow.gif'),
        },
    },
};

function statusFolder(status) {
    return status === RUNNER_STATUS.HEALTHY ? 'healthy' : 'damaged';
}

/** true, только если для (type, status) реально есть gif-аватар. */
export function hasAvatarGif(type, status) {
    const byStatus = avatarGifSources[type];
    if (!byStatus) return false;
    return !!byStatus[statusFolder(status)];
}

/** Требует hasAvatarGif(type, status) === true — иначе вернёт undefined. */
export function getAvatarGif(type, status, colorKey) {
    const byStatus = avatarGifSources[type];
    const byColor = byStatus && byStatus[statusFolder(status)];
    return byColor ? (byColor[colorKey] ?? byColor.blue) : undefined;
}
