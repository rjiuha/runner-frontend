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
 * 'sand'/'mud'/'wall'/'danger'/'anomaly'). По каждому типу (кроме wall, см.
 * ниже) — несколько вариантов ассета (пользователь сам добавил по несколько
 * картинок на тип, 2026-08-28) — lib/board.js#pickSegmentImage выбирает
 * конкретный вариант детерминированно по id клетки (не Math.random — иначе
 * картинка "прыгала" бы на каждый ре-рендер экрана вместо того, чтобы быть
 * стабильной на всю партию). Файл dirt_base_*.gif визуально изображает грязь,
 * поэтому ключ — 'mud', а не имя файла. 'anomaly' — группа black_hole_*.gif.
 * 'road' — 2 варианта (road_base_1/2.png; было 3, пользователь удалил
 * road_base_3.png тем же днём), 'sand' — 2 варианта (sand_base_1/2.png,
 * аналогично удалён sand_base_3.png).
 * 'danger' — 2026-09-14: было 4 варианта, пользователь удалил 3 (оставил
 * только danger_base_1.gif) — если позже добавит ещё, просто дописать в
 * массив ниже, выбор уже общий для любой длины массива.
 *
 * Облегчённые '-ez'-дубликаты для мобильных устройств (были нужны из-за
 * тяжёлых исходных gif) пользователь удалил целиком, 2026-09-13 — платформенный
 * сплит (SEGMENT_IMAGES_WEB/MOBILE) убран, теперь ОДИН набор ассетов
 * одинаково на вебе и native.
 *
 * 'wall' — НЕ плоский список, а `{acid, burn}` (2026-09-13, стены типа "acid"/
 * "burn" вместо старого единого wall_base_*): `lib/board.js#pickSegmentImage`
 * для этого типа СНАЧАЛА выбирает вариант через `pickDeathVariant(cellId)` (та
 * же детерминированная функция, что решает, КАКУЮ терминальную позу
 * ('acid'/'burn') получит бегун, погибающий на этой клетке, см.
 * lib/runnerAnimTriggers.js) — гарантирует, что картинка стены и анимация
 * гибели на ней ВСЕГДА одного и того же варианта, не расходятся по случайности
 * двух независимых хэшей. Расположение стен на дороге сейчас выбирает бэк
 * (просто присылает тип 'wall' без подтипа) — какой именно вариант (acid/burn)
 * покажет конкретная клетка, решает фронт случайно (детерминированно по id).
 */
export const SEGMENT_IMAGES = {
  road: [
    require('../assets/images/road/road_base_1.png'),
    require('../assets/images/road/road_base_2.png'),
  ],
  sand: [
    require('../assets/images/road/sand_base_1.png'),
    require('../assets/images/road/sand_base_2.png'),
  ],
  mud: [
    require('../assets/images/road/dirt_base_1.gif'),
    require('../assets/images/road/dirt_base_2.gif'),
    require('../assets/images/road/dirt_base_3.gif'),
    require('../assets/images/road/dirt_base_4.gif'),
  ],
  wall: {
    acid: [
      require('../assets/images/road/wall_acid_1.gif'),
      require('../assets/images/road/wall_acid_2.gif'),
      require('../assets/images/road/wall_acid_3.gif'),
    ],
    burn: [require('../assets/images/road/wall_burn_1.gif')],
  },
  danger: [require('../assets/images/road/danger_base_1.gif')],
  anomaly: [
    require('../assets/images/road/black_hole_1.gif'),
    require('../assets/images/road/black_hole_2.gif'),
    require('../assets/images/road/black_hole_3.gif'),
  ],
};

