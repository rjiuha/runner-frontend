// src/screens/MainMenuScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
//import { useGame } from '../hooks/useGame';

export default function MainMenuScreen({ navigation }) {
 // const { user, createRoom, activeGameId, roomState, handleReconnect } = useGame('MAIN_MENU');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Шапка с информацией о пользователе */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Привет, {/*user?.name ||*/ 'Гость'}</Text>
          <Text style={styles.subtitle}>Добро пожаловать в Runner Game</Text>
        </View>

        {/* Статус активной игры (если есть) */}
        {activeGameId && (
          <TouchableOpacity 
            style={[styles.card, styles.reconnectCard]} 
            //onPress={() => handleReconnect()}
          >
            <Text style={styles.cardTitle}>🔄 Переподключиться</Text>
            <Text style={styles.cardDesc}>ID: {activeGameId}</Text>
            <Text style={{color: '#f1c40f', fontSize: 12}}>Статус: {/*roomState.status*/}</Text>
          </TouchableOpacity>
        )}

        {/* Кнопка создания игры */}
        <TouchableOpacity 
          style={[styles.card, styles.createBtn]} 
          //onPress={() => createRoom()}
        >
          <Text style={styles.cardTitle}>🏁 Создать игру</Text>
          <Text style={styles.cardDesc}>Пригласить до 3 друзей в комнату ожидания</Text>
        </TouchableOpacity>

        {/* Кнопка списка игр */}
        <TouchableOpacity 
          style={[styles.card, styles.listBtn]} 
          onPress={() => navigation.navigate('GameList')}
        >
          <Text style={styles.cardTitle}>📋 Список игр</Text>
          <Text style={styles.cardDesc}>Подключиться к существующей игре</Text>
        </TouchableOpacity>

        {/* Кнопка выхода */}
        <TouchableOpacity 
          style={[styles.card, styles.logoutBtn]} 
          onPress={() =>  navigation.navigate('Auth')}
        >
          <Text style={styles.cardTitle}>🚪 Выйти</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ecf0f1' },
  scrollContent: { padding: 20 },
  
  header: { 
    marginBottom: 30, 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#bdc3c7',
    paddingBottom: 20
  },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50' },
  subtitle: { fontSize: 16, color: '#7f8c8d', marginTop: 5 },
  
  card: { 
    backgroundColor: 'white', 
    borderRadius: 12, 
    padding: 20, 
    marginBottom: 15, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  
  createBtn: { backgroundColor: '#e74c3c' }, // Красный для создания (акцент)
  listBtn: { backgroundColor: '#3498db' },   // Синий для списка
  reconnectCard: { backgroundColor: '#2ecc71' }, // Зеленый для ре-коннекта
  logoutBtn: { backgroundColor: '#95a5a6', marginTop: 'auto', marginBottom: 0 },
  
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  cardDesc: { fontSize: 14, color: 'rgba(255,255,255,0.9)' }
});
