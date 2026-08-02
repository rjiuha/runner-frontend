// src/components/ui/DicePicker.js
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { GAME_CONFIG } from '../../constants/GameConstants';

/**
 * Компонент выбора типа кубика для хода
 */
export default function DicePicker({ selectedType, onSelect }) {
  const diceConfig = [
    { id: GAME_CONFIG.DICE_TYPES.MOVEMENT, label: 'Перемещение', color: '#3498db' },
    { id: GAME_CONFIG.DICE_TYPES.SHOOTING, label: 'Стрельба', color: '#e74c3c' },
    { id: GAME_CONFIG.DICE_TYPES.STUNT, label: 'Трюк', color: '#f1c40f' }
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Выберите кубик</Text>
      
      {/* Сетка выбора кубиков */}
      <View style={styles.diceGrid}>
        {diceConfig.map((d) => (
          <TouchableOpacity 
            key={d.id} 
            style={[styles.die, selectedType === d.id && styles.selectedDie]} 
            onPress={() => onSelect(d.id)}
          >
            <Text style={{color: 'white', fontWeight: 'bold'}}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Подсказка о значении кубика */}
      {selectedType === GAME_CONFIG.DICE_TYPES.MOVEMENT && (
        <Text style={styles.hint}>Значение: 1-6 очков перемещения</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 10 },
  
  title: { 
    fontSize: 16, 
    textAlign: 'center', 
    marginBottom: 10, 
    color: '#333'
  },
  
  diceGrid: { 
    flexDirection: 'row', 
    justifyContent: 'space-around'
  },
  
  die: { 
    width: 80, 
    height: 80, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#ccc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  
  selectedDie: { 
    backgroundColor: '#3498db', 
    borderWidth: 4, 
    borderColor: '#fff'
  },
  
  hint: { 
    fontSize: 12, 
    textAlign: 'center', 
    color: '#7f8c8d',
    marginTop: 5
  }
});
