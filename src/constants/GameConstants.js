// src/constants/GameConstants.js
import { Platform } from 'react-native';
import { colors } from '../theme';
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
  
  // Типы ячеек на поле — зеркалят RoadType (бэк) и имена файлов в assets/tracks/*.json
  CELL_TYPES: {
    ROAD: 'road',
    SAND: 'sand',
    MUD: 'mud',
    WALL: 'wall',
    DANGER: 'danger',
    ANOMALY: 'anomaly'
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
 * Изображения ячеек дороги для рендера поля (GameBoardScreen/BoardGrid).
 * Ключи — значения RoadType с бэка и values из assets/tracks/*.json ('road'/
 * 'sand'/'mud'/'wall'/'danger'); 'anomaly' своего ассета не имеет и в
 * lib/board.js падает на 'danger'. Файл dirt_base.png визуально изображает
 * грязь, поэтому ключ — 'mud', а не имя файла.
 */
export const SEGMENT_IMAGES = {
  road: require('../assets/images/road/road_base.png'),
  sand: require('../assets/images/road/sand_base.png'),
  mud: require('../assets/images/road/dirt_base.png'),
  wall: require('../assets/images/road/wall_base.png'),
  danger: require('../assets/images/road/danger_base.png'),
};

/**
 * Подложка под сегментом-целью текущего шага (MOVE/SHOOT/reaper-размещение/
 * первый выход на трассу, см. BoardGrid.highlightedCells) — рисуется ПОД
 * обычной картинкой типа клетки (та полупрозрачна, opacity:0.9, так что
 * подложка просвечивает), вместо прежней рамки+цветной заливки поверх.
 */
export const HIGHLIGHT_IMAGE = require('../assets/images/road/allowed_move.png');

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
 * Типы бегунов — зеркалят RunnerType (бэк). Игровые названия (скаут/штурмовик/
 * джаггернаут) — художественные имена поверх бэковых tank/athlete/sprinter.
 */
export const RUNNER_TYPES = {
  TANK: 'tank',
  ATHLETE: 'athlete',
  SPRINTER: 'sprinter',
  REAPER: 'reaper',
  BALL: 'ball',
};

/** Порядок карточек бегунов на планшете игрока (Танк → Атлет → Спринтер, как в правилах) */
export const RUNNER_ORDER = [RUNNER_TYPES.TANK, RUNNER_TYPES.ATHLETE, RUNNER_TYPES.SPRINTER];

export const RUNNER_DISPLAY = {
  [RUNNER_TYPES.TANK]: { label: 'Джаггернаут', icon: require('../assets/images/runner/jaggernaut.png'), size: 3 },
  [RUNNER_TYPES.ATHLETE]: { label: 'Штурмовик', icon: require('../assets/images/runner/trooper.png'), size: 2 },
  [RUNNER_TYPES.SPRINTER]: { label: 'Скаут', icon: require('../assets/images/runner/scout.png'), size: 1 },
  [RUNNER_TYPES.REAPER]: { label: 'Жнец', icon: require('../assets/images/runner/reaper.png'), size: 0 },
};

/** Состояния бегуна — зеркалят RunnerStatus (бэк) */
export const RUNNER_STATUS = {
  HEALTHY: 'healthy',
  DAMAGED: 'damaged',
  BROKEN: 'broken',
  DESTROYED: 'destroyed',
};

export const RUNNER_STATUS_LABEL = {
  [RUNNER_STATUS.HEALTHY]: 'Исправен',
  [RUNNER_STATUS.DAMAGED]: 'Повреждён',
  [RUNNER_STATUS.BROKEN]: 'Неисправен',
  [RUNNER_STATUS.DESTROYED]: 'Уничтожен',
};

/**
 * Командные усиления — зеркалят PlayerAbility (бэк, без служебного unghost).
 * min/max — допустимый номинал кубика для активации (см. правила), используется
 * только для визуальной подсказки при перетаскивании кубика на зону.
 */
export const PLAYER_ABILITIES = {
  boost: { label: 'Буст', min: 1, max: 3, hint: 'кубик 1–3' },
  heal: { label: 'Лечение', min: 6, max: 6, hint: 'кубик 6' },
  reaper: { label: 'Жнец', min: 1, max: 6, hint: 'любой кубик' },
  ghost: { label: 'Призрак', min: 3, max: 5, hint: 'кубик 3–5' },
};

export const PLAYER_ABILITY_ORDER = ['boost', 'heal', 'reaper', 'ghost'];

/**
 * Жетоны повреждений — зеркалят Damage (бэк). "damage" в правилах называется
 * «Вмятина» — эффекта на ход не даёт, просто занимает ячейку повреждения.
 */
export const DAMAGE_TOKENS = {
  damage: { label: 'Вмятина', short: 'ВМТ', color: colors.muted },
  ricochet: { label: 'Рикошет', short: 'РИК', color: colors.info },
  stupor: { label: 'Занос', short: 'ЗАН', color: colors.warning },
  rocket: { label: 'Ракета', short: 'РКТ', color: colors.danger },
  anomaly: { label: 'Аномалия', short: 'АНМ', color: colors.primary },
};

/** Цвета для визуального различения бегунов разных игроков на общей доске (фолбэк по индексу) */
export const PLAYER_COLORS = [colors.danger, colors.info, colors.success, colors.warning];

/**
 * Цвет игрока — зеркалит PlayerColor (бэк, Service/Game/RunnerGame/Enum/PlayerColor.php).
 * Бэк сам случайно и без повторов раздаёт эти 4 цвета игрокам при создании партии
 * (RunnerGameFactory::createGame) и отдаёт их строкой в RunnerPlayer.color — как в
 * GET /api/runner_game, так и во всех событиях, где публикуется игрок целиком.
 */
export const PLAYER_COLOR_HEX = {
  red: colors.danger,
  blue: colors.info,
  yellow: colors.warning,
  green: colors.success,
};

/** Статус партии — зеркалит GameStatus (бэк, Service/Game/Enum/GameStatus.php) */
export const GAME_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  FINISH: 'finish',
};