/**
 * Одноразовый визуальный эффект взрыва мины (danger==='mine', см. Enum\Danger
 * на бэке) — НЕ тайл клетки (после мины клетка становится обычной road, см.
 * Danger::mine() на бэке read-only), а транзиентная VFX-подложка ПОД токеном
 * бегуна: играется один раз и исчезает (см. hooks/useMineBlasts.js). Оба
 * файла закольцованы (loop=0) — "один раз" даёт таймер
 * (MINE_BLAST_DURATION_MS), не свойство файла, тот же приём, что уже
 * применён для терминальных поз acid/burn (useRunnerAnimations.js) — запас
 * в ~2 кадра до конца цикла, чтобы не поймать мигание первым кадром, если
 * gif успеет зациклиться раньше, чем таймер снимет слой.
 * 2026-09-16: по прямому запросу пользователя оба файла ускорены ровно в
 * коде АССЕТА (не JS) — кадры были 17×150мс=2550мс, скриптом (gifwrap,
 * scratch) delayCentisecs каждого кадра поделен на 2 (150мс→80мс с
 * округлением, GIF хранит только целые сантисекунды), итог 17×80мс=1360мс.
 * MINE_BLAST_DURATION_MS ниже пересчитан под НОВУЮ длительность (1360мс -
 * 2 кадра запаса × 80мс = 1200мс), сама скорость воспроизведения — целиком
 * в файле, код её не регулирует и не может (нет своего таймера на кадр,
 * gif проигрывается нативным декодером).
 *
 * Вариант (mine_1/mine_2) выбирается СЛУЧАЙНО при каждом срабатывании (не
 * детерминированно по id клетки, как у персистентных тайлов SEGMENT_IMAGES
 * выше) — эффект транзиентный и ни разу не перерендеривается с другим
 * случайным числом за время своей жизни, риска "мигания при ре-рендере" тут
 * нет.
 *
 * MINE_BLAST_SCALE/MINE_BLAST_OFFSET подобраны пользователем интерактивно
 * (Artifact-превью с реальными ассетами поверх road-тайла и бегуна,
 * 2026-09-15): 0.60× размера сегмента. Смещение — было +6% (высоты сегмента
 * вверх от НИЗА клетки), 2026-09-16 сдвинуто на 2 процентных пункта ниже
 * (+6%→+4%) по прямому запросу — тот же якорь по низу, что и у токена
 * бегуна (см. BoardGrid#anchorBottom), центр взрыва приходится примерно на
 * нижнюю треть силуэта бегуна, "как будто он наступил на мину прямо сейчас". Порядок
 * отрисовки — СТРОГО под бегуном (см. BoardGrid#mineBlastLayer, zIndex между
 * дорогой и токенами), по прямому запросу пользователя.
 */
export const MINE_BLAST_IMAGES = [
  require('../assets/images/road/mine_1.gif'),
  require('../assets/images/road/mine_2.gif'),
];
export const MINE_BLAST_SCALE = 0.6;
export const MINE_BLAST_OFFSET = 0.04;
export const MINE_BLAST_DURATION_MS = 1200;

/**
 * Цвет подсветки легальной клетки текущего шага (MOVE/SHOOT/reaper-размещение/
 * первый выход на трассу, см. BoardGrid.highlightedCells). Раньше — отдельный
 * ассет allowed_move.png под картинкой клетки; пользователь его удалил
 * (2026-08-28, коммит "segments") без замены и попросил вернуть прежний
 * подход "рамка+заливка" (был до 2026-08-14), просто не толстую.
 */
export const HIGHLIGHT_COLOR = colors.success;

