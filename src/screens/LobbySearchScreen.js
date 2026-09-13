// src/screens/LobbySearchScreen.js
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
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
          // Полное лобби больше НЕ disabled целиком (2026-09-14, по прямому
          // запросу пользователя) — тап по нему теперь явно объясняет
          // причину диалогом. notify() теперь сам рендерит кастомный Modal
          // (см. lib/notify.js/AppModal.js), не системный Alert — отдельный
          // локальный Modal тут больше не нужен.
          onPress={() => (isFull ? notify('Лобби заполнено') : onJoin(lobby))}
          disabled={joining}
          activeOpacity={0.8}
      >
        <View style={styles.rowMain}>
          <Text style={styles.host} noGlobalTint>Лобби #{lobby.id}</Text>
          <Text style={styles.meta} noGlobalTint>Хост: {lobby.host?.username ?? '—'}</Text>
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
  // Фильтр по номеру лобби — чисто клиентский (список и так уже загружен
  // целиком, лимит 20 штук за раз, не нужен отдельный запрос к бэку).
  const [filterText, setFilterText] = useState('');
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

  const filteredLobbies = useMemo(() => {
    const q = filterText.trim();
    if (!q) return lobbies;
    return lobbies.filter((l) => String(l.id).includes(q));
  }, [lobbies, filterText]);

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

  // Заменяет убранную нативную шапку стека (headerShown:false в
  // RootNavigator, 2026-09-14, "по аналогии с лобби") — заголовок сверху,
  // ниже — панель результатов ФИКСИРОВАННОЙ высоты (styles.panel), кнопки
  // сразу под ней. Панель — ОДНА структура на все три состояния (загрузка/
  // ошибка первой загрузки/список) — 2026-09-14, по прямому запросу
  // пользователя: "кнопки не должны скакать по экрану при каждом поиске" —
  // раньше загрузка и список были двумя РАЗНЫМИ return'ами с полностью
  // разным layout, из-за чего высота контента (а с ней и позиция кнопок)
  // прыгала между состояниями. Скролл внутри панели — обычное поведение
  // FlatList/индикатора прокрутки: виден, только когда строк больше, чем
  // помещается в styles.panel.height, ничего специально включать не нужно.
  const title = <Text style={styles.screenTitle} noGlobalTint>Поиск лобби</Text>;

  // "Создать лобби" убрана (2026-09-14, по прямому запросу пользователя) —
  // на этом экране это дублировало главное меню, там уже есть своя кнопка.
  // "↻" — обычный текстовый глиф (U+21BB), не цветной emoji (у 🔄 всегда
  // синий кружок-подложка независимо от цвета кнопки) — красится в тот же
  // цвет, что и остальной текст кнопки. backgroundColor: colors.primary
  // (сплошной, БЕЗ альфы) — variant="primary" у Button даёт полупрозрачный
  // colors.primaryTranslucent, тут явно перекрываем сплошным цветом (тот же
  // solid-фиолетовый, что и у карточек MainMenuScreen, см. ниже).
  const actions = (
      <>
        <Button
            title="↻ Обновить" variant="primary" style={[styles.headerBtn, styles.solidPrimary]}
            loading={refreshing} onPress={() => load(true)}
        />
        <Button
            title="Назад" variant="danger" style={styles.headerBtn}
            onPress={() => navigation.goBack()}
        />
      </>
  );

  // Ошибка на самой ПЕРВОЙ загрузке (сервер недоступен и т.п.) — раньше
  // подменяла список отдельным полноэкранным блоком, теперь остаётся той же
  // панелью (спиннер+подсказка, LoadingCard) с маленькой кнопкой "Повторить".
  // Ошибка при pull-to-refresh поверх УЖЕ загруженного списка сюда не
  // попадает (там есть данные, что показать).
  const showLoadingState = loading || (error && lobbies.length === 0);

  return (
      <Screen>
        <View style={styles.column}>
          {title}

          <View style={styles.panel}>
            {showLoadingState ? (
                <View style={styles.panelCenter}>
                  <LoadingCard label={error ? 'Не удалось загрузить' : undefined}>
                    {!!error && (
                        <>
                          <Text style={styles.errorText} noGlobalTint>{error}</Text>
                          <Button title="Повторить" variant="info" onPress={() => load()} style={styles.retryInline} />
                        </>
                    )}
                  </LoadingCard>
                </View>
            ) : (
                <FlatList
                    data={filteredLobbies}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                        <LobbyRow lobby={item} onJoin={handleJoin} joining={joiningId === item.id} />
                    )}
                    style={styles.panelList}
                    contentContainerStyle={styles.list}
                    // На Android нативный индикатор скролла по умолчанию виден
                    // ТОЛЬКО во время самого жеста, потом гаснет — на вебе
                    // скроллбар постоянный, отсюда жалоба "не вижу ползунок".
                    // persistentScrollbar — Android-специфичный проп, держит
                    // индикатор всегда видимым; на iOS/вебе не действует
                    // (no-op), там уже было как надо.
                    persistentScrollbar
                    refreshControl={
                      <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.info} />
                    }
                    ListEmptyComponent={
                      <View style={styles.empty}>
                        <Text style={styles.emptyTitle} noGlobalTint>
                          {filterText.trim() ? 'Совпадений нет' : 'Пока пусто'}
                        </Text>
                        <Text style={styles.emptyText} noGlobalTint>
                          {filterText.trim()
                              ? `Лобби с номером «${filterText.trim()}» не найдено.`
                              : 'Открытых лобби нет. Создай своё — и другие смогут присоединиться.'}
                        </Text>
                      </View>
                    }
                />
            )}
          </View>

          <Input
              value={filterText}
              onChangeText={setFilterText}
              placeholder="Поиск по номеру лобби"
              keyboardType="numeric"
          />
          {actions}
        </View>
      </Screen>
  );
}

