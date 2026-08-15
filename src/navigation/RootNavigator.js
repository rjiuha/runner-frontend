// src/navigation/RootNavigator.js
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { ROUTES } from './routes';

import AuthScreen from '../screens/AuthScreen';
import MainMenuScreen from '../screens/MainMenuScreen';
import LobbySearchScreen from '../screens/LobbySearchScreen';
import LobbyScreen from '../screens/LobbyScreen';
import GameBoardScreen from '../screens/GameBoardScreen';
import DevPlaygroundScreen from '../screens/DevPlaygroundScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    const { isLoading, isAuthenticated } = useAuth();

    // Пока читаем токены — ничего не показываем, иначе экран логина
    // мигнёт даже у авторизованного пользователя
    if (isLoading) {
        return (
            <View style={styles.splash}>
                <ActivityIndicator size="large" color="#6e34db" />
            </View>
        );
    }

    return (
        <Stack.Navigator
            screenOptions={{
                headerTitleAlign: 'center',
                headerStyle: { backgroundColor: '#2c3e50' },
                headerTintColor: '#fff',
            }}
        >
            {!isAuthenticated ? (
                /**
                 * Два независимых набора экранов вместо initialRouteName.
                 * Так после входа экран Auth физически исчезает из истории —
                 * вернуться на него свайпом или кнопкой «назад» невозможно.
                 */
                <Stack.Screen
                    name={ROUTES.AUTH}
                    component={AuthScreen}
                    options={{ headerShown: false, animationTypeForReplace: 'pop' }}
                />
            ) : (
                <>
                    <Stack.Screen
                        name={ROUTES.MAIN_MENU}
                        component={MainMenuScreen}
                        options={{ headerShown: false }}
                    />

                    <Stack.Screen
                        name={ROUTES.LOBBY_SEARCH}
                        component={LobbySearchScreen}
                        options={{ title: 'Поиск лобби' }}
                    />

                    {
                        <Stack.Screen
                            name={ROUTES.LOBBY}
                            component={LobbyScreen}
                            // выход из лобби — только через POST /api/lobby/leave,
                            // случайный свайп не должен уводить с экрана
                            options={{ title: 'Лобби', gestureEnabled: false }}
                        />


                    }
                    <Stack.Screen
                        name={ROUTES.RUNNER_GAME}
                        component={GameBoardScreen}
                        options={{
                            headerShown: false,
                            gestureEnabled: false,
                            presentation: 'fullScreenModal',
                        }}
                    />

                    {/* __DEV__ — не регистрируем маршрут в production-сборке, недостижим
                        через navigation.navigate, даже если кто-то узнает имя роута. */}
                    {__DEV__ && (
                        <Stack.Screen
                            name={ROUTES.DEV_PLAYGROUND}
                            component={DevPlaygroundScreen}
                            options={{ headerShown: false, presentation: 'fullScreenModal' }}
                        />
                    )}
                </>
            )}
        </Stack.Navigator>
    );
}

const styles = StyleSheet.create({
    splash: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2c3e50',
    },
});