/** Статус игрока в партии — зеркалит PlayerStatus (бэк, Service/Game/Enum/PlayerStatus.php) */
export const PLAYER_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  OUT: 'out',
  WINNER: 'winner',
};

/**
 * Шаг хода игрока — зеркалит int-backed enum PlayerStep (бэк). Присылается
 * числом (0-5) как в player_step-событии, так и в RunnerPlayer::toArray().
 * COLLISION в этот enum не входит — она сигналится через game.extraTurnPlayer,
 * не через player.step (см. CLAUDE.md). ROAD_BONUS — новый шаг: игрок ни разу
 * не покидал дорогу за весь обычный ход, есть ненулевой кубик дороги
 * (game.trackGain), и нужно явно принять/пропустить бонус (POST
 * /runner_game/road_bonus) — только тогда игра идёт дальше к SHOOT/ABILITY.
 */
export const PLAYER_STEP = {
  BEGIN: 0,
  SELECT: 1,
  ABILITY: 2,
  MOVE: 3,
  SHOOT: 4,
  ROAD_BONUS: 5,
};

/**
 * Раскладка панели информации об игроке. LEFT_PANEL_* — альбомная ориентация
 * (панель сбоку, ширина от ширины экрана), PANEL_*_H — портретная (панель
 * снизу, высота от высоты экрана) — см. useBoardLayout.
 */
export const LAYOUT = {
  LEFT_PANEL_MIN_W: 300,
  LEFT_PANEL_MAX_W: 430,
  LEFT_PANEL_RATIO: 0.36,
  PANEL_MIN_H: 260,
  PANEL_MAX_H: 480,
  PANEL_HEIGHT_RATIO: 0.52,
};
