// src/screens/AuthScreen.js
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import ParallaxBackground from '../components/ui/ParallaxBackground';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { notify } from '../lib/notify';
import { colors, spacing, font, radius } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- Вход ---------- */
function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = {};
    if (!email.trim()) next.email = 'Укажи email';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Похоже, email неверный';
    if (!password) next.password = 'Укажи пароль';

    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await signIn(email, password);
      // Навигации здесь НЕТ. RootNavigator сам подменит стек,
      // как только isAuthenticated станет true.
      // Плюс: экран Auth исчезает из истории, вернуться свайпом нельзя.
    } catch (e) {
      // 401 при логине = неверная пара, а не «истекла сессия»
      if (e.status === 401) {
        setErrors({ password: 'Неверный email или пароль' });
      } else {
        notify('Не удалось войти', e.userMessage ?? e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
      <View style={styles.form}>
        <Input
            placeholder="email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
        />
        <Input
            placeholder="Пароль"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secondary
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={submit}
        />
        <Button title="Войти" onPress={submit} loading={busy} style={styles.submit} />
      </View>
  );
}

/* ---------- Регистрация ---------- */
function RegisterForm({ onDone }) {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = {};
    if (!username.trim()) next.username = 'Придумай имя';
    else if (username.trim().length < 3) next.username = 'Минимум 3 символа';
    if (!email.trim()) next.email = 'Укажи email';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Похоже, email неверный';
    if (!password) next.password = 'Укажи пароль';
    else if (password.length < 6) next.password = 'Минимум 6 символов';
    if (password !== confirm) next.confirm = 'Пароли не совпадают';

    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      // signUp регистрирует И сразу логинит: не заставляем вводить
      // те же данные второй раз
      await signUp(email, password, username);
    } catch (e) {
      // 400/409 — обычно «email занят». Точный код добавим,
      // когда договоримся про формат ошибок на беке
      if (e.status === 400 || e.status === 409) {
        notify('Не удалось зарегистрироваться', e.userMessage ?? 'Проверь введённые данные');
        onDone?.(); // вернём на вкладку «Вход» — возможно, аккаунт уже есть
      } else {
        notify('Ошибка', e.userMessage ?? e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
      <View style={styles.form}>
        <Input
            placeholder="Имя пользователя"
            value={username}
            onChangeText={setUsername}
            error={errors.username}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
        />
        <Input
            placeholder="email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
        />
        <Input
            placeholder="Пароль"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secondary
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
        />
        <Input
            placeholder="Подтверждение пароля"
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            secondary
            secureTextEntry
            autoComplete="password-new"
            returnKeyType="go"
            onSubmitEditing={submit}
        />
        <Button title="Зарегистрироваться" onPress={submit} loading={busy} style={styles.submit} />
      </View>
  );
}

/* ---------- Экран ---------- */
export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);

  return (
      <Screen scroll contentContainerStyle={styles.content}>
        <ParallaxBackground />

        <View style={styles.header}>
          <Text style={styles.title}>Runner Game</Text>
          <Text style={styles.subtitle}>Игра на выживание</Text>
        </View>

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
            <Text style={[styles.tabLabel, !isLogin && styles.activeLabel]}>Регистрация</Text>
          </TouchableOpacity>
        </View>

        {isLogin ? <LoginForm /> : <RegisterForm onDone={() => setIsLogin(true)} />}
      </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  header: { marginTop: spacing.xxl, marginBottom: spacing.xxl, alignItems: 'center' },
  title: { fontSize: font.h1, color: colors.textOnDark, fontWeight: 'bold' },
  subtitle: { fontSize: font.body, color: colors.textOnDarkSecondary, marginTop: spacing.sm },

  tabBar: {
    width: '80%',
    maxWidth: 300,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
    borderBottomWidth: 1,
    borderColor: '#555',
  },
  tabItem: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  activeTab: { borderBottomWidth: 3, borderColor: colors.primaryTranslucent },
  tabLabel: { color: '#bbb', fontSize: font.body + 2 },
  activeLabel: { color: colors.textOnDark, fontWeight: 'bold' },

  form: { width: '80%', maxWidth: 300, alignSelf: 'center' },
  submit: { marginTop: spacing.sm, borderRadius: radius.md },
});