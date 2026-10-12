// src/components/game/FramedSquare.js
import React, { useMemo } from 'react';
import { View } from 'react-native';
import FramePanel, { frameNotchRadius } from '../ui/FramePanel';
import PersonPanel, { personPanelNotchRadius } from '../ui/PersonPanel';
import NeonGlow from '../ui/NeonGlow';

/**
 * Обёртка "контент + декоративная рамка" с выбором стиля — 2026-10-10,
 * новая строка под швом дороги (и кайма самой рамки дороги).
 * - `variant="frame"` (по умолчанию) — FramePanel, та же рамка, что у
 *   аватарки/слота кубика на карточке бегуна (RunnerCard.js). Тут —
 *   панель имени игрока + раунд/ход/бонус дороги (голый `Text` без
 *   собственного фона — рамка ему действительно нужна).
 * - `variant="person"` — PersonPanel В РЕЖИМЕ `showBackground={false}` (см.
 *   её докстринг) — честная 9-slice рамка (грани+уголки, тайлами, НЕ
 *   нарисованная на растре) БЕЗ фоновой плашки. Для кнопок навигации/
 *   настроек/лога (RoadNavButton/GameMenuButton/EventLogPanel seam) — их
 *   PNG-ассеты (`road_map_button_*`/`settings_*`/`log_*`) уже содержат СВОЙ
 *   фон/форму (просто больше не содержат нарисованную линию-рамку, та
 *   вырезана скриптом, см. CLAUDE.md 2026-10-10) — `showBackground=false`
 *   не дублирует их фон, рисует ТОЛЬКО декоративный контур поверх. Полный
 *   PersonPanel (с фоном) тут раньше давал видимую двойную рамку (живая
 *   жалоба пользователя) — альтернатива "утолщить рамку прямо на PNG" тоже
 *   была отклонена ("не честные слайсы").
 * - `variant="bare"` — вообще без декора, просто центрирующий контейнер.
 *
 * В отличие от обоих компонентов по отдельности (оба требуют size,
 * ОБЯЗАТЕЛЬНО измеренный снаружи через onLayout/measureInWindow в их
 * обычном месте использования — см. их докстринги) — тут размер ВСЕГДА
 * известен заранее (явные числа, посчитанные в GameBoardScreen.js),
 * поэтому `size` просто useMemo'ится от пропов, без своего onLayout.
 *
 * `width`/`height` — если `height` не передан, используется `width`
 * (квадрат) — большинство мест тут квадратные, только кнопки навигации на
 * рамке дороги явно передают оба (ширина = 2×высоты, см. место рендера).
 *
 * `glow` (2026-10-11, по прямому запросу пользователя — "такое же свечение
 * у personPanel, у кнопок, у панели с именем игрока... у панелей раунд-
 * ход-бонус") — тот же NeonGlow, что уже стоит у dATile в
 * PlayerInfoPanel.js, см. её докстринг за тем, почему не настоящая
 * blur-тень. По умолчанию `false` — остальные (ещё не упомянутые) места,
 * использующие FramedSquare, не затронуты автоматически. Радиус свечения
 * — та же формула, что уже считает сам FramePanel/PersonPanel для своего
 * скругления (frameNotchRadius/personPanelNotchRadius), чтобы кольцо точно
 * легло по контуру декоративной дуги, а не прямоугольником поверх неё.
 */
export default function FramedSquare({ width, height, variant = 'frame', targetCornerSize = 10, glow = false, style, children }) {
    const boxW = width;
    const boxH = height ?? width;
    const size = useMemo(() => ({ width: boxW, height: boxH }), [boxW, boxH]);
    const glowRadius = variant === 'frame'
        ? frameNotchRadius(size, targetCornerSize)
        : personPanelNotchRadius(size, targetCornerSize);

    // Порядок РАЗНЫЙ для разных вариантов (оба крайних варианта уже ловили
    // живой баг на эмуляторе 2026-10-10 — держать в уме при будущих правках):
    // - `variant="frame"` — FramePanel ВСЕГДА рисует сплошной непрозрачный
    //   фон (своей опции showBackground у неё нет) — должна идти ДО children
    //   (текст поверх своего фона), иначе полностью его закрывает ("Раунд/
    //   Ход/Бонус/имя" стали пустыми квадратами). Свечение — СРАЗУ после
    //   рамки, тем же порядком (над фоном, под текстом — текст у этих мест
    //   короткий/по центру, края ему не мешают).
    // - `variant="person"` — ПОСЛЕ children. У неё self showBackground=false
    //   (ничего не закрывает), а вот сам контент (иконка settings/log/nav) —
    //   ПОЛНОСТЬЮ НЕПРОЗРАЧНЫЙ квадрат (после вырезания нарисованной рамки
    //   граница залита цветом заливки, не прозрачностью, см. CLAUDE.md
    //   2026-10-10) — если рамку положить ДО иконки, та своим непрозрачным
    //   прямоугольником полностью перекрывает тонкие грани под собой (рамка
    //   казалась "пропавшей" — живая жалоба). Свечение — ТУДА ЖЕ, сразу
    //   после рамки, по той же причине (иначе непрозрачная иконка скрыла бы
    //   и его тоже).
    return (
        <View style={[{ width: boxW, height: boxH, alignItems: 'center', justifyContent: 'center' }, style]}>
            {variant === 'frame' && <FramePanel size={size} targetCornerSize={targetCornerSize} />}
            {variant === 'frame' && glow && <NeonGlow size={size} radius={glowRadius} />}
            {children}
            {variant === 'person' && <PersonPanel size={size} targetCornerSize={targetCornerSize} showBackground={false} />}
            {variant === 'person' && glow && <NeonGlow size={size} radius={glowRadius} />}
        </View>
    );
}
