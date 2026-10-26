// src/lib/notify.js
import { createLogger } from './logger';
import { t } from './i18n';

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
        buttons: [{ label: t('common.ok'), variant: 'primary' }],
    });
}

/**
 * Подтверждение действия (выход, покинуть лобби). `cancelLabel` — опционален
 * (2026-10-14, по прямому запросу пользователя для диалога "Выйти без
 * сохранения?" в GameSettingsModal.js, где кнопка отмены по смыслу — просто
 * возврат в настройки, не "отмена" чего-либо) — дефолт common.cancel не
 * трогает остальные вызовы confirm() по проекту. 2026-10-26: дефолты
 * confirmLabel/cancelLabel переведены на t(...) — значения по умолчанию в
 * JS вычисляются НА КАЖДЫЙ вызов без этого аргумента, не один раз при
 * объявлении функции, так что это читает ТЕКУЩУЮ локаль корректно.
 */
export function confirm(title, message, onConfirm, confirmLabel = t('common.yes'), cancelLabel = t('common.cancel')) {
    log(title, message ?? '');
    showModal?.({
        title,
        message,
        buttons: [
            { label: cancelLabel, variant: 'muted' },
            { label: confirmLabel, variant: 'danger', onPress: onConfirm },
        ],
    });
}
