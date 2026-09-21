// src/screens/__SpriteSheetPreview.js — ВРЕМЕННЫЙ экран-прототип для живого
// сравнения (см. CLAUDE.md, 2026-09-20). Не часть игры — просто витрина.
// Удалить вместе с кнопкой-входом в GameBoardScreen.js, когда сравнение
// больше не нужно.
//
// 2026-09-20 (второй заход): переписан под ТЕКУЩУЮ, боевую версию
// SpriteSheetAnimation.js (sheetWidth/sheetHeight/boxSize/clips с rowY на
// клип) и РЕАЛЬНЫЕ production-данные из constants/scoutSpriteSheets.js —
// прошлая версия ссылалась на устаревшую (single-row) форму API компонента
// и на отдельный старый файл-заготовку (scout_combined_green_sheet.png),
// из-за чего боевой компонент рендерил boxSize=undefined и рисовал пустоту
// (см. SPRITEDBG-лог). Теперь сравниваем ИМЕННО то, что реально стоит на
// доске у RunnerToken (та же SCOUT_SPRITE_SHEETS, та же getScoutSpriteRef).
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// 2026-09-21: Skia-эксперимент (RunnerToken.js#isScoutSprite) откачен и
// удалён целиком (новые баги перевесили пользу, см. CLAUDE.md) — снова
// боевой RN Image+Animated рендерер.
import SpriteSheetAnimation from '../components/ui/SpriteSheetAnimation';
import { SCOUT_SPRITE_SHEETS } from '../constants/scoutSpriteSheets';
import { useBoardLayout } from '../hooks/useBoardLayout';

const CLIP_NAMES = ['idle', 'start', 'move_north', 'attack_north', 'collision_east', 'fly', 'destroyed'];
const SIZE_PRESETS = [
    { label: 'как на доске', mult: 1 },
    { label: '×2', mult: 2 },
    { label: '×4', mult: 4 },
];

export default function SpriteSheetPreview({ navigation }) {
    const [activeClip, setActiveClip] = useState('idle');
    const [sizeMult, setSizeMult] = useState(1);

    // Та же формула, что и на реальной доске (BoardGrid.js) — чтобы boxSize
    // тут совпадал с тем, что реально видит игрок на этом самом устройстве.
    const { segmentW, segmentH } = useBoardLayout();
    const tokenSize = Math.floor(Math.min(segmentW, segmentH) * 0.82);
    const BOARD_TOKEN_IMAGE_SCALE = 1.18 * 1.3 * 1.15;
    const boardBoxSize = tokenSize * BOARD_TOKEN_IMAGE_SCALE;
    const boxSize = boardBoxSize * sizeMult;

    const bucket = SCOUT_SPRITE_SHEETS.healthy.green;

    return (
        <View style={styles.wrap}>
            <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
                <Text style={styles.backText}>← Назад в игру</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Спрайт-лист скаута (боевые данные)</Text>
            <Text style={styles.subtitle}>Клип: {activeClip} · boxSize≈{Math.round(boxSize)}dp (доска: {Math.round(boardBoxSize)}dp)</Text>

            <View style={styles.cell}>
                <SpriteSheetAnimation
                    source={bucket.source}
                    sheetWidth={bucket.sheetWidth}
                    sheetHeight={bucket.sheetHeight}
                    clips={bucket.clips}
                    activeClip={activeClip}
                    boxSize={boxSize}
                />
            </View>

            <View style={styles.btnRow}>
                {CLIP_NAMES.map((name) => (
                    <TouchableOpacity
                        key={name}
                        style={[styles.btn, activeClip === name && styles.btnActive]}
                        onPress={() => setActiveClip(name)}
                    >
                        <Text style={styles.btnText}>{name}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.btnRow}>
                {SIZE_PRESETS.map((p) => (
                    <TouchableOpacity
                        key={p.label}
                        style={[styles.btn, sizeMult === p.mult && styles.btnActive]}
                        onPress={() => setSizeMult(p.mult)}
                    >
                        <Text style={styles.btnText}>{p.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: '#2c3e50', padding: 24, alignItems: 'center', paddingTop: 60 },
    back: { position: 'absolute', top: 16, left: 16, padding: 8 },
    backText: { color: '#2abcbd', fontSize: 14 },
    title: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
    subtitle: { color: '#bdc3c7', fontSize: 13, marginBottom: 16, textAlign: 'center' },
    cell: { alignItems: 'center', justifyContent: 'center', minHeight: 260, backgroundColor: '#00000055', padding: 16, borderRadius: 8, width: '100%' },
    btnRow: { flexDirection: 'row', gap: 12, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
    btn: { backgroundColor: '#34495e', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
    btnActive: { backgroundColor: '#2abcbd' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
