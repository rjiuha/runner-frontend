// src/screens/AuthScreen.js
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ForgotPasswordModal from '../components/auth/ForgotPasswordModal';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { notify } from '../lib/notify';
import { colors, spacing, font, radius } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Зеркалит RegistrationService::USERNAME_PATTERN на бэке (read-only,
// 2026-10-22): 3-20 символов, буквы (включая кириллицу через \p{L}), цифры,
// «_», «-», «.». «@» не входит в допустимые символы — этим бэк отличает
// ник от email в поле login при входе (см. UserRepository::findOneByLogin).
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const USERNAME_RE = new RegExp(`^[\\p{L}\\p{N}_.-]{${USERNAME_MIN},${USERNAME_MAX}}$`, 'u');

/* ---------- Вход ---------- */
function LoginForm() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const submit = async () => {
    const next = {};
    if (!login.trim()) next.login = t('auth.login.errorEmptyLogin');
    if (!password) next.password = t('auth.login.errorEmptyPassword');

    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await signIn(login, password);
      // Навигации здесь НЕТ. RootNavigator сам подменит стек,
      // как только isAuthenticated станет true.
      // Плюс: экран Auth исчезает из истории, вернуться свайпом нельзя.
    } catch (e) {
      // 401 при логине = неверная пара, а не «истекла сессия»
      if (e.status === 401) {
        setErrors({ password: t('auth.login.errorWrongCredentials') });
      } else {
        notify(t('auth.login.failTitle'), e.userMessage ?? e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
      <View style={styles.form}>
        {/*
          Поле принимает и email, и ник — бэк сам определяет по наличию «@»
          (POST /api/login {"login":...}, см. api/auth.js). 2026-10-22: было
          строго email-only поле (keyboardType/textContentType под email
          мешали бы вводу ника), после смены контракта бэка сделано общим.
        */}
        <Input
            placeholder={t('auth.login.placeholderLogin')}
            value={login}
            onChangeText={setLogin}
            error={errors.login}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
        />
        <Input
            placeholder={t('auth.login.placeholderPassword')}
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
        <Button title={t('auth.login.submit')} onPress={submit} loading={busy} style={styles.submit} />
        <TouchableOpacity onPress={() => setForgotOpen(true)} style={styles.forgotLink}>
          <Text style={styles.forgotLinkText} noGlobalTint>{t('auth.login.forgotLink')}</Text>
        </TouchableOpacity>

        <ForgotPasswordModal visible={forgotOpen} onClose={() => setForgotOpen(false)} />
      </View>
  );
}

/* ---------- Регистрация ---------- */
function RegisterForm() {
  const { signUp } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = {};
    if (!username.trim()) next.username = t('auth.register.errorEmptyUsername');
    else if (!USERNAME_RE.test(username.trim())) {
      next.username = t('auth.register.errorUsernamePattern', { min: USERNAME_MIN, max: USERNAME_MAX });
    }
    if (!email.trim()) next.email = t('auth.register.errorEmptyEmail');
    else if (!EMAIL_RE.test(email.trim())) next.email = t('auth.register.errorEmailInvalid');
    if (!password) next.password = t('auth.register.errorEmptyPassword');
    else if (password.length < 6) next.password = t('auth.register.errorPasswordMin');
    if (password !== confirm) next.confirm = t('auth.register.errorPasswordMismatch');

    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      // signUp регистрирует И сразу логинит: не заставляем вводить
      // те же данные второй раз
      await signUp(email, password, username);
    } catch (e) {
      // Коды ошибок регистрации — UserException на бэке (read-only,
      // 2026-10-22): EMAIL_INVALID/USER_ALREADY_EXISTS → поле email,
      // USERNAME_INVALID/USERNAME_TAKEN → поле username. На остальное
      // (MISSING_CREDENTIALS и т.п., клиент сам не пропустит) — общий тост.
      if (e.code === 'EMAIL_INVALID') {
        setErrors({ email: t('auth.register.errorEmailInvalid') });
      } else if (e.code === 'USER_ALREADY_EXISTS') {
        setErrors({ email: t('auth.register.errorEmailTaken') });
      } else if (e.code === 'USERNAME_TAKEN') {
        setErrors({ username: t('auth.register.errorUsernameTaken') });
      } else if (e.code === 'USERNAME_INVALID') {
        setErrors({ username: t('auth.register.errorUsernamePatternShort', { min: USERNAME_MIN, max: USERNAME_MAX }) });
      } else {
        notify(t('common.error'), e.userMessage ?? e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
      <View style={styles.form}>
        <Input
            placeholder={t('auth.register.placeholderUsername')}
            value={username}
            onChangeText={setUsername}
            error={errors.username}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
        />
        <Input
            placeholder={t('auth.register.placeholderEmail')}
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
            placeholder={t('auth.register.placeholderPassword')}
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secondary
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
        />
        <Input
            placeholder={t('auth.register.placeholderConfirm')}
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            secondary
            secureTextEntry
            autoComplete="password-new"
            returnKeyType="go"
            onSubmitEditing={submit}
        />
        <Button title={t('auth.register.submit')} onPress={submit} loading={busy} style={styles.submit} />
      </View>
  );
}

/* ---------- Экран ---------- */
export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const { t } = useI18n();

  return (
      <Screen scroll contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {/* "Star Runners" — название бренда, не переводится ни на один язык */}
          <Text style={styles.title}>Star Runners</Text>
          <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
              style={[styles.tabItem, isLogin && styles.activeTab]}
              onPress={() => setIsLogin(true)}
          >
            <Text style={[styles.tabLabel, isLogin && styles.activeLabel]}>{t('auth.tabLogin')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
              style={[styles.tabItem, !isLogin && styles.activeTab]}
              onPress={() => setIsLogin(false)}
          >
            <Text style={[styles.tabLabel, !isLogin && styles.activeLabel]}>{t('auth.tabRegister')}</Text>
          </TouchableOpacity>
        </View>

        {isLogin ? <LoginForm /> : <RegisterForm />}
      </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  header: { marginTop: spacing.xxl, marginBottom: spacing.xxl, alignItems: 'center' },
  // color: colors.neonCyan — точечно, ЯВНО (2026-09-14). Раньше это давал
  // глобальный jsx-патч в App.js (форсил циан на любой Text) — по прямому
  // решению пользователя патч убран, циан остаётся ТОЛЬКО тут.
  title: { fontSize: font.h1, color: colors.neonCyan, fontWeight: 'bold' },
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
  // backgroundColor явно (2026-09-14, по прямому запросу пользователя) —
  // дефолтный variant="primary" у Button даёт полупрозрачный
  // colors.primaryTranslucent, тут перекрываем сплошным colors.primary (тот
  // же приём, что и у кнопки "Обновить" на LobbySearchScreen).
  submit: { marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primary },

  forgotLink: { marginTop: spacing.md, alignSelf: 'center' },
  forgotLinkText: { color: colors.textOnDarkSecondary, fontSize: font.small, textDecorationLine: 'underline' },
});