/**
 * Прозрачность картинки типа клетки (BoardGrid) — road/sand непрозрачны (по
 * более раннему запросу, не просвечивают заливку подсветки под собой).
 * danger — по прямому запросу пользователя, 2026-08-31, сделан ещё прозрачнее
 * (0.9→0.75, потом ещё →0.65 — суммарно на 25 процентных пунктов), чтобы
 * сквозь него было лучше видно подложку (см. lib/board#pickBaseImage — road
 * под danger). anomaly — был в той же группе, но 2026-09-15 вернули
 * непрозрачным СРАЗУ следом за тем, как убрали у него road-подложку (см.
 * lib/board#BASE_IMAGE_TYPE) — просвечивать больше нечему. wall и mud —
 * ОБРАТНО непрозрачны (wall —
 * 2026-09-13, mud — 2026-09-14, оба по прямому запросу): картинка сама
 * целиком не прозрачна, но всё ещё занимает не весь слот (SEGMENT_INSET-
 * зазор по краю, как у остальных типов) — под ней по-прежнему лежит
 * подложка (road под wall, sand под mud — см. BASE_IMAGE_TYPE в
 * lib/board.js), просто не просвечивает сквозь саму картинку, только видна
 * в этом зазоре.
 */
export const CELL_OPACITY = {
  road: 1, sand: 1, wall: 1, mud: 1,
  // anomaly (black_hole) — ВЕРНУЛИ непрозрачность (2026-09-15, прямой запрос,
  // сразу следом за тем, как убрали road-подложку под ней — раз просвечивать
  // больше нечему, полупрозрачность стала не нужна). danger по-прежнему
  // прозрачнее — под ним всё ещё есть road-подложка (см. lib/board#BASE_IMAGE_TYPE).
  danger: 0.65, anomaly: 1,
};

/**
 * Цвета для визуального различения 3 фрагментов трассы (см.
 * FragmentLabelStrip и BoardGrid#fragmentBoundaryLine, 2026-08-30). Первая
 * версия нарочно избегала danger/success/warning (уже заняты жетонами
 * повреждений/подсветкой легальной клетки на этой же доске) — по прямому
 * запросу пользователя заменено на красный/оранжевый/зелёный (в неоновых,
 * максимально насыщенных оттенках — заметно ярче обычной палитры темы), риск
 * переклички с HIGHLIGHT_COLOR/DAMAGE_TOKENS осознанно принят. Ровно 3 цвета
 * — BOARD_LAYOUT.TOTAL_BLOCKS фиксировано равно 3. Первая правка (чистые
 * максимально-насыщенные #ff1744/#ff9100/#39ff14) показалась пользователю
 * "кислотной" — притушено на тон темнее, оставаясь неоновыми (не пастельными).
 */
export const FRAGMENT_COLORS = ['#e2113f', '#e65100', '#00c853'];

/**
 * Кнопки навигации по дороге для мобильного приложения (портретная
 * раскладка, native — НЕ веб, пользователь явно не захотел разбираться, как
 * это будет выглядеть для браузера) — замена круглой ArrowButton, свой
 * глиф+рамка уже нарисованы в ассете, см. RoadNavButton.js.
 *
 * Первая версия декоративной рамки (один квадратный `frame.png`, нарезанный
 * скриптом на 9 частей) не прижилась — асимметрия толщины по сторонам,
 * искажённые углы, наплыв рамок друг на друга (см. историю в CLAUDE.md).
 * Пользователь заменил её на честно подготовленный набор — один угол
 * (верхний правый) и 2 планки (верхняя горизонтальная, правая
 * вертикальная), с ТОЧНО совпадающей толщиной уголка и планки (проверено
 * по пикселям: у угла толщина сверху 47px/справа 49px — совпадает с
 * высотой горизонтальной планки (47px) и шириной вертикальной (49px)).
 * Остальные 3 угла и вторые стороны планок — то же изображение,
 * отзеркаленное `scaleX:-1`/`scaleY:-1` в MobileFrameOverlay, отдельных
 * файлов под них не нужно.
 */
