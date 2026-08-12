// src/constants/GameConstants.js
import { Platform } from 'react-native';
/**
 * Конфигурация игры на основе правил PDF и структуры бэкенда
 */
export const GAME_CONFIG = {
  // Количество игроков в игре
  MAX_PLAYERS: 4,
  
  // Ходов в раунде (по правилам)
  TURNS_PER_ROUND: 3,
  
  // Фрагменты дороги на поле одновременно
  SEGMENTS_ON_BOARD: 3,
  
  // Типы кубиков для выбора хода
  DICE_TYPES: {
    MOVEMENT: 'movement',      // Кубик перемещения (1-6)
    SHOOTING: 'shooting',      // Кубик стрельбы (размер цели)
    COLLISION: 'collision',    // Кубик столкновения
    STUNT: 'stunt',            // Кубик трюков
    ROAD: 'road',              // Кубик дороги (бонус)
    DIRECTION: 'direction'     // Кубик направления
  },
  
  // Типы состояний машины (из Runner.php)
  VEHICLE_STATUS: {
    ACTIVE: 'active',          // Активная
    BROKEN: 'broken',          // Неисправная
    DESTROYED: 'destroyed'     // Уничтожена
  },
  
  // Типы ячеек на поле (из правил)
  CELL_TYPES: {
    ROAD: 'road',              // Дорога - 1 очко
    MUD: 'mud',                // Грязь - 2 очка
    OFFROAD: 'offroad',        // Бездорожье - 1 очко
    DANGER: 'danger',          // Опасность (мин, разбитая машина)
    IMPASSABLE: 'impassable'   // Непроходимая
  },
  
  // Размеры машин
  VEHICLE_SIZES: {
    SMALL: 'small',            // Малая - сложно попасть, плохо таранит
    MEDIUM: 'medium',          // Средняя - баланс
    LARGE: 'large'             // Большая - легко попасть, хорошо таранит
  }
};

/**
 * Структура данных из бэкенда (Game.php)
 */
export const GAME_STATE_STRUCTURE = {
  id: 'int',                    // ID игры
  status: 'string',              // waiting | active | finished
  currentRound: 'int',           // Текущий раунд
  currentPlayerOrder: 'int',     // Порядок хода в очереди
  currentTurnInRound: 'int',     // Номер хода в текущем раунде (0-2)
  trackState: {                  // Состояние трека
    segments: ['array'],         // Массив из 3 сегментов
    currentSegmentIndex: 'int'   // Индекс текущего сегмента
  },
  remainingTracks: 'array',      // Очередь оставшихся карт
  moves: 'array',                // История ходов
  players: [                     // Список игроков в игре
    {
      id: 'int',
      nickname: 'string',
      playerOrder: 'int',
      isActive: 'bool',
      runners: ['tank', 'athlete', 'sprinter'] // Данные Runner.php
    }
  ],
  myPlayerOrder: 'int|null'      // Порядок текущего игрока в очереди
};

/**
 * Структура данных из бэкенда (Runner.php)
 */
export const RUNNER_STRUCTURE = {
  position: {                    // Позиция на поле
    segment: 'string',           // ID сегмента
    row: 'int|null',             // Строка в сетке
    col: 'int|null'              // Колонка в сетке
  },
  health: 'int',                 // Здоровье (0-2 урона)
  status: 'string',              // active | broken | destroyed
  movement: 'int',               // Очки перемещения текущего хода
  additionalMovement: 'int|null',// Дополнительные очки (команды)
  damageTokens: ['array']        // Жетоны урона с эффектами
};

/**
 * Размеры изображений для UI элементов
 */
export const ASSET_SIZES = {
  // Форматы файлов
  FORMAT_PNG: 'png',            // Прозрачный фон, для иконок
  FORMAT_JPG: 'jpg',            // Фотографии, фоны
  FORMAT_SVG: 'svg',            // Векторная графика
  
  // Размеры (в пикселях)
  VEHICLE_SIZE: {               // Размер машины на поле
    width: 80,                   // Ширина в ячейке
    height: 120                  // Высота в ячейке
  },
  
  SEGMENT_SIZE: {               // Размер сегмента дороги
    width: 'flex',               // На всю ширину экрана минус отступы
    height: 150,                 // Высота каждого сегмента
    marginVertical: 2            // Отступ между сегментами
  },
  
  UI_ELEMENTS: {                // Размеры UI элементов
    BUTTON_HEIGHT: 60,           // Высота кнопок
    INPUT_HEIGHT: 50,            // Высота полей ввода
    CARD_PADDING: 20,            // Внутренние отступы карточек
    HEADER_HEIGHT: 80,           // Высота шапки экрана
    HUD_HEIGHT: 60               // Высота HUD (верхняя панель)
  }
};

/**
 * Изображения сегментов дороги для рендера поля (GameBoardScreen/BoardGrid)
 */
export const SEGMENT_IMAGES = {
  sand: require('../assets/images/sand_base.png'),
  road: require('../assets/images/road_base.png'),
  wall: require('../assets/images/wall_base.png'),
  dirt: require('../assets/images/dirt_base.png'),
  danger: require('../assets/images/danger_base.png'),
};

/**
 * Геометрия игрового поля: сколько блоков дороги существует, сколько
 * колонок видно/всего в очереди, и скорость непрерывной прокрутки на вебе
 */
export const BOARD_LAYOUT = {
  ROWS: 6,
  COLS: 8,
  TOTAL_BLOCKS: 3,
  TOTAL_COLS: 24,
  WEB_SCROLL_SPEED: 80,
};

/**
 * API эндпоинты бэкенда
 */
const isAndroid = Platform.OS === 'android';
export const API_ENDPOINTS = {
  BASE_URL: isAndroid ? 'http://10.0.2.2:8080' : 'http://localhost:8080',
  AUTH: {
    REGISTER: '/api/register',        // POST - Регистрация
    LOGIN: '/api/login'          // POST - Вход (если добавите)
  },
  GAMES: {
    CREATE: '/api/games',             // POST - Создать игру
    JOIN: '/api/games/{id}',          // POST - Присоединиться к игре
    GET: '/api/games/{id}'            // GET - Получить состояние игры
  }
};

/**
 * WebSocket события (для реального времени)
 */
export const WEBSOCKET_EVENTS = {
  // От клиента на сервер
  CLIENT_TO_SERVER: {
    CREATE_ROOM: 'room_create',
    JOIN_ROOM: 'join_room',
    TOGGLE_READY: 'toggle_ready',
    START_GAME: 'start_game',
    RECONNECT: 'reconnect',
    MOVE_VEHICLE: 'move_vehicle',
    SHOOT_VEHICLE: 'shoot_vehicle'
  },
  
  // От сервера на клиента
  SERVER_TO_CLIENT: {
    ROOM_CREATED: 'room_created',
    PLAYER_JOINED: 'player_joined',
    ALL_READY: 'all_ready',
    GAME_STARTED: 'game_started',
    ROUND_END: 'round_end',
    STATE_UPDATE: 'state_update'
  }
};

/**
 * Типы эффектов жетонов урона (из правил PDF)
 */
export const DAMAGE_TOKEN_EFFECTS = {
  JUMP: 'jump',                 // Прыжок - бросок кубика направления + трюков
  STUN: 'stun',                 // Ступор - медленное перемещение
  SKID: 'skid',                 // Занос - движение в указанном направлении
  DENT: 'dent',                 // Вмятина - просто занимает ячейку
  RICOCHET: 'ricochet',         // Рикошет - цепная реакция урона
  OFFROAD: 'offroad'            // Бездорожье - перемещение на 1 очко
};
