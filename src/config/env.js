// src/config/env.js
import { Platform } from 'react-native';
import * as Device from 'expo-device';

/** IP машины в локальной сети — для запуска на физическом устройстве */
const LAN_IP = '192.168.0.10'; // ← подставь свой

/**
 * localhost внутри мобильного приложения — это сам телефон, а не твой ПК.
 *
 * Device.isDevice (expo-device) — синхронный флаг, true на настоящем
 * телефоне/планшете, false на эмуляторе/симуляторе — так devHost() сам
 * выбирает адрес хоста без ручной правки при каждом переключении между
 * эмулятором и реальным устройством (по прямому запросу пользователя,
 * 2026-09-26). На реальном Android — 'localhost', а не LAN_IP: подразумевает
 * `adb reverse tcp:8080 tcp:8080`/`tcp:80 tcp:80` (телефон видит localhost
 * ПК через USB) — если вместо этого нужен LAN_IP (Wi-Fi, без USB-реверса),
 * подставь `LAN_IP` в этой ветке вместо 'localhost'.
 */
function devHost() {
    if (Platform.OS === 'web') return 'localhost';
    if (Platform.OS === 'android') return Device.isDevice ? 'localhost' : '10.0.2.2';
    return 'localhost'; // iOS-симулятор делит сеть с макбуком; реальный iPhone — тем же путём через LAN_IP при необходимости
}

// 2026-09-26, живая находка: `adb reverse tcp:80 tcp:80` НЕ устанавливается на
// реальном Android-устройстве — adb отказывает в привязке привилегированного
// порта на стороне телефона ("Permission denied"), 8080 (API) при этом
// реверсится нормально (>1024, непривилегированный). Из-за этого Mercure на
// реальном устройстве был ВСЕГДА физически недостижим при обычном
// `adb reverse tcp:80 tcp:80` — партия ехала только на REST/45с-fallback
// (see useMercure.js#STALE_CHECK_INTERVAL_MS), что и объясняло "анимация
// движения не проигрывается" на телефоне при исправно работающей тест-дороге.
// Обход — реверсить на НЕПРИВИЛЕГИРОВАННЫЙ порт устройства, указывающий на
// 80-й порт ПК: `adb reverse tcp:8079 tcp:80` (сам номер 8079 — условный,
// главное что не конфликтует с 8080/8081). Порт нужен ЯВНО в URL только для
// реального Android-устройства — эмулятор (10.0.2.2 сам транслирует порты
// хоста как есть) и веб продолжают ходить на голый 80.
const MERCURE_PORT_SUFFIX = (Platform.OS === 'android' && Device.isDevice) ? ':8079' : '';

const DEV = __DEV__;
const host = devHost();

/** nginx из docker-compose слушает 8080 */
export const API_URL = DEV
    ? `http://${host}:8080/api`
    : 'https://api.example.com/api';

/** контейнер mercure отдаёт 80-й порт — см. MERCURE_PORT_SUFFIX выше */
export const MERCURE_URL = DEV
    ? `http://${host}${MERCURE_PORT_SUFFIX}/.well-known/mercure`
    : 'https://hub.example.com/.well-known/mercure';

export const REQUEST_TIMEOUT = 150000000;