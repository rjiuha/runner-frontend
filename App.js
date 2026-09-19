// App.js
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';

import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import ParallaxBackground from './src/components/ui/ParallaxBackground';
import AppModal from './src/components/ui/AppModal';
import { useMenuMusic } from './src/hooks/useMenuMusic';
import { fontFamily as CUSTOM_FONT_FAMILY, colors } from './src/theme';

/**
 * Тема навигатора — только чтобы обнулить `colors.background` у
 * @react-navigation/native-stack. На native та автоматически подмешивает
 * ЭТОТ цвет как `contentStyle` КАЖДОМУ экрану стека (см. `NativeStackView
 * .native.tsx` — `backgroundColor: colors.background` из useTheme(),
 * дефолт без явной темы — светло-серый из DefaultTheme), рисуя его ПОД
 * содержимым экрана, но НАД общим фоном — без этой правки общий
 * ParallaxBackground (см. ниже) был бы не виден вообще ни на одном
 * реальном экране на Android/iOS (на вебе этого слоя нет, там
 * contentContainer и так прозрачен). Остальные поля темы (`dark`/шрифты/
 * прочие цвета) не используются нигде в приложении — берём `DarkTheme`
 * просто как основу, чтобы не собирать объект с нуля.
 */
const TRANSPARENT_NAV_THEME = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: 'transparent' },
};

/**
 * Кастомный шрифт (spaceranger-rus.otf, 2026-09-13, по прямому запросу
 * пользователя — "шрифт в игре как assets/fonts") — применяется ГЛОБАЛЬНО,
 * не точечно по экранам: приложение почти везде использует голый `Text`/
 * `TextInput` из react-native (не общий UI-компонент), а заводить свою
 * обёртку и менять импорт на каждом из десятков экранов — избыточно много
 * правок ради одной константы. Ключ 'SpaceRanger' в useFonts должен
 * СОВПАДАТЬ с theme#fontFamily.
 *
 * `Text.defaultProps`/`TextInput.defaultProps` тут НЕ РАБОТАЮТ — в этой
 * версии RN (0.85) оба компонента функциональные, а не классовые
 * (проверено чтением исходника `node_modules/react-native/Libraries/Text/
 * Text.js`), а React 18+ игнорирует `defaultProps` у функциональных
 * компонентов. Проект к тому же использует АВТОМАТИЧЕСКИЙ JSX-рантайм
 * (`babel-preset-expo` компилирует `<Text>` в `_jsxRuntime.jsx(Text, {...})`,
 * не в `React.createElement` — проверено прогоном через `@babel/core`), так
 * что патчить `React.createElement` тоже бессмысленно — эти вызовы через
 * него не идут. Патчим САМИ функции `jsx`/`jsxs`/`jsxDEV` в модулях
 * `react/jsx-runtime`/`react/jsx-dev-runtime` (обычный CommonJS-экспорт,
 * мутируемый объект) — единственная точка, через которую реально проходит
 * КАЖДЫЙ `<Text>`/`<TextInput>` в приложении, независимо от dev/prod сборки.
 * `Text.defaultProps` оставлен ниже как дешёвая подстраховка на случай
 * стороннего кода, который зовёт `React.createElement(Text, ...)` напрямую,
 * в обход JSX — вреда от него нет, даже если он не сработает.
 *
 * **Глобальный форсинг `color: colors.neonCyan` УБРАН (2026-09-14, по
 * прямому запросу пользователя)** — раньше цвет форсился на КАЖДЫЙ `<Text>`
 * во всём приложении (введено 2026-09-13), а обратный опт-аут через
 * `noGlobalTint` пришлось расставлять по ~20 файлам, где циан не подходил
 * (кнопки/карточки/подсказки/пульсирующие заголовки и т.д.) — то есть циан
 * был дефолтом, а "нормальный" цвет — исключением. Пользователь развернул
 * это: циан должен быть ТОЛЬКО в паре мест (сейчас — заголовок "Star Runners"
 * на AuthScreen, см. его собственный стиль), остальной текст — свой обычный
 * цвет, который и так уже был задан явно в стилях экранов до 2026-09-13 (тот
 * форсинг просто больше не перекрывает его). `noGlobalTint`-проп остался
 * проставлен в тех же ~20 местах (вреда как дохлый проп не несёт — патч
 * по-прежнему вырезает его из `config`, чтобы не утёк в реальный `<Text>`),
 * заново вычищать по всем файлам не стал — переживший смысл использования
 * не нанёс ущерба, просто больше ничего не переключает.
 *
 * **`fontWeight: 'normal'` — ОБЯЗАТЕЛЬНО форсим вместе с fontFamily
 * (2026-09-13, живая жалоба + скриншот с реального Android: заголовок
 * "Star Runners", активная вкладка "Вход" и кнопка "Войти" рисовались
 * ОБЫЧНЫМ системным шрифтом, хотя подзаголовок/неактивная вкладка/поля
 * ввода — уже кастомным).** Сверил построчно: ВСЕ три "сломанных" места
 * (AuthScreen#title/activeLabel, Button#label) — единственные, у кого в
 * СОБСТВЕННОМ стиле стоит `fontWeight: 'bold'`; всё остальное — без
 * fontWeight вообще. Причина — известная особенность именно Android (не
 * iOS/веб): у нас зарегистрирован ОДИН файл шрифта (spaceranger-rus.otf)
 * под одним именем, БЕЗ отдельного жирного начертания. Когда `fontFamily`
 * указывает на кастомный шрифт, а `fontWeight` просит 'bold' — Android
 * ищет жирный ВАРИАНТ ИМЕННО ЭТОГО семейства, не находит и молча
 * ОТКАТЫВАЕТСЯ на системный шрифт целиком (не просто рисует некастомный
 * bold — теряет fontFamily полностью). На вебе/iOS это либо синтезируется
 * (fake bold), либо игнорируется, поэтому там бага не было видно вообще.
 * Раз другого начертания шрифта нет и не будет, форсим 'normal' ВСЕГДА,
 * СИЛЬНЕЕ любого fontWeight, который выставил сам компонент (наш объект —
 * ПОСЛЕДНИЙ в style-массиве). Подтверждено на реальном Android (adb) —
 * обычный Fast Refresh это НЕ подхватывает, нужен полный холодный
 * перезапуск приложения (force-stop + релонч).
 *
 * **Проп `noGlobalFont` (2026-09-13, по прямому запросу — "в полях для
 * ввода на экранах логина и регистрации сам вводимый текст пусть будет
 * обычным")** — полностью выключает форсинг для конкретного
 * `<TextInput>`: ни `fontFamily`, ни `fontWeight` не добавляются вообще,
 * стиль компонента идёт как есть (значит текст рисуется системным шрифтом
 * ОС). `TextInput` в проекте используется РОВНО в одном месте
 * (`components/ui/Input.js`, использует ТОЛЬКО AuthScreen) — проставлен
 * там, остальной форсинг шрифта (`Text`, дефолт `TextInput` через
 * `defaultProps` ниже — фолбэк на случай `React.createElement` в обход
 * JSX) не трогаем.
 *
 * `noGlobalTint` вырезается из `config` по-прежнему (см. деструктуризацию
 * ниже) — сам он больше НИЧЕГО не переключает (цвет нигде не форсится, см.
 * выше), но проп по-прежнему проставлен в ~20 файлах с прошлого захода и
 * должен не утекать в реальный `<Text>` (на вебе react-native-web иначе
 * попытался бы прокинуть неизвестный атрибут в DOM).
 */
