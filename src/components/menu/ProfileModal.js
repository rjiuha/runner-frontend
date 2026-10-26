// src/components/menu/ProfileModal.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Button from '../ui/Button';
import Input from '../ui/Input';
import LoadingCard from '../ui/LoadingCard';
import { meApi } from '../../api/me';
import { authApi } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { notify, confirm } from '../../lib/notify';
import { colors, spacing, font, radius } from '../../theme';

const CODE_RE = /^\d{6}$/;
// Клиентский кулдаун кнопки "Отправить код ещё раз" — зеркалит
// OneTimeCodeService::RESEND_COOLDOWN_SEC на бэке (read-only, 2026-10-22).
// Для сброса пароля бэк этот кулдаун НЕ показывает (POST /password/forgot
// всегда отвечает {"result":"ok"}, молча игнорируя повтор раньше срока, см.
// PasswordResetService::requestCode) — здесь он чисто клиентский, чтобы не
// спамить кнопкой впустую. Для подтверждения email бэк РЕАЛЬНО возвращает
// VERIFICATION_CODE_COOLDOWN с точным retryAfter — тот приоритетнее этой
// константы, когда известен (см. sendVerifyCode ниже).
const RESEND_COOLDOWN_SEC = 60;

function useCountdown(untilTs) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!untilTs) return;
        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, [untilTs]);
    if (!untilTs) return 0;
    return Math.max(0, Math.ceil((untilTs - now) / 1000));
}

/**
 * Модалка профиля (открывается нажатием на ProfileCard в главном меню,
 * 2026-10-22, по прямому запросу пользователя — выравнивание фронта с новыми
 * эндпоинтами бэка: подтверждение email, сброс пароля, удаление аккаунта).
 * Один Modal, внутренний `step` переключает содержимое (тот же приём, что у
 * useGameMenuModals — хаб с "назад", без стопки нескольких <Modal>).
 *
 * `me` (username/email/emailVerified) — ВСЕГДА свежий GET /api/me при
 * каждом открытии, не из JWT (AuthContext#user): emailVerified меняется на
 * бэке со временем и в JWT не кладётся.
 */