const styles = StyleSheet.create({
  // Тот же паттерн центрированной узкой колонки, что у AuthScreen/
  // MainMenuScreen/LobbyScreen (2026-09-14, "по аналогии с лобби").
  column: { width: '80%', maxWidth: 300, alignSelf: 'center' },
  screenTitle: {
    fontSize: font.h1, fontWeight: 'bold', color: colors.textOnDark,
    marginTop: spacing.md, marginBottom: spacing.lg, textAlign: 'center',
  },
  headerBtn: { marginBottom: spacing.sm },
  solidPrimary: { backgroundColor: colors.primary },
  // Панель результатов — ФИКСИРОВАННАЯ высота (2026-09-14, по прямому
  // запросу пользователя: кнопки под ней не должны прыгать при каждом
  // поиске/загрузке) — один и тот же контейнер и под спиннер загрузки, и
  // под список лобби; скролл внутри включается сам, когда строк больше, чем
  // помещается в height (обычное поведение FlatList — не нужно ничего
  // включать отдельно).
  // backgroundColor — тот же '#00000055' (чёрный, ~33% непрозрачности), что
  // уже использует PlayerInfoPanel.panel в игре (2026-09-14, "по аналогии"),
  // а не сплошной colors.bgLight — сквозь панель виден общий звёздный фон.
  panel: {
    height: 260,
    backgroundColor: '#00000055',
    borderRadius: radius.md,
    // БЕЗ overflow:'hidden' (2026-09-14, живая жалоба "не вижу ползунок
    // скролла на Android") — нативный индикатор скролла Android рисуется
    // оверлеем у самого края FlatList, и обрезка по скруглённому углу
    // родителя, судя по всему, срезала его целиком. Ряды внутри и так не
    // вылезают за пределы панели по ширине — цена чисто косметическая
    // (острый, а не скруглённый угол у самой первой/последней строки).
    marginBottom: spacing.md,
  },
  panelCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  panelList: { flex: 1 },
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
  counterText: { fontSize: font.h3, fontWeight: 'bold', color: colors.textOnDark },
  counterFull: { color: colors.danger },
  counterLabel: { fontSize: 10, color: colors.textOnDarkSecondary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: font.h3, fontWeight: 'bold', color: colors.textOnDark, marginBottom: spacing.sm },
  emptyText: { fontSize: font.small, color: colors.textOnDarkSecondary, textAlign: 'center' },

  // Ошибка первой загрузки внутри LoadingCard (см. рендер выше) — тот же
  // приём, что и retryBtn в GameBoardScreen.
  errorText: { fontSize: font.small, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  retryInline: { marginTop: spacing.sm },
});