export const MOBILE_FRAME_CORNER_TR = require('../assets/images/ui/mobile/frame_corner.png');
export const MOBILE_FRAME_EDGE_TOP = require('../assets/images/ui/mobile/frame_gorizont.png');
export const MOBILE_FRAME_EDGE_RIGHT = require('../assets/images/ui/mobile/frame_vert.png');
// Ассет — квадрат 200×200, толщина каймы внутри него ~47-49px (см. выше) —
// используем среднее (48) как референс для пересчёта масштаба под целевую
// толщину рамки на экране (MobileFrameOverlay.borderDp).
export const MOBILE_FRAME_CORNER_SIZE_PX = 200;
export const MOBILE_FRAME_BORDER_PX = 48;
export const ROAD_NAV_BUTTON_IMAGES = {
  up: require('../assets/images/ui/mobile/road_map_button_up.png'),
  down: require('../assets/images/ui/mobile/road_map_button_down.png'),
};

/**
 * Насколько мобильная рамка (MobileFrameOverlay) выступает за истинные
 * внешние края экрана (лево/право у обеих зон, низ у панели) — по прямому
 * запросу пользователя, чтобы скруглённый угол не был виден отдельно от края
 * экрана. Вынесено сюда (было локальной константой в GameBoardScreen) —
 * useBoardLayout тоже должен знать это число, чтобы резервировать место под
 * декоративную кайму рамки и не давать игровому контенту (доске) заезжать
 * под неё у правого края (жалоба пользователя, 2026-08-30).
 */
export const MOBILE_FRAME_BLEED = 10;

/**
 * Геометрия игрового поля: сколько блоков дороги существует и сколько
 * колонок в одном блоке/во всех блоках суммарно.
 */
