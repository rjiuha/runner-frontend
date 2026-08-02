/**
 * GameContext – глобальный контекст приложения.
 *
 * В нём хранится:
 *  • аутентификация (user, token);
 *  • состояние лобби и комнаты;
 *  • игровое поле, игроки, ход и раунд;
 *  • методы для создания/присоединения к комнате, готовности, старта игры,
 *    перемещения, стрельбы, завершения хода и т.п.
 *
 * В реальном проекте все сетевые вызовы (REST + Mercure) заменятся
 * на настоящие API‑запросы. Здесь – заглушки/логика для локального теста.
 */

import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  registerUser,
  loginUser,
  getGameState,
  createGame,
  joinGame
} from '../services/api'; // REST‑запросы (заглушки)
import { gameSocket } from '../services/socket'; // WebSocket/Mercure клиент
import {
  GAME_CONFIG,
  WS_CLIENT_EVENTS,
  WS_SERVER_EVENTS
} from '../constants/GameConstants';

/* ------------------------------------------------------------------ */
/* --------------------------- CONTEXT ---------------------------------*/
/* ------------------------------------------------------------------ */
export const GameContext = createContext();

/**
 * Хук‑обёртка над контекстом – удобно использовать в экранах.
 */
export const useGame = () => React.useContext(GameContext);

