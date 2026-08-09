// App.js
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

/**
 * Точка входа. Здесь только провайдеры — вся логика в RootNavigator.
 * Порядок важен: AuthProvider должен быть ВЫШЕ навигатора,
 * потому что навигатор решает, какие экраны показывать, по состоянию авторизации.
 */
export default function App() {
  return (
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
  );
}