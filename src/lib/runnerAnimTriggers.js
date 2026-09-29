// src/lib/runnerAnimTriggers.js
import { statusWorsened } from '../constants/runnerAnimHelpers';
import { forwardNeighbors, neighborPosition } from './hexDirection';
import { RUNNER_TYPES } from '../constants/GameConstants';

/**
 * 2026-09-18: бэк добавил явное поле `reason` к `runner_destroy`
 * (RunnerDestroyEvent — `wall`, `edge`, `fire`, `acid`, `damage`, `reaper`,
 * `track_shift`, `unclaimed`, см. README backend'а) — терминальная поза
 * гибели на клетке fire/acid теперь берётся НАПРЯМУЮ из него, а не гадается
 * по типу клетки под последней известной позицией. Экспортируется —
 * GameBoardScreen.js использует ТУ ЖЕ проверку для гейта pendingDeathRunnerIds.
 */
export const DEATH_KIND_BY_REASON = { fire: 'burn', acid: 'acid' };

// Ловушка Жнеца (см. 'bomb' ниже) — жертва проигрывает 'destroyed' ТОЛЬКО
// ПОСЛЕ того, как Жнец доиграет СВОЮ 'bomb'-анимацию (по прямому запросу
// пользователя, 2026-09-08: "должна быть анимация bomb и дальше destroyed",
// не одновременно). Совпадает с ANIM_DURATION_MS.bomb в useRunnerAnimations.js
// (держать числа в паре, как и другие такие пары в проекте — см. move/
// SLIDE_DURATION_MS).
const REAPER_BOMB_TO_DESTROYED_DELAY_MS = 1800;

/**
 * 2026-09-27 — ПЕРЕПИСАНО под бандлинг Mercure-событий (`action_result` +
 * `sequence`, см. `1_pitch_for_backend_dev.md`/`2_backend_todo.md` в
 * scratchpad сессии, отправлены и реализованы бэкендером). Раньше это были
 * ДВЕ функции (`handleVersionedRunnerAnimEvent`/`handleTransientRunnerAnimEvent`)
 * — разделены потому, что версионные и транзиентные события раньше шли
 * РАЗНЫМИ путями (`reduce` vs `onTransient` в useMercure). С новым конвертом
 * оба вида перемешаны в одном `sequence` одного бандла — разделение по
 * "версионное/транзиентное" больше не соответствует реальности, слиты в один
 * диспетчер с `switch` по `e.event`.
 *
 * **Главное следствие бандлинга + обогащения полей** — вся эвристика
 * "move или fly" (была нужна ТОЛЬКО потому, что бэк раньше не говорил
 * "почему" бегун переместился) ЗАМЕНЕНА на прямое чтение `runner_save.reason`
 * (backend, `Action::$reason`/`RunnerSaveService::run($runner, $reason)`,
 * см. `2_backend_todo.md`): `'step'` — обычный добровольный ход (move),
 * что угодно ещё (`'collision'`/`'anomaly'`/`'rocket'`/`'stupor'`) — отскок
 * (fly). Раньше здесь была эвристика по расстоянию (`forwardNeighbors`) +
 * `RECENTLY_SHOT_TTL_MS`-метка "недавно подстрелен" + `pushedFrom`-проверка
 * "старая клетка была занята кем-то другим" (с ручными исключениями для
 * Жнеца/Призрака, оба НИКОГДА не толкают) — ВСЁ ЭТО убрано целиком, явный
 * `reason` уже недвусмысленно говорит то же самое, без всяких совпадений.
 * `forwardNeighbors` НЕ удалён полностью — остаётся нужным ТОЛЬКО чтобы
 * выбрать visual-вариант направления (юг/север/восток/запад) для 'move',
 * не для решения "это шаг или отброс".
 *
 * **Известный пробел бэка (НЕ наша ошибка, сообщено бэкендеру отдельно)**:
 * ветка "Использовать" при столкновении разных размеров
 * (`StepCollisionService::run()`, `accept:true`) строит `Action::TYPE_MOVE`
 * БЕЗ `reason` — единственное место во всём бэке, где отброс-движение не
 * помечено. Раз `step_collision`-транзиент (`StepCollisionEvent`) ВСЕГДА
 * приходит раньше в ТОМ ЖЕ бандле для этой конкретной ветки — используем
 * его присутствие как резервный сигнал "это всё равно отброс" (см.
 * `animHelpers.forceKnockback`, простановка — GameBoardScreen.js), а не
 * геометрию по расстоянию (та самая эвристика, которую отменяем везде
 * остальном, тут её возвращать не нужно — есть более надёжный сигнал).
 *
 * **Пара при коллизии (кто "победитель", кого ждать перед fly)** — раньше
 * реконструировалась эвристикой `pushedFromCandidate` (кто ещё стоял на
 * старой клетке). Теперь `CollisionEvent` несёт `runnerId`/`otherRunnerId`
 * явно (см. `2_backend_todo.md`, п.2.3) — GameBoardScreen.js передаёт их
 * сюда через `animHelpers.collisionPair` (сохраняется на 'collision'-item,
 * потребляется на следующем `runner_save` с `reason:'collision'` В ТОМ ЖЕ
 * бандле). "Победитель" (кого ждать через `onceStepDone`) — просто ДРУГОЙ
 * участник пары (не тот, кого сейчас двигает этот `runner_save`), не нужно
 * даже разбирать LOWER/TOP самим — обе стороны пары уже названы явно.
 *
 * **2026-09-28, реальный живой баг**: `reason` — поле ВЕРХНЕГО уровня самого
 * события (`RunnerSaveEvent.php`: `'reason' => $reason` — сосед `runnerId`,
 * не его свойство), а этот файл читал его как `patch.reason` (`patch =
 * e.runnerId`) — там такого поля никогда не было, значит `patch.reason` был
 * ВСЕГДА `undefined`. `isVoluntaryStep` из-за этого всегда считал ЛЮБОЙ
 * `runner_save` (в т.ч. настоящий отброс при коллизии) обычным шагом —
 * `patch.reason == null` слепо давало `true` — живая жалоба: при коллизии
 * бегун-жертва вместо 'wait'+'fly' проигрывал обычный 'move' прямо в
 * результирующую клетку, позы столкновения не было вовсе. Поправлено на
 * `e.reason` во всех проверках ниже.
 */
