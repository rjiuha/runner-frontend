// src/components/game/ReaperCard.js
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RunnerToken from './RunnerToken';
import PersonPanel, { NOTCH_RADIUS } from '../ui/PersonPanel';
import FramePanel from '../ui/FramePanel';
import { FRAME_PANEL_BACKGROUND, FRAME_PANEL_BACKGROUND_CORNER, RUNNER_TYPES } from '../../constants/GameConstants';
import { colors, font, spacing } from '../../theme';

// ВДВОЕ меньше, чем у обычных бегунов (RunnerCard.js#AVATAR_SIZE=64) — по
// прямому запросу пользователя "плитку для жнеца вдвое уже [по высоте], чем
// для бегунов" (2026-09-20, уточнено явно: "не в ширину, а в высоту" — сама
// плитка по-прежнему на всю ширину колонки, как RunnerCard, короче именно по
// высоте). padding у card ниже тоже уменьшен (spacing.xs вместо spacing.sm) —
// итоговая высота плитки (padding*2 + AVATAR_SIZE) ровно вдвое меньше
// RunnerCard.js#styles.card (было 8*2+64=80, теперь 4*2+32=40).
const AVATAR_SIZE = 32;
// Стабильный объект (создан ОДИН раз, не на каждый рендер) — тот же приём,
// что и AVATAR_FRAME_SIZE в RunnerCard.js: FramePanel обёрнут в React.memo,
// который сравнивает пропсы по ссылке, инлайн-объект каждый раз "менялся" бы.
const AVATAR_FRAME_SIZE = { width: AVATAR_SIZE, height: AVATAR_SIZE };

/**
 * Плитка Жнеца — по прямому запросу пользователя "плитку для жнеца по
 * аналогии с плиткой бегуна, чтобы avatar анимация жнеца была во фрейме, а
 * рядом просто текст, на поле он или в резерве" (2026-09-20). Та же
 * декоративная рамка корпуса (PersonPanel) и та же мини-рамка аватара
 * (FramePanel с чёрным фоном FRAME_PANEL_BACKGROUND — тот же override, что
 * RunnerCard.js#avatarBox, "frame_background... это чисто для аватарки
 * бегуна"), что у RunnerCard — но СИЛЬНО упрощённая: у Жнеца нет слота
 * кубика хода/наката и жетонов повреждения (та механика — только для
 * обычных движимых бегунов, см. CLAUDE.md), рядом с аватаром — просто текст
 * "на поле"/"в резерве" (было раньше в reaperNode, PlayerInfoPanel.js, до
 * этого захода — маленький нерамочный RunnerToken + Text в строку).
 *
 * `active` — тот же признак, что уже был (String(reaper.id) ===
 * activeRunnerId), красит и halo вокруг аватара (RunnerToken#selected), и
 * цветное кольцо вокруг ВСЕЙ плитки (тот же приём, что RunnerCard.js#
 * activeRing) — раньше кольца вокруг всей плитки не было вообще.
 *
 * React.memo — тот же резон, что у RunnerCard/FramePanel/PersonPanel (живая
 * жалоба "тормозит при перетаскивании кубика по плиткам", 2026-09-19): без
 * него ~30 дочерних `<Image>` этой плитки заново реконсилировались бы на
 * КАЖДЫЙ ре-рендер панели, даже когда сам Жнец не менялся.
 */
function ReaperCard({ reaper, color, active }) {
    const cardRef = useRef(null);
    // Размер КОРПУСА плитки (для PersonPanel) — measureInWindow, НЕ
    // собственный onLayout PersonPanel — та же причина/фикс, что в
    // RunnerCard.js (на Android onLayout абсолютно спозиционированного
    // ребёнка с auto-height родителем стабильно ловит height=0).
    const [cardSize, setCardSize] = useState(null);

    const measure = useCallback(() => {
        requestAnimationFrame(() => {
            cardRef.current?.measureInWindow((x, y, width, height) => {
                setCardSize({ width, height });
            });
        });
    }, []);

    const onField = reaper.segment != null;

    return (
        <View ref={cardRef} onLayout={measure} style={styles.card}>
            <PersonPanel size={cardSize} />
            {/* borderRadius — та же величина, что у PersonPanel.js#styles.wrap
                (тот же фикс "рамка острым углом поверх скруглённой дуги",
                что уже применён в RunnerCard.js/AbilityZone.js). */}
            {active && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.activeRing, { borderColor: color }]} />}

            <View style={styles.row}>
                <View style={styles.avatarBox}>
                    {/* targetCornerSize=6 (половина дефолта FramePanel, 12) —
                        держит толщину декоративной дуги ПРОПОРЦИОНАЛЬНОЙ
                        уменьшенному вдвое боксу (иначе тот же абсолютный
                        12px выглядел бы вдвое толще относительно AVATAR_SIZE,
                        чем у RunnerCard.js — там 12px на 64px бокс, тут было
                        бы 12px на 32px). */}
                    <FramePanel
                        size={AVATAR_FRAME_SIZE}
                        targetCornerSize={6}
                        backgroundSource={FRAME_PANEL_BACKGROUND}
                        backgroundCornerSource={FRAME_PANEL_BACKGROUND_CORNER}
                        backgroundTileSize={60}
                    />
                    <RunnerToken
                        type={RUNNER_TYPES.REAPER}
                        status={reaper.status}
                        avatar
                        color={color}
                        size={AVATAR_SIZE}
                        imageScale={0.85}
                        selected={active}
                        showRing={false}
                    />
                </View>
                {/* Зелёный НАВСЕГДА, пока Жнец стоит на поле — по прямому
                    запросу пользователя, БЕЗ пульсации (не привязано к тому,
                    чей сейчас ход, см. CLAUDE.md, 2026-09-14). */}
                <Text
                    style={[styles.text, onField && styles.textOnField]}
                    numberOfLines={1}
                    noGlobalTint
                >
                    {onField ? 'Жнец — на поле' : 'Жнец — в резерве'}
                </Text>
            </View>
        </View>
    );
}

export default React.memo(ReaperCard);

const styles = StyleSheet.create({
    // width:'100%' — та же ширина, что RunnerCard.js#styles.card (короче
    // именно по ВЫСОТЕ, см. AVATAR_SIZE выше, не по ширине). padding —
    // spacing.xs (было spacing.sm, как у RunnerCard) — половина, даёт ровно
    // вдвое меньшую итоговую высоту плитки.
    card: { width: '100%', padding: spacing.xs, marginBottom: spacing.xs },
    // borderRadius — та же величина, что у PersonPanel.js#styles.wrap
    // (NOTCH_RADIUS, тот же фикс, что и в RunnerCard.js#activeRing, 2026-09-26).
    activeRing: { borderWidth: 3, borderRadius: NOTCH_RADIUS },
    row: { flexDirection: 'row', alignItems: 'center' },
    avatarBox: { width: AVATAR_SIZE, height: AVATAR_SIZE, alignItems: 'center', justifyContent: 'flex-end' },
    text: { color: colors.textOnDark, fontWeight: 'bold', fontSize: font.small, marginLeft: spacing.sm, flex: 1 },
    textOnField: { color: colors.success },
});