/* ------------------------------------------------------------------ */
/* ------------------------ PROVIDER ---------------------------------*/
/* ------------------------------------------------------------------ */
export const GameProvider = ({ children }) => {
  /* ---------- Аутентификация ---------- */
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  /* ---------- Лобби и комнаты ---------- */
  const [lobbies, setLobbies] = useState([]);
  const [currentLobbyId, setCurrentLobbyId] = useState(null);
  const [roomState, setRoomState] = useState({
    status: 'CREATING',        // CREATING | WAITING | READY | STARTED
    hostId: null,
    playerCount: 0,
    maxPlayers: GAME_CONFIG.MAX_PLAYERS,
    readyPlayers: []           // ID игроков, нажавших "Готов"
  });

  /* ---------- Игровое состояние (поле + игроки) ---------- */
  const [gameState, setGameState] = useState(null);   // { id, field, status, ... }
  const [players, setPlayers] = useState([]);         // [{id, username, vehicle}]
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [turnPhase, setTurnPhase] = useState('SELECT_DICE'); // SELECT_DICE | MOVE | SHOOT

  /* ---------- Текущий ход (выбор кубика) ---------- */
  const [selectedDieType, setSelectedDieType] = useState(GAME_CONFIG.DICE_TYPES.MOVEMENT);
  const [movementPoints, setMovementPoints] = useState(0);

  /* ------------------------------------------------------------------ */
  /* -------------------------- Инициализация ------------------------ */
  /* ------------------------------------------------------------------ */

  /** Подключаемся к Mercure / WebSocket при монтировании экрана GameBoard */
  useEffect(() => {
    if (!gameState) return;

    const socket = gameSocket.getSocket();
    if (!socket) return;

    // Отправляем событие подключения
    socket.emit(WS_CLIENT_EVENTS.JOIN_ROOM, { roomId: currentLobbyId });

    // Слушаем события от сервера (Mercure)
    socket.on(WS_SERVER_EVENTS.GAME_STATE_UPDATE, (payload) => {
      setGameState(payload);
    });

    return () => {
      socket.off(WS_SERVER_EVENTS.GAME_STATE_UPDATE);
    };
  }, [gameState]);

  /* ------------------------------------------------------------------ */
  /* --------------------------- Аутентификация ---------------------- */
  /* ------------------------------------------------------------------ */

  const login = async (email, password) => {
    try {
      const res = await loginUser(email, password);
      if (!res.success) throw new Error(res.data?.error || 'Login failed');

      // Сохраняем токен
      setToken(res.data.token);
      await AsyncStorage.setItem('@token', res.data.token);

      // В реальном проекте запросить профиль пользователя
      const userData = { id: 1, username: 'Player1' }; // placeholder
      setUser(userData);
      return true;
    } catch (e) {
      console.warn('Login error:', e);
      return false;
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('@token');
    setToken(null);
    setUser(null);
  };

  /* ------------------------------------------------------------------ */
  /* --------------------------- Лобби ---------------------------------*/
  /* ------------------------------------------------------------------ */

  /** Создание комнаты (хост) */
  const createRoom = async () => {
    if (!user) return;

    // Отправляем запрос на сервер
    await gameSocket.emit(WS_CLIENT_EVENTS.CREATE_ROOM, {
      hostId: user.id,
      maxPlayers: GAME_CONFIG.MAX_PLAYERS
    });

    setRoomState({
      status: 'WAITING',
      hostId: user.id,
      playerCount: 1,
      maxPlayers: GAME_CONFIG.MAX_PLAYERS,
      readyPlayers: []
    });

    // В демо генерируем id комнаты
    const roomId = `room_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentLobbyId(roomId);
  };

  /** Присоединение к комнате (игрок) */
  const joinRoom = async (lobbyId) => {
    if (!user) return;

    await gameSocket.emit(WS_CLIENT_EVENTS.JOIN_ROOM, {
      playerId: user.id,
      roomId: lobbyId
    });

    setCurrentLobbyId(lobbyId);
    setPlayers((prev) => [...prev, { id: user.id, username: user.username }]);
  };

  /** Кнопка «Готов» */
  const toggleReady = async () => {
    if (!currentLobbyId || roomState.status !== 'WAITING') return;

    await gameSocket.emit(WS_CLIENT_EVENTS.TOGGLE_READY, {
      playerId: user.id,
      roomId: currentLobbyId
    });

    setRoomState((prev) => {
      const isReady = !prev.readyPlayers.includes(user.id);
      return {
        ...prev,
        readyPlayers: isReady
          ? [...prev.readyPlayers, user.id]
          : prev.readyPlayers.filter((id) => id !== user.id)
      };
    });

    // Если все игроки готовы – сообщаем серверу (если хост)
    if (
      roomState.readyPlayers.length + 1 === GAME_CONFIG.MAX_PLAYERS &&
      !roomState.readyPlayers.includes(user.id)
    ) {
      await gameSocket.emit(WS_CLIENT_EVENTS.ALL_READY, { roomId: currentLobbyId });
    }
  };

  /** Старт игры (хост) */
  const startGame = async () => {
    if (!currentLobbyId || roomState.status !== 'READY') return;

    await gameSocket.emit(WS_CLIENT_EVENTS.START_GAME, {
      roomId: currentLobbyId,
      hostId: user.id
    });

    setRoomState((prev) => ({ ...prev, status: 'STARTED' }));
  };

  /* ------------------------------------------------------------------ */
  /* --------------------------- Ход игрока ----------------------------*/
  /* ------------------------------------------------------------------ */

  /** Начало хода (вызывается сервером) */
  const startTurn = async () => {
    if (!currentLobbyId) return;

    setTurnPhase('SELECT_DICE');
    setSelectedDieType(GAME_CONFIG.DICE_TYPES.MOVEMENT);
    setMovementPoints(4); // базовое

    await gameSocket.emit(WS_CLIENT_EVENTS.START_TURN, {});
  };

  /** Выбор кубика */
  const selectDie = async (type) => {
    if (turnPhase !== 'SELECT_DICE') return;

    setSelectedDieType(type);

    if (type === GAME_CONFIG.DICE_TYPES.MOVEMENT) {
      // Генерируем очки перемещения
      setMovementPoints(Math.floor(Math.random() * 6) + 1);
    }

    // Переходим к следующему этапу
    setTimeout(() => {
      if (
        type === GAME_CONFIG.DICE_TYPES.MOVEMENT ||
        type === GAME_CONFIG.DICE_TYPES.STUNT
      ) {
        setTurnPhase('MOVE');
      } else if (type === GAME_CONFIG.DICE_TYPES.SHOOTING) {
        setTurnPhase('SHOOT');
      }
    }, 500);
  };

  /** Перемещение машины */
  const moveVehicle = async ({ vehicleId, targetRow, targetCol }) => {
    if (!gameState || turnPhase !== 'MOVE') return;

    // Локальная логика перемещения (см. GameContext.moveVehicle ниже)
    await gameSocket.emit(WS_CLIENT_EVENTS.MOVE_VEHICLE, {
      vehicleId,
      targetRow,
      targetCol
    });

    // В демо сразу обновляем локальное состояние (см. ниже)
    applyLocalMove(vehicleId, targetRow, targetCol);
  };

  /** Стрельба */
  const shootVehicle = async ({ shooterId, targetX, targetY }) => {
    if (!gameState || turnPhase !== 'SHOOT') return;

    await gameSocket.emit(WS_CLIENT_EVENTS.SHOOT_VEHICLE, {
      shooterId,
      targetX,
      targetY
    });

    // В демо просто логируем
    console.log(`Игрок ${shooterId} стреляет в (${targetX},${targetY})`);
  };

  /** Завершение хода */
  const endTurn = async () => {
    setCurrentTurnIndex((prev) => (prev + 1) % players.length);

    // Если все игроки сделали ход – конец раунда
    if (currentTurnIndex === 0 && roundNumber > 1) {
      setRoundNumber((prev) => prev - 1);
    } else {
      startTurn(); // следующий ход
    }
  };

  /* ------------------------------------------------------------------ */
  /* --------------------------- Локальная логика ---------------------*/
  /* ------------------------------------------------------------------ */

  /**
   * Простой локальный алгоритм перемещения.
   *
   * В реальном проекте сюда придёт полноценная проверка стоимости,
   * столкновений, урона и т.п. Сейчас он просто
   * ищет машину в поле, убирает её из старой ячейки и ставит в новую.
   */
  const applyLocalMove = ({ vehicleId, targetRow, targetCol }) => {
    if (!gameState) return;

    // Копируем поле (deep copy)
    const newField = JSON.parse(JSON.stringify(gameState.field));

    let sourceCell = null;
    let destCell = null;

    for (const frag of newField) {
      for (const cell of frag.cells) {
        if (cell.vehicle?.id === vehicleId) sourceCell = cell;
        if (cell.row === targetRow && cell.col === targetCol) destCell = cell;
      }
    }

    if (!sourceCell || !destCell) return;

    // Если целевая ячейка занята – это столкновение
    if (destCell.vehicle) {
      console.log('Столкновение с', destCell.vehicle.id);
      // TODO: вызвать resolveCollision(...)
      return;
    }

    // Перемещаем машину
    destCell.vehicle = sourceCell.vehicle;
    sourceCell.vehicle = null;

    setGameState((prev) => ({
      ...prev,
      field: newField
    }));

    // Переходим к следующему игроку (упрощённо)
    const nextIdx = (currentTurnIndex + 1) % players.length;
    setCurrentTurnIndex(nextIdx);
  };

  /* ------------------------------------------------------------------ */
  /* --------------------------- Публичный API ------------------------*/
  /* ------------------------------------------------------------------ */

  return (
    <GameContext.Provider
      value={{
        user,
        token,
        login,
        logout,

        lobbies,
        currentLobbyId,
        createRoom,
        joinRoom,
        toggleReady,
        startGame,

        gameState,
        players,
        currentTurnIndex,
        roundNumber,
        turnPhase,

        selectedDieType,
        movementPoints,

        startTurn,
        selectDie,
        moveVehicle,
        shootVehicle,
        endTurn
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