export const BOARD_LAYOUT = {
  ROWS: 6,
  COLS: 8,
  TOTAL_BLOCKS: 3,
  // 3 полных фрагмента (trackBegin/Middle/End, по 8 колонок каждый) + 1
  // "пик"-колонка (первая колонка trackNext, см. lib/board#flattenPeekColumn) —
  // по прямому запросу пользователя, 2026-09-08: без неё бегуну физически
  // некуда шагнуть с последней клетки 3-го фрагмента (см. TODO в CLAUDE.md
  // про "переход за передний край сегмента"). Заход на неё — триггер
  // game_track_updated на бэке (см. Move::handle(), read-only).
  TOTAL_COLS: 25,
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
  // `icon` (старая статичная картинка-фолбэк, assets/images/runner/ —
  // единственное число, не путать с assets/images/runners/) убран 2026-09-12
  // по прямому запросу пользователя — папка удалена с диска, а фолбэк давно
  // мёртв: у ВСЕХ типов ниже (включая Мяч/BALL) уже есть полный набор
  // анимаций в constants/runnerAnimations#RUNNER_ANIMATION_SETS,
  // getRunnerAnimationImage/getRunnerAvatarImage больше никогда не
  // возвращают null для них — RunnerToken.js's `?? display.icon` не имел
  // реального шанса сработать, только тянул мёртвый require() (который и
  // валил Metro после удаления файлов, "Unable to resolve").
  [RUNNER_TYPES.TANK]: { label: 'Танк', size: 3 },
  [RUNNER_TYPES.ATHLETE]: { label: 'Атлет', size: 2 },
  [RUNNER_TYPES.SPRINTER]: { label: 'Скаут', size: 1 },
  [RUNNER_TYPES.REAPER]: { label: 'Жнец', size: 0 },
  // "Мяч" — ничейный (playerId всегда null), никогда не показывается в
  // панели игрока (RUNNER_ORDER его не перечисляет, а карточки и так
  // фильтруются по runner.playerId === p.id) — запись тут нужна ТОЛЬКО
  // чтобы RunnerToken (BoardGrid) не бэйлился на `!display` и рисовал токен
  // на доске.
  [RUNNER_TYPES.BALL]: { label: 'Мяч', size: 1 },
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

/** Грани кубика перемещения (D6) — ассеты D:\runner-frontend\src\assets\images\dice */
export const DICE_FACE_IMAGES = {
  1: require('../assets/images/dice/dice_p2_1.png'),
  2: require('../assets/images/dice/dice_p2_2.png'),
  3: require('../assets/images/dice/dice_p2_3.png'),
  4: require('../assets/images/dice/dice_p2_4.png'),
  5: require('../assets/images/dice/dice_p2_5.png'),
  6: require('../assets/images/dice/dice_p2_6.png'),
};

/**
 * Командные усиления — зеркалят PlayerAbility (бэк, без служебного unghost).
 * min/max — допустимый номинал кубика для активации (см. правила), используется
 * только для визуальной подсказки при перетаскивании кубика на зону.
 * shortHint — то же самое, но без слова "кубик" (компактная раскладка,
 * портрет — по прямому запросу пользователя, места мало).
 */
export const PLAYER_ABILITIES = {
  boost: { label: 'Буст', min: 1, max: 3, hint: 'кубик 1–3', shortHint: '1–3' },
  heal: { label: 'Лечение', min: 6, max: 6, hint: 'кубик 6', shortHint: '6' },
  reaper: { label: 'Жнец', min: 1, max: 6, hint: 'любой кубик', shortHint: 'любой' },
  ghost: { label: 'Призрак', min: 3, max: 5, hint: 'кубик 3–5', shortHint: '3–5' },
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

// Отдельный "настоящий синий" (indigo) для игрока-blue — НЕ colors.info
// (тот делит смысл с обычным UI: спиннеры, инфо-кнопки и т.п., трогать его
// ради одного игрового цвета нельзя). Заменён по прямому запросу
// пользователя, 2026-09-02: старый colors.info (#3498db) визуально сливался
// с голубоватыми тайлами дороги на доске. Первая замена (royalBlue #1f51ff)
// всё ещё казалась "голубоватой" — indigo взят из уже подготовленных
// кандидатов (см. scratchpad-превью того же захода).
const PLAYER_BLUE = '#2e3192';

/** Цвета для визуального различения бегунов разных игроков на общей доске (фолбэк по индексу) */
export const PLAYER_COLORS = [colors.danger, PLAYER_BLUE, colors.success, colors.warning];

/**
 * Цвет игрока — зеркалит PlayerColor (бэк, Service/Game/RunnerGame/Enum/PlayerColor.php).
 * Бэк сам случайно и без повторов раздаёт эти 4 цвета игрокам при создании партии
 * (RunnerGameFactory::createGame) и отдаёт их строкой в RunnerPlayer.color — как в
 * GET /api/runner_game, так и во всех событиях, где публикуется игрок целиком.
 */
export const PLAYER_COLOR_HEX = {
  red: colors.danger,
  blue: PLAYER_BLUE,
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
  // Было 480/0.52 — с компактной (compactColumns) вёрсткой карточек часть
  // высоты панели оставалась пустой (жалоба пользователя, обмерено по
  // скриншоту). Первая попытка урезать до 340/0.37 оказалась СЛИШКОМ
  // агрессивной — учла только левую колонку (карточки бегунов), не правую
  // (кубики+усиления, которая на деле требует БОЛЬШЕ высоты) и не
  // переключатель игроков под ними: контент правой колонки начал вылезать
  // за её границы и накладываться на переключатель (жалоба пользователя со
  // скриншотом), а левая колонка обрезала последнюю карточку. Обе колонки
  // получили ScrollView (см. rightColumn ниже — раньше был голым View) как
  // структурная защита от переполнения на любом экране, а сама высота
  // панели поднята обратно до компромиссного значения — меньше исходных
  // 480, но с запасом под содержимое правой колонки.
  // 420/0.45 оказалось наоборот СЛИШКОМ много (пустота вернулась, жалоба
  // пользователя сразу после прошлой правки) — 340 было мало (обрезка/
  // наложение), 420 много; текущее — компромисс между ними. rightColumn
  // теперь ScrollView (см. PlayerInfoPanel) — если на каком-то экране всё
  // же не хватит и этого, контент просто проскроллится, а не наложится.
  PANEL_MAX_H: 375,
  PANEL_HEIGHT_RATIO: 0.4,
};
