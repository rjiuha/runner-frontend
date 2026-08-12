import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Animated, useWindowDimensions, Text, Platform, PanResponder, Easing } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';

function useScrollAnimation(minOffset, options = {}) {
  const { scrollSpeed = 20 } = options;
  const xOffset = useRef(new Animated.Value(0)).current;
  const isScrollingRef = useRef(0);
  const rafIdRef = useRef(null);

  const maxOffset = 0;

  const animateStep = useCallback(() => {
    if (!isScrollingRef.current) return;

    let currentValue = xOffset._value !== undefined ? xOffset._value : 0;
    let nextValue = currentValue + (isScrollingRef.current * scrollSpeed);

    const isAtRightBoundary = isScrollingRef.current > 0 && currentValue >= maxOffset - 1;
    const isAtLeftBoundary = isScrollingRef.current < 0 && currentValue <= minOffset + 1;

    if (isAtRightBoundary || isAtLeftBoundary) {
      stopScroll();

      Animated.sequence([
        Animated.timing(xOffset, {
          toValue: isAtRightBoundary ? maxOffset + 20 : minOffset - 20,
          duration: 150,
          useNativeDriver: true
        }),
        Animated.spring(xOffset, {
          toValue: isAtRightBoundary ? maxOffset : minOffset,
          friction: 8,
          tension: 40,
          useNativeDriver: true
        })
      ]).start();
    } else {
      xOffset.setValue(nextValue);
      rafIdRef.current = requestAnimationFrame(animateStep);
    }
  }, [scrollSpeed, maxOffset, minOffset]);

  const startScroll = useCallback((direction) => {
    if (isScrollingRef.current === direction) return;
    isScrollingRef.current = direction;
    rafIdRef.current = requestAnimationFrame(animateStep);
  }, [animateStep]);

  const stopScroll = useCallback(() => {
    isScrollingRef.current = 0;
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
  }, []);

  useEffect(() => () => stopScroll(), [stopScroll]);

  return { xOffset, startScroll, stopScroll };
}





