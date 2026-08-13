// src/config/env.js
import { Platform } from 'react-native';

/** IP машины в локальной сети — для запуска на физическом устройстве */
const LAN_IP = '192.168.0.10'; // ← подставь свой

/**
 * localhost внутри мобильного приложения — это сам телефон, а не твой ПК.
 */
function devHost() {
    if (Platform.OS === 'web') return 'localhost';
    if (Platform.OS === 'android') return '10.0.2.2'; // так эмулятор видит хост-машину
    return 'localhost';                                // iOS-симулятор делит сеть с макбуком
    // на реальном устройстве: return LAN_IP;
}

const DEV = __DEV__;
const host = devHost();

/** nginx из docker-compose слушает 8080 */
export const API_URL = DEV
    ? `http://${host}:8080/api`
    : 'https://api.example.com/api';

/** контейнер mercure отдаёт 80-й порт */
export const MERCURE_URL = DEV
    ? `http://${host}/.well-known/mercure`
    : 'https://hub.example.com/.well-known/mercure';

export const REQUEST_TIMEOUT = 150000000;