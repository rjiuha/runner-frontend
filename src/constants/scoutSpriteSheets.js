// src/constants/scoutSpriteSheets.js
// Автосгенерировано pack_scout_sheets.js (scratch-скрипт сессии, не в репозитории) —
// при добавлении/изменении анимаций скаута перегенерировать заново по тому же
// рецепту (см. докстринг SpriteSheetAnimation.js): построчная упаковка, один клип —
// один ряд, родной пиксельный размер каждого клипа без изменений.
import { RUNNER_STATUS } from './GameConstants';
import { resolveMoveAssetDirection } from './runnerAnimations';

const scoutHealthyRedSheet = require('../assets/images/runners/scout/healthy/spritesheets/scout_healthy_red_sheet.png');
const scoutHealthyBlueSheet = require('../assets/images/runners/scout/healthy/spritesheets/scout_healthy_blue_sheet.png');
const scoutHealthyGreenSheet = require('../assets/images/runners/scout/healthy/spritesheets/scout_healthy_green_sheet.png');
const scoutHealthyYellowSheet = require('../assets/images/runners/scout/healthy/spritesheets/scout_healthy_yellow_sheet.png');
const scoutDamagedRedSheet = require('../assets/images/runners/scout/healthy/spritesheets/scout_damaged_red_sheet.png');
const scoutDamagedBlueSheet = require('../assets/images/runners/scout/healthy/spritesheets/scout_damaged_blue_sheet.png');
const scoutDamagedGreenSheet = require('../assets/images/runners/scout/healthy/spritesheets/scout_damaged_green_sheet.png');
const scoutDamagedYellowSheet = require('../assets/images/runners/scout/healthy/spritesheets/scout_damaged_yellow_sheet.png');

