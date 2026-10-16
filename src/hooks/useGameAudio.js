// src/hooks/useGameAudio.js
import { useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { COLLISION_SOUND } from '../constants/runnerSounds';

/**
 * 2026-10-16, вынесено из GameBoardScreen.js по итогам аудита лучших
 * практик (пункт "а" — самый безопасный из кандидатов на вынос: блок не
 * завязан на игровую логику экрана, только на настройки звука).
 *
 * Озвучка бегунов (2026-09-03) — 3 "переиспользуемых канала" (.replace() на
 * существующем плеере вместо создания нового на каждый звук, см.
 * constants/runnerSounds за тем, какие файлы у каких типов есть) + отдельный
 * фиксированный плеер под общий звук столкновения + общий "комментарийный"
 * канал (старт/уничтожение/выбывание/столкновение/аномалия/победа, см.
 * constants/commentSounds.js) + общий одноразовый SFX-канал (мина/acid-burn/
 * рикошет, см. constants/commonSounds.js). Один переиспользуемый плеер на
 * каждую категорию — эти события физически не могут выпасть друг на друга
 * в один момент, усложнять множеством каналов не нужно.
 *
 * `moveSound`/`musicSound`/`eventLogToggleSound` — НЕ сюда: они либо
 * зациклены синхронно с конкретной игровой анимацией (moveSound), либо
 * управляются отдельным, не завязанным на партию механизмом (музыка меню/
 * лобби, лог событий) — остаются в GameBoardScreen.js рядом со своей
 * собственной логикой, не часть этого самодостаточного блока.
 *
 * Громкость по каналам — lib/audioSettings.js (панель настроек, кнопка
 * settings в seam-ряду, 2026-10-04) передаётся параметром, не читается тут
 * напрямую через useAudioSettings() — вызывающий код (GameBoardScreen.js)
 * использует тот же `audioSettings` ещё для нескольких ДРУГИХ плееров
 * (moveSound/musicSound/eventLogToggleSound), значит подписка должна жить
 * ровно в одном месте, не в этом хуке и не дублированием вызова хука.
 */
export function useGameAudio(audioSettings) {
    const voiceSound = useAudioPlayer(null);
    const shootSound = useAudioPlayer(null);
    const startSound = useAudioPlayer(null);
    const collisionSound = useAudioPlayer(COLLISION_SOUND);
    const commentSound = useAudioPlayer(null);
    const sfxSound = useAudioPlayer(null);

    useEffect(() => {
        collisionSound.loop = true;
    }, [collisionSound]);

    // 'voice' — ТОЛЬКО реплики бегунов (active/damagedActive, по прямому
    // запросу пользователя — отдельно от остального "игрового" звука);
    // 'action' — ВСЁ остальное (выстрелы/шаги/столкновение/появление Жнеца-
    // Мяча/мины/рикошет-SFX/UI-клики, И голосовые комментарии — канал
    // "Комментатор" объединён с "Игровыми звуками" 2026-10-14, по прямому
    // запросу пользователя: отдельный регулятор для озвучки результатов
    // показался избыточным рядом с голосами бегунов).
    useEffect(() => {
        voiceSound.volume = audioSettings.voice;
    }, [voiceSound, audioSettings.voice]);
    useEffect(() => {
        shootSound.volume = audioSettings.action;
        startSound.volume = audioSettings.action;
        collisionSound.volume = audioSettings.action;
        commentSound.volume = audioSettings.action;
        sfxSound.volume = audioSettings.action;
    }, [shootSound, startSound, collisionSound, commentSound, sfxSound, audioSettings.action]);

    return { voiceSound, shootSound, startSound, collisionSound, commentSound, sfxSound };
}
