// src/components/game/VehicleComponent.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Компонент отображения машины на игровом поле
 */
export default function VehicleComponent({ type, state }) {
  // type: small/medium/large (из VEHICLE_SIZES)
  // state: active/broken/destroyed (из RUNNER_STRUCTURE.status)
  
  let color = '#3498db'; // Синий по умолчанию (средняя машина)
  if (state === 'broken') color = '#f1c40f'; // Желтый если сломана
  if (type === 'large') color = '#e74c3c'; // Красный большая
  
  // Размеры машины на поле (из ASSET_SIZES.VEHICLE_SIZE)
  const size = { width: 80, height: 120 };

  return (
    <View style={[styles.vehicle, { backgroundColor: color }]}>
      {/* Статус машины */}
      <Text style={styles.label}>{state === 'active' ? 'OK' : state.toUpperCase()}</Text>
      
      {/* Тип машины (размер) - можно добавить иконку или текст */}
      <Text style={{fontSize: 8, color: 'white', fontWeight: 'bold'}}>
        {type.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  vehicle: { 
    width: 80, 
    height: 120, 
    borderRadius: 5, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5
  },
  
  label: { 
    fontSize: 10, 
    color: 'white', 
    fontWeight: 'bold'
  }
});