export function handleSequenceItem(prevGame, e, trigger, animHelpers) {
    if (e.event === 'runner_save') {
        const patch = e.runnerId;
        const prev = prevGame?.runners?.find((r) => r.id === patch.id);
        const toPosition = { segment: patch.segment, positionX: patch.positionX, positionY: patch.positionY };

        if (!prev) {
            // Бегун вообще не найден в ПРЕДЫДУЩЕМ состоянии — для обычных
            // бегунов/Жнеца это "мы просто не видели предыдущего состояния"
            // (холодный коннект/resync), молчим, просто idle. "Мяч" —
            // принципиально другой случай, см. старый докстринг: создаётся
            // заново на каждой danger-коллизии, !prev тут ВСЕГДА "только что
            // появился".
            if (patch.type === 'ball') trigger(patch.id, 'start', { toPosition, runnerType: patch.type });
            return;
        }
        // 'start' — первый выход из резерва (RunnerStartMoveService,
        // reason явно 'start') — БЕЗ анимации вообще (по прямому запросу
        // пользователя, 2026-09-01): бегуна до этого момента нигде не было
        // нарисовано, скользить неоткуда. `prev.segment==null` оставлен
        // защитным фолбэком на случай рассинхрона reason/фактического
        // состояния — обе проверки должны совпадать всегда.
        if (e.reason === 'start' || prev.segment == null) {
            trigger(patch.id, 'start', { toPosition });
            return;
        }
        if (patch.segment == null) return; // снят с трассы — не наш случай
        if (prev.segment === patch.segment && prev.positionX === patch.positionX && prev.positionY === patch.positionY) {
            // Позиция не изменилась — это либо 'danger' (Danger::mud()/mine(),
            // повторный save на ТОЙ ЖЕ клетке после смены dice), либо 'roll'
            // (RunnerRollService — чистая бухгалтерия rollDice/rollMoves, без
            // движения), либо сегментная перенумерация при сдвиге трассы
            // (см. ниже) — ни одно не требует анимации.
            return;
        }
        if (prev.positionX === patch.positionX && prev.positionY === patch.positionY) {
            // Чистая перенумерация сегмента при сдвиге фрагментов трассы
            // (TrackService::shift(), read-only — X/Y те же, поменялся
            // ТОЛЬКО номер фрагмента) — не идёт через Move::handle()/reason
            // вообще, оставлен тем же позиционным чеком, что и раньше.
            return;
        }

        const neighbor = forwardNeighbors(prev).find(
            (n) => n.segment === patch.segment && n.positionX === patch.positionX && n.positionY === patch.positionY,
        );
        const isVoluntaryStep = e.reason === 'step'
            || (e.reason == null && !animHelpers?.forceKnockback);

        if (isVoluntaryStep) {
            // depthChanged/targetLaneShifted — ТОЛЬКО для выбора visual-
            // варианта направления (юг/север/восток/запад), см. докстринг
            // модуля выше — geometрия тут больше не решает move-или-fly.
            trigger(patch.id, 'move', {
                direction: neighbor?.direction ?? 'UP',
                depthChanged: neighbor ? patch.positionX !== prev.positionX : false,
                targetLaneShifted: neighbor ? patch.positionY % 2 === 0 : false,
                toPosition,
            });
            return;
        }

        // Отскок/телепорт (collision/anomaly/rocket/stupor/известный
        // backend-пробел у "Использовать") — 'fly'. Пара "кто победитель,
        // кого ждать" — ТОЛЬКО для честного reason:'collision' с реально
        // переданной collisionPair (см. докстринг модуля); во всех
        // остальных случаях (аномалия/ракета/ступор/backend-пробел) пары
        // нет и не нужно — просто улетает.
        const pair = e.reason === 'collision' ? animHelpers?.collisionPair : null;
        const winnerId = pair ? (pair.runnerId === patch.id ? pair.otherRunnerId : pair.runnerId) : null;
        if (winnerId != null && animHelpers?.onceStepDone && animHelpers?.completeWaitStep) {
            // Не телепортируем сразу — сперва синтетический шаг 'wait' (тихо
            // стоим на СТАРОЙ, уже общей клетке), ждём, пока ПОБЕДИТЕЛЬ
            // реально доиграет свой текущий шаг (см. docstring модуля и
            // историю в CLAUDE_DONE_TASKS.md за разбор живых багов, которые
            // этот механизм чинил) — только потом реальный 'fly'.
            trigger(patch.id, 'wait', {
                toPosition: { segment: prev.segment, positionX: prev.positionX, positionY: prev.positionY },
            });
            animHelpers.onceStepDone(winnerId, () => {
                // requestAnimationFrame — гарантия РОВНО одного лишнего
                // кадра отрисовки между "оба settled" и "проигравший начал
                // fly", не угаданная длительность (см. история в
                // CLAUDE_DONE_TASKS.md, 2026-09-25).
                //
                // 'fly' передаётся ВНУТРЬ completeWaitStep (не отдельным
                // trigger() следующей строкой, как было раньше) — см. её
                // докстринг в useRunnerAnimations.js за разбором живого бага
                // 2026-09-28: терминальная поза каскада (например 'acid' от
                // приземления на опасную клетку СРАЗУ следом за этим же
                // отбросом) могла синхронно встать в очередь ПОКА мы ждали
                // onceStepDone — тогда именно ОНА, а не 'fly', оказывалась
                // первой в очереди и стартовала до того, как бегун реально
                // долетел.
                requestAnimationFrame(() => {
                    animHelpers.completeWaitStep(patch.id, 'fly', { toPosition });
                });
            });
            return;
        }
        trigger(patch.id, 'fly', { toPosition });
        return;
    }

    if (e.event === 'runner_damage' || e.event === 'runner_destroy') {
        const patch = e.runnerId;
        const prev = prevGame?.runners?.find((r) => r.id === patch.id);
        if (!prev) return;

        // Последняя известная (ДО события) позиция — нужна как toPosition
        // для 'fly'/'destroyed' ниже: RunnerDestroyService на бэке (read-only)
        // ВСЕГДА обнуляет position/segment ПЕРЕД публикацией события.
        const lastKnownPosition = prev.segment != null
            ? { segment: prev.segment, positionX: prev.positionX, positionY: prev.positionY }
            : null;

        // Жнец НИКОГДА не получает статус 'destroyed' от RunnerDestroyService
        // — событие runner_destroy для НЕГО означает "вернулся в резерв".
        // По прямому запросу пользователя, 2026-09-08: играем 'fly' НА МЕСТЕ.
        if (e.event === 'runner_destroy' && patch.type === RUNNER_TYPES.REAPER && lastKnownPosition) {
            trigger(patch.id, 'fly', { toPosition: lastKnownPosition });
            return;
        }

        // "Смерть" на клетке типа fire/acid — терминальная поза 'burn'/'acid'
        // ВМЕСТО обычной 'destroyed', причина смерти уже названа в e.reason
        // (DEATH_KIND_BY_REASON выше).
        if (e.event === 'runner_destroy' && lastKnownPosition) {
            const deathKind = DEATH_KIND_BY_REASON[e.reason];
            if (deathKind) {
                trigger(patch.id, deathKind, { toPosition: lastKnownPosition });
                return;
            }
        }

        if (!statusWorsened(prev.status, patch.status)) return;

        if (patch.status === 'destroyed') {
            // Ловушка Жнеца: reason:'reaper' подтверждает САМ ФАКТ ловушки,
            // но не называет id конкретного Жнеца — ищем по последней
            // известной позиции жертвы. bomb СНАЧАЛА (у Жнеца), жертва
            // получает 'destroyed' только ПОСЛЕ (см.
            // REAPER_BOMB_TO_DESTROYED_DELAY_MS выше).
            const reaperHere = e.reason === 'reaper' && prevGame.runners.find(
                (r) => r.type === RUNNER_TYPES.REAPER
                    && r.segment === prev.segment && r.positionX === prev.positionX && r.positionY === prev.positionY,
            );
            if (reaperHere) {
                trigger(reaperHere.id, 'bomb', {});
                setTimeout(
                    () => trigger(patch.id, 'destroyed', { fromStatus: prev.status, toPosition: lastKnownPosition }),
                    REAPER_BOMB_TO_DESTROYED_DELAY_MS,
                );
            } else {
                trigger(patch.id, 'destroyed', { fromStatus: prev.status, toPosition: lastKnownPosition });
            }
        } else {
            trigger(patch.id, 'gotShot');
        }
        return;
    }

    if (e.event === 'ability_reaper') {
        // Первая (и единственная) установка Жнеца на трассу — "прилетает"
        // сбоку, из-за края трассы, случайно слева или справа. Если игрок
        // сразу выстрелил при размещении (e.attack — направление) — вторым
        // шагом очереди играем 'attack'.
        const side = Math.random() < 0.5 ? 'east' : 'west';
        const toPosition = { segment: e.reaper.segment, positionX: e.reaper.positionX, positionY: e.reaper.positionY };
        trigger(e.reaper.id, 'start', { side, toPosition, runnerType: RUNNER_TYPES.REAPER });

        if (e.attack) {
            // Жнец не двигается, целится через ту же hex-клетку из СВОЕЙ
            // свежепоставленной позиции — она уже целиком в e.reaper, не
            // нужно смотреть в game-стейт (в отличие от step_shoot ниже,
            // где стрелка нужно ещё найти по id).
            const target = neighborPosition(e.reaper, e.attack);
            trigger(e.reaper.id, 'attack', {
                direction: e.attack,
                depthChanged: target ? target.positionX !== e.reaper.positionX : false,
                targetLaneShifted: target ? target.positionY % 2 === 0 : false,
            });
        }
        return;
    }

    if (e.event === 'step_shoot') {
        // Выстрел не двигает стрелка — нет versioned-сигнала о позиции
        // вообще, единственный источник направления — сам этот транзиент.
        // Целится через ТУ ЖЕ hex-геометрию, что и шаг (canShoot() на бэке
        // проверяет ровно тех же соседей, что и движение) — чисто боковой
        // выстрел на "смещённую" (нечётную) дорожку визуально идёт south-*,
        // не north-*, та же поправка, что и у обычного шага.
        if (!e.accept) return;
        const direction = e.direction ?? 'UP';
        // String() — `e.activeRunner` приходит от `RunnerPlayer::$activeRunner`
        // (бэк, `?string`), а `runner.id` в game-стейте — число (`Runner::$id`,
        // `?int`) — тот же разъезд типов, что уже учтён везде в проекте для
        // этого поля (GameBoardScreen.js/PlayerInfoPanel.js — все через
        // String()), но был пропущен именно тут: строгое `===` никогда не
        // совпадало → `shooter` всегда `undefined` → depthChanged/
        // targetLaneShifted всегда false → выстрел
        // на смещённую (нечётную) дорожку визуально всегда шёл "по умолчанию"
        // (north-вариант спрайта), а не в реальном направлении.
        const shooter = prevGame?.runners?.find((r) => String(r.id) === String(e.activeRunner));
        let depthChanged = false;
        let targetLaneShifted = false;
        if (shooter?.segment != null) {
            const target = neighborPosition(shooter, direction);
            if (target) {
                depthChanged = target.positionX !== shooter.positionX;
                targetLaneShifted = target.positionY % 2 === 0;
            }
        }
        trigger(e.activeRunner, 'attack', { direction, depthChanged, targetLaneShifted });
    }
}
