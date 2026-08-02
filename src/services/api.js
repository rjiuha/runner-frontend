// src/services/api.js

import { Alert } from 'react-native';
import { API_ENDPOINTS } from '../constants/GameConstants';


/**
 * Базовая функция для отправки HTTP запросов
 */
export const apiRequest = async (endpoint, method = 'GET', body = null) => {
  try {
    const url = `${API_ENDPOINTS.BASE_URL}${endpoint}`;

    const config = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        // Добавьте авторизацию здесь (JWT токен)
        // 'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    };

    if (body) {
      config.body = JSON.stringify(body);
    }
    console.log('REQUEST:', config);  
    console.log('URL:', url); 
    //console.log('ENDPOINT REQUEST:', endpoint); 
    //console.log('BASE_URL REQUEST:', API_ENDPOINTS.BASE_URL); 
    const response = await fetch(url, config);
    console.log('RAW RESPONSE:', response);         // <-- посмотрим, что пришло
    console.log('Status:', response.status);          // 200, 400, 401 … 
    //console.log('Content-Type:', response.headers.get('content-type'));
    const responseData = await response.json();
    if (response.ok) {
      Alert.alert(responseData.message)
    }
    return {
      success: response.ok,
      data: responseData,
      status: response.status
    };
  } catch (error) {
    console.error('API Error:', error);
    throw new Error(`Network error: ${error.message}`);
  }
};

/**
 * Регистрация пользователя
 */
export const registerUser = async (email, password, username) => {
  return apiRequest(API_ENDPOINTS.AUTH.REGISTER, 'POST', {
    email,
    password,
    username
  });
};

/**
 * Регистрация пользователя
 */
export const loginUser = async (email, password) => {
  return apiRequest(API_ENDPOINTS.AUTH.LOGIN, 'POST', {
    email,
    password
  });
};



/**
 * Создание игры
 */
export const createGame = async () => {
  return apiRequest(API_ENDPOINTS.GAMES.CREATE, 'POST');
};

/**
 * Присоединение к игре
 */
export const joinGame = async (gameId) => {
  return apiRequest(`${API_ENDPOINTS.GAMES.JOIN.replace('{id}', gameId)}`, 'POST');
};

/**
 * Получение состояния игры
 */
export const getGameState = async (gameId) => {
  return apiRequest(`${API_ENDPOINTS.GAMES.GET.replace('{id}', gameId)}`);
};