function patchJsxForFont(mod) {
    if (!mod) return;
    ['jsx', 'jsxs', 'jsxDEV'].forEach((fnName) => {
        const original = mod[fnName];
        if (typeof original !== 'function') return;
        mod[fnName] = function patchedJsx(type, config, ...rest) {
            if ((type === Text || type === TextInput) && config) {
                const { noGlobalTint, noGlobalFont, ...rest2 } = config;
                config = noGlobalFont
                    ? rest2
                    : { ...rest2, style: [rest2.style, { fontFamily: CUSTOM_FONT_FAMILY, fontWeight: 'normal' }] };
            }
            return original.call(this, type, config, ...rest);
        };
    });
}
patchJsxForFont(require('react/jsx-runtime'));
patchJsxForFont(require('react/jsx-dev-runtime'));

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = [Text.defaultProps.style, { fontFamily: CUSTOM_FONT_FAMILY, fontWeight: 'normal' }];
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = [TextInput.defaultProps.style, { fontFamily: CUSTOM_FONT_FAMILY, fontWeight: 'normal' }];

/**
 * Точка входа. Здесь только провайдеры — вся логика в RootNavigator.
 * Порядок важен: AuthProvider должен быть ВЫШЕ навигатора,
 * потому что навигатор решает, какие экраны показывать, по состоянию авторизации.
 *
 * GestureHandlerRootView — снаружи всего: без него Pan-жесты (перетаскивание
 * кубиков на игровой доске) молча не работают на Android, а иногда и на вебе.
 *
 * **`ParallaxBackground` — ОДИН экземпляр на всё приложение (2026-09-14, по
 * прямому запросу пользователя — "анимация фона не должна зависеть от
 * перехода между экранами").** Раньше каждый экран (через `Screen.js`) и
 * отдельно `GameBoardScreen` монтировали СВОЙ instance — при любой навигации
 * между экранами старый размонтировался, новый стартовал анимацию с нуля
 * (offsetX/offsetY обнулялись, случайная цель выбиралась заново). Теперь
 * компонент рендерится здесь, ВЫШЕ `NavigationContainer`, и живёт весь
 * жизненный цикл приложения — экраны просто должны быть прозрачными, чтобы
 * его было видно (см. `Screen.js`/`GameBoardScreen.js` — там фон убран,
 * `TRANSPARENT_NAV_THEME` выше гасит автоматический непрозрачный
 * `contentStyle` у native-stack). `styles.root.backgroundColor` — фоллбэк
 * НА СЛУЧАЙ, если сама картинка почему-то не отрисуется (тот же приём,
 * что раньше был точечно на `GameBoardScreen.wrapper`, теперь общий для
 * всего приложения, а не только одного экрана).
 *
 * Рендерится ДАЖЕ на сплэше загрузки шрифта (`!fontsLoaded`) — картинка
 * фона не зависит от кастомного шрифта, а анимация должна идти буквально
 * с первого кадра, а не после.
 *
 * `AppModal` — тем же приёмом, единственный хост для notify()/confirm()
 * (см. lib/notify.js, 2026-09-14, "не хочу стандартные диалоги в общем") —
 * заменяет платформенный Alert.alert/window.alert/window.confirm везде в
 * приложении одним кастомным Modal. Смонтирован БЕЗУСЛОВНО (даже во время
 * сплэша загрузки шрифта) — registerModalHandler должен успеть отработать
 * раньше первого возможного вызова notify()/confirm() откуда угодно.
 */
