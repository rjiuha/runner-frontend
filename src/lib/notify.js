// src/lib/notify.js
import { createLogger } from './logger';

const log = createLogger('NOTIFY');

/**
 * notify()/confirm() больше НЕ используют платформенный Alert.alert/
 * window.alert/window.confirm (2026-09-14, по прямому запросу
 * пользователя — "не хочу стандартные диалоги в общем", после того как
 * заметил разный стиль системных диалогов на выходе из аккаунта и т.п.).
 * Рендер — components/ui/AppModal.js, один экземпляр на всё приложение
 * (монтируется в App.js). Сам этот файл теперь просто пересылает вызов
 * зарегистрированному обработчику — сигнатуры notify()/confirm() не
 * менялись, ни один из вызывающих экранов трогать не пришлось.
 *
 * `showModal` == null возможен только в практически недостижимый момент —
 * ДО того как AppModal успел смонтироваться в App.js (тот монтируется
 * синхронно с самым первым рендером приложения) — тогда вызов молча
 * игнорируется, лог всё равно пишется.
 */
let showModal = null;

export function registerModalHandler(fn) {
    showModal = fn;
}

/**
 * Логируем КАЖДЫЙ вызов (2026-09-14, по прямому запросу пользователя —
 * "хочу видеть всё в терминале") — это единственная точка во всём проекте,
 * через которую идёт любое пользовательское уведомление об ошибке/результате
 * (LobbyScreen/AuthScreen/GameBoardScreen и т.д.), так что один лог здесь
 * покрывает весь UI-слой разом, без правок в каждом экране по отдельности.
 */
export function notify(title, message) {
    log(title, message ?? '');
    showModal?.({
        title,
        message,
        buttons: [{ label: 'OK', variant: 'primary' }],
    });
}

/** Подтверждение действия (выход, покинуть лобби) */
export function confirm(title, message, onConfirm, confirmLabel = 'Да') {
    log(title, message ?? '');
    showModal?.({
        title,
        message,
        buttons: [
            { label: 'Отмена', variant: 'muted' },
            { label: confirmLabel, variant: 'danger', onPress: onConfirm },
        ],
    });
}
