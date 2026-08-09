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