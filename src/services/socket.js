// src/services/socket.js

import { WEBSOCKET_EVENTS, API_ENDPOINTS } from '../constants/GameConstants';

/**
 * Класс для управления WebSocket подключением
 */
class GameSocket {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // 3 секунды
    
    this.init();
  }

  /**
   * Инициализация сокета (симуляция для тестов)
   */
  init() {
    // В реальном проекте используйте: socket.io-client или react-native-socket-io-client
    // Для простоты используем стандартный WebSocket API
    
    try {
      this.socket = new WebSocket(`${API_ENDPOINTS.BASE_URL.replace('/api', '')}/ws`);
      
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        
        // Отправляем событие подключения к комнате (если есть activeGameId)
        if (this.activeGameId) {
          this.emit(WEBSOCKET_EVENTS.CLIENT_TO_SERVER.JOIN_ROOM, { roomId: this.activeGameId });
        }
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Обработка событий от сервера
        if (data.type === WEBSOCKET_EVENTS.SERVER_TO_CLIENT.STATE_UPDATE) {
          console.log('State update received:', data.payload);
          // Обновляем локальное состояние игры
          this.onStateUpdate(data.payload);
        } else if (data.type === WEBSOCKET_EVENTS.SERVER_TO_CLIENT.ROUND_END) {
          console.log('Round ended');
          this.onRoundEnd();
        } else if (data.type === WEBSOCKET_EVENTS.SERVER_TO_CLIENT.GAME_STARTED) {
          console.log('Game started by server');
          this.onGameStarted(data.payload);
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.connected = false;
        
        // Логика переподключения (Reconnect Logic)
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnect();
          }, this.reconnectDelay);
        } else {
          console.log('Max reconnect attempts reached');
          // Показать экран ожидания или ошибку пользователю
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (e) {
      console.error('Socket init error:', e);
      // Для тестов можно использовать заглушку
      this.connected = true;
    }
  }

  /**
   * Отправка события на сервер
   */
  emit(event, data = {}) {
    if (this.socket && this.connected) {
      this.socket.send(JSON.stringify({ type: event, ...data }));
      console.log(`Event sent: ${event}`, data);
    } else {
      // Если не подключены, сохраняем в очередь
      this.pendingEvents.push({ event, data });
    }
  }

  /**
   * Обработка обновления состояния игры
   */
  onStateUpdate(payload) {
    console.log('onStateUpdate called');
    // Здесь обновляем глобальное состояние игры через Redux/Zustand или Context
    // this.store.dispatch({ type: 'UPDATE_GAME_STATE', payload });
  }

  /**
   * Обработка конца раунда
   */
  onRoundEnd() {
    console.log('onRoundEnd called');
    // Переход к следующему раунду
    this.emit(WEBSOCKET_EVENTS.CLIENT_TO_SERVER.START_GAME, {});
  }

  /**
   * Обработка старта игры сервером
   */
  onGameStarted(payload) {
    console.log('onGameStarted called');
    // Инициализация игрового поля
    this.activeGameId = payload.gameId;
    this.emit(WEBSOCKET_EVENTS.CLIENT_TO_SERVER.MOVE_VEHICLE, {});
  }

  /**
   * Переподключение к серверу
   */
  reconnect() {
    this.reconnectAttempts++;
    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
    
    // Очищаем pending events
    this.pendingEvents = [];
    
    // Перезапускаем сокет
    this.init();
  }

  /**
   * Отключение от сервера
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.connected = false;
    }
  }

  /**
   * Проверка подключения
   */
  isConnected() {
    return this.connected && this.socket?.readyState === WebSocket.OPEN;
  }

  // Экспорт для использования в других файлах
  getSocket() {
    return this.socket;
  }
}

// Создаем единый экземпляр сокета
export const gameSocket = new GameSocket();
