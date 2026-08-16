// src/components/ui/ParallaxBackground.js
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';

const IMG_SCALE = 1.5;

/**
 * Плавающий фон-картинка (парящий параллакс, случайные withTiming-переезды
 * по кругу). `useWindowDimensions()` — общий для веба и native, реактивно
 * пересчитывает границы при ресайзе/повороте на обеих платформах, отдельного
 * разделения по платформам не потребовалось.
 *
 * Следующий цикл анимации запускается ЧИСТЫМ JS `setTimeout` — раньше был
 * колбэк завершения `withTiming` внутри ворклета (`(finished) => {
 * 'worklet'; runOnJS(animateToRandom)(); }`). Найдено живым прогоном на
 * Android-эмуляторе методом бисекции (см. CLAUDE.md): с колбэк-вариантом
 * `Animated.Image` под непрерывно (рекурсивно) анимируемым transform-ом
 * визуально пропадает целиком на Android — сама анимация при этом честно
 * крутится (подтверждено логами), просто картинка не рисуется.
 * `zIndex`, реактивность размеров, `Animated.Image` напрямую vs `Image` в
 * обёртке `Animated.View` — НЕ влияют (проверено по отдельности); также НЕ
 * стоит завязывать `useEffect` монтирования на `[screenW, screenH]`, чтобы
 * ловить ресайз, — это тоже ломает Android тем же образом (переисполнение
 * эффекта с повторным стартом анимации). Единственная переменная, реально
 * влияющая на результат, — способ планирования следующего цикла.
 *
 * `setTimeout`-колбэк уже выполняется на JS-потоке — `runOnJS(...)` тут не
 * нужен (он для обратного перехода UI-поток→JS-поток ИЗ ворклета). С ним
 * первый цикл анимации проигрывался нормально, а рекурсивный вызов молча
 * не срабатывал повторно — картинка проявлялась, но застывала после
 * первого цикла (тоже поймано живым прогоном).
 */
export default function ParallaxBackground() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const imgW = screenW * IMG_SCALE;
  const imgH = screenH * IMG_SCALE;
  const maxX = (imgW - screenW) / 2;
  const maxY = (imgH - screenH) / 2;

  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const isMounted = useRef(true);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
    ],
  }));

  const randomTarget = () => {
    const x = Math.random() * maxX * 2 - maxX;
    const y = Math.random() * maxY * 2 - maxY;
    return { x, y };
  };

  const animateToRandom = () => {
    if (!isMounted.current) return;

    const { x, y } = randomTarget();

    offsetX.value = withTiming(x, {
      duration: 4000,
      easing: Easing.bezier(0.61, 0.02, 0.31, 0.93),
      reduceMotion: ReduceMotion.System,
    });
    offsetY.value = withTiming(y, {
      duration: 4000,
      easing: Easing.bezier(0.61, 0.02, 0.31, 0.93),
      reduceMotion: ReduceMotion.System,
    });

    setTimeout(() => {
      if (isMounted.current) {
        animateToRandom();
      }
    }, 4100);
  };

  useEffect(() => {
    animateToRandom();

    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <View style={styles.container}>
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
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute',
  },
});
