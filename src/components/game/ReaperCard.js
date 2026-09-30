// src/components/game/ReaperCard.js
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import RunnerToken from './RunnerToken';
import PersonPanel, { NOTCH_RADIUS } from '../ui/PersonPanel';
import FramePanel from '../ui/FramePanel';
import PulseHighlight from '../ui/PulseHighlight';
import { FRAME_PANEL_BACKGROUND, FRAME_PANEL_BACKGROUND_CORNER, RUNNER_TYPES } from '../../constants/GameConstants';
import { spacing } from '../../theme';

// ВДВОЕ меньше, чем у обычных бегунов (RunnerCard.js#AVATAR_SIZE=64) — по
// прямому запросу пользователя "плитку для жнеца вдвое уже [по высоте], чем
// для бегунов" (2026-09-20, уточнено явно: "не в ширину, а в высоту" — сама
// плитка по-прежнему на всю ширину колонки, как RunnerCard, короче именно по
// высоте). padding у card ниже тоже уменьшен (spacing.xs вместо spacing.sm) —
// итоговая высота плитки (padding*2 + AVATAR_SIZE) ровно вдвое меньше
// RunnerCard.js#styles.card (было 8*2+64=80, теперь 4*2+32=40).
// Экспортирован (2026-10-01) — PlayerInfoPanel.js считает от него sizeScale,
// чтобы вырастить аватар Жнеца до размера кубика бонуса дороги (см. её
// докстринг и место передачи sizeScale ниже) без дублирования магического
// числа 32 в двух файлах.
export const AVATAR_SIZE = 32;
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
// sizeScale — изначально (2026-09-26) был частью авто-РОСТА compact-колонки
// (leftGrow, механизм убран НАВСЕГДА 2026-09-30, см. CLAUDE.md), но сам проп
// остался и переиспользован 2026-10-01: PlayerInfoPanel.js теперь передаёт
// его явно (`roadBonusDieSize / AVATAR_SIZE`), чтобы аватар Жнеца визуально
// вырос вместе с картой — прямой запрос пользователя "забыл увеличить
// аватарку Жнеца" после того, как выросла сама карточка/кубик бонуса дороги
// рядом. БЕЗ клэмпа по ширине: аватар — фиксированного размера слева, но
// текст СПРАВА (`styles.text`, `flex:1`) сам подстраивается/ужимается под
// ЛЮБОЙ остаток ширины, поэтому рост аватара тут структурно безопасен без
// проверки.
function ReaperCard({ reaper, color, active, sizeScale = 1 }) {
    const cardRef = useRef(null);
    const avatarSize = Math.round(AVATAR_SIZE * sizeScale);
    const avatarFrameSize = useMemo(
        () => (sizeScale === 1 ? AVATAR_FRAME_SIZE : { width: avatarSize, height: avatarSize }),
        [sizeScale, avatarSize],
    );
    // Отступ вокруг аватара и толщина декоративной дуги — ОБА масштабируются
    // вместе с sizeScale (2026-10-01, живая жалоба "рамка аватарки налезает
    // на рамку панели слева"). `card`#padding был константным `spacing.xs`
    // (4px) — рассчитан на СТАРЫЙ 32px аватар; выросший до ~50px аватар с тем
    // же 4px зазором визуально упирается в декоративную дугу корпуса
    // (PersonPanel) слева. `cornerSize` — та же пропорция, что и раньше
    // (6/32, см. её докстринг ниже) — держит толщину дуги аватара
    // ПРОПОРЦИОНАЛЬНОЙ новому размеру, а не оставшейся тонкой относительно
    // выросшего бокса.
    const cardPadding = Math.round(spacing.xs * sizeScale);
    const cornerSize = Math.round(6 * sizeScale);
    // Размер КОРПУСА плитки (для PersonPanel) — НЕ через собственный onLayout
    // PersonPanel (та же причина/фикс, что в RunnerCard.js — на Android
    // onLayout абсолютно спозиционированного ребёнка с auto-height родителем
    // стабильно ловит height=0), а через onLayout САМОЙ плитки (`cardRef`,
    // обычный flow-элемент).
    //
    // **`onLayout`, НЕ `measureInWindow`** (2026-09-26, тот же симметричный
    // фикс, что и в RunnerCard.js/AbilityZone.js/PlayerInfoPanel.js — живая
    // жалоба "рамки висят в воздухе" после введения авто-масштабирования
    // колонок leftScale/rightScale). У этой карточки нет своего хит-теста
    // (Жнец не участвует в drag-n-drop дропа кубика хода так же, как обычные
    // бегуны), поэтому измерение тут можно переключить на onLayout целиком,
    // без разделения на два потребителя, как в RunnerCard.js/AbilityZone.js.
    const [cardSize, setCardSize] = useState(null);

    const onLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setCardSize({ width, height });
    }, []);

    const onField = reaper.segment != null;

    return (
        <View ref={cardRef} onLayout={onLayout} style={[styles.card, { padding: cardPadding }]}>
            <PersonPanel size={cardSize} />
            {/* borderRadius — та же величина, что у PersonPanel.js#styles.wrap
                (тот же фикс "рамка острым углом поверх скруглённой дуги",
                что уже применён в RunnerCard.js/AbilityZone.js). */}
            {active && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.activeRing, { borderColor: color }]} />}
            {/* Мигание всей плитки, пока Жнец на поле — 2026-10-01, прямой
                запрос пользователя ("если жнец на поле, пусть панель жнеца
                мигает, а если он в руке, то пусть как обычно просто").
                PulseHighlight — тот же компонент, что уже "дышит" зелёным на
                зонах усилений/панели кубиков (см. её докстринг), borderRadius
                — тот же NOTCH_RADIUS, что и у activeRing выше (тот же фикс
                "рамка острым углом поверх скруглённой дуги корпуса"). НЕ
                гейтится `active` (чей сейчас ход) — это отдельный, всегда
                видимый статус-сигнал "Жнец физически на поле", а не "сейчас
                мой выбор", оба индикатора могут быть включены одновременно. */}
            <PulseHighlight active={onField} borderRadius={NOTCH_RADIUS} showBorder showBackground />

            {/* Текст "В руке"/"На поле" убран целиком — 2026-10-01, прямой
                запрос пользователя ("убери текст из панели жнеца, а
                аватарку отцентрируй"), тем же заходом, что и сузил плитку
                до ширины одной карточки бегуна (см. reaperCardWidth в
                PlayerInfoPanel.js) — статус "на поле" теперь читается через
                мигание (PulseHighlight выше), отдельный текст стал не нужен
                и физически не помещался бы в заметно более узкой плитке.
                `styles.row` заменена на центрирование одного avatarBox —
                раньше это был flex-ряд из двух элементов (аватар+текст),
                теперь единственный ребёнок центрируется по обеим осям. */}
            <View style={styles.row}>
                <View style={[styles.avatarBox, sizeScale !== 1 && { width: avatarSize, height: avatarSize }]}>
                    {/* targetCornerSize — 6 у СТАРОГО 32px аватара (половина
                        дефолта FramePanel, 12 — держит толщину декоративной
                        дуги ПРОПОРЦИОНАЛЬНОЙ боксу, та же пропорция, что и у
                        RunnerCard.js — 12px на 64px), теперь `cornerSize`
                        масштабируется вместе с sizeScale (см. её докстринг
                        выше), сохраняя ту же пропорцию при любом размере
                        аватара. */}
                    <FramePanel
                        size={avatarFrameSize}
                        targetCornerSize={cornerSize}
                        backgroundSource={FRAME_PANEL_BACKGROUND}
                        backgroundCornerSource={FRAME_PANEL_BACKGROUND_CORNER}
                        backgroundTileSize={60}
                    />
                    <RunnerToken
                        type={RUNNER_TYPES.REAPER}
                        status={reaper.status}
                        avatar
                        color={color}
                        size={avatarSize}
                        imageScale={0.85}
                        selected={active}
                        showRing={false}
                    />
                </View>
            </View>
        </View>
    );
}

