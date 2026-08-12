// App.js
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

/**
 * Точка входа. Здесь только провайдеры — вся логика в RootNavigator.
 * Порядок важен: AuthProvider должен быть ВЫШЕ навигатора,
 * потому что навигатор решает, какие экраны показывать, по состоянию авторизации.
 *
 * GestureHandlerRootView — снаружи всего: без него Pan-жесты (перетаскивание
 * кубиков на игровой доске) молча не работают на Android, а иногда и на вебе.
 */
export default function App() {
  return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
  );
}