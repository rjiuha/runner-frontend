// src/screens/LobbySearchScreen.js
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import LoadingCard from '../components/ui/LoadingCard';
import { lobbyApi } from '../api/lobby';
import { ROUTES } from '../navigation/routes';
import { notify } from '../lib/notify';
import { colors, spacing, font, radius } from '../theme';

function LobbyRow({ lobby, onJoin, joining }) {
  const isFull = lobby.players.length >= lobby.maxPlayers;

  return (
      <TouchableOpacity
          style={[styles.row, isFull && styles.rowFull]}
          onPress={() => onJoin(lobby)}
          disabled={isFull || joining}
          activeOpacity={0.8}
      >
        <View style={styles.rowMain}>
          <Text style={styles.host} noGlobalTint>Хост: {lobby.host?.username ?? '—'}</Text>
          <Text style={styles.meta} noGlobalTint>Лобби #{lobby.id}</Text>
        </View>

        <View style={styles.counter}>
          <Text style={[styles.counterText, isFull && styles.counterFull]} noGlobalTint>
            {lobby.players.length}/{lobby.maxPlayers}
          </Text>
          <Text style={styles.counterLabel} noGlobalTint>{isFull ? 'полное' : 'игроков'}</Text>
        </View>
      </TouchableOpacity>
  );
}

export default function LobbySearchScreen({ navigation }) {
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState(null);
  // Счётчик запросов: useFocusEffect дёргает load() на каждый фокус, а его
  // ещё можно нажать вручную (Retry/pull-to-refresh) поверх уже летящего
  // запроса. Без этого более ранний, но позже завершившийся запрос перезаписывал
  // состояние свежего — списку то мерещилась ошибка, то пустота, хотя бэк
  // всё это время отдавал одно и то же (см. CLAUDE.md).
  const requestIdRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const requestId = ++requestIdRef.current;
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const { items } = await lobbyApi.search({ limit: 20 });
      if (requestId !== requestIdRef.current) return; // устарел — уже пошёл более новый запрос
      setLobbies(items);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e.userMessage ?? e.message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Обновляем при каждом входе: список лобби живёт своей жизнью,
  // за секунды может опустеть или заполниться
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleJoin = async (lobby) => {
    setJoiningId(lobby.id);
    try {
      const joined = await lobbyApi.join(lobby.id);
      navigation.navigate(ROUTES.LOBBY, { lobbyId: joined.id });
    } catch (e) {
      // Гонка: пока список рисовался, место заняли.
      // Не выкидываем с экрана — сообщаем и обновляем список.
      notify('Не удалось войти', e.userMessage ?? e.message);
      load();
    } finally {
      setJoiningId(null);
    }
  };

  // Ошибка на самой ПЕРВОЙ загрузке (сервер недоступен и т.п.) — раньше
  // подменяла список отдельным полноэкранным блоком ("Не удалось загрузить"
  // + большая кнопка), визуально выглядевшим как отдельный экран поверх уже
  // привычной панели спиннера. По прямому запросу пользователя — теперь
  // остаёмся на той же панели (спиннер+подсказка, LoadingCard), просто
  // добавляем в неё маленькую кнопку "Повторить". Ошибка при pull-to-refresh
  // поверх УЖЕ загруженного списка сюда не попадает (там есть данные, что
  // показать) — это не то, на что жаловался пользователь.
  if (loading || (error && lobbies.length === 0)) {
    return (
        <Screen contentContainerStyle={styles.center}>
          <LoadingCard label={error ? 'Не удалось загрузить' : undefined}>
            {!!error && (
                <>
                  <Text style={styles.errorText} noGlobalTint>{error}</Text>
                  <Button title="Повторить" variant="info" onPress={() => load()} style={styles.retryInline} />
                </>
            )}
          </LoadingCard>
        </Screen>
    );
  }

  return (
      <Screen>
        <FlatList
            data={lobbies}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
                <LobbyRow lobby={item} onJoin={handleJoin} joining={joiningId === item.id} />
            )}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.info} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle} noGlobalTint>Пока пусто</Text>
                <Text style={styles.emptyText} noGlobalTint>
                  Открытых лобби нет. Создай своё — и другие смогут присоединиться.
                </Text>
                <Button
                    title="Создать лобби"
                    variant="danger"
                    onPress={() => navigation.navigate(ROUTES.MAIN_MENU)}
                    style={styles.retry}
                />
              </View>
            }
        />
      </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, flexGrow: 1 },

  // colors.bgLight — тот же приём, что уже использует LobbyScreen для
  // карточек игроков (2026-09-13, приведение к единой тёмной палитре
  // Auth/GameBoard/LobbyScreen) — раньше тут был сплошной белый colors.card
  // с тенью, рассчитанный на светлый фон Screen#dark=false.
  row: {
    backgroundColor: colors.bgLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowFull: { opacity: 0.5 },
  rowMain: { flex: 1 },
  host: { fontSize: font.body, fontWeight: 'bold', color: colors.textOnDark },
  meta: { fontSize: font.tiny, color: colors.textOnDarkSecondary, marginTop: 2 },

  counter: { alignItems: 'center', minWidth: 60 },
  counterText: { fontSize: font.h3, fontWeight: 'bold', color: colors.info },
  counterFull: { color: colors.danger },
  counterLabel: { fontSize: 10, color: colors.textOnDarkSecondary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: font.h3, fontWeight: 'bold', color: colors.textOnDark, marginBottom: spacing.sm },
  emptyText: { fontSize: font.small, color: colors.textOnDarkSecondary, textAlign: 'center' },
  retry: { marginTop: spacing.lg, alignSelf: 'stretch' },

  // Ошибка первой загрузки внутри LoadingCard (см. рендер выше) — небольшая
  // кнопка, БЕЗ alignSelf:'stretch' (в отличие от styles.retry) — тот же
  // приём, что и retryBtn в GameBoardScreen.
  errorText: { fontSize: font.small, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  retryInline: { marginTop: spacing.sm },
});