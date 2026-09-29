// src/components/game/DiceDie.js
import React, { useCallback, useRef } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { DICE_FACE_IMAGES } from '../../constants/GameConstants';
import { colors } from '../../theme';

// Веб vs native — разные стратегии позиционирования во время драга, см.
// комментарий у DiceDie ниже.
const IS_WEB = Platform.OS === 'web';

/**
 * Один кубик перемещения — перетаскивается на зону усиления (AbilityZones)
 * или карточку бегуна (RunnerCard).
 *
 * **Веб**: кубик визуально "прилипает" ЦЕНТРОМ ровно к текущей точке курсора
 * (`e.absoluteX/Y`), хит-тест (`onDragMove`/`onDrop`) шлёт ТУ ЖЕ точку — то,
 * что видно, и то, что хит-тестится, совпадают по построению. Проверено
 * живым прогоном через автоматизацию с реальными trusted pointer-событиями.
 * Смещение для transform — (`absoluteX/Y` минус `origin`, координаты кубика
 * в покое из `measureInWindow`).
 *
 * **Native (Android/iOS)**: используем `origin + e.translationX/Y` — ЧИСТАЯ
 * ДЕЛЬТА с начала жеста (не завязана на оконные координаты вообще), в
 * отличие от `e.absoluteX/Y`. Причина расхождения с вебом: живой прогон на
 * реальном Android-устройстве показал, что кубик при драге визуально
 * оказывается смещён от пальца, а хит-тест карточек бегунов срабатывает
 * только в узкой полосе, не по всей видимой карточке — похоже на системный
 * сдвиг между `measureInWindow` (оконные координаты) и `e.absoluteX/Y` от
 * gesture-handler на Android (вероятный кандидат — edge-to-edge/статус-бар,
 * не подтверждено физическим устройством из сессии). `e.translationX/Y` —
 * дельта заведомо ИММУННА к такому сдвигу (он одинаково входит и вычитается
 * из обеих точек, между которыми считается разница), а на native (в отличие
 * от web-реализации gesture-handler) её вычисляет нативный код — там не было
 * найдено проблемы "translation застревает в 0", это была именно
 * веб-специфика синтетического автоматизированного ввода (см. историю в
 * CLAUDE.md, двадцатый заход).
 *
 * При неудачном дропе (мимо зоны или зона не принимает текущее значение)
 * пружиной возвращается на место — сам факт "не долетел" уже понятная
 * обратная связь, без дополнительных попапов.
 *
 * "Использованный" слот (value === null — кубик уже отдан на усиление)
 * жест не ловит и рисуется как пустое место, а не тусклая кость.
 * draggable=false — кубик виден (не отдан), но жест выключен: не мой ход
 * или не тот шаг хода (см. dragMode в PlayerInfoPanel).
 *
 * **`ghostX`/`ghostY`/`panelOriginX`/`panelOriginY` (2026-09-28, native
 * only)** — опциональные reanimated shared values, созданные и рендерящиеся
 * СНАРУЖИ (`PlayerInfoPanel.js`), сюда просто передаются пропом. Нужны для
 * того же "призрака поверх всего", что и веб (`dragGhost` в PlayerInfoPanel),
 * но БЕЗ JS-моста на каждый кадр: `.onUpdate()` — воркет, крутится на
 * UI-потоке, и запись `ghostX.value = ...` В ДРУГОЙ shared value (созданный
 * ancestor-компонентом, но тот же самый JS-объект-ref под капотом) — тоже
 * чисто UI-поток, без единого `runOnJS`. Раньше (тот же день, чуть раньше)
 * для этого использовался legacy `Animated.ValueXY.setValue()` внутри
 * `runOnJS(onDragMove)` — работало, но КАЖДЫЙ кадр драга пересекал JS-мост,
 * и на живом (особенно нагруженном) Android это давало заметный лаг —
 * "подсветка зоны не поспевает за пальцем", живая жалоба. `panelOriginX/Y` —
 * оконные координаты панели (см. PlayerInfoPanel#measurePanelOrigin) —
 * `origin`/`e.translationX/Y` этого кубика УЖЕ в оконных координатах (см.
 * докстринг про native выше), а `dragGhost` рисуется `position:'absolute'`
 * ПРЯМЫМ ребёнком корня панели — нужен пересчёт в координаты этого корня.
 * На вебе эти пропы не передаются (не нужны — там свой, отдельный,
 * legacy-Animated путь, см. `IS_WEB`-ветку ниже, её не трогали).
 */
