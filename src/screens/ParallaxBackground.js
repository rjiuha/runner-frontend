import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  withRepeat, ReduceMotion
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const IMG_SCALE = 1.5;
const IMG_W = SCREEN_W * IMG_SCALE;
const IMG_H = SCREEN_H * IMG_SCALE;

const MAX_OFFSET_X = (IMG_W - SCREEN_W) / 2;
const MAX_OFFSET_Y = (IMG_H - SCREEN_H) / 2;

export default function ParallaxBackground() {
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
    const x = Math.random() * MAX_OFFSET_X * 2 - MAX_OFFSET_X;
    const y = Math.random() * MAX_OFFSET_Y * 2 - MAX_OFFSET_Y;
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

    // После завершения обеих анимаций запускаем следующую
    // Используем setTimeout с задержкой чуть больше длительности анимации
    setTimeout(() => {
      if (isMounted.current) {
        runOnJS(animateToRandom)();
      }
    }, 4100); // должен совпадать с duration
  };

  useEffect(() => {
    animateToRandom(); // стартуем

    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../assets/images/auth_background_landscape.png')}
        style={[styles.bg, animatedStyle]}
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
    zIndex: -1,
    overflow: 'hidden',
  },
  bg: {
    width: IMG_W,
    height: IMG_H,
    position: 'absolute',
    top: -(IMG_H - SCREEN_H) / 2,
    left: -(IMG_W - SCREEN_W) / 2,
  },
});
