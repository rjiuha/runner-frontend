// src/screens/MainMenuScreen.js
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/ui/Screen';
import MenuCard from '../components/menu/MenuCard';
import ProfileCard from '../components/menu/ProfileCard';
import CreateLobbyModal from '../components/menu/CreateLobbyModal';
import LoadingCard from '../components/ui/LoadingCard';
import Button from '../components/ui/Button';
import GameSettingsModal from '../components/game/GameSettingsModal';
import { useAuth } from '../hooks/useAuth';
import { lobbyApi } from '../api/lobby';
import { meApi } from '../api/me';
import { ROUTES } from '../navigation/routes';
import { notify, confirm } from '../lib/notify';
import { GAME_STATUS } from '../constants/GameConstants';
import { colors, spacing, font, radius } from '../theme';

// Партия, в которую можно/нужно вернуться при заходе в меню — активная
// (ждёт готовности игроков или уже идёт). "finish" сюда не попадает: для неё
// в Фазе 1 нет отдельного экрана, так что незачем на неё редиректить.
const RESUMABLE_GAME_STATUSES = [GAME_STATUS.WAITING, GAME_STATUS.ACTIVE];

export default function MainMenuScreen({ navigation }) {
  const { user, signOut } = useAuth();

  const [creating, setCreating] = useState(false);
  // true только до первого резолва проверки активной игры/лобби — дальше не
  // блокируем повторные фокусы экрана.
  const [checkingSession, setCheckingSession] = useState(true);
  const bootCheckedRef = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Баннер "нет связи с сервером" (2026-10-11, по прямому запросу
  // пользователя — раньше сбой GET /api/me при заходе в меню просто
  // логировался в консоль, молча оставляя пользователя в меню без
  // объяснений, см. checkSession ниже). Строка userMessage ИЛИ null —
  // null прячет баннер целиком. Только `isNetwork` (ApiError.js — статус 0,
  // реальный обрыв связи/таймаут), НЕ любая ошибка /api/me — например 401
  // уже обрабатывается глобально (разлогин через AuthContext), не нужно
  // показывать тут ещё и "нет связи" поверх.
  const [connectionError, setConnectionError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  // "⚙️ Настройки" (2026-10-04, по прямому запросу пользователя — в меню
  // уже была заготовка-заглушка под MVP-2, "Профиль и звук") — пока только
  // звук, тот же GameSettingsModal, что и в игре (кнопка settings в
  // seam-ряду GameBoardScreen) — общий lib/audioSettings.js стор, одни и те
  // же 4 канала/значения видны из обоих мест.
  const [settingsOpen, setSettingsOpen] = useState(false);

  /**
   * Один вызов GET /api/me (см. AuthController::me() на бэке, read-only)
   * вместо прежних ДВУХ отдельных (runnerGameApi.get()+lobbyApi.mine()) —
   * по прямому запросу пользователя, "после авторизации фронт вызывал
   * api/me". Игра приоритетнее лобби: если у пользователя есть активная
   * партия (например, после reload/relaunch посреди игры), сразу уводим
   * туда. Лобби тоже безусловный редирект — по прямому требованию "если
   * есть лобби - то в лобби". `me.lobby`/`me.game` — слим-объекты
   * {id,status} (НЕ полный toArray()) — этого достаточно, чтобы решить,
   * КУДА направить, полные данные подтянет сам целевой экран
   * (LobbyScreen/GameBoardScreen) через свой обычный live-коннект.
   *
   * Вынесена в отдельную функцию (2026-10-11) — вызывается и из
   * useFocusEffect ниже (авто-проверка при каждом фокусе экрана), и из
   * кнопки "Обновить соединение" баннера (ручной повтор после сбоя сети).
   * `guard` — опционален, нужен ТОЛЬКО useFocusEffect'у (отменить
   * setState, если экран потерял фокус/размонтировался, пока запрос
   * летел) — ручной вызов из кнопки его не передаёт, экран в этот момент
   * точно сфокусирован.
   */
  const checkSession = useCallback(async (guard) => {
    try {
      const me = await meApi.get();
      if (guard?.cancelled) return;
      setConnectionError(null);

      if (me.game && RESUMABLE_GAME_STATUSES.includes(me.game.status)) {
        navigation.reset({
          index: 0,
          routes: [{ name: ROUTES.RUNNER_GAME, params: { gameId: me.game.id } }],
        });
        return;
      }

      if (me.lobby) {
        navigation.navigate(ROUTES.LOBBY, { lobbyId: me.lobby.id });
        return;
      }
    } catch (e) {
      // Залогировано (2026-09-13, по жалобе "иногда не находит активную
      // игру, хотя она есть") — раньше ошибка проглатывалась молча,
      // отличить "игры действительно нет" от "запрос упал" было
      // невозможно. 2026-10-11 — живой лог с реального устройства наконец
      // подтвердил: как минимум один реальный случай был именно сетевым
      // сбоем (status 0, 11+ секунд таймаут), не багом бэка/токена.
      console.warn('[MainMenuScreen] GET /me failed:', e?.status, e?.code, e?.message);
      if (guard?.cancelled) return;
      // Баннер — ТОЛЬКО для реального обрыва связи (isNetwork, статус 0).
      // Другие ошибки (401 и т.п.) не блокируют меню молча, как и раньше —
      // пользователь может попробовать действие вручную.
      if (e?.isNetwork) setConnectionError(e.userMessage);
    } finally {
      if (!guard?.cancelled && !bootCheckedRef.current) {
        bootCheckedRef.current = true;
        setCheckingSession(false);
      }
    }
  }, [navigation]);

  // useFocusEffect, а не useEffect: проверять активное лобби/партию нужно
  // при КАЖДОМ возврате на экран (например, вышел из лобби вручную — а бэк
  // по-прежнему считает его активным, значит сразу вернуть обратно), а не
  // только при первом монтировании.
  useFocusEffect(
      useCallback(() => {
        const guard = { cancelled: false };
        checkSession(guard);
        return () => { guard.cancelled = true; };
      }, [checkSession]),
  );

  const handleRetryConnection = useCallback(() => {
    setRetrying(true);
    checkSession().finally(() => setRetrying(false));
  }, [checkSession]);

  const handleCreate = async (maxPlayers) => {
    setCreating(true);
    try {
      const lobby = await lobbyApi.create(maxPlayers);
      setModalOpen(false);
      navigation.navigate(ROUTES.LOBBY, { lobbyId: lobby.id });
    } catch (e) {
      // Уже есть НЕЗАВЕРШЁННАЯ партия (ACTIVE_GAME_EXISTS, см. ApiError.js —
      // ТОТ же приём, что уже был у "ты уже в лобби" ниже) — 2026-10-15, по
      // прямому запросу пользователя: вместо тоста сразу уводим в партию,
      // той же навигацией, что и checkSession выше при обычном заходе в меню.
      if (e.activeGameId != null) {
        setModalOpen(false);
        navigation.reset({
          index: 0,
          routes: [{ name: ROUTES.RUNNER_GAME, params: { gameId: e.activeGameId } }],
        });
        return;
      }
      // Самый частый случай — «ты уже в лобби».
      // Тогда не показываем ошибку, а просто отводим туда, где он есть.
      const existing = await lobbyApi.mine().catch(() => null);
      if (existing) {
        setModalOpen(false);
        navigation.navigate(ROUTES.LOBBY, { lobbyId: existing.id });
        return;
      }
      notify('Не удалось создать лобби', e.userMessage ?? e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    confirm('Выйти из аккаунта?', 'Придётся войти заново', signOut, 'Выйти');
  };

  // Пока не резолвнулась первая проверка активной игры/лобби — не мелькаем
  // содержимым меню перед возможным авторедиректом в игру.
  if (checkingSession) {
    return (
        <Screen contentContainerStyle={styles.splash}>
          <LoadingCard />
        </Screen>
    );
  }

  return (
      <Screen scroll contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <ProfileCard username={user?.username} />

          {connectionError && (
              <View style={styles.connectionBanner}>
                <Text style={styles.connectionBannerText} noGlobalTint>{connectionError}</Text>
                <Button
                    title="Обновить соединение"
                    variant="danger"
                    loading={retrying}
                    onPress={handleRetryConnection}
                    style={styles.connectionBannerButton}
                />
              </View>
          )}

          <MenuCard
              title="Создать лобби"
              description="Собрать игроков и начать партию"
              color={colors.primary}
              onPress={() => setModalOpen(true)}
          />

          <MenuCard
              title="Найти лобби"
              description="Присоединиться к открытой игре"
              color={colors.primary}
              onPress={() => navigation.navigate(ROUTES.LOBBY_SEARCH)}
          />

          <MenuCard
              title="⚙️ Настройки"
              description="Громкость звука"
              color={colors.muted}
              onPress={() => setSettingsOpen(true)}
          />

          {/* Заготовка под MVP-2 — оставлена намеренно, чтобы был виден план */}
          <View style={styles.soonBlock}>
            <Text style={styles.soonLabel} noGlobalTint>Скоро</Text>
            <MenuCard title="🛒 Магазин" description="Скины и бонусы" color={colors.muted} disabled />
          </View>

          <MenuCard title="🚪 Выйти" color={colors.muted} onPress={handleLogout} />
        </View>

        <CreateLobbyModal
            visible={modalOpen}
            busy={creating}
            onClose={() => setModalOpen(false)}
            onSubmit={handleCreate}
        />
        <GameSettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </Screen>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // alignItems:'center' + column.width — тот же паттерн, что уже у AuthScreen
  // (styles.content/styles.form) — по прямому запросу пользователя,
  // 2026-09-14: "кнопки главного меню и лобби центрировать и по ширине
  // сделать как окно авторизации в браузере".
  content: { padding: spacing.lg, alignItems: 'center' },
  column: { width: '80%', maxWidth: 300 },
  // Баннер "нет связи с сервером" — тот же приглушённый danger-тон, что и
  // у Button#variant="danger" (colors.danger), но как плашка, не кнопка:
  // полупрозрачный фон той же палитры, чтобы не спорить цветом с самой
  // кнопкой внутри.
  connectionBanner: {
    backgroundColor: `${colors.danger}26`,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  connectionBannerText: {
    color: colors.textOnDark,
    fontSize: font.small,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  connectionBannerButton: { alignSelf: 'stretch' },
  soonBlock: { marginTop: spacing.sm, opacity: 0.7 },
  soonLabel: {
    fontSize: font.tiny, color: colors.textOnDarkSecondary,
    textTransform: 'uppercase', marginBottom: spacing.sm, letterSpacing: 1,
  },
});