function GameBoard() {
  useEffect(() => {
      if (Platform.OS === 'web') return;
      const lock = async () => await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      lock();
    }, []);

 const ROWS = 6;
 const COLS = 8;
 const TOTAL_BLOCKS = 3;
 const TOTAL_COLS = 24;

 const SEGMENT_IMAGES = {
  sand: require('../assets/sand_base.png'),
  road: require('../assets/road_base.png'),
  wall: require('../assets/wall_base.png'),
  dirt: require('../assets/dirt_base.png'),
  danger: require('../assets/danger_base.png'),
};

 const WEB_SCROLL_SPEED = 80;

  const RoadArea = ({ children, spacing = 10, backgroundColor = '#3a034b' }) => (
    <View style={[styles.relativeContainer, { flex: 1 }]}>
      {/* Внешняя рамка обертки */}
      <View 
        pointerEvents="none" 
        style={{
          position: 'absolute', top: 20, left: 20, right: 20, bottom: 20,
        }}
      />
      {/* Контейнер с цветом и отступами (пространство вокруг дороги) */}
      <View style={[styles.outerContainer, { backgroundColor, padding: spacing }]}>
         {children}
      </View>
    </View>
  );


  const { width: screenW, height: screenH } = useWindowDimensions();

  const ARROW_BTN_SIZE = Math.floor(screenH * 0.15);
  const ROAD_CONTAINER_W = Math.floor(screenW - ARROW_BTN_SIZE * 2);
  const SEGMENT_W = Math.floor(ROAD_CONTAINER_W / (COLS * 1.07));
  const SEGMENT_H = Math.floor(screenH / ROWS);

  const minOffset = -(TOTAL_COLS - COLS) * SEGMENT_W;

  const isWeb = Platform.OS === 'web';

  // Refs used for mobile mode to keep latest values accessible in handlers
  const xOffsetRef = useRef(new Animated.Value(0));
  const minOffsetRef = useRef(minOffset);
  const segmentWRef = useRef(SEGMENT_W);
  const startXOffsetRef = useRef(0);
  const isAnimatingRef = useRef(false);

  // Update refs on every render so handlers see current bounds and dimensions
  minOffsetRef.current = minOffset;
  segmentWRef.current = SEGMENT_W;

  let xOffset, startScroll, stopScroll, leftButtonProps, rightButtonProps, roadContainerHandlers = {};

  if (isWeb) {
    ({ xOffset, startScroll, stopScroll } = useScrollAnimation(minOffset, { scrollSpeed: WEB_SCROLL_SPEED }));
    leftButtonProps = { onPressIn: () => startScroll(1), onPressOut: stopScroll };
    rightButtonProps = { onPressIn: () => startScroll(-1), onPressOut: stopScroll };
  } else {
    xOffset = xOffsetRef.current;

    // PanResponder for smooth finger drag (only activates after horizontal movement > 5px)
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          return !isAnimatingRef.current && Math.abs(gestureState.dx) > 5;
        },
        onPanResponderGrant: () => {
          startXOffsetRef.current = xOffset._value;
        },
        onPanResponderMove: (evt, gestureState) => {
          const newOffset = startXOffsetRef.current + gestureState.dx;
          const clamped = Math.max(minOffsetRef.current, Math.min(0, newOffset));
          xOffset.setValue(clamped);
        }
      })
    ).current;

    roadContainerHandlers = panResponder.panHandlers;

    // Snap to next/previous block start on button press
    const snapToBlock = useCallback((direction) => {
      if (isAnimatingRef.current) return;

      const currentOffset = xOffset._value;
      const blockWidth = COLS * segmentWRef.current;
      const quotient = Math.floor((-currentOffset) / blockWidth); // 0..TOTAL_BLOCKS-1

      let targetBlockIndex;
      if (direction === 'left') {
        targetBlockIndex = Math.max(0, quotient - 1);
      } else { // right
        targetBlockIndex = Math.min(TOTAL_BLOCKS - 1, quotient + 1);
      }

      // No movement possible at boundary – could add feedback, omitted for brevity
      if (targetBlockIndex === quotient) return;

      const targetOffset = -targetBlockIndex * blockWidth;

      isAnimatingRef.current = true;
      Animated.timing(xOffset, {
        toValue: targetOffset,
        duration: 300,
        easing: Easing.easeOutQuad,
        useNativeDriver: true,
      }).start(() => {
        isAnimatingRef.current = false;
      });
    }, [xOffset]);

    leftButtonProps = { onPress: () => snapToBlock('left') };
    rightButtonProps = { onPress: () => snapToBlock('right') };
  }

  const player = useAudioPlayer(require('../assets/lazer.mp3'));

  const gridData = useMemo(() => {
    const data = [];
    for (let b = 0; b < TOTAL_BLOCKS; b++) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          data.push({
            id: `${b}-${r}-${c}`,
            row: r,
            col: c + (b * COLS),
            blockIndex: b,
            type: b % 2 === 0 ? 'road' : 'dirt',
          });
        }
      }
    }
    return data;
  }, []);

  const handleSegmentPress = useCallback(() => {
    player.seekTo(0);
    player.play();
  }, [player]);

  return (

      <View style={styles.gameBoardWrapper}>
      <Image source={require('../assets/background_landscape.png')} style={[styles.backgroundImg, { width: screenW, height: screenH }]} />

      {/* Left arrow */}
      <TouchableOpacity
        style={[styles.arrowBtn, { width: ARROW_BTN_SIZE, height: ARROW_BTN_SIZE }]}
        activeOpacity={0.7}
        {...leftButtonProps}
      >
        <Text style={[styles.arrowText, { fontSize: Math.floor(ARROW_BTN_SIZE * 0.5) }]}>←</Text>
      </TouchableOpacity>

      {/* Road area */}
      <RoadArea spacing={12} backgroundColor="#3a034b00">
        <View
          style={[styles.roadContainer, { width: ROAD_CONTAINER_W, height: screenH }]}
          {...(isWeb ? {} : roadContainerHandlers)}
        >
          <Animated.View style={{ transform: [{ translateX: xOffset }] }}>
            {Array.from({ length: ROWS }).map((_, rowIdx) => (
              <View
                key={`row-${rowIdx}`}
                style={[
                  styles.rowContainer,
                  rowIdx % 2 !== 0 && { marginLeft: SEGMENT_W / 2 },
                ]}
              >
                {gridData.filter(seg => seg.row === rowIdx).map(segment => (
                  <TouchableOpacity
                    key={segment.id}
                    onPress={handleSegmentPress}
                    style={{ width: SEGMENT_W, height: SEGMENT_H }}
                  >
                    <Image
                      source={SEGMENT_IMAGES[segment.type] || SEGMENT_IMAGES.danger}
                      style={{ width: SEGMENT_W, height: SEGMENT_H, resizeMode: 'stretch', opacity: 0.9 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </Animated.View>
        </View>
      </RoadArea>

      {/* Right arrow */}
      <TouchableOpacity
        style={[styles.arrowBtn, { width: ARROW_BTN_SIZE, height: ARROW_BTN_SIZE }]}
        activeOpacity={0.7}
        {...rightButtonProps}
      >
        <Text style={[styles.arrowText, { fontSize: Math.floor(ARROW_BTN_SIZE * 0.5) }]}>→</Text>
      </TouchableOpacity>

    </View>

  );
}

const styles = StyleSheet.create({
  gameBoardWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  roadContainer: { overflow: 'hidden' },
  rowContainer: { flexDirection: 'row', alignItems: 'center' },
  backgroundImg: { position: 'absolute', resizeMode: 'stretch', opacity: 1, zIndex: -1 },
  arrowBtn: { backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 999, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  arrowText: { fontWeight: 'bold', color: '#fff' },
  relativeContainer: { position: 'relative' },
  outerContainer: { flex: 1 } 
});

export default GameBoard;
