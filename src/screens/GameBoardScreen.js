// src/screens/GameBoardScreen.js   (только изменённая часть)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { useGame } from '../context/GameContext';

const { width: screenW, height: screenH } = Dimensions.get('window');
const ROWS = 6;
const COLS = 8;
const CELL_W = Math.floor(screenW / COLS);
const CELL_H = Math.floor(screenH / ROWS);

/** Ячейка дороги */
const Cell = ({ cell, isSelected }) => {
  const { moveVehicle, currentTurnIndex, players } = useGame();
  const [selectedCell, setSelectedCell] = useState(null);

  // Определяем, принадлежит ли машина текущему игроку
  const isOwnVehicle =
    cell.vehicle && cell.vehicle.ownerId === players[currentTurnIndex]?.id;

  /** Обработчик нажатия */
  const onPress = () => {
    if (!selectedCell) {
      // Если ещё нет выбранной машины и в ячейке есть наша машина – выбираем её
      if (isOwnVehicle) setSelectedCell(cell);
    } else {
      // Есть выбранная машина – пытаемся переместить её в нажатую ячейку
      const { row, col } = cell;
      moveVehicle({
        vehicleId: selectedCell.vehicle.id,
        targetRow: row,
        targetCol: col
      });
      setSelectedCell(null);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        {
          width: CELL_W,
          height: CELL_H,
          marginLeft: cell.isOdd ? CELL_W / 2 : 0
        },
        isSelected && styles.selectedCell
      ]}
      onPress={onPress}
    >
      {/* Машина */}
      {cell.vehicle && (
        <View style={[styles.vehicle, { backgroundColor: '#e74c3c' }]} />
      )}
    </TouchableOpacity>
  );
};

/** Фрагмент дороги (один из трёх) */
const FieldFragment = ({ fragment }) => {
  return (
    <View style={styles.fragmentContainer}>
      {fragment.cells.map((cell) => (
        <Cell key={`${cell.row}-${cell.col}`} cell={cell} />
      ))}
    </View>
  );
};

/** Основной экран */
export default function GameBoardScreen() {
  const { gameState, players } = useGame();

  if (!gameState) return null; // пока поле не загружено

  /* ---------- HUD ---------- */
  const renderHUD = () => (
    <View style={styles.hud}>
      <Text style={styles.hudLabel}>Игрок: {players[0]?.username || '…'}</Text>
    </View>
  );

  /* ---------- Панель управления (низ) ---------- */
  const renderControls = () => (
    <View style={styles.controls}>
      {/* Кнопка завершения хода */}
      <TouchableOpacity
        style={styles.controlBtn}
        onPress={() => console.log('Завершить ход')}
      >
        <Text>Готово</Text>
      </TouchableOpacity>
    </View>
  );

  /* ---------- Основной контейнер (с возможностью скролла) ---------- */
  const MainContainer = Platform.OS === 'web' ? View : ScrollView;

  return (
    <SafeAreaView style={styles.container}>
      {renderHUD()}

      {/* Поле – три фрагмента подряд */}
      <MainContainer contentContainerStyle={styles.fieldWrapper}>
        {gameState.field.map((frag) => (
          <FieldFragment key={frag.id} fragment={frag} />
        ))}
      </MainContainer>

      {renderControls()}
    </SafeAreaView>
  );
}

/* ---------- Стили ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2c3e50',
    justifyContent: 'space-between'
  },

  /* HUD */
  hud: {
    paddingVertical: 10,
    backgroundColor: '#34495e',
    alignItems: 'center'
  },
  hudLabel: { color: '#ecf0f1', fontSize: 14 },

  /* Поле (три фрагмента) */
  fieldWrapper: {
    flexGrow: 1,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  fragmentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: COLS * CELL_W
  },

  /* Ячейка */
  cell: {
    borderWidth: 1,
    borderColor: '#7f8c8d',
    justifyContent: 'center',
    alignItems: 'center'
  },
  selectedCell: { backgroundColor: 'rgba(255,255,0,.2)' },

  vehicle: {
    width: CELL_W * 0.6,
    height: CELL_H * 0.6,
    borderRadius: 4
  },

  /* Панель управления */
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#1abc9c'
  },
  controlBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#16a085',
    borderRadius: 4
  }
});
