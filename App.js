// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthScreen from './src/screens/AuthScreen';
import MainMenuScreen from './src/screens/MainMenuScreen';
import GameListScreen from './src/screens/GameListScreen';
//import CreateRoomScreen from './src/screens/CreateRoomScreen';
//import GameBoardScreen from './src/screens/GameBoardScreen';
const Stack = createStackNavigator();

/**
 * Точка входа приложения
 */
export default function App() {
  return (
    
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        {/* Экран авторизации/регистрации */}
        <Stack.Screen 
          name="Auth" 
          component={AuthScreen} 
          options={{ headerShown: false }} 
        />
        
        {/* Главное меню */}
        <Stack.Screen 
          name="MainMenu" 
          component={MainMenuScreen} 
          options={{ title: 'Главное меню', lazy: 'true' }} 
          
        />
        
        {/* Список игр */}
        <Stack.Screen 
          name="GameList" 
          component={GameListScreen} 
          options={{ title: 'Список игр', lazy: 'true' }} 
        />
        
        {/*
        <Stack.Screen 
          name="CreateRoom" 
          component={CreateRoomScreen} 
          options={{ title: 'Новая игра', lazy: 'true', headerStyle: { backgroundColor: '#e74c3c' } }} 
        />
        
        {/*
        <Stack.Screen 
          name="GameBoard" 
          component={GameBoardScreen} 
          options={{ 
            headerShown: false, 
            presentation: 'fullScreenModal', // На весь экран без шапки
            animationType: 'slide',
            lazy: 'true'
          }} 
        />*/}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
