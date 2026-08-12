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
import { runnerGameApi } from '../api/runnerGame';
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

  const [activeLobby, setActiveLobby] = useState(null);
  const [creating, setCreating] = useState(false);
  // true только до первого резолва проверки активной игры — дальше не блокируем
  // повторные фокусы экрана (как и лобби-баннер ниже, который не блокирует рендер).
  const [checkingSession, setCheckingSession] = useState(true);
  const bootCheckedRef = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);

  /**
   * useFocusEffect, а не useEffect: проверять активное лобби/партию нужно
   * при КАЖДОМ возврате на экран (вышел из лобби → баннер должен исчезнуть),
   * а не только при первом монтировании. Игра приоритетнее лобби: если у
   * пользователя есть активная партия (например, после reload/relaunch
   * посреди игры), сразу уводим туда, а не показываем меню с баннером.
   */
  useFocusEffect(
      useCallback(() => {
        let cancelled = false;

        (async () => {
          try {
            const game = await runnerGameApi.get();
            if (!cancelled && game && RESUMABLE_GAME_STATUSES.includes(game.status)) {
              navigation.reset({
                index: 0,
                routes: [{ name: ROUTES.RUNNER_GAME, params: { gameId: game.id } }],
              });
              return;
            }
          } catch {
            // «нет активной игры» бек отдаёт ошибкой — для нас это норма, идём смотреть лобби
          }

          try {
            const lobby = await lobbyApi.mine();
            if (!cancelled) setActiveLobby(lobby);
          } catch {
            // «нет лобби» бек отдаёт ошибкой — тоже норма, а не сбой
            if (!cancelled) setActiveLobby(null);
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

        {/* Возврат в лобби, если игрок из него выпал */}
        {activeLobby && (
            <MenuCard
                title="🔄 Вернуться в лобби"
                description={`Игроков: ${activeLobby.players.length}/${activeLobby.maxPlayers}`}
                color={colors.success}
                onPress={() => navigation.navigate(ROUTES.LOBBY, { lobbyId: activeLobby.id })}
            />
        )}

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