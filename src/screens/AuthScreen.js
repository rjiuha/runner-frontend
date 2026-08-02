// AuthScreen.js
import React, { useState } from 'react';
import ParallaxBackground from './ParallaxBackground';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';

/* ---------- Вкладка «Вход» ---------- */
function RenderLogin() {
  const { processLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation();

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    processLogin(email, password).then(result => {
      if (result.success) {
        navigation.navigate('MainMenu');
      } else {
        Alert.alert('Ошибка', result.error);
      }
    });
  };

  return (
    <View style={styles.formContainer}>
      <TextInput
        style={styles.input}
        placeholder="email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, styles.passwordInput]}
        placeholder="Пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.btnText}>Войти</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- Вкладка «Регистрация» ---------- */
function RenderRegister() {
  const { processRegister } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const navigation = useNavigation();

  const handleRegister = () => {
    if (!username || !password || !email || !passwordConfirm) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('Ошибка', 'Пароли не совпадают!');
      return;
    }

    processRegister(email, password, username).then(result => {
      if (result.success) {
        navigation.navigate('Auth');
      } else {
        Alert.alert('Ошибка', result.error);
      }
    });
  };

  return (
    <View style={styles.formContainer}>
      <TextInput
        style={styles.input}
        placeholder="Имя пользователя"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, styles.passwordInput]}
        placeholder="Пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={[styles.input, styles.passwordInput]}
        placeholder="Подтверждение пароля"
        secureTextEntry
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
      />
      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.btnText}>Зарегистрироваться</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- Основной экран ---------- */
export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    
   
    <SafeAreaView style={styles.safeContainer}>
      <ParallaxBackground/>
      {/* Header */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Runner Game</Text>
          <Text style={styles.subtitle}>Игра на выживание</Text>
        </View>

        {/* Переключатель вкладок */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, isLogin && styles.activeTab]}
            onPress={() => setIsLogin(true)}
          >
            <Text style={[styles.tabLabel, isLogin && styles.activeLabel]}>Вход</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, !isLogin && styles.activeTab]}
            onPress={() => setIsLogin(false)}
          >
            <Text style={[styles.tabLabel, !isLogin && styles.activeLabel]}>
              Регистрация
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Содержимое вкладки */}
        {isLogin ? <RenderLogin /> : <RenderRegister />}
      </ScrollView>
    </SafeAreaView>
   
  );
}

/* ---------- Стили ---------- */
const styles = StyleSheet.create({
  /* 1️⃣ SafeArea + ScrollView */
  safeContainer: {
    flex: 1,
    backgroundColor: '#2c3e50',
   
  },
  scrollContent: {          // ← это то, что раньше было в `container`
    flexGrow: 1,            // растягиваемся на всю доступную высоту
    //justifyContent: 'center',   // вертикальное центрирование
    alignItems: 'center',       // горизонтальное центрирование
    paddingHorizontal: 20,
    paddingBottom: 40
  },

  /* 2️⃣ Header */
  header: { marginBottom: 40, alignItems: 'center' },
  title: { fontSize: 32, color: 'white', fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#bdc3c7', marginTop: 10 },

  /* 3️⃣ Переключатель вкладок */
  tabBar: {
    width: '80%',
    maxWidth: 300,
    flexDirection: 'row',
    justifyContent: 'space-around',   // равномерное распределение
    marginBottom: 30,
    borderBottomWidth: 1,
    borderColor: '#555',
  },
  tabItem: { paddingVertical: 8, paddingHorizontal: 20 },
  activeTab: { borderBottomWidth: 3, borderColor: '#6e34dbb8' },
  tabLabel: { color: '#bbb', fontSize: 18 },
  activeLabel: { color: '#fff', fontWeight: 'bold' },

  /* 4️⃣ Форма */
  formContainer: {
    width: '80%',
    maxWidth: 300,
    alignSelf: 'center',
    marginTop: 10
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#848383',
    color: 'white',
    borderRadius: 8,
    marginVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#918f8f9f',
  },
  passwordInput: { backgroundColor: '#6261619f', },

  button: {
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#6e34dbb8',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
