// src/screens/GameListScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';

export default function GameListScreen({ navigation }) {
  const games = [
    { id: 1, name: 'Гонка с друзьями', players: 3/4, host: 'Alex' },
    { id: 2, name: 'Турнир по пятницам', players: 2/4, host: 'Maria' }
  ];

  const renderGame = ({ item }) => (
    <TouchableOpacity 
      style={styles.gameItem} 
      onPress={() => alert(`Подключение к игре ${item.name}`)}
    >
      <Text style={styles.gameName}>{item.name}</Text>
      <Text style={styles.gameInfo}>Игроков: {item.players}/4 • Хост: {item.host}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Доступные игры</Text>
      <FlatList 
        data={games} 
        renderItem={renderGame} 
        keyExtractor={(item) => item.id.toString()} 
        contentContainerStyle={{ padding: 10 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ecf0f1', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  gameItem: { 
    backgroundColor: 'white', padding: 15, borderRadius: 8, 
    marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' 
  },
  gameName: { fontSize: 16, fontWeight: 'bold' },
  gameInfo: { fontSize: 12, color: '#7f8c8d' }
});
