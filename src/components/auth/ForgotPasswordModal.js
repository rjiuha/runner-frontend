// src/components/auth/ForgotPasswordModal.js
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { authApi } from '../../api/auth';
import { useI18n } from '../../hooks/useI18n';
import { notify } from '../../lib/notify';
import { colors, spacing, font, radius } from '../../theme';

const CODE_RE = /^\d{6}$/;

/**
 * Восстановление пароля ДО входа (ссылка "Забыли пароль?" на AuthScreen) —
 * два шага: запросить код (`POST /api/password/forgot {login}`), затем
 * ввести код+новый пароль (`POST /api/password/reset`). Оба эндпоинта
 * публичные (не требуют токена, см. security.yaml на бэке, read-only).
 * Бэк отвечает {"result":"ok"} на forgot ВСЕГДА (даже если логина нет или
 * email не подтверждён) — по дизайну не раскрывает, кто зарегистрирован,
 * так что тут нет отдельной ветки "логин не найден", просто переходим
 * дальше ко вводу кода.
 */
export default function ForgotPasswordModal({ visible, onClose }) {
    const { t } = useI18n();
    const [step, setStep] = useState('request'); // 'request' | 'reset'
    const [login, setLogin] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);

    // Сброс формы при каждом новом открытии — пользователь не должен видеть
    // введённый вчера код при повторном открытии модалки.
    useEffect(() => {
        if (visible) {
            setStep('request');
            setLogin('');
            setCode('');
            setPassword('');
            setConfirm('');
            setErrors({});
        }
    }, [visible]);

    const handleClose = () => {
        if (busy) return;
        onClose();
    };

    const submitRequest = async () => {
        if (!login.trim()) {
            setErrors({ login: t('forgotPassword.errorEmptyLogin') });
            return;
        }
        setErrors({});
        setBusy(true);
        try {
            await authApi.forgotPassword(login);
            setStep('reset');
        } catch (e) {
            notify(t('forgotPassword.failRequestTitle'), e.userMessage ?? e.message);
        } finally {
            setBusy(false);
        }
    };

    const submitReset = async () => {
        const next = {};
        if (!CODE_RE.test(code.trim())) next.code = t('forgotPassword.errorCodeFormat');
        if (!password) next.password = t('forgotPassword.errorEmptyPassword');
        else if (password.length < 6) next.password = t('forgotPassword.errorPasswordMin');
        if (password !== confirm) next.confirm = t('forgotPassword.errorPasswordMismatch');

        setErrors(next);
        if (Object.keys(next).length) return;

        setBusy(true);
        try {
            await authApi.resetPassword(login, code, password);
            notify(t('forgotPassword.successTitle'), t('forgotPassword.successMessage'));
            onClose();
        } catch (e) {
            if (e.code === 'VERIFICATION_CODE_INVALID') {
                const attemptsLeft = e.payload?.error?.details?.attemptsLeft;
                setErrors({
                    code: attemptsLeft != null
                        ? t('forgotPassword.errorCodeInvalidAttempts', { attemptsLeft })
                        : t('forgotPassword.errorCodeInvalid'),
                });
            } else if (e.code === 'VERIFICATION_CODE_EXPIRED') {
                setErrors({ code: t('forgotPassword.errorCodeExpired') });
            } else {
                notify(t('forgotPassword.failResetTitle'), e.userMessage ?? e.message);
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <Text style={styles.title} noGlobalTint>{t('forgotPassword.title')}</Text>

                    {step === 'request' ? (
                        <>
                            <Text style={styles.hint} noGlobalTint>
                                {t('forgotPassword.requestHint')}
                            </Text>
                            <Input
                                placeholder={t('forgotPassword.placeholderLogin')}
                                value={login}
                                onChangeText={setLogin}
                                error={errors.login}
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="go"
                                onSubmitEditing={submitRequest}
                            />
                            <Button title={t('forgotPassword.submitRequest')} onPress={submitRequest} loading={busy} style={styles.submit} />
                        </>
                    ) : (
                        <>
                            <Text style={styles.hint} noGlobalTint>
                                {t('forgotPassword.resetHint')}
                            </Text>
                            <Input
                                placeholder={t('forgotPassword.placeholderCode')}
                                value={code}
                                onChangeText={setCode}
                                error={errors.code}
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                            <Input
                                placeholder={t('forgotPassword.placeholderPassword')}
                                value={password}
                                onChangeText={setPassword}
                                error={errors.password}
                                secondary
                                secureTextEntry
                                textContentType="newPassword"
                                autoComplete="password-new"
                            />
                            <Input
                                placeholder={t('forgotPassword.placeholderConfirm')}
                                value={confirm}
                                onChangeText={setConfirm}
                                error={errors.confirm}
                                secondary
                                secureTextEntry
                                autoComplete="password-new"
                                returnKeyType="go"
                                onSubmitEditing={submitReset}
                            />
                            <Button title={t('forgotPassword.submitReset')} onPress={submitReset} loading={busy} style={styles.submit} />
                        </>
                    )}

                    <Button title={t('common.cancel')} variant="muted" onPress={handleClose} disabled={busy} style={styles.cancel} />
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
    title: { fontSize: font.h2, fontWeight: 'bold', color: colors.textOnDark, marginBottom: spacing.md },
    hint: { fontSize: font.small, color: colors.textOnDarkSecondary, marginBottom: spacing.sm },
    submit: { marginTop: spacing.sm },
    cancel: { marginTop: spacing.sm },
});
