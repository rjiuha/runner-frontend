// src/components/ui/ParallaxBackground.js
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const IMG_SCALE = 1.5;
const DURATION = 4000;

export default function ParallaxBackground() {
  // Реагирует на поворот экрана и на ресайз окна в браузере
  const { width: screenW, height: screenH } = useWindowDimensions();

  const imgW = screenW * IMG_SCALE;
  const imgH = screenH * IMG_SCALE;
  const maxX = (imgW - screenW) / 2;
  const maxY = (imgH - screenH) / 2;

  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const aliveRef = useRef(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }));

  const animateToRandom = useCallback(() => {
    if (!aliveRef.current) return;

    const x = Math.random() * maxX * 2 - maxX;
    const y = Math.random() * maxY * 2 - maxY;
    const config = {
      duration: DURATION,
      easing: Easing.bezier(0.61, 0.02, 0.31, 0.93),
      reduceMotion: ReduceMotion.System,
    };

    // Колбэк withTiming выполняется на UI-потоке ровно по завершении анимации.
    // Именно здесь runOnJS уместен — он прыгает из ворклета обратно в JS.
    // Никаких setTimeout: рассинхрона по времени не будет.
    offsetX.value = withTiming(x, config, (finished) => {
      'worklet';
      if (finished) runOnJS(animateToRandom)();
    });
    offsetY.value = withTiming(y, config);
  }, [maxX, maxY, offsetX, offsetY]);

  useEffect(() => {
    // true ставим ЗДЕСЬ, а не в useRef: при повторном монтировании
    // (Fast Refresh, StrictMode) ref сохраняет старое значение false
    aliveRef.current = true;
    animateToRandom();

    return () => {
      aliveRef.current = false;
    };
  }, [animateToRandom]);

  return (
      <View style={styles.container} pointerEvents="none">
        <Animated.Image
            source={require('../../assets/images/auth_background_landscape.jpg')}
            style={[
              styles.bg,
              { width: imgW, height: imgH, top: -(imgH - screenH) / 2, left: -(imgW - screenW) / 2 },
              animatedStyle,
            ]}
            resizeMode="cover"
        />
      </View>
  );
}

const styles = StyleSheet.create({
  // Раньше здесь был zIndex: -1 — на Android отрицательный zIndex может
  // привести к тому, что вью вообще не рисуется (особенно рядом со сложными
  // соседями, как на GameBoardScreen), и фон пропадал только на мобильных.
  // Тот же эффект "фон позади всего" даёт порядок рендера: компонент и так
  // всегда вставляется первым ребёнком, а более поздние соседи по умолчанию
  // рисуются поверх — zIndex тут не нужен вовсе.
  container: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bg: { position: 'absolute' },
});