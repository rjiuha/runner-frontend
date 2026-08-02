// src/hooks/useGame.js

import { useState, useEffect, useCallback } from 'react';
import { getGameState, createGame, joinGame } from '../services/api';
import { gameSocket } from '../services/socket';
import { GAME_CONFIG, RUNNER_STRUCTURE, GAME_STATE_STRUCTURE } from '../constants/GameConstants';

/**
 * Хук для управления состоянием игры (полный цикл)
 */
export const useGame = (screenName) => {
  // --- Состояния UI и Навигации ---
  const [user, setUser] = useState(null);
  const [activeGameId, setActiveGameId] = useState(null);
  const [gameState, setGameState] = useState({});
  
  // --- Состояние Комнаты (Room State) ---
  const [roomState, setRoomState] = useState({
    status: 'CREATING',        // CREATING | WAITING | READY | STARTED
    hostId: null,
    playerCount: 0,
    maxPlayers: GAME_CONFIG.MAX_PLAYERS,
    readyPlayers: []           // ID игроков, нажавших "Готов"
  });

  // --- Состояние Игры (Core) ---
  const [players, setPlayers] = useState([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [turnPhase, setTurnPhase] = useState('SELECT_DICE'); // SELECT_DICE | MOVE | SHOOT
  
  // --- Состояние Текущего Хода ---
  const [selectedDieType, setSelectedDieType] = useState(GAME_CONFIG.DICE_TYPES.MOVEMENT);
  const [movementPoints, setMovementPoints] = useState(0);

  /**
   * Загрузка состояния игры при монтировании экрана
   */
  useEffect(() => {
    if (screenName === 'GAME_BOARD' && activeGameId) {
      console.log('Connecting to game server...');
      
      // Подключаем WebSocket для реального времени
      const socket = gameSocket.getSocket();
      
      if (socket) {
        // Отправляем событие подключения к комнате
        socket.emit(GAME_CONFIG.WEBSOCKET_EVENTS.CLIENT_TO_SERVER.JOIN_ROOM, { 
          roomId: activeGameId 
        });

        // Слушаем события от сервера
        const interval = setInterval(async () => {
          try {
            // Периодическая проверка состояния игры (опционально)
            const state = await getGameState(activeGameId);
            
            if (state.status !== gameState.status || 
                state.currentRound !== roundNumber) {
              setGameState(state);
              if (state.round !== roundNumber) {
                setRoundNumber(state.round);
                setCurrentTurnIndex(0);
                setPlayers([...players]); // Обновляем список игроков
              }
            }
          } catch (e) {
            console.error('Sync error', e);
          }
        }, 2000);

        return () => clearInterval(interval);
      }
    }
  }, [screenName, roundNumber, players]);

  /**
   * Авторизация и Меню
   */
  const login = async (login, password) => {
    try {
      // В реальном проекте здесь вызов api.login(login, password)
      await new Promise(resolve => setTimeout(resolve, 800));
      setUser({ id: 1, name: 'Player1', avatar: 'car_1.png' });
      return true;
    } catch (e) {
      alert(e.message);
      return false;
    }
  };

  /**
   * Создание Комнаты (Host Flow)
   */
  const createRoom = async () => {
    if (!user) return;
    
    console.log('Creating room...');
    
    // Отправляем событие на сервер
    gameSocket.emit(GAME_CONFIG.WEBSOCKET_EVENTS.CLIENT_TO_SERVER.CREATE_ROOM, { 
      hostId: user.id, 
      maxPlayers: GAME_CONFIG.MAX_PLAYERS 
    });

    setRoomState({
      status: 'WAITING',
      hostId: user.id,
      playerCount: 1, // Хост уже в комнате
      maxPlayers: GAME_CONFIG.MAX_PLAYERS,
      readyPlayers: []
    });
    
    setActiveGameId('room_' + Math.random().toString(36).substr(2, 9));
  };

  /**
   * Подключение к Комнате (Player Flow)
   */
  const joinRoom = async (gameId) => {
    console.log('Joining room:', gameId);
    
    gameSocket.emit(GAME_CONFIG.WEBSOCKET_EVENTS.CLIENT_TO_SERVER.JOIN_ROOM, { 
      playerId: user.id, 
      roomId: gameId 
    });

    setPlayers(prev => [...prev, { id: user.id, name: user.name }]);
  };

  /**
   * Кнопка "Готов" (Ready Button)
   */
  const toggleReady = async () => {
    if (!activeGameId || roomState.status !== 'WAITING') return;
    
    console.log('Toggling ready status');
    
    gameSocket.emit(GAME_CONFIG.WEBSOCKET_EVENTS.CLIENT_TO_SERVER.TOGGLE_READY, { 
      playerId: user.id, 
      roomId: activeGameId 
    });

    // Обновляем локальное состояние (если вы хост)
    setRoomState(prev => {
      const isReady = !prev.readyPlayers.includes(user.id);
      return {
        ...prev,
        readyPlayers: isReady 
          ? [...prev.readyPlayers, user.id]
          : prev.readyPlayers.filter(id => id !== user.id)
      };
    });

    // Если все игроки готовы (кроме хоста), серверу сообщаем об этом
    if (isReady && roomState.playerCount === GAME_CONFIG.MAX_PLAYERS - 1) {
      gameSocket.emit(GAME_CONFIG.WEBSOCKET_EVENTS.CLIENT_TO_SERVER.ALL_READY, { roomId: activeGameId });
    }
  };

  /**
   * Старт Игры (Host Clicks Start)
   */
  const startGame = async () => {
    if (!activeGameId || roomState.status !== 'READY') return;
    
    console.log('Starting game...');
    
    gameSocket.emit(GAME_CONFIG.WEBSOCKET_EVENTS.CLIENT_TO_SERVER.START_GAME, { 
      roomId: activeGameId, 
      hostId: user.id 
    });

    setRoomState(prev => ({ ...prev, status: 'STARTED' }));
  };

  /**
   * Переподключение (Reconnect Logic)
   */
  const handleReconnect = async () => {
    console.log('Attempting reconnect...');
    
    if (!activeGameId) return;
    
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Пробуем переподключиться к комнате
      gameSocket.emit(GAME_CONFIG.WEBSOCKET_EVENTS.CLIENT_TO_SERVER.RECONNECT, { roomId: activeGameId });
      
      console.log('Reconnected successfully');
    } catch (e) {
      console.error('Reconnect failed:', e);
      alert('Потеряно соединение. Попробуйте создать новую игру.');
    }
  };

  /**
   * Начало хода игрока
   */
  const startTurn = async () => {
    if (!activeGameId) return;
    
    setTurnPhase('SELECT_DICE');
    setSelectedDieType(GAME_CONFIG.DICE_TYPES.MOVEMENT);
    setMovementPoints(4); // Стандартное кол-во очков хода

    // Уведомляем сервер о начале хода (Mock)
    await gameSocket.emit(GAME_CONFIG.WEBSOCKET_EVENTS.CLIENT_TO_SERVER.START_TURN, {});
  };

  /**
   * Выбор кубика для перемещения
   */
  const selectDie = async (type) => {
    if (turnPhase !== 'SELECT_DICE') return;
    
    setSelectedDieType(type);
    
    // Если выбрали перемещение, генерируем очки
    if (type === GAME_CONFIG.DICE_TYPES.MOVEMENT) {
      setMovementPoints(Math.floor(Math.random() * 6) + 1); // 1-6 очков
    }

    // Переключаемся на этап движения или стрельбы
    setTimeout(() => {
        if (type === GAME_CONFIG.DICE_TYPES.MOVEMENT || type === GAME_CONFIG.DICE_TYPES.STUNT) {
            setTurnPhase('MOVE');
        } else if (type === GAME_CONFIG.DICE_TYPES.SHOOTING) {
            setTurnPhase('SHOOT');
        }
    }, 500);
  };

  /**
   * Перемещение машины
   */
  const moveVehicle = async () => {
    if (turnPhase !== 'MOVE') return;
    
    // Имитация перемещения на поле
    console.log(`Moving vehicle for player ${players[currentTurnIndex].id}`);
    
    await gameSocket.emit(GAME_CONFIG.WEBSOCKET_EVENTS.CLIENT_TO_SERVER.MOVE_VEHICLE, {});
    
    // Проверка условий (упрощенно)
    if (Math.random() > 0.8) {
        alert('Машина врезалась! Столкновение...');
        // Здесь логика столкновения из PDF
    }

    endTurn();
  };

  /**
   * Стрельба машиной
   */
  const shootVehicle = async () => {
    if (turnPhase !== 'SHOOT') return;
    
    console.log(`Shooting for player ${players[currentTurnIndex].id}`);
    await gameSocket.emit(GAME_CONFIG.WEBSOCKET_EVENTS.CLIENT_TO_SERVER.SHOOT_VEHICLE, {});
    endTurn();
  };

  /**
   * Конец хода (переход к следующему игроку)
   */
  const endTurn = async () => {
    // Переход хода к следующему игроку
    setCurrentTurnIndex((prev) => (prev + 1) % players.length);
    
    // Если все игроки сделали ходы, раунд заканчивается
    if (currentTurnIndex === 0 && roundNumber > 1) {
        setRoundNumber(prev => prev - 1); // Упрощенно уменьшаем номер для примера смены
    } else {
        startTurn(); // Начинаем следующий ход текущего игрока или следующего в очереди
    }
  };

  return {
    user, login, createRoom, joinRoom, activeGameId,
    gameState, players, currentTurnIndex, roundNumber, turnPhase,
    roomState, // Состояние комнаты (WAITING/READY/STARTED)
    selectedDieType: GAME_CONFIG.DICE_TYPES.MOVEMENT,
    movementPoints: 4,
    startTurn, selectDie, moveVehicle, shootVehicle,
    
    // Новые методы для комнаты
    toggleReady, 
    startGame, 
    handleReconnect
  };
};