export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceRanger: require('./src/assets/fonts/spaceranger-rus.otf'),
  });

  // Имя текущего роута — для музыки меню/лобби (hooks/useMenuMusic.js).
  // NavigationContainer.onStateChange НЕ срабатывает на первом монтировании
  // (см. BaseNavigationContainer.tsx — isFirstMountRef), поэтому текущий
  // роут дополнительно ловится через onReady (тот же navigationRef,
  // getCurrentRoute() — официальный паттерн react-navigation для трекинга
  // экранов). useMenuMusic вызван здесь, выше NavigationContainer — тот же
  // приём, что и у ParallaxBackground выше: живёт весь жизненный цикл
  // приложения, не перемонтируется при навигации.
  const navigationRef = useNavigationContainerRef();
  const [routeName, setRouteName] = useState(null);
  const syncRouteName = useCallback(() => {
    setRouteName(navigationRef.isReady() ? (navigationRef.getCurrentRoute()?.name ?? null) : null);
  }, [navigationRef]);
  useMenuMusic(routeName);

  return (
      <View style={styles.root}>
        <ParallaxBackground />
        <AppModal />

        {!fontsLoaded ? (
            <View style={styles.splash}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
        ) : (
            <GestureHandlerRootView style={{ flex: 1 }}>
              <SafeAreaProvider>
                <AuthProvider>
                  <NavigationContainer
                      ref={navigationRef}
                      onReady={syncRouteName}
                      onStateChange={syncRouteName}
                      theme={TRANSPARENT_NAV_THEME}
                      // На вебе @react-navigation/native сам управляет
                      // document.title (useDocumentTitle, включён по умолчанию) —
                      // без явного documentTitle он берёт options.title экрана,
                      // а если тот не задан — имя РОУТА ("Auth", "MainMenu" и
                      // т.п., см. navigation/routes.js), поэтому вкладка браузера
                      // показывала служебное имя экрана вместо названия игры
                      // (2026-09-13, по прямому запросу пользователя). Фиксируем
                      // на одно и то же значение для любого экрана — это НЕ
                      // трогает options.title отдельных экранов (тот по-прежнему
                      // рисует текст в шапке нативного стека, см. LobbyScreen/
                      // LobbySearchScreen).
                      documentTitle={{ formatter: () => 'Star Runners' }}
                  >
                    <StatusBar style="light" />
                    <RootNavigator />
                  </NavigationContainer>
                </AuthProvider>
              </SafeAreaProvider>
            </GestureHandlerRootView>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  // Фоллбэк-цвет на случай, если ParallaxBackground почему-то не отрисуется
  // (единственное место в приложении, где он теперь нужен — раньше был
  // продублирован по экранам, см. докстринг App() выше).
  root: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
