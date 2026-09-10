// src/screens/MainMenuScreen.js
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/ui/Screen';
import MenuCard from '../components/menu/MenuCard';
import ProfileCard from '../components/menu/ProfileCard';
import CreateLobbyModal from '../components/menu/CreateLobbyModal';
import { useAuth } from '../hooks/useAuth';
import { lobbyApi } from '../api/lobby';
import { meApi } from '../api/me';
import { ROUTES } from '../navigation/routes';
import { notify, confirm } from '../lib/notify';
import { GAME_STATUS } from '../constants/GameConstants';
import { colors, spacing, font } from '../theme';

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

  /**
   * useFocusEffect, а не useEffect: проверять активное лобби/партию нужно
   * при КАЖДОМ возврате на экран (например, вышел из лобби вручную — а
   * бэк по-прежнему считает его активным, значит сразу вернуть обратно), а
   * не только при первом монтировании. Один вызов GET /api/me (см.
   * AuthController::me() на бэке, read-only) вместо прежних ДВУХ отдельных
   * (runnerGameApi.get()+lobbyApi.mine()) — по прямому запросу пользователя,
   * "после авторизации фронт вызывал api/me". Игра приоритетнее лобби: если
   * у пользователя есть активная партия (например, после reload/relaunch
   * посреди игры), сразу уводим туда. Лобби теперь ТОЖЕ безусловный редирект
   * (не баннер с ручным тапом, как было раньше) — по прямому требованию
   * "если есть лобби - то в лобби", той же формулировкой, что и для игры.
   * `me.lobby`/`me.game` — слим-объекты {id,status} (НЕ полный toArray()) —
   * этого достаточно, чтобы решить, КУДА направить, полные данные подтянет
   * сам целевой экран (LobbyScreen/GameBoardScreen) через свой обычный
   * live-коннект.
   */
  useFocusEffect(
      useCallback(() => {
        let cancelled = false;

        (async () => {
          try {
            const me = await meApi.get();
            if (cancelled) return;

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
          } catch {
            // Сбой самого /api/me (сеть и т.п.) — не блокируем меню, просто
            // не редиректим никуда, пользователь может попробовать вручную.
          } finally {
            if (!cancelled && !bootCheckedRef.current) {
              bootCheckedRef.current = true;
              setCheckingSession(false);
            }
          }
        })();

        return () => { cancelled = true; };
      }, [navigation]),
  );

  const handleCreate = async (maxPlayers) => {
    setCreating(true);
    try {
      const lobby = await lobbyApi.create(maxPlayers);
      setModalOpen(false);
      navigation.navigate(ROUTES.LOBBY, { lobbyId: lobby.id });
    } catch (e) {
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
        <View style={styles.splash}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
  }

  return (
      <Screen dark={false} scroll contentContainerStyle={styles.content}>
        <ProfileCard username={user?.username} />

        <MenuCard
            title="🏁 Создать лобби"
            description="Собрать игроков и начать партию"
            color={colors.danger}
            onPress={() => setModalOpen(true)}
        />

        <MenuCard
            title="🔍 Найти лобби"
            description="Присоединиться к открытой игре"
            color={colors.info}
            onPress={() => navigation.navigate(ROUTES.LOBBY_SEARCH)}
        />

        {/* Заготовки под MVP-2 — оставлены намеренно, чтобы был виден план */}
        <View style={styles.soonBlock}>
          <Text style={styles.soonLabel}>Скоро</Text>
          <MenuCard title="🛒 Магазин" description="Скины и бонусы" color={colors.muted} disabled />
          <MenuCard title="⚙️ Настройки" description="Профиль и звук" color={colors.muted} disabled />
        </View>

        <MenuCard title="🚪 Выйти" color={colors.muted} onPress={handleLogout} />

        <CreateLobbyModal
            visible={modalOpen}
            busy={creating}
            onClose={() => setModalOpen(false)}
            onSubmit={handleCreate}
        />
      </Screen>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  soonBlock: { marginTop: spacing.sm, opacity: 0.7 },
  soonLabel: {
    fontSize: font.tiny, color: colors.textSecondary,
    textTransform: 'uppercase', marginBottom: spacing.sm, letterSpacing: 1,
  },
});