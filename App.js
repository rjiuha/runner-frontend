// App.js
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { fontFamily as CUSTOM_FONT_FAMILY, colors } from './src/theme';

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
 * `color: colors.neonCyan` (2026-09-13, по прямому запросу — "буквально весь
 * текст в приложении", подтверждено после явного предупреждения о риске
 * нечитаемости на светлых экранах типа MainMenu/LobbySearch) — в отличие от
 * `fontFamily` (которую ничего в проекте раньше не задавало, поэтому её
 * достаточно было подставить ПЕРВОЙ в массиве style — "мягкий" дефолт), цвет
 * почти ВЕЗДЕ уже задан явно через `theme.colors` в собственных стилях
 * экранов — чтобы реально перекрасить "буквально весь текст", а не только
 * те немногие места без своего цвета, наш объект стоит ПОСЛЕДНИМ в массиве
 * (`config.style` первым) — так наш `color` побеждает ЛЮБОЙ явно заданный
 * компонентом. Цвет снят напрямую с пикселей неоновых полосок бегуна
 * (`theme.colors.neonCyan`, см. её докстринг) — не выдуман.
 *
 * **Проп `noGlobalTint` (2026-09-13, живая жалоба — "cyan не виден на
 * некоторых цветах кнопок")**: циан читается отлично на тёмном фоне игры, но
 * сливается/теряет контраст на НАСЫЩЕННЫХ цветных фонах кнопок/карточек меню
 * (`Button`/`MenuCard` — там текст лежит поверх `colors.info`/`colors.danger`
 * и т.п., не поверх `colors.bg`). Эти компоненты уже осознанно подбирают
 * контрастный цвет текста сами (`v.fg` в Button.js, `colors.textOnDark` в
 * MenuCard.js) — форсить cyan поверх их выбора и есть причина жалобы. Компонент
 * помечает СВОЙ `<Text>` пропом `noGlobalTint` — патч это видит и НЕ
 * подставляет color (fontFamily всё равно применяется, он не конфликтует ни с
 * чем). Проп вырезается из `config` перед передачей дальше — реальный `<Text>`
 * его не видит и не ругается на неизвестный проп.
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
 * ПОСЛЕДНИЙ в style-массиве в ОБОИХ ветках, noGlobalTint тоже, иначе именно
 * там `Button`'s `fontWeight:'bold'` продолжил бы ломать шрифт даже после
 * того как noGlobalTint уже чинит цвет). Подтверждено на реальном Android
 * (adb) — обычный Fast Refresh это НЕ подхватывает, нужен полный холодный
 * перезапуск приложения (force-stop + релонч).
 *
 * **`TextInput` — цвет НИКОГДА не форсим, только fontFamily/fontWeight**
 * (2026-09-13, живая жалоба — "при вводе текста в поля логина/пароля и
 * других цвет меняется на cyan"). В отличие от `Text` (статичный UI-текст,
 * где циан — осознанный редизайн), `TextInput` — это то, что НАБИРАЕТ сам
 * пользователь (email, пароль, поиск и т.п.) — свой цвет там уже задан
 * осознанно (`Input.js` — `colors.textOnDark`) и перекраска ВВОДИМОГО текста
 * в акцентный цвет никем не запрашивалась, только всплыла как побочный
 * эффект правила "весь текст". `TextInput` в проекте используется РОВНО в
 * одном месте (`components/ui/Input.js`, проверено grep'ом) — безопасно
 * исключить его из форсинга цвета целиком, без пропа-переключателя на
 * каждом отдельном месте использования.
 */
function patchJsxForFont(mod) {
    if (!mod) return;
    ['jsx', 'jsxs', 'jsxDEV'].forEach((fnName) => {
        const original = mod[fnName];
        if (typeof original !== 'function') return;
        mod[fnName] = function patchedJsx(type, config, ...rest) {
            if ((type === Text || type === TextInput) && config) {
                const { noGlobalTint, ...rest2 } = config;
                const skipColor = noGlobalTint || type === TextInput;
                config = {
                    ...rest2,
                    style: [
                        rest2.style,
                        skipColor
                            ? { fontFamily: CUSTOM_FONT_FAMILY, fontWeight: 'normal' }
                            : { fontFamily: CUSTOM_FONT_FAMILY, fontWeight: 'normal', color: colors.neonCyan },
                    ],
                };
            }
            return original.call(this, type, config, ...rest);
        };
    });
}
patchJsxForFont(require('react/jsx-runtime'));
patchJsxForFont(require('react/jsx-dev-runtime'));

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = [Text.defaultProps.style, { fontFamily: CUSTOM_FONT_FAMILY, fontWeight: 'normal', color: colors.neonCyan }];
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
 * Шрифт грузится ДО рендера остального приложения (тот же приём, что и у
 * RootNavigator#isLoading — сплэш вместо мигания системным шрифтом на первом
 * кадре, до того как SpaceRanger встанет в defaultProps выше).
 */
export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceRanger: require('./src/assets/fonts/spaceranger-rus.otf'),
  });

  if (!fontsLoaded) {
    return (
        <View style={styles.splash}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
  }

  return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <NavigationContainer
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
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
