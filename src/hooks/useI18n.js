// src/hooks/useI18n.js
import { useCallback, useEffect, useState } from 'react';
import { ensureI18nLoaded, getLocale, setLocale, subscribeLocale, t as translate } from '../lib/i18n';

/**
 * Подписка на текущий язык UI — компонент перерендерится при setLocale()
 * из ЛЮБОГО другого места (например при выборе в GameGeneralSettingsModal).
 * `t` из возвращаемого объекта — та же функция, что и lib/i18n.js#t, просто
 * заново прокинута на каждый рендер, чтобы её ссылка менялась вместе с
 * локалью (не мемоизирована — она сама не хранит стейт, читает модульную
 * переменную `current` в lib/i18n.js в момент вызова).
 */
export function useI18n() {
    const [locale, setLocaleState] = useState(getLocale());

    useEffect(() => {
        ensureI18nLoaded().then(setLocaleState);
        return subscribeLocale(setLocaleState);
    }, []);

    const t = useCallback((key, params) => translate(key, params), [locale]);

    return { locale, setLocale, t };
}