export default function ProfileModal({ visible, onClose }) {
    const { deleteAccount } = useAuth();
    const { t } = useI18n();
    const [step, setStep] = useState('hub'); // 'hub' | 'verify' | 'reset' | 'delete'
    const [me, setMe] = useState(null);
    const [loadingMe, setLoadingMe] = useState(true);

    // Код подтверждения email
    const [verifyCode, setVerifyCode] = useState('');
    const [verifyError, setVerifyError] = useState(null);
    const [verifyCooldownUntil, setVerifyCooldownUntil] = useState(null);
    const [sendingVerify, setSendingVerify] = useState(false);
    const [confirmingVerify, setConfirmingVerify] = useState(false);
    const verifyAutoSentRef = useRef(false);
    const verifyCountdown = useCountdown(verifyCooldownUntil);

    // Сброс пароля
    const [resetCode, setResetCode] = useState('');
    const [resetPassword, setResetPassword] = useState('');
    const [resetConfirm, setResetConfirm] = useState('');
    const [resetErrors, setResetErrors] = useState({});
    const [resetCooldownUntil, setResetCooldownUntil] = useState(null);
    const [sendingReset, setSendingReset] = useState(false);
    const [confirmingReset, setConfirmingReset] = useState(false);
    const resetAutoSentRef = useRef(false);
    const resetCountdown = useCountdown(resetCooldownUntil);

    // Удаление аккаунта
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const resetAllLocalState = useCallback(() => {
        setStep('hub');
        setVerifyCode(''); setVerifyError(null); setVerifyCooldownUntil(null);
        setResetCode(''); setResetPassword(''); setResetConfirm(''); setResetErrors({}); setResetCooldownUntil(null);
        setDeletePassword(''); setDeleteError(null);
        verifyAutoSentRef.current = false;
        resetAutoSentRef.current = false;
    }, []);

    // Свежий профиль при каждом открытии
    useEffect(() => {
        if (!visible) return;
        resetAllLocalState();
        setLoadingMe(true);
        meApi.get()
            .then((data) => setMe(data))
            .catch((e) => notify(t('profile.loadFailTitle'), e.userMessage ?? e.message))
            .finally(() => setLoadingMe(false));
    }, [visible, resetAllLocalState]);

    const handleClose = () => {
        if (sendingVerify || confirmingVerify || sendingReset || confirmingReset || deleting) return;
        onClose();
    };

    /* ---------- Подтверждение email ---------- */

    const sendVerifyCode = useCallback(async () => {
        setSendingVerify(true);
        setVerifyError(null);
        try {
            await meApi.sendVerificationCode();
            setVerifyCooldownUntil(Date.now() + RESEND_COOLDOWN_SEC * 1000);
        } catch (e) {
            if (e.code === 'VERIFICATION_CODE_COOLDOWN') {
                const retryAfter = e.payload?.error?.details?.retryAfter ?? RESEND_COOLDOWN_SEC;
                setVerifyCooldownUntil(Date.now() + retryAfter * 1000);
            } else if (e.code === 'EMAIL_ALREADY_VERIFIED') {
                setMe((m) => (m ? { ...m, emailVerified: true } : m));
                setStep('hub');
                notify(t('profile.verify.alreadyVerified'));
            } else {
                notify(t('profile.code.failSendTitle'), e.userMessage ?? e.message);
            }
        } finally {
            setSendingVerify(false);
        }
    }, [t]);

    useEffect(() => {
        if (step !== 'verify' || verifyAutoSentRef.current) return;
        verifyAutoSentRef.current = true;
        sendVerifyCode();
    }, [step, sendVerifyCode]);

    const submitVerify = async () => {
        if (!CODE_RE.test(verifyCode.trim())) {
            setVerifyError(t('profile.code.format'));
            return;
        }
        setVerifyError(null);
        setConfirmingVerify(true);
        try {
            await meApi.verifyEmail(verifyCode);
            setMe((m) => (m ? { ...m, emailVerified: true } : m));
            notify(t('profile.verify.confirmedTitle'));
            setStep('hub');
        } catch (e) {
            if (e.code === 'VERIFICATION_CODE_INVALID') {
                const attemptsLeft = e.payload?.error?.details?.attemptsLeft;
                setVerifyError(attemptsLeft != null ? t('profile.code.invalidAttempts', { attemptsLeft }) : t('profile.code.invalid'));
            } else if (e.code === 'VERIFICATION_CODE_EXPIRED') {
                setVerifyError(t('profile.code.expired'));
                setVerifyCooldownUntil(null);
            } else if (e.code === 'EMAIL_ALREADY_VERIFIED') {
                setMe((m) => (m ? { ...m, emailVerified: true } : m));
                notify(t('profile.verify.alreadyVerified'));
                setStep('hub');
            } else {
                notify(t('profile.verify.failConfirmTitle'), e.userMessage ?? e.message);
            }
        } finally {
            setConfirmingVerify(false);
        }
    };

    /* ---------- Сброс пароля ---------- */

    const sendResetCode = useCallback(async () => {
        if (!me?.email) return;
        setSendingReset(true);
        try {
            await authApi.forgotPassword(me.email);
            setResetCooldownUntil(Date.now() + RESEND_COOLDOWN_SEC * 1000);
        } catch (e) {
            notify(t('profile.code.failSendTitle'), e.userMessage ?? e.message);
        } finally {
            setSendingReset(false);
        }
    }, [me?.email, t]);

    useEffect(() => {
        if (step !== 'reset' || resetAutoSentRef.current || !me?.email) return;
        resetAutoSentRef.current = true;
        sendResetCode();
    }, [step, me?.email, sendResetCode]);

    const submitReset = async () => {
        const next = {};
        if (!CODE_RE.test(resetCode.trim())) next.code = t('profile.code.format');
        if (!resetPassword) next.password = t('profile.reset.errorEmptyPassword');
        else if (resetPassword.length < 6) next.password = t('profile.reset.errorPasswordMin');
        if (resetPassword !== resetConfirm) next.confirm = t('profile.reset.errorPasswordMismatch');

        setResetErrors(next);
        if (Object.keys(next).length) return;

        setConfirmingReset(true);
        try {
            await authApi.resetPassword(me.email, resetCode, resetPassword);
            notify(t('profile.reset.successTitle'), t('profile.reset.successMessage'));
            setStep('hub');
        } catch (e) {
            if (e.code === 'VERIFICATION_CODE_INVALID') {
                const attemptsLeft = e.payload?.error?.details?.attemptsLeft;
                setResetErrors({
                    code: attemptsLeft != null ? t('profile.code.invalidAttempts', { attemptsLeft }) : t('profile.code.invalid'),
                });
            } else if (e.code === 'VERIFICATION_CODE_EXPIRED') {
                setResetErrors({ code: t('profile.code.expired') });
                setResetCooldownUntil(null);
            } else {
                notify(t('profile.reset.failTitle'), e.userMessage ?? e.message);
            }
        } finally {
            setConfirmingReset(false);
        }
    };

    /* ---------- Удаление аккаунта ---------- */

    const submitDelete = () => {
        if (!deletePassword) {
            setDeleteError(t('profile.delete.errorEmptyPassword'));
            return;
        }
        confirm(
            t('profile.delete.confirmTitle'),
            t('profile.delete.confirmMessage'),
            async () => {
                setDeleting(true);
                setDeleteError(null);
                try {
                    await deleteAccount(deletePassword);
                    onClose();
                    // RootNavigator сам переключит стек на AuthScreen, как
                    // только isAuthenticated станет false (deleteAccount это
                    // делает) — своей навигации тут не нужно.
                } catch (e) {
                    if (e.code === 'INVALID_PASSWORD') {
                        setDeleteError(t('profile.delete.errorWrongPassword'));
                    } else {
                        notify(t('profile.delete.failTitle'), e.userMessage ?? e.message);
                    }
                } finally {
                    setDeleting(false);
                }
            },
            t('profile.delete.confirmBtn'),
        );
    };

    /* ---------- Рендер ---------- */

    const renderHub = () => (
        <>
            <Text style={styles.name} noGlobalTint>{me?.username ?? '…'}</Text>
            <Text style={styles.email} noGlobalTint>{me?.email ?? ''}</Text>

            <View style={styles.emailStatusRow}>
                {me?.emailVerified ? (
                    <Text style={styles.emailVerified} noGlobalTint>{t('profile.hub.emailVerified')}</Text>
                ) : (
                    <Text style={styles.emailUnverified} noGlobalTint>{t('profile.hub.emailUnverified')}</Text>
                )}
            </View>

            {!me?.emailVerified && (
                <Button title={t('profile.hub.verifyEmailBtn')} onPress={() => setStep('verify')} style={styles.btn} />
            )}
            <Button title={t('profile.hub.resetPasswordBtn')} variant="info" onPress={() => setStep('reset')} style={styles.btn} />
            <Button title={t('profile.hub.deleteAccountBtn')} variant="danger" onPress={() => setStep('delete')} style={styles.btn} />
            <Button title={t('profile.hub.closeBtn')} variant="muted" onPress={handleClose} style={styles.btn} />
        </>
    );

    const renderVerify = () => (
        <>
            <Text style={styles.title} noGlobalTint>{t('profile.verify.title')}</Text>
            <Text style={styles.hint} noGlobalTint>
                {t('profile.code.hint', { email: me?.email })}
            </Text>
            <Input
                placeholder={t('forgotPassword.placeholderCode')}
                value={verifyCode}
                onChangeText={setVerifyCode}
                error={verifyError}
                keyboardType="number-pad"
                maxLength={6}
            />
            <Button title={t('profile.verify.confirmBtn')} onPress={submitVerify} loading={confirmingVerify} style={styles.btn} />
            <Button
                title={verifyCountdown > 0 ? t('profile.code.resendCountdown', { s: verifyCountdown }) : t('profile.code.resend')}
                variant="muted"
                onPress={sendVerifyCode}
                loading={sendingVerify}
                disabled={verifyCountdown > 0}
                style={styles.btn}
            />
            <Button title={t('common.back')} variant="muted" onPress={() => setStep('hub')} style={styles.btn} />
        </>
    );

    const renderReset = () => (
        <>
            <Text style={styles.title} noGlobalTint>{t('profile.reset.title')}</Text>
            <Text style={styles.hint} noGlobalTint>
                {t('profile.code.hint', { email: me?.email })}
            </Text>
            <Input
                placeholder={t('forgotPassword.placeholderCode')}
                value={resetCode}
                onChangeText={setResetCode}
                error={resetErrors.code}
                keyboardType="number-pad"
                maxLength={6}
            />
            <Input
                placeholder={t('profile.reset.placeholderPassword')}
                value={resetPassword}
                onChangeText={setResetPassword}
                error={resetErrors.password}
                secondary
                secureTextEntry
                textContentType="newPassword"
                autoComplete="password-new"
            />
            <Input
                placeholder={t('profile.reset.placeholderConfirm')}
                value={resetConfirm}
                onChangeText={setResetConfirm}
                error={resetErrors.confirm}
                secondary
                secureTextEntry
                autoComplete="password-new"
            />
            <Button title={t('profile.reset.submitBtn')} onPress={submitReset} loading={confirmingReset} style={styles.btn} />
            <Button
                title={resetCountdown > 0 ? t('profile.code.resendCountdown', { s: resetCountdown }) : t('profile.code.resend')}
                variant="muted"
                onPress={sendResetCode}
                loading={sendingReset}
                disabled={resetCountdown > 0}
                style={styles.btn}
            />
            <Button title={t('common.back')} variant="muted" onPress={() => setStep('hub')} style={styles.btn} />
        </>
    );

    const renderDelete = () => (
        <>
            <Text style={styles.title} noGlobalTint>{t('profile.delete.title')}</Text>
            <Text style={styles.hint} noGlobalTint>
                {t('profile.delete.hint')}
            </Text>
            <Input
                placeholder={t('profile.delete.placeholderPassword')}
                value={deletePassword}
                onChangeText={setDeletePassword}
                error={deleteError}
                secondary
                secureTextEntry
                textContentType="password"
                autoComplete="current-password"
            />
            <Button title={t('profile.hub.deleteAccountBtn')} variant="danger" onPress={submitDelete} loading={deleting} style={styles.btn} />
            <Button title={t('common.back')} variant="muted" onPress={() => setStep('hub')} disabled={deleting} style={styles.btn} />
        </>
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    {loadingMe ? (
                        <LoadingCard />
                    ) : (
                        <>
                            {step === 'hub' && renderHub()}
                            {step === 'verify' && renderVerify()}
                            {step === 'reset' && renderReset()}
                            {step === 'delete' && renderDelete()}
                        </>
                    )}
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

    name: { fontSize: font.h2, fontWeight: 'bold', color: colors.textOnDark, textAlign: 'center' },
    email: { fontSize: font.small, color: colors.textOnDarkSecondary, textAlign: 'center', marginTop: spacing.xs },
    emailStatusRow: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
    emailVerified: { color: colors.success, fontSize: font.small, fontWeight: 'bold' },
    emailUnverified: { color: colors.warning, fontSize: font.small, fontWeight: 'bold' },

    btn: { marginTop: spacing.sm },
});
