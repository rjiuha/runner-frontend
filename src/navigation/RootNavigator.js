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
// ВРЕМЕННО (2026-09-20, прототип спрайт-листов, см. CLAUDE.md) — убрать
// вместе с этим импортом, Stack.Screen ниже и кнопкой-входом в
// GameBoardScreen.js, когда сравнение gif/спрайт-лист будет больше не нужно.
import SpriteSheetPreview from '../screens/__SpriteSheetPreview';

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
                // 'fade' вместо дефолтного 'slide_from_right' — по прямому
                // запросу пользователя, 2026-09-14: "плавное одновременное
                // исчезание элементов экрана... плавное возникновение элементов
                // нового экрана" вместо слайда. Встроенный пресет native-stack
                // (react-native-screens) — ближайшее РЕАЛЬНО поддерживаемое
                // приближение: кросс-фейд старого/нового экрана целиком, не
                // покадрово настраиваемая 3-фазная последовательность (fade-out
                // → спиннер → fade-in отдельными шагами) — для ТАКОГО уровня
                // контроля нужен JS-driven `@react-navigation/stack`
                // (cardStyleInterpolator) вместо нативного стека, это отдельная,
                // более рискованная замена навигатора, не делал без отдельного
                // запроса. На вебе `NativeStackView.tsx`/`ScreenStack.web.tsx`
                // не реализуют переходы вообще (см. исходники) — эффект будет
                // виден только на native (Android/iOS).
                animation: 'fade',
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
                        // headerShown:false — та же правка, что и у LOBBY
                        // (2026-09-14, по прямому запросу пользователя,
                        // "по аналогии с лобби"): свой заголовок рисует сам
                        // экран, см. LobbySearchScreen#screenTitle.
                        options={{ headerShown: false }}
                    />

                    {
                        <Stack.Screen
                            name={ROUTES.LOBBY}
                            component={LobbyScreen}
                            // headerShown:false (2026-09-14, по прямому запросу
                            // пользователя) — нативная шапка стека рисовалась на
                            // всю ширину экрана сплошным непрозрачным цветом
                            // (перекрывала общий ParallaxBackground) и обычным
                            // системным шрифтом текста (мимо глобального
                            // JSX-патча в App.js — шапка рисуется библиотекой
                            // напрямую, не через наш `<Text>`). Заголовок теперь
                            // рисует сам LobbyScreen внутри центрированного блока
                            // (свой шрифт/цвет). gestureEnabled:false оставлен —
                            // выход из лобби только через POST /api/lobby/leave
                            // (кнопка «Покинуть лобби»), случайный свайп-назад
                            // не должен уводить с экрана в обход этого вызова —
                            // это верно независимо от видимости шапки (на iOS
                            // жест работает по краю экрана сам по себе).
                            options={{ headerShown: false, gestureEnabled: false }}
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

                    {/* ВРЕМЕННО — см. импорт SpriteSheetPreview выше. Обычный
                        Stack.Screen (не подмена AuthScreen) — открывается
                        ПОВЕРХ активной партии кнопкой из GameBoardScreen,
                        "назад" возвращает в игру, ничего в игровом состоянии
                        не трогает. */}
                    <Stack.Screen
                        name="__SpriteSheetPreview"
                        component={SpriteSheetPreview}
                        options={{ headerShown: false }}
                    />
                </>
            )}
        </Stack.Navigator>
    );
}

const styles = StyleSheet.create({
    // Без backgroundColor — под этим спиннером теперь общий ParallaxBackground
    // (App.js), а не свой сплошной цвет. Тот же приём, что и во всех
    // остальных загрузочных экранах приложения, см. App.js#TRANSPARENT_NAV_THEME.
    splash: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});