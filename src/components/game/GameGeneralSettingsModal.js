// src/components/game/GameGeneralSettingsModal.js
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../ui/Button';
import { colors, spacing, font, radius } from '../../theme';
import { DIALOG_ORIENTATION, setDialogOrientation } from '../../lib/dialogSettings';
import { useDialogOrientation } from '../../hooks/useDialogOrientation';
import { LOCALES } from '../../lib/i18n';
import { useI18n } from '../../hooks/useI18n';

const ORIENTATION_OPTIONS = [DIALOG_ORIENTATION.LEFT, DIALOG_ORIENTATION.RIGHT];
const LANGUAGE_OPTIONS = [LOCALES.RU, LOCALES.EN];

/**
 * 2026-10-15, по прямому запросу пользователя — раздел "Игра" настроек
 * (см. GameSettingsHubModal.js). "Ориентация диалога" (к какой грани экрана
 * прибита ручка сворачиваемой модалки, GameDialogModal.js) — выпадающий
 * список из 2 вариантов.
 *
 * 2026-10-26, по прямому запросу пользователя — второй такой же
 * переключатель, "Язык" (lib/i18n.js), тем же дискретным dropdown-приёмом:
 * применяется и пишется в storage СРАЗУ по выбору, без общего шага
 * "Сохранить" с остальными настройками этого экрана (у ориентации диалога
 * уже было так же, см. ниже) — язык полностью независим от неё, просто
 * второй дискретный переключатель в том же разделе.
 *
 * Названия языков в своих пунктах (`Русский`/`English`, settings.general.
 * languageRu/languageEn) — идут через t(), как и всё остальное, но ЗНАЧЕНИЕ
 * этих двух ключей ОДИНАКОВОЕ в обоих словарях (ru.js/en.js) — название
 * языка всегда на родном языке независимо от текущей локали UI, иначе
 * пользователь, переключивший язык по ошибке, не нашёл бы обратный пункт.
 *
 * Свой мини-dropdown (нет готового select-компонента в проекте, см.
 * components/ui/) — тап по текущему значению разворачивает список НИЖЕ
 * (inline, не floating-попап — при 2 опциях всегда помещается), оба
 * переключателя делят один и тот же набор стилей (`selectBox`/
 * `optionsList`/...), но у каждого свой локальный `optionsOpen`-стейт —
 * разворачивать оба списка одновременно смысла нет, но и взаимно
 * закрывать друг друга при открытии другого не требовалось.
 */
export default function GameGeneralSettingsModal({ visible, onClose }) {
    const { t, locale, setLocale } = useI18n();
    const orientation = useDialogOrientation();
    const [orientationOptionsOpen, setOrientationOptionsOpen] = useState(false);
    const [languageOptionsOpen, setLanguageOptionsOpen] = useState(false);

    if (!visible) return null;

    const ORIENTATION_LABELS = {
        [DIALOG_ORIENTATION.LEFT]: t('settings.general.orientationLeft'),
        [DIALOG_ORIENTATION.RIGHT]: t('settings.general.orientationRight'),
    };
    const LANGUAGE_LABELS = {
        [LOCALES.RU]: t('settings.general.languageRu'),
        [LOCALES.EN]: t('settings.general.languageEn'),
    };

    const handleClose = () => {
        setOrientationOptionsOpen(false);
        setLanguageOptionsOpen(false);
        onClose();
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <Text style={styles.title} noGlobalTint>{t('settings.general.title')}</Text>

                    <View style={[styles.row, orientationOptionsOpen && styles.rowOpen]}>
                        <Text style={styles.label} noGlobalTint>{t('settings.general.dialogOrientationLabel')}</Text>
                        <TouchableOpacity
                            style={styles.selectBox}
                            onPress={() => setOrientationOptionsOpen((v) => !v)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.selectValue} noGlobalTint>{ORIENTATION_LABELS[orientation]}</Text>
                            <Text style={styles.chevron} noGlobalTint>{orientationOptionsOpen ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {orientationOptionsOpen && (
                            <View style={styles.optionsList}>
                                {ORIENTATION_OPTIONS.map((opt) => (
                                    <TouchableOpacity
                                        key={opt}
                                        style={[styles.option, opt === orientation && styles.optionActive]}
                                        onPress={() => {
                                            setDialogOrientation(opt);
                                            setOrientationOptionsOpen(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.optionText} noGlobalTint>{ORIENTATION_LABELS[opt]}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    <View style={[styles.row, languageOptionsOpen && styles.rowOpen]}>
                        <Text style={styles.label} noGlobalTint>{t('settings.general.languageLabel')}</Text>
                        <TouchableOpacity
                            style={styles.selectBox}
                            onPress={() => setLanguageOptionsOpen((v) => !v)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.selectValue} noGlobalTint>{LANGUAGE_LABELS[locale]}</Text>
                            <Text style={styles.chevron} noGlobalTint>{languageOptionsOpen ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {languageOptionsOpen && (
                            <View style={styles.optionsList}>
                                {LANGUAGE_OPTIONS.map((opt) => (
                                    <TouchableOpacity
                                        key={opt}
                                        style={[styles.option, opt === locale && styles.optionActive]}
                                        onPress={() => {
                                            setLocale(opt);
                                            setLanguageOptionsOpen(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.optionText} noGlobalTint>{LANGUAGE_LABELS[opt]}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    <Button title={t('common.back')} variant="muted" onPress={handleClose} style={styles.btn} />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
    },
    sheet: {
        width: '100%', maxWidth: 360,
        backgroundColor: colors.bgLight,
        borderRadius: radius.xl, padding: spacing.lg,
    },
    title: {
        fontSize: font.h2, fontWeight: 'bold', color: colors.textOnDark,
        marginBottom: spacing.lg, textAlign: 'center',
    },
    // position:'relative' — якорь для абсолютно спозиционированного
    // optionsList ниже (2026-10-26, живая жалоба: модалка раздувалась по
    // размеру раскрытого списка). rowOpen (zIndex) — применяется только на
    // РАСКРЫТОМ ряду: без явного zIndex более поздний сосед (второй ряд/
    // кнопка "Назад") рисуется поверх floating-списка первого ряда — тот же
    // класс грабель, что уже задокументирован в CLAUDE.md ("Android
    // сортирует ВСЕХ соседей по zIndex, как только хоть один его объявил").
    row: { marginBottom: spacing.lg, position: 'relative' },
    rowOpen: { zIndex: 20 },
    label: { fontSize: font.body, color: colors.textOnDark, marginBottom: spacing.xs },
    selectBox: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.inputBg, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.inputBorder,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    },
    selectValue: { fontSize: font.body, color: colors.textOnDark },
    chevron: { fontSize: font.small, color: colors.textOnDarkSecondary },
    // position:'absolute' (2026-10-26) — список вариантов плавает ПОВЕРХ
    // контента под ним, не раздвигает layout (раньше был обычным block-
    // потомком row, и modal#sheet растягивался на его высоту). top:'100%' —
    // сразу под selectBox, независимо от его реальной высоты.
    optionsList: {
        position: 'absolute', top: '100%', left: 0, right: 0,
        marginTop: spacing.xs,
        borderRadius: radius.md,
        overflow: 'hidden',
        borderWidth: 1, borderColor: colors.inputBorder,
    },
    option: {
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
        backgroundColor: colors.inputBgAlt,
    },
    optionActive: { backgroundColor: colors.primaryTranslucent },
    optionText: { fontSize: font.body, color: colors.textOnDark },
    btn: { marginTop: spacing.sm },
});
