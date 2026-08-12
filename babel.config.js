// babel.config.js
//
// Раньше этого файла не было в проекте вообще (ни babel.config.js, ни
// .babelrc, ни "babel" в package.json — проверено find'ом по всему репо).
// Без него Metro транспилирует код своим дефолтным пресетом, а не
// babel-preset-expo — а именно babel-preset-expo при обнаружении
// react-native-reanimated/react-native-worklets в зависимостях сам
// подставляет плагин 'react-native-worklets/plugin' (см.
// node_modules/babel-preset-expo/build/configs/expo.js). Без этого плагина
// ворклеты (useSharedValue/useAnimatedStyle/withTiming/runOnJS/'worklet' в
// ParallaxBackground, Gesture.Pan().onUpdate в DiceDie) не компилируются
// правильно — вероятная причина того, что parallax-анимация фона молча не
// запускалась. После добавления этого файла нужен рестарт Metro с очисткой
// кэша (`expo start -c`), иначе возьмётся старый закэшированный бандл.
module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
    };
};
