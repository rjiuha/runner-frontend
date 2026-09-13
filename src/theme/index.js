// src/theme/index.js

/**
 * Единственный источник цветов и отступов.
 * Смысл: перекрасить приложение = поправить один файл, а не искать
 * #2c3e50 по двадцати экранам.
 */
export const colors = {
    bg: '#2c3e50',
    bgLight: '#34495e',
    surface: '#ecf0f1',
    card: '#ffffff',

    primary: '#6e34db',
    primaryTranslucent: '#6e34dbb8',

    danger: '#e74c3c',
    info: '#3498db',
    success: '#2ecc71',
    warning: '#f39c12',
    muted: '#95a5a6',

    text: '#2c3e50',
    textOnDark: '#ffffff',
    textSecondary: '#7f8c8d',
    textOnDarkSecondary: '#bdc3c7',

    border: '#bdc3c7',
    inputBg: '#918f8f9f',
    inputBgAlt: '#6261619f',
    inputBorder: '#848383',

    // Цвет неоновых полосок на спрайтах бегунов (2026-09-13) — снят напрямую
    // с пикселей ассетов (assets/images/runners/scout/healthy/
    // scout_healthy_idle_red.gif, усреднение по пикселям, попавшим под тот же
    // HSL-порог, что и в скрипте реверс-маскинга бегунов — hue 150-255°,
    // saturation≥20%, lightness 35-96%, см. CLAUDE.md 2026-09-02), не
    // выдуман — по прямому запросу пользователя "цвет текста в цвет полосок
    // персонажей, в cyan".
    neonCyan: '#2abcbd',

    // Тёмная полупрозрачная "плашка" под текстом поверх busy-фона (звёздное
    // небо ParallaxBackground) — 2026-09-13, по прямому запросу пользователя:
    // спиннер+LoadingTip читались плохо прямо на фоне со звёздами. Та же
    // alpha (0.6), что уже использует backdrop модалки (CreateLobbyModal) —
    // не выдумываю новое значение непрозрачности.
    overlayPlate: 'rgba(10, 14, 20, 0.6)',
};

export const spacing = { xs: 4, sm: 8, md: 15, lg: 20, xl: 30, xxl: 40 };
export const radius = { sm: 4, md: 8, lg: 12, xl: 15, pill: 999 };

export const font = {
    h1: 32,
    h2: 24,
    h3: 20,
    body: 16,
    small: 14,
    tiny: 12,
};

// Кастомный шрифт (src/assets/fonts/spaceranger-rus.otf, добавлен пользователем,
// 2026-09-13) — регистрируется в App.js через expo-font (useFonts), ключ
// 'SpaceRanger' там ЖЁСТКО совпадает с этой константой. Применяется ГЛОБАЛЬНО
// через Text.defaultProps/TextInput.defaultProps (см. App.js) — эта константа
// не обязательна использовать напрямую в компонентах, но экспортирована на
// случай точечного переопределения (например, если где-то понадобится ЯВНО
// откатиться на системный шрифт).
export const fontFamily = 'SpaceRanger';

/** Тень одинаково на iOS/Android/web */
export const shadow = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
};