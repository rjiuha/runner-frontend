// src/components/ui/TiledImage.js
import React from 'react';
import { Image, View } from 'react-native';

/**
 * Мостит `source` (тайл размером `tileW`×`tileH` DP) на прямоугольник
 * `width`×`height`, копиями `resizeMode="stretch"` — НЕ через
 * `resizeMode="repeat"`.
 *
 * Почему не `repeat` (2026-09-19, живая жалоба пользователя на Android —
 * "грани не в масштабе относительно углов"): исходник RN Android
 * (`ScaleTypeStartInside.kt`, которым `resizeMode="repeat"` реализован) —
 * `scale = min(scaleX, scaleY, 1.0)` — `repeat` НИКОГДА не масштабирует
 * тайл вверх, всегда рисует его в родных ПИКСЕЛЯХ файла (1 пиксель файла =
 * 1 физический пиксель экрана), совершенно не учитывая плотность экрана
 * устройства. На density=420dpi (реальный эмулятор пользователя, ×2.625 от
 * dp) это даёт тайл в 2.6 раза МЕЛЬЧЕ, чем должен быть — а соседние углы
 * (`resizeMode="stretch"`, который масштабируется штатно) остаются верного
 * размера, отсюда и видимый рассинхрон масштаба. `stretch` с dest-размером
 * РОВНО в размер одного тайла (без искажения пропорций тайла — width/height
 * ЭТОЙ функции просто определяют, сколько копий нужно, не растягивают
 * КАЖДУЮ копию по-разному) масштабируется наравне с углами.
 *
 * Последняя копия по каждой оси может вылезти за `width`/`height` (если
 * тайл не укладывается ровно целое число раз) — обрезается `overflow:
 * 'hidden'` на обёртке, а не искажением тайла.
 */
export default function TiledImage({ source, tileW, tileH, width, height, style }) {
    if (width <= 0 || height <= 0 || tileW <= 0 || tileH <= 0) return null;
    const cols = Math.ceil(width / tileW);
    const rows = Math.ceil(height / tileH);
    const items = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            items.push(
                <Image
                    key={`${r}-${c}`}
                    source={source}
                    resizeMode="stretch"
                    style={{ position: 'absolute', top: r * tileH, left: c * tileW, width: tileW, height: tileH }}
                />
            );
        }
    }
    return (
        <View style={[{ position: 'absolute', width, height, overflow: 'hidden' }, style]}>
            {items}
        </View>
    );
}