export default React.memo(ReaperCard);

const styles = StyleSheet.create({
    // width:'100%' — заполняет свою обёртку в общем ряду с RoadBonusPanel
    // (см. PlayerInfoPanel#reaperNode, `reaperCardWrap` там). padding —
    // задаётся ИНЛАЙН (`cardPadding`, см. её докстринг у места объявления) —
    // базовое значение тут (`spacing.xs`) используется только пока
    // sizeScale===1 (нет проп-инстанса — практически недостижимо, единственный
    // вызов всегда передаёт sizeScale), оставлено как безопасный дефолт.
    // height:'100%' (2026-10-01, "сопряжение по высоте", прямой запрос
    // пользователя) — `reaperCardWrap` теперь передаёт ЯВНУЮ высоту, равную
    // высоте соседней RoadBonusPanel (`roadBonusPanelHeight()`, см.
    // PlayerInfoPanel.js), а не полагается на неявный row-stretch (та же
    // ненадёжность на RN Web, что уже нашлась и была исправлена для
    // leftColumn) — эта карточка должна ЗАПОЛНИТЬ явно заданную обёртку, не
    // остаться на своей меньшей натуральной высоте. Внутренний ряд
    // (`styles.row` — `alignItems:'center'`) сам центрирует аватар+текст в
    // получившемся, теперь чуть более высоком боксе.
    // marginBottom переехал на сам ряд (`reaperRow` в PlayerInfoPanel.js).
    card: { width: '100%', height: '100%', padding: spacing.xs },
    // borderRadius — та же величина, что у PersonPanel.js#styles.wrap
    // (NOTCH_RADIUS, тот же фикс, что и в RunnerCard.js#activeRing, 2026-09-26).
    activeRing: { borderWidth: 3, borderRadius: NOTCH_RADIUS },
    // height:'100%' (2026-10-01, по прямому запросу пользователя) — та же
    // причина, что и у `card` выше: без явного числа `row` полагался бы на
    // неявный stretch от `card` (default alignItems), чтобы дотянуться до
    // полной высоты — та же категория ненадёжности на RN Web, что уже
    // нашлась для leftColumn/reaperCardWrap. `justifyContent:'center'` (было
    // 'flex-start'-по-умолчанию, т.к. `flexDirection:'row'` раньше держал
    // ДВА элемента — аватар+текст, см. историю) — 2026-10-01, тот же заход,
    // что убрал текст целиком ("убери текст из панели жнеца, а аватарку
    // отцентрируй"): единственный оставшийся ребёнок (avatarBox) теперь
    // центрируется по ОБЕИМ осям в уже узкой (ширина одной карточки бегуна)
    // плитке, а не жмётся к левому краю, как было нужно для соседства с
    // текстом.
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%' },
    avatarBox: { width: AVATAR_SIZE, height: AVATAR_SIZE, alignItems: 'center', justifyContent: 'flex-end' },
});
