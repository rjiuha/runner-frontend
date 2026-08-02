// src/screens/CreateRoomScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, FlatList, TouchableOpacity, Modal } from 'react-native';
import { useGame } from '../hooks/useGame';
import VehicleComponent from '../components/game/VehicleComponent';

export default function CreateRoomScreen({ navigation }) {
  const { 
    createRoom, joinRoom, roomState, players, toggleReady, startGame 
  } = useGame('CREATE_ROOM');

  // Состояние для отображения списка игроков в комнате
  const [connectedPlayers, setConnectedPlayers] = useState([]);

  /**
   * Эффект обновления списка игроков при подключении к сокету
   */
  useEffect(() => {
    if (roomState.status === 'WAITING') {
      // В реальном проекте здесь слушаем событие player_joined от WebSocket
      console.log('Waiting for players in room...');
      
      const interval = setInterval(async () => {
        // Периодическая проверка состояния комнаты
        try {
          // Здесь можно добавить fetch для получения актуального списка игроков
          // await getGameState(activeGameId);
          
          // Для теста обновляем список случайным образом
          if (Math.random() > 0.8) {
            setConnectedPlayers(prev => [...prev, { id: Date.now(), name: `Player_${Math.floor(Math.random() * 100)}` }]);
          }
        } catch (e) {
          console.error('Sync error', e);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [roomState.status, activeGameId]);

  /**
   * Обработка нажатия кнопки "Готов"
   */
  const handleReady = async () => {
    await toggleReady();
    
    // Визуальная обратная связь
    alert(roomState.readyPlayers.includes(players[0]?.id) ? 'Вы готовы!' : 'Вы отменили готовность');
  };

  /**
   * Обработка нажатия кнопки "Старт" (только для хоста)
   */
  const handleStart = async () => {
    if (roomState.status === 'READY') {
      await startGame();
      
      // Переход в игровое поле после старта
      setTimeout(() => {
        navigation.navigate('GameBoard');
      }, 1000);
    } else {
      alert('Подождите, пока все игроки нажмут "Готов"');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Шапка с информацией о комнате */}
      <View style={styles.header}>
        <Text style={styles.title}>Комната ожидания</Text>
        
        {/* Статус комнаты */}
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Статус: {roomState.status}</Text>
          
          {roomState.status === 'WAITING' && (
            <>
              <Text style={{fontSize: 18, fontWeight: 'bold', marginTop: 10}}>
                Игроков в комнате: {players.length}/{roomState.maxPlayers}
              </Text>
              
              {/* Список подключившихся игроков */}
              {connectedPlayers.length > 0 && (
                <FlatList 
                  data={connectedPlayers}
                  renderItem={({ item }) => (
                    <View style={styles.playerItem}>
                      <VehicleComponent type="small" state="active" />
                      <Text>{item.name}</Text>
                    </View>
                  )}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={{ marginTop: 10 }}
                />
              )}
            </>
          )}

          {/* Кнопка "Готов" (для всех игроков) */}
          {roomState.status === 'WAITING' && players.length > 0 && (
            <TouchableOpacity 
              style={[styles.readyBtn, roomState.readyPlayers.includes(players[0]?.id) ? styles.readyActive : {}]} 
              onPress={handleReady}
            >
              <Text style={styles.readyText}>
                {roomState.readyPlayers.includes(players[0]?.id) ? '✅ Готов' : '🔄 Нажми "Готов"'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Кнопка "Старт" (только для хоста, когда все готовы) */}
          {roomState.status === 'READY' && roomState.hostId === players[0]?.id && (
            <TouchableOpacity 
              style={styles.startBtn} 
              onPress={handleStart}
            >
              <Text style={styles.startText}>🚀 Старт игры</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Индикатор загрузки */}
      {roomState.status === 'CREATING' && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={{marginTop: 10, color: '#fff'}}>Создание комнаты...</Text>
        </View>
      )}

      {/* Индикатор загрузки при ожидании игроков */}
      {roomState.status === 'WAITING' && connectedPlayers.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={{marginTop: 10, color: '#fff'}}>Ожидание игроков...</Text>
        </View>
      )}

      {/* Индикатор загрузки при ожидании старта */}
      {roomState.status === 'READY' && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={{marginTop: 10, color: '#fff'}}>Все готовы! Ждем старта...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2c3e50', padding: 20 },
  
  header: { 
    marginBottom: 30, 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#bdc3c7',
    paddingBottom: 20
  },
  
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  
  statusBox: { 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    borderRadius: 15, 
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  
  statusText: { fontSize: 16, fontWeight: 'bold', color: '#3498db' },
  
  playerItem: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#bdc3c7'
  },
  
  readyBtn: { 
    marginTop: 20, 
    width: '100%', 
    height: 60, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 8,
    backgroundColor: '#f39c12'
  },
  
  readyActive: { backgroundColor: '#2ecc71' }, // Зеленый когда готов
  
  startBtn: { 
    marginTop: 20, 
    width: '100%', 
    height: 60, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 8,
    backgroundColor: '#e74c3c'
  },
  
  readyText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  startText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  }
});
