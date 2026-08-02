// src/components/game/RoadSegment.js
import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Компонент отображения одного сегмента игрового поля
 */
export default function RoadSegment({ index }) {
  // В реальном проекте здесь рендерится сетка ячеек с типами (дорога, грязь и т.д.)
  // Данные берутся из gameState.trackState.segments[index]
  
  return (
    <View style={styles.segment}>
      {/* Номер сегмента */}
      <Text style={styles.segmentLabel}>Сегмент {index + 1}</Text>
      
      {/* Сетка ячеек для визуализации */}
      <View style={{flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center'}}>
        {/* Примерная сетка из 3-х типов ячеек */}
        <Cell type="road" />
        <Cell type="mud" />
        <Cell type="danger" />
      </View>
    </View>
  );
}

/**
 * Компонент ячейки с типом местности
 */
function Cell({ type }) {
  const stylesMap = {
    road: styles.roadCell,
    mud: styles.mudCell,
    danger: styles.dangerCell,
    offroad: styles.offroadCell,
    impassable: styles.impassableCell
  };

  return (
    <View style={[styles.cell, stylesMap[type] || styles.roadCell]} />
  );
}

const styles = StyleSheet.create({
  segment: { 
    height: 150, 
    backgroundColor: '#95a5a6', 
    marginVertical: 2, 
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  
  segmentLabel: { 
    position: 'absolute', 
    top: 5, 
    left: 5, 
    color: 'white', 
    fontSize: 10, 
    fontWeight: 'bold'
  },
  
  cell: { 
    width: 80, 
    height: 80, 
    borderWidth: 1, 
    borderColor: '#7f8c8d', 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  
  roadCell: { backgroundColor: '#bdc3c7' }, // Дорога - серая
  mudCell: { backgroundColor: '#5D4037' },   // Грязь - коричневая
  dangerCell: { backgroundColor: '#e74c3c' }, // Опасность - красная
  offroadCell: { backgroundColor: '#f39c12' }, // Бездорожье - оранжевая
  impassableCell: { backgroundColor: '#34495e', borderWidth: 2, borderColor: '#fff' } // Непроходимая - темная с рамкой
});
