// src/components/game/MobileFrameOverlay.js
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import {
    MOBILE_FRAME_BORDER_PX,
    MOBILE_FRAME_CORNER_SIZE_PX,
    MOBILE_FRAME_CORNER_TR,
    MOBILE_FRAME_EDGE_RIGHT,
    MOBILE_FRAME_EDGE_TOP,
} from '../../constants/GameConstants';

/**
 * Декоративная sci-fi рамка (мобильное приложение, портретная раскладка,
 * см. GameBoardScreen.useMobileNavButtons) — собрана из ОДНОГО угла
 * (верхний правый) и 2 планок (верхняя горизонтальная, правая
 * вертикальная); остальные 3 угла и обратные стороны планок получены
 * зеркалированием (`scaleX:-1`/`scaleY:-1`) того же изображения — отдельных
 * файлов под них нет, толщина уголка и планки в исходниках уже точно
 * совпадает (см. GameConstants.js), так что швы сходятся без подгонки.
 *
 * Заполняет РОВНО родителя — но НЕ через left+right без явного width на
 * планках: на реальном Android планка рендерилась в СВОЁМ нативном размере
 * (121px) вместо растяжения на весь зазор (тот же класс бага, что раньше
 * ловил на react-native-web). Поэтому измеряем родителя через onLayout и
 * считаем ширину/высоту планок ЯВНО числом.
 *
 * `corners` — какие из 4 углов рисовать закруглёнными (по умолчанию все).
 * Дорога и панель стыкуются друг с другом (общий шов, БЕЗ зазора между
 * зонами) — на этом шве закруглённый угол смотрелся бы как нахлёст двух
 * выпуклых кривых с просветом фона между ними. Поэтому дорога рисует только
 * верхние 2 угла (низ — прямой обрез, там шов), а панель — только нижние 2
 * (верх — прямой обрез). На прямом крае (без угла) планка/грань идёт ВО ВСЮ
 * ширину/высоту (инсет по этой стороне = 0, не cornerSize) — так шов
 * получается сплошной линией без разрыва.
 *
 * zIndex/elevation — без них анимированные gif-тайлы опасности на доске
 * (BoardGrid) на реальном Android пролезали ПОВЕРХ рамки, хотя структурно
 * рамка объявлена позже (later sibling = должна рисоваться сверху). Android
 * не всегда уважает порядок объявления для elevated контента глубоко во
 * вложенном дереве — тот же класс бага, что уже был с токеном бегуна под
 * сегментом (см. CLAUDE.md, пятый заход).
 *
 * `bleed` — на сколько px рамка выступает НАРУЖУ за границы родителя с
 * каждой стороны (по умолчанию 0, т.е. ровно по родителю). Только для ИСТИННЫХ
 * внешних краёв экрана (верх дороги — уходит под статус-бар/вырез камеры,
 * левый/правый края обеих зон — чуть за границу экрана) — НЕ для внутреннего
 * шва между дорогой и панелью (там bleed=0, иначе разъедутся и там появится
 * зазор, который мы специально убирали). Реализовано через отрицательные
 * top/left/right/bottom на ВНЕШНЕЙ View — она сама position:'absolute' с
 * pointerEvents:'none', поэтому не участвует в layout соседей (в отличие от
 * прошлой версии outward-growth, которая росла на всех 4 сторонах сразу и
 * налезала на соседние зоны/кнопки, см. CLAUDE.md). onLayout меряет уже
 * УВЕЛИЧЕННЫЙ (за счёт bleed) размер — доп. пересчёт не нужен.
 */
export default function MobileFrameOverlay({ borderDp, corners = {}, bleed = {} }) {
    const { tl = true, tr = true, bl = true, br = true } = corners;
    const { top: bleedTop = 0, bottom: bleedBottom = 0, left: bleedLeft = 0, right: bleedRight = 0 } = bleed;
    const [size, setSize] = useState(null);
    const cornerSize = (borderDp / MOBILE_FRAME_BORDER_PX) * MOBILE_FRAME_CORNER_SIZE_PX;

    const onLayout = (e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
    };

    const leftInsetTop = tl ? cornerSize : 0;
    const rightInsetTop = tr ? cornerSize : 0;
    const leftInsetBottom = bl ? cornerSize : 0;
    const rightInsetBottom = br ? cornerSize : 0;

    return (
        <View
            style={{
                position: 'absolute',
                top: -bleedTop, left: -bleedLeft, right: -bleedRight, bottom: -bleedBottom,
                zIndex: 10, elevation: 10,
            }}
            pointerEvents="none"
            onLayout={onLayout}
        >
            {size && (
                <>
                    <Image
                        source={MOBILE_FRAME_EDGE_TOP}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', top: 0, left: leftInsetTop,
                            width: size.width - leftInsetTop - rightInsetTop, height: borderDp,
                        }}
                    />
                    <Image
                        source={MOBILE_FRAME_EDGE_TOP}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', bottom: 0, left: leftInsetBottom,
                            width: size.width - leftInsetBottom - rightInsetBottom, height: borderDp,
                            transform: [{ scaleY: -1 }],
                        }}
                    />
                    <Image
                        source={MOBILE_FRAME_EDGE_RIGHT}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', right: 0, top: rightInsetTop,
                            width: borderDp, height: size.height - rightInsetTop - rightInsetBottom,
                        }}
                    />
                    <Image
                        source={MOBILE_FRAME_EDGE_RIGHT}
                        resizeMode="stretch"
                        style={{
                            position: 'absolute', left: 0, top: leftInsetTop,
                            width: borderDp, height: size.height - leftInsetTop - leftInsetBottom,
                            transform: [{ scaleX: -1 }],
                        }}
                    />
                    {tr && (
                        <Image
                            source={MOBILE_FRAME_CORNER_TR}
                            resizeMode="stretch"
                            style={{ position: 'absolute', top: 0, right: 0, width: cornerSize, height: cornerSize }}
                        />
                    )}
                    {tl && (
                        <Image
                            source={MOBILE_FRAME_CORNER_TR}
                            resizeMode="stretch"
                            style={{
                                position: 'absolute', top: 0, left: 0, width: cornerSize, height: cornerSize,
                                transform: [{ scaleX: -1 }],
                            }}
                        />
                    )}
                    {br && (
                        <Image
                            source={MOBILE_FRAME_CORNER_TR}
                            resizeMode="stretch"
                            style={{
                                position: 'absolute', bottom: 0, right: 0, width: cornerSize, height: cornerSize,
                                transform: [{ scaleY: -1 }],
                            }}
                        />
                    )}
                    {bl && (
                        <Image
                            source={MOBILE_FRAME_CORNER_TR}
                            resizeMode="stretch"
                            style={{
                                position: 'absolute', bottom: 0, left: 0, width: cornerSize, height: cornerSize,
                                transform: [{ scaleX: -1 }, { scaleY: -1 }],
                            }}
                        />
                    )}
                </>
            )}
        </View>
    );
}