export default function DiceDie({
    value, draggable = true, onDragStart, onDragMove, onDrop, onDragEnd, size = 44,
    ghostX, ghostY, panelOriginX, panelOriginY,
}) {
    const originX = useSharedValue(0);
    const originY = useSharedValue(0);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const dragging = useSharedValue(false);
    const dieRef = useRef(null);

    const measure = useCallback(() => {
        // requestAnimationFrame — см. тот же приём и объяснение в RunnerCard.js.
        requestAnimationFrame(() => {
            dieRef.current?.measureInWindow((x, y, width, height) => {
                originX.value = x + width / 2;
                originY.value = y + height / 2;
            });
        });
    }, [originX, originY]);

    const pan = Gesture.Pan()
        .enabled(value != null && draggable)
        .onStart(() => {
            dragging.value = true;
            // onDragStart/onDragEnd (2026-09-14) — сигнал ВЫШЕ (PlayerInfoPanel),
            // что кубик СЕЙЧАС реально тащат, и каким значением — нужен только
            // для подсветки следующего шага (см. PulseHighlight/PulseText), сама
            // логика драга/дропа этих колбэков не касается вообще.
            if (onDragStart) runOnJS(onDragStart)(value);
        })
        .onUpdate((e) => {
            if (IS_WEB) {
                translateX.value = e.absoluteX - originX.value;
                translateY.value = e.absoluteY - originY.value;
                if (onDragMove) runOnJS(onDragMove)(e.absoluteX, e.absoluteY, value);
            } else {
                translateX.value = e.translationX;
                translateY.value = e.translationY;
                // Позиция призрака — ЧИСТО на UI-потоке, см. докстринг файла.
                if (ghostX && ghostY) {
                    ghostX.value = originX.value + e.translationX - (panelOriginX?.value ?? 0);
                    ghostY.value = originY.value + e.translationY - (panelOriginY?.value ?? 0);
                }
                if (onDragMove) runOnJS(onDragMove)(originX.value + e.translationX, originY.value + e.translationY, value);
            }
        })
        .onEnd((e) => {
            if (!onDrop) return;
            if (IS_WEB) {
                runOnJS(onDrop)(e.absoluteX, e.absoluteY, value);
            } else {
                runOnJS(onDrop)(originX.value + e.translationX, originY.value + e.translationY, value);
            }
        })
        .onFinalize(() => {
            dragging.value = false;
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            if (onDragEnd) runOnJS(onDragEnd)();
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: dragging.value ? 1.18 : 1 },
        ],
        zIndex: dragging.value ? 10 : 1,
        // elevation — Android-специфичный аналог zIndex (2026-09-20, живая
        // жалоба "кубики при передвижении на android заходят ЗА фрейм
        // усиления"): zIndex сам по себе на Android не всегда надёжно
        // поднимает вид над содержимым СОСЕДНИХ поддеревьев (тот же класс
        // бага, что уже не раз ловился в этом проекте — см. BoardGrid.js/
        // MobileFrameOverlay). backgroundColor:'transparent' — известный
        // спутник elevation на Android без явного фона: без него Android
        // иногда рисует тень/контур по ПРЯМОУГОЛЬНОЙ границе вида, игнорируя
        // форму содержимого (тот же фикс, что уже применён в RunnerToken.js
        // для похожей причины).
        elevation: dragging.value ? 10 : 0,
        backgroundColor: 'transparent',
        // Поверх едет независимый "призрак" кубика (см. dragGhost в
        // PlayerInfoPanel) — на ОБЕИХ платформах — без этого во время драга
        // были бы видны ДВА кубика одновременно (этот, ограниченный
        // стекингом/clip своей колонки, и призрак поверх неё). 2026-09-28,
        // два захода за один день: сначала призрак на native вёлся через
        // `runOnJS`+legacy `Animated.ValueXY` (JS-мост на каждый кадр,
        // живая жалоба на лаг подсветки) → откачено на "оставить видимым,
        // просто снять overflow:hidden колонки на время драга" → живая
        // проверка показала, что этого НЕДОСТАТОЧНО (кубик всё ещё уходит
        // "за" соседнюю колонку — видимо, `transform:scale` на
        // `leftColumnContent`/`rightColumnContent` создаёт свой stacking-
        // контекст, из которого elevation/zIndex не может вырваться, не
        // только clip был виноват) → финально призрак вернули, но уже через
        // reanimated shared values (`ghostX`/`ghostY`, см. докстринг файла)
        // вместо legacy `Animated` — та же визуальная логика, что и раньше,
        // но обновление позиции ЦЕЛИКОМ на UI-потоке, без JS-моста на кадр.
        opacity: dragging.value ? 0 : 1,
    }));

    if (value == null) {
        return <View style={[styles.emptySlot, { width: size, height: size, borderRadius: size / 2 }]} />;
    }

    return (
        <GestureDetector gesture={pan}>
            <Animated.View ref={dieRef} onLayout={measure} style={[styles.die, { width: size, height: size }, animatedStyle]}>
                <Image
                    source={DICE_FACE_IMAGES[value]}
                    style={{ width: size, height: size }}
                    resizeMode="contain"
                />
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    die: { alignItems: 'center', justifyContent: 'center' },
    emptySlot: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.textOnDarkSecondary,
        opacity: 0.4,
    },
});
