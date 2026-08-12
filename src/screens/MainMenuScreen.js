// src/screens/MainMenuScreen.js
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/ui/Screen';
import MenuCard from '../components/menu/MenuCard';
import ProfileCard from '../components/menu/ProfileCard';
import CreateLobbyModal from '../components/menu/CreateLobbyModal';
import { useAuth } from '../hooks/useAuth';
import { lobbyApi } from '../api/lobby';
import { ROUTES } from '../navigation/routes';
import { notify, confirm } from '../lib/notify';
import { colors, spacing, font } from '../theme';

export default function MainMenuScreen({ navigation }) {
  const { user, signOut } = useAuth();

  const [activeLobby, setActiveLobby] = useState(null);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  /**
   * useFocusEffect, а не useEffect: проверять активное лобби нужно
   * при КАЖДОМ возврате на экран (вышел из лобби → баннер должен исчезнуть),
   * а не только при первом монтировании.
   */
  useFocusEffect(
      useCallback(() => {
        let cancelled = false;

        lobbyApi
            .mine()
            .then((lobby) => { if (!cancelled) setActiveLobby(lobby); })
            // «нет лобби» бек отдаёт ошибкой — для нас это норма, а не сбой
            .catch(() => { if (!cancelled) setActiveLobby(null); });

        return () => { cancelled = true; };
      }, []),
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

        {/*
          ВРЕМЕННО: GameBoardScreen пока рисует мок (constants/mockGameData.js)
          независимо от параметров навигации, а настоящий путь туда — только
          через лобби (нужно 2+ игрока, оба готовы, бэк создаёт партию).
          Прямая кнопка — чтобы смотреть вёрстку доски без этого ритуала.
          Убрать, когда экран подключится к реальному /api/runner_game.
        */}
        <View style={styles.soonBlock}>
          <Text style={styles.soonLabel}>Для разработки</Text>
          <MenuCard
              title="🧪 Тест игровой доски"
              description="Открыть GameBoardScreen на моковых данных, без лобби"
              color={colors.muted}
              onPress={() => navigation.navigate(ROUTES.RUNNER_GAME)}
          />
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
  content: { padding: spacing.lg },
  soonBlock: { marginTop: spacing.sm, opacity: 0.7 },
  soonLabel: {
    fontSize: font.tiny, color: colors.textSecondary,
    textTransform: 'uppercase', marginBottom: spacing.sm, letterSpacing: 1,
  },
});