export const SCOUT_SPRITE_SHEETS = {
  healthy: {
    red: {
      source: scoutHealthyRedSheet,
      sheetWidth: 2548,
      sheetHeight: 3452,
      clips: {
        idle: { frameWidth: 216, frameHeight: 216, frameCount: 8, rowY: 0, delaysMs: [200,200,200,200,200,200,200,200] },
        move_north: { frameWidth: 216, frameHeight: 216, frameCount: 11, rowY: 216, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 432, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 636, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_east: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 840, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_west: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 1028, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north: { frameWidth: 188, frameHeight: 224, frameCount: 13, rowY: 1216, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_east: { frameWidth: 180, frameHeight: 204, frameCount: 13, rowY: 1440, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_west: { frameWidth: 180, frameHeight: 204, frameCount: 13, rowY: 1644, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        collision_east: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 1848, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_west: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 2044, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        // scaleCorrection (2026-09-21, живая жалоба "start чуть больше idle") —
        // персонаж на арте start занимает ~76.5% высоты своей канвы (168×168),
        // а на idle — ~59.1% высоты своей (216×216); "contain"-масштаб по
        // размеру канвы (см. SpriteSheetAnimation.js) не учитывает эту разницу — start выходил на экран заметно крупнее.
        // Измерено численно (bbox непрозрачных пикселей по всем 11 кадрам,
        // канал альфа>10), не на глаз: idle_avgFracH/start_avgFracH ≈ 0.7725.
        // Тот же клип у остальных 3 цветов — то же самое расхождение (силуэт
        // не зависит от перекраски), поэтому одна константа на все цвета.
        start: { frameWidth: 168, frameHeight: 168, frameCount: 11, rowY: 2240, delaysMs: [200,200,200,200,200,200,200,200,200,200,200], scaleCorrection: 0.7725 },
        fly: { frameWidth: 216, frameHeight: 216, frameCount: 11, rowY: 2408, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        got_shot: { frameWidth: 168, frameHeight: 220, frameCount: 11, rowY: 2624, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        destroyed: { frameWidth: 216, frameHeight: 216, frameCount: 9, rowY: 2844, delaysMs: [200,200,200,200,200,200,200,200,200] },
        acid: { frameWidth: 196, frameHeight: 196, frameCount: 13, rowY: 3060, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        burn: { frameWidth: 196, frameHeight: 196, frameCount: 13, rowY: 3256, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
      },
    },
    blue: {
      source: scoutHealthyBlueSheet,
      sheetWidth: 2548,
      sheetHeight: 3452,
      clips: {
        idle: { frameWidth: 216, frameHeight: 216, frameCount: 8, rowY: 0, delaysMs: [200,200,200,200,200,200,200,200] },
        move_north: { frameWidth: 216, frameHeight: 216, frameCount: 11, rowY: 216, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 432, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 636, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_east: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 840, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_west: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 1028, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north: { frameWidth: 188, frameHeight: 224, frameCount: 13, rowY: 1216, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_east: { frameWidth: 180, frameHeight: 204, frameCount: 13, rowY: 1440, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_west: { frameWidth: 180, frameHeight: 204, frameCount: 13, rowY: 1644, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        collision_east: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 1848, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_west: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 2044, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        // scaleCorrection (2026-09-21, живая жалоба "start чуть больше idle") —
        // персонаж на арте start занимает ~76.5% высоты своей канвы (168×168),
        // а на idle — ~59.1% высоты своей (216×216); "contain"-масштаб по
        // размеру канвы (см. SpriteSheetAnimation.js) не учитывает эту разницу — start выходил на экран заметно крупнее.
        // Измерено численно (bbox непрозрачных пикселей по всем 11 кадрам,
        // канал альфа>10), не на глаз: idle_avgFracH/start_avgFracH ≈ 0.7725.
        // Тот же клип у остальных 3 цветов — то же самое расхождение (силуэт
        // не зависит от перекраски), поэтому одна константа на все цвета.
        start: { frameWidth: 168, frameHeight: 168, frameCount: 11, rowY: 2240, delaysMs: [200,200,200,200,200,200,200,200,200,200,200], scaleCorrection: 0.7725 },
        fly: { frameWidth: 216, frameHeight: 216, frameCount: 11, rowY: 2408, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        got_shot: { frameWidth: 168, frameHeight: 220, frameCount: 11, rowY: 2624, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        destroyed: { frameWidth: 216, frameHeight: 216, frameCount: 9, rowY: 2844, delaysMs: [200,200,200,200,200,200,200,200,200] },
        acid: { frameWidth: 196, frameHeight: 196, frameCount: 13, rowY: 3060, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        burn: { frameWidth: 196, frameHeight: 196, frameCount: 13, rowY: 3256, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
      },
    },
    green: {
      source: scoutHealthyGreenSheet,
      sheetWidth: 2548,
      sheetHeight: 3452,
      clips: {
        idle: { frameWidth: 216, frameHeight: 216, frameCount: 8, rowY: 0, delaysMs: [200,200,200,200,200,200,200,200] },
        move_north: { frameWidth: 216, frameHeight: 216, frameCount: 11, rowY: 216, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 432, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 636, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_east: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 840, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_west: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 1028, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north: { frameWidth: 188, frameHeight: 224, frameCount: 13, rowY: 1216, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_east: { frameWidth: 180, frameHeight: 204, frameCount: 13, rowY: 1440, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_west: { frameWidth: 180, frameHeight: 204, frameCount: 13, rowY: 1644, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        collision_east: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 1848, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_west: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 2044, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        // scaleCorrection (2026-09-21, живая жалоба "start чуть больше idle") —
        // персонаж на арте start занимает ~76.5% высоты своей канвы (168×168),
        // а на idle — ~59.1% высоты своей (216×216); "contain"-масштаб по
        // размеру канвы (см. SpriteSheetAnimation.js) не учитывает эту разницу — start выходил на экран заметно крупнее.
        // Измерено численно (bbox непрозрачных пикселей по всем 11 кадрам,
        // канал альфа>10), не на глаз: idle_avgFracH/start_avgFracH ≈ 0.7725.
        // Тот же клип у остальных 3 цветов — то же самое расхождение (силуэт
        // не зависит от перекраски), поэтому одна константа на все цвета.
        start: { frameWidth: 168, frameHeight: 168, frameCount: 11, rowY: 2240, delaysMs: [200,200,200,200,200,200,200,200,200,200,200], scaleCorrection: 0.7725 },
        fly: { frameWidth: 216, frameHeight: 216, frameCount: 11, rowY: 2408, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        got_shot: { frameWidth: 168, frameHeight: 220, frameCount: 11, rowY: 2624, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        destroyed: { frameWidth: 216, frameHeight: 216, frameCount: 9, rowY: 2844, delaysMs: [200,200,200,200,200,200,200,200,200] },
        acid: { frameWidth: 196, frameHeight: 196, frameCount: 13, rowY: 3060, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        burn: { frameWidth: 196, frameHeight: 196, frameCount: 13, rowY: 3256, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
      },
    },
    yellow: {
      source: scoutHealthyYellowSheet,
      sheetWidth: 2548,
      sheetHeight: 3452,
      clips: {
        idle: { frameWidth: 216, frameHeight: 216, frameCount: 8, rowY: 0, delaysMs: [200,200,200,200,200,200,200,200] },
        move_north: { frameWidth: 216, frameHeight: 216, frameCount: 11, rowY: 216, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 432, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 636, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_east: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 840, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_west: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 1028, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north: { frameWidth: 188, frameHeight: 224, frameCount: 13, rowY: 1216, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_east: { frameWidth: 180, frameHeight: 204, frameCount: 13, rowY: 1440, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_west: { frameWidth: 180, frameHeight: 204, frameCount: 13, rowY: 1644, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        collision_east: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 1848, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_west: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 2044, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        // scaleCorrection (2026-09-21, живая жалоба "start чуть больше idle") —
        // персонаж на арте start занимает ~76.5% высоты своей канвы (168×168),
        // а на idle — ~59.1% высоты своей (216×216); "contain"-масштаб по
        // размеру канвы (см. SpriteSheetAnimation.js) не учитывает эту разницу — start выходил на экран заметно крупнее.
        // Измерено численно (bbox непрозрачных пикселей по всем 11 кадрам,
        // канал альфа>10), не на глаз: idle_avgFracH/start_avgFracH ≈ 0.7725.
        // Тот же клип у остальных 3 цветов — то же самое расхождение (силуэт
        // не зависит от перекраски), поэтому одна константа на все цвета.
        start: { frameWidth: 168, frameHeight: 168, frameCount: 11, rowY: 2240, delaysMs: [200,200,200,200,200,200,200,200,200,200,200], scaleCorrection: 0.7725 },
        fly: { frameWidth: 216, frameHeight: 216, frameCount: 11, rowY: 2408, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        got_shot: { frameWidth: 168, frameHeight: 220, frameCount: 11, rowY: 2624, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        destroyed: { frameWidth: 216, frameHeight: 216, frameCount: 9, rowY: 2844, delaysMs: [200,200,200,200,200,200,200,200,200] },
        acid: { frameWidth: 196, frameHeight: 196, frameCount: 13, rowY: 3060, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
        burn: { frameWidth: 196, frameHeight: 196, frameCount: 13, rowY: 3256, delaysMs: [200,200,200,200,200,200,200,200,200,200,200,200,200] },
      },
    },
  },
  damaged: {
    red: {
      source: scoutDamagedRedSheet,
      sheetWidth: 2332,
      sheetHeight: 3280,
      clips: {
        idle: { frameWidth: 212, frameHeight: 212, frameCount: 8, rowY: 0, delaysMs: [200,200,200,200,200,200,200,200] },
        move_north: { frameWidth: 212, frameHeight: 212, frameCount: 11, rowY: 212, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 424, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 628, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_east: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 832, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_west: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 1020, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north: { frameWidth: 212, frameHeight: 212, frameCount: 11, rowY: 1208, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 1420, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 1624, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_east: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 1828, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_west: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 2024, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        fly: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2220, delaysMs: [200,200,200,200,200,200,200,200,200] },
        got_shot: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2432, delaysMs: [200,200,200,200,200,200,200,200,200] },
        destroyed: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2644, delaysMs: [200,200,200,200,200,200,200,200,200] },
        heal: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2856, delaysMs: [200,200,200,200,200,200,200,200,200] },
        broken: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 3068, delaysMs: [200,200,200,200,200,200,200,200,200] },
      },
    },
    blue: {
      source: scoutDamagedBlueSheet,
      sheetWidth: 2332,
      sheetHeight: 3280,
      clips: {
        idle: { frameWidth: 212, frameHeight: 212, frameCount: 8, rowY: 0, delaysMs: [200,200,200,200,200,200,200,200] },
        move_north: { frameWidth: 212, frameHeight: 212, frameCount: 11, rowY: 212, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 424, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 628, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_east: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 832, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_west: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 1020, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north: { frameWidth: 212, frameHeight: 212, frameCount: 11, rowY: 1208, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 1420, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 1624, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_east: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 1828, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_west: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 2024, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        fly: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2220, delaysMs: [200,200,200,200,200,200,200,200,200] },
        got_shot: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2432, delaysMs: [200,200,200,200,200,200,200,200,200] },
        destroyed: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2644, delaysMs: [200,200,200,200,200,200,200,200,200] },
        heal: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2856, delaysMs: [200,200,200,200,200,200,200,200,200] },
        broken: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 3068, delaysMs: [200,200,200,200,200,200,200,200,200] },
      },
    },
    green: {
      source: scoutDamagedGreenSheet,
      sheetWidth: 2332,
      sheetHeight: 3280,
      clips: {
        idle: { frameWidth: 212, frameHeight: 212, frameCount: 8, rowY: 0, delaysMs: [200,200,200,200,200,200,200,200] },
        move_north: { frameWidth: 212, frameHeight: 212, frameCount: 11, rowY: 212, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 424, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 628, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_east: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 832, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_west: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 1020, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north: { frameWidth: 212, frameHeight: 212, frameCount: 11, rowY: 1208, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 1420, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 1624, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_east: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 1828, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_west: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 2024, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        fly: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2220, delaysMs: [200,200,200,200,200,200,200,200,200] },
        got_shot: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2432, delaysMs: [200,200,200,200,200,200,200,200,200] },
        destroyed: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2644, delaysMs: [200,200,200,200,200,200,200,200,200] },
        heal: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2856, delaysMs: [200,200,200,200,200,200,200,200,200] },
        broken: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 3068, delaysMs: [200,200,200,200,200,200,200,200,200] },
      },
    },
    yellow: {
      source: scoutDamagedYellowSheet,
      sheetWidth: 2332,
      sheetHeight: 3280,
      clips: {
        idle: { frameWidth: 212, frameHeight: 212, frameCount: 8, rowY: 0, delaysMs: [200,200,200,200,200,200,200,200] },
        move_north: { frameWidth: 212, frameHeight: 212, frameCount: 11, rowY: 212, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 424, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 628, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_east: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 832, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        move_south_west: { frameWidth: 188, frameHeight: 188, frameCount: 11, rowY: 1020, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north: { frameWidth: 212, frameHeight: 212, frameCount: 11, rowY: 1208, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_east: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 1420, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        attack_north_west: { frameWidth: 204, frameHeight: 204, frameCount: 11, rowY: 1624, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_east: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 1828, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        collision_west: { frameWidth: 196, frameHeight: 196, frameCount: 11, rowY: 2024, delaysMs: [200,200,200,200,200,200,200,200,200,200,200] },
        fly: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2220, delaysMs: [200,200,200,200,200,200,200,200,200] },
        got_shot: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2432, delaysMs: [200,200,200,200,200,200,200,200,200] },
        destroyed: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2644, delaysMs: [200,200,200,200,200,200,200,200,200] },
        heal: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 2856, delaysMs: [200,200,200,200,200,200,200,200,200] },
        broken: { frameWidth: 212, frameHeight: 212, frameCount: 9, rowY: 3068, delaysMs: [200,200,200,200,200,200,200,200,200] },
      },
    },
  },
};

function camelToSnake(key) {
    return key.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
}

/**
 * Зеркалит getRunnerAnimationImage (runnerAnimations.js) но возвращает
 * {statusFolder, clipName} — ключи в SCOUT_SPRITE_SHEETS — вместо
 * require()-ассета. ТОЛЬКО для Скаута (RUNNER_TYPES.SPRINTER), вызывается из
 * RunnerToken.js только при type===SPRINTER. Логика ветвления (destroyed
 * берёт набор fromStatus, heal — всегда из damaged, acid/burn — всегда из
 * healthy) — та же, что и у gif-пути, скопирована намеренно 1-в-1, чтобы обе
 * ветки (gif для остальных типов, спрайт-лист для скаута) вели себя
 * одинаково для одного и того же `anim`.
 */
export function getScoutSpriteRef(status, anim) {
    const currentFolder = status === RUNNER_STATUS.HEALTHY ? 'healthy' : 'damaged';

    if (anim?.kind === 'destroyed') {
        const fromFolder = (anim.fromStatus ?? status) === RUNNER_STATUS.HEALTHY ? 'healthy' : 'damaged';
        return { statusFolder: fromFolder, clipName: 'destroyed' };
    }
    if (anim?.kind === 'heal') {
        return { statusFolder: 'damaged', clipName: 'heal' };
    }
    if (anim?.kind === 'burn' || anim?.kind === 'acid') {
        return { statusFolder: 'healthy', clipName: anim.kind };
    }

    if (!anim || anim.kind === 'idle') {
        if (status === RUNNER_STATUS.BROKEN) return { statusFolder: 'damaged', clipName: 'broken' };
        if (status === RUNNER_STATUS.DESTROYED) return { statusFolder: 'damaged', clipName: 'destroyed' };
        return { statusFolder: currentFolder, clipName: 'idle' };
    }
    if (anim.kind === 'move') {
        const dirKey = resolveMoveAssetDirection(anim.direction, anim.depthChanged, anim.targetLaneShifted);
        return { statusFolder: currentFolder, clipName: `move_${camelToSnake(dirKey)}` };
    }
    if (anim.kind === 'attack') {
        const dirKey = resolveMoveAssetDirection(anim.direction, anim.depthChanged, anim.targetLaneShifted);
        return { statusFolder: currentFolder, clipName: `attack_${camelToSnake(dirKey)}` };
    }
    if (anim.kind === 'fly') return { statusFolder: currentFolder, clipName: 'fly' };
    if (anim.kind === 'gotShot') return { statusFolder: currentFolder, clipName: 'got_shot' };
    if (anim.kind === 'collision') return { statusFolder: currentFolder, clipName: `collision_${anim.side}` };
    if (anim.kind === 'start') return { statusFolder: 'healthy', clipName: 'start' };
    return { statusFolder: currentFolder, clipName: 'idle' };
}
