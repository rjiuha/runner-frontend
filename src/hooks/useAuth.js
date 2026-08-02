// src/hooks/useAuth.js

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerUser, loginUser } from '../services/api';

/**
 * Хук для управления состоянием авторизации
 */
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Загрузка пользователя при монтировании
  /*useEffect(() => {
    loadUser();
  }, []);*/

  /**
   * Загрузка пользователя из AsyncStorage
   
  const loadUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('@user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

    } catch (e) {
      console.error('Load user error:', e);
    }
  };*/

  /**
   * Регистрация нового пользователя
   */
  const processRegister = async (email, password, username) => {
    setLoading(true);
    setError('');

    try {
      const response = await registerUser(email, password, username);


      if (response.success) {
        return { success: true };
      } else {
        const errMsg = response.data?.error || 'Registration failed';
        setError(errMsg);

        return { success: false, error: errMsg };
      }
    } catch (e) {
      console.error('Register error:', e);
      setError(e.message);
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Регистрация нового пользователя
   */
  const processLogin = async (email, password) => {
    setLoading(true);
    setError('');

    try {
      const response = await loginUser(email, password);

      if (response.success) {
        // Сохраняем данные пользователя
        const userData = { email, username };
        await AsyncStorage.setItem('@user', JSON.stringify(userData));

        setUser(userData);
        return { success: true };
      } else {
        const errMsg = response.data?.error || 'Login failed';
        setError(errMsg);

        return { success: false, error: errMsg };
      }
    } catch (e) {
      console.error('Login error:', e);
      setError(e.message);
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  };
  /**
   * Выход из аккаунта
   */
  const logout = async () => {
    await AsyncStorage.removeItem('@user');
    setUser(null);
  };

  return { user, loading, error, processLogin, processRegister, logout };
};
