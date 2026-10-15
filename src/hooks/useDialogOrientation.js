// src/hooks/useDialogOrientation.js
import { useEffect, useState } from 'react';
import {
    ensureDialogSettingsLoaded,
    getDialogOrientation,
    subscribeDialogSettings,
} from '../lib/dialogSettings';

/** Живое значение ориентации сворачиваемой модалки — см. lib/dialogSettings.js. */
export function useDialogOrientation() {
    const [orientation, setOrientation] = useState(getDialogOrientation());

    useEffect(() => {
        ensureDialogSettingsLoaded().then(setOrientation);
        return subscribeDialogSettings(setOrientation);
    }, []);

    return orientation;
}
