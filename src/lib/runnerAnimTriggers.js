// src/lib/runnerAnimTriggers.js
import { statusWorsened } from '../constants/runnerAnimHelpers';
import { forwardNeighbors, neighborPosition } from './hexDirection';
import { RUNNER_TYPES } from '../constants/GameConstants';

/**
 * 2026-09-18: бэк добавил явное поле `reason` к `runner_destroy`
 * (RunnerDestroyEvent — `wall`, `edge`, `fire`, `acid`, `damage`, `reaper`,
 * `track_shift`, `unclaimed`, см. README backend'а) — терминальная поза
 * гибели на клетке fire/acid теперь берётся НАПРЯМУЮ из него, а не гадается
 * по типу клетки под последней известной позицией (старый pickDeathVariant/
 * cellTypeAt, оба удалены). Экспортируется — GameBoardScreen.js использует
 * ТУ ЖЕ проверку для гейта pendingDeathRunnerIds (см. там).
 */
export const DEATH_KIND_BY_REASON = { fire: 'burn', acid: 'acid' };

/**
 * Версионное событие (runner_damage/runner_destroy) → `{runnerId, prevStatus}`
 * при РЕАЛЬНОМ ухудшении статуса (та же проверка `statusWorsened`, что
 * handleVersionedRunnerAnimEvent уже делает внутри себя ниже, чтобы решить
 * gotShot/destroyed/acid/burn) — вынесена отдельно, т.к. вызывающему коду
 * (GameBoardScreen.js#reduceAndLog, см. heldRunnerStatuses) нужен САМ ФАКТ
 * и СТАРЫЙ статус ДО применения патча реducer'ом, а не только побочный
 * эффект trigger() изнутри handleVersionedRunnerAnimEvent. `null`, если
 * событие не про ухудшение (другой тип события, лечение, дубль).
 */
export function identifyStatusWorsening(prevGame, e) {
    if (e.event !== 'runner_damage' && e.event !== 'runner_destroy') return null;
    const patch = e.runnerId;
    const prev = prevGame?.runners?.find((r) => r.id === patch.id);
    if (!prev || !statusWorsened(prev.status, patch.status)) return null;
    return { runnerId: patch.id, prevStatus: prev.status };
}

// Сколько мс держим "недавно получил выстрел" по runnerId (2026-09-07, живой
// прогон — "вместо fly отработала move при отбросе выстрелом"). Эвристика
// move/fly для runner_save (см. ниже) считает knockback по расстоянию —
// forwardNeighbors(prev).find(...) — но случайное направление отброса от
// выстрела иногда СОВПАДАЕТ с одним из 3 forward-соседей старой позиции,
// и тогда знакомая эвристика ошибочно классифицирует явный отброс как
// обычный шаг (move). Раз мы точно знаем, что этого бегуна только что
// подстрелили (runner_damage с ухудшением статуса, см. ниже), последующее
// перемещение того же бегуна форсируем как 'fly', не полагаясь на эвристику
// расстояния. TTL — на случай, если urner_damage без последующего
// перемещения (просто урон без отброса) никогда не "заберёт" метку сам —
// не должна протухать бесконечно.
const RECENTLY_SHOT_TTL_MS = 4000;
const recentlyShotRunners = new Map(); // runnerId -> timestamp

// Ловушка Жнеца (см. 'bomb' ниже) — жертва проигрывает 'destroyed' ТОЛЬКО
// ПОСЛЕ того, как Жнец доиграет СВОЮ 'bomb'-анимацию (по прямому запросу
// пользователя, 2026-09-08: "должна быть анимация bomb и дальше destroyed",
// не одновременно). Совпадает с ANIM_DURATION_MS.bomb в useRunnerAnimations.js
// (держать числа в паре, как и другие такие пары в проекте — см. move/
// SLIDE_DURATION_MS).
const REAPER_BOMB_TO_DESTROYED_DELAY_MS = 1800;

function markRecentlyShot(runnerId) {
    // Заодно чистим протухшие записи — карта живёт весь сеанс модуля,
    // не хотим копить мусор за долгую партию.
    for (const [id, ts] of recentlyShotRunners) {
        if (Date.now() - ts > RECENTLY_SHOT_TTL_MS) recentlyShotRunners.delete(id);
    }
    recentlyShotRunners.set(runnerId, Date.now());
}

function consumeRecentlyShot(runnerId) {
    const ts = recentlyShotRunners.get(runnerId);
    if (ts == null) return false;
    recentlyShotRunners.delete(runnerId);
    return Date.now() - ts <= RECENTLY_SHOT_TTL_MS;
}

/**
 * Смотрит на versioned-событие ДО того, как его применит runnerGameReducer
 * (нужно старое состояние бегуна для сравнения), и решает, нужно ли завести
 * транзиентную анимацию (move/fly/gotShot/destroyed). Чистая функция —
 * единственный побочный эффект через переданный trigger(runnerId, kind, extra)
 * (см. hooks/useRunnerAnimations), сам стейт не трогает.
 *
 * 'runner_save' → сравниваем старую и новую позицию бегуна:
 *   - бегун только что вышел из резерва (prev.segment был null) → БЕЗ
 *     анимации вообще (по прямому запросу пользователя, 2026-09-01) — до
 *     этого момента он нигде не был нарисован, скользить неоткуда, просто
 *     появляется в клетке в позе idle.
 *   - не изменилась → ничего (событие не про перемещение).
 *   - новая клетка — один из 3 forwardNeighbors старой → обычный шаг вперёд
 *     (move, с РЕАЛЬНЫМ направлением этого шага — важно и для самого первого
 *     step_move, и для КАЖДОГО последующего "схлопнутого" шага multi-hop
 *     движения, см. CLAUDE.md про то, что один /move может дать несколько
 *     Action::TYPE_MOVE подряд — у каждого своя пара старая/новая позиция,
 *     каждая тут своя forwardNeighbors-проверка). Вместе с направлением —
 *     depthChanged/targetLaneShifted, нужны constants/runnerAnimations
 *     #resolveMoveAssetDirection, чтобы отличить чисто боковой шаг на
 *     "отставшую" (смещённую на пол-сегмента назад) дорожку от диагонали
 *     вперёд — первое визуально идёт south-*, не north-*.
 *   - иначе (не сосед) → отскок/телепорт (столкновение, аномалия, ракета и
 *     т.п.) — бэк НЕ шлёт отдельного сигнала "это был knockback" (см.
 *     обсуждение в CLAUDE.md), это осознанно принятая эвристика по
 *     расстоянию, а не точный сигнал. Исключение — аномалия: та шлёт СВОЙ
 *     явный транзиентный сигнал (см. handleTransientRunnerAnimEvent ниже),
 *     который форсит 'fly' через pending-мерж независимо от этой эвристики.
 *
 * 'runner_damage'/'runner_destroy' → сравниваем статус: стало ХУЖЕ (не
 * лечение) → gotShot, а если конечный статус — destroyed → сразу terminal
 * 'destroyed' (с fromStatus = статус ДО удара, для выбора healthy/damaged
 * набора анимации, см. constants/runnerAnimations#getRunnerAnimationImage).
 *
 * Каждый trigger() тут передаёт `toPosition` (кроме damage/destroy — они
 * позицию не меняют) — useRunnerAnimations ставит шаг в очередь ЭТОГО
 * бегуна и проигрывает по одному, а не перезаписывает предыдущий (2026-08-31,
 * второй заход) — иначе каскад из нескольких runner_save подряд (отскок от
 * столкновения → аномалия → отлёт из неё) схлопывался бы в одну финальную
 * анимацию, минуя промежуточные шаги (см. подробности в useRunnerAnimations).
 */
export function handleVersionedRunnerAnimEvent(prevGame, e, trigger, animHelpers) {
    if (e.event === 'runner_save') {
        const patch = e.runnerId;
        const prev = prevGame?.runners?.find((r) => r.id === patch.id);
        const toPosition = { segment: patch.segment, positionX: patch.positionX, positionY: patch.positionY };

        if (!prev) {
            // Бегун вообще не найден в ПРЕДЫДУЩЕМ состоянии. Для обычных
            // бегунов (и Жнеца) это значит "мы просто не видели предыдущего
            // состояния" (холодный коннект/resync) — не можем отличить
            // "только что появился" от "давно там стоит", молчим, как и
            // раньше, просто idle. НО "мяч" (RUNNER_TYPES.BALL,
            // RunnerBallInitService на бэке) — принципиально другой случай:
            // это НАСТОЯЩАЯ первая персистентная запись, он физически не мог
            // существовать раньше этого события (создаётся заново на каждой
            // danger-коллизии) — !prev тут ВСЕГДА означает "только что
            // появился", а не "мы его просто не видели". Играем его 'start'
            // безусловно.
            // runnerType в extra — чисто для звуковой системы
            // (lib/runnerSoundTriggers.js): в момент этого триггера бегуна
            // ещё нет ни в prevGame, ни (пока) в применённом game-стейте, по
            // id его тип не найти — событие несёт его напрямую.
            if (patch.type === 'ball') trigger(patch.id, 'start', { toPosition, runnerType: patch.type });
            return;
        }
        if (prev.segment == null) {
            // Первый выход на трассу (из резерва) — ЗНАЛИ бегуна раньше (был
            // в резерве, segment==null), теперь у него реальный segment.
            // Бегуна ещё нигде не было нарисовано на доске, скользить
            // неоткуда (RunnerTokenSlide на первом рендере и так не анимирует
            // позицию). ДО 2026-09-03 тут вообще не было анимации (по
            // прямому запросу пользователя, 2026-09-01) — теперь добавлен
            // отдельный gif "start" именно под этот момент (установка на
            // стартовую клетку), играем его ОДИН раз на месте (toPosition —
            // чтобы токен сразу отрисовался в правильной клетке, без слайда).
            trigger(patch.id, 'start', { toPosition });
            return;
        }
        if (patch.segment == null) return; // снят с трассы — не наш случай сейчас
        if (prev.segment === patch.segment && prev.positionX === patch.positionX && prev.positionY === patch.positionY) {
            return; // позиция не изменилась — событие не про перемещение (очки/статус и т.п.)
        }
        // Чистая перенумерация сегмента при сдвиге фрагментов трассы
        // (TrackService::shift(), бэк, read-only — при удалении фрагмента 1
        // ВСЕ выжившие на middle/end получают segment-1 и свой runner_save,
        // хотя физически не сдвинулись ни на клетку) — X и Y те же, поменялся
        // ТОЛЬКО номер фрагмента. Обычный игровой ход/отброс ВСЕГДА меняет
        // positionX и/или positionY (это единственный способ сменить segment
        // по правилам движения) — значит "оба неизменны, а segment другой"
        // однозначно опознаёт именно этот случай, не совпадение. Без этой
        // проверки ветка ниже классифицировала бы такое как "не сосед" →
        // отброс → 'fly' через полдоски, хотя бегун на самом деле стоял на
        // месте (живая жалоба пользователя, 2026-09-12: во время исчезновения
        // старого фрагмента 1 на нём оказывались и жители фрагмента 2 —
        // именно эта паразитная 'fly'-анимация их туда "переносила").
        if (prev.positionX === patch.positionX && prev.positionY === patch.positionY) return;

        const neighbor = forwardNeighbors(prev).find(
            (n) => n.segment === patch.segment && n.positionX === patch.positionX && n.positionY === patch.positionY,
        );
        // Если бегуна только что подстрелили (см. RECENTLY_SHOT_TTL_MS выше),
        // это ВСЕГДА отброс, даже если он случайно приземлился на клетку,
        // которая формально является forward-соседом старой позиции —
        // эвристика расстояния тут заведомо ошибается (жалоба пользователя,
        // 2026-09-07: "вместо fly отработала move при отбросе выстрелом").
        const wasJustShot = consumeRecentlyShot(patch.id);
        // Столкновение — та же ошибка эвристики расстояния, найдена ПОВТОРНО
        // живьём (жалоба пользователя, 2026-09-08: "коллизия одинаковых по
        // размеру персонажей — того, кого подвинули, просто прошагал в
        // другую клетку"). Причина: `Collision::collision()` на бэке (read-
        // only) бросает НАПРАВЛЕНИЕ отброса ПОЛНОСТЬЮ случайно, всеми 6
        // направлениями (DirectionDiceRoller), не только тремя "вперёд" —
        // когда случайно выпадает ОДНО ИЗ ЭТИХ ТРЁХ, итоговая клетка
        // формально совпадает с forward-соседом старой позиции, и эвристика
        // (см. `neighbor` выше) ошибочно классифицирует явный отброс как
        // обычный шаг игрока. Надёжный сигнал уже был в коде НИЖЕ (см.
        // `occupant`), но проверялся только ПОСЛЕ того, как `neighbor` уже
        // решил "это шаг" — теперь проверяем ПЕРВЫМ: если СТАРАЯ клетка
        // этого бегуна (которую он сейчас покидает) в prevGame была занята
        // ДРУГИМ бегуном, это НЕ МОЖЕТ быть обычным добровольным ходом
        // игрока (тот никогда не начинается с клетки, где кто-то уже стоит,
        // столкновение всегда резолвится синхронно на бэке ДО следующего
        // добровольного хода) — значит это отброс, вне зависимости от того,
        // куда именно СЛУЧАЙНО улетел бегун.
        const pushedFrom = prevGame?.runners?.find(
            (r) => r.id !== patch.id
                && r.segment === prev.segment && r.positionX === prev.positionX && r.positionY === prev.positionY,
        );
        if (neighbor && !wasJustShot && !pushedFrom) {
            // depthChanged/targetLaneShifted — для resolveMoveAssetDirection
            // (constants/runnerAnimations): чисто боковой шаг (глубина не
            // изменилась) на дорожку со сдвигом "назад" (чётный индекс, см.
            // BoardGrid — 2026-09-02, сдвиг переключён с нечётных дорожек на
            // чётные) визуально идёт south-*, не north-*, см. комментарий там же.
            trigger(patch.id, 'move', {
                direction: neighbor.direction,
                depthChanged: patch.positionX !== prev.positionX,
                targetLaneShifted: patch.positionY % 2 === 0,
                toPosition,
            });
        } else {
            // Отскок/телепорт (столкновение, выстрел, аномалия, ракета…).
            // Коллизионный частный случай (жалоба пользователя, 2026-09-07,
            // "скаут-vs-скаут"/"скаут наступил на danger с Мячом внутри" —
            // коллизионная поза ни разу не показалась, сразу finalное
            // состояние): если СТАРАЯ клетка ЭТОГО бегуна (та, что он сейчас
            // покидает) в prevGame уже занята ДРУГИМ бегуном (см. pushedFrom
            // выше) — значит именно ОН только что туда заехал и вытолкнул
            // текущего. Раз оба события (заезд победителя + отброс
            // проигравшего) почти всегда приходят одним и тем же тиком
            // (React 18/19 авто-батчинг — см. разбор в CLAUDE.md), сам факт
            // "оба на одной клетке" мог бы никогда не отрендериться, и
            // BoardGrid#pushPair (коллизионная поза) не успевала сработать.
            // Фикс — НЕ телепортируем сразу: сперва проигрываем синтетический
            // шаг 'wait' (тихо стоим на СТАРОЙ, уже общей клетке —
            // resolveSpriteRef откатывается на idle для незнакомого kind),
            // ждём, пока ПОБЕДИТЕЛЬ реально доиграет СВОЙ текущий шаг
            // (обычно move/fly-заезд на эту клетку) — оба settled на одной
            // клетке хотя бы один рендер, ровно момент, когда пара покажется.
            // Только ПОТОМ реальный 'fly' уводит проигравшего.
            //
            // **2026-09-25, по прямому и повторному запросу пользователя —
            // "перестань привязываться к угадыванию тайминга"**: раньше
            // "подождать, пока победитель осядет" решалось угаданной
            // длительностью (KNOCKBACK_WAIT_MS, с запасом больше
            // ANIM_DURATION_MS.move) — тот же класс костыля, каким были и
            // ANIM_DURATION_MS-таймеры для собственных поз ДО переделки
            // useRunnerAnimations в этом же заходе. Теперь — честный сигнал:
            // `animHelpers.onceStepDone(pushedFrom.id, callback)` подписывается
            // РОВНО на момент, когда ТЕКУЩИЙ активный шаг победителя реально
            // закончится (тот же completeStep/таймаут-страховка, что и у
            // любого другого шага очереди) — если победитель уже settled
            // прямо сейчас, колбэк зовётся синхронно, без всякой задержки.
            // `completeWaitStep` в колбэке принудительно завершает 'wait'
            // (у него самого нет позы, которая могла бы честно сигналить о
            // своём конце — см. completeStep в useRunnerAnimations.js) РОВНО
            // в этот момент, и только тогда стартует 'fly'. KNOCKBACK_WAIT_MS
            // остался в useRunnerAnimations как страховка на случай, если
            // победитель почему-то никогда не долетит — не единственный
            // механизм, как раньше.
            //
            // `animHelpers` необязателен (защитный фолбэк для вызывающего
            // кода, который почему-то не прокинул onceStepDone/completeWaitStep)
            // — тогда используется старый путь ('wait' держится только
            // KNOCKBACK_WAIT_MS-таймером, как было ДО этого захода).
            if (pushedFrom) {
                trigger(patch.id, 'wait', {
                    toPosition: { segment: prev.segment, positionX: prev.positionX, positionY: prev.positionY },
                });
                if (animHelpers?.onceStepDone && animHelpers?.completeWaitStep) {
                    animHelpers.onceStepDone(pushedFrom.id, () => {
                        animHelpers.completeWaitStep(patch.id);
                        trigger(patch.id, 'fly', { toPosition });
                    });
                    return;
                }
            }
            trigger(patch.id, 'fly', { toPosition });
        }
        return;
    }

    if (e.event === 'runner_damage' || e.event === 'runner_destroy') {
        const patch = e.runnerId;
        const prev = prevGame?.runners?.find((r) => r.id === patch.id);
        if (!prev) return;

        // Последняя известная (ДО события) позиция — нужна как toPosition
        // для 'fly'/'destroyed' ниже: RunnerDestroyService на бэке (read-only)
        // ВСЕГДА обнуляет position/segment ПЕРЕД публикацией события, так что
        // сам `patch` их уже не несёт — без явного toPosition BoardGrid
        // (через effectiveRunners/runnerVisualPositions) увидел бы у бегуна
        // segment=null РАНЬШЕ, чем анимация успеет доиграть, и он исчезал бы
        // мгновенно вместо того чтобы визуально "остаться на месте" на время
        // позы (случайно маскировалось раньше только тем, что почти всегда
        // на момент destroy уже был АКТУАЛЬНЫЙ leftover toPosition от
        // предыдущего шага очереди этого же бегуна — ненадёжно, если бегун
        // перед этим долго стоял на месте).
        const lastKnownPosition = prev.segment != null
            ? { segment: prev.segment, positionX: prev.positionX, positionY: prev.positionY }
            : null;

        // Жнец НИКОГДА не получает статус 'destroyed' от RunnerDestroyService
        // (см. бэк, read-only — там явное исключение по RunnerType::REAPER) —
        // событие runner_destroy для НЕГО означает "вернулся в резерв"
        // (segment/position обнулены, статус НЕ менялся), независимо от
        // причины (сдвиг трассы при выходе за 3-й фрагмент — см.
        // TrackService::shift(), или что угодно ещё, что вызовет тот же
        // сервис). По прямому запросу пользователя, 2026-09-08: "жнец должен
        // улететь и вернуться в резерв (чтобы можно было дальше его снова
        // вызвать)" — играем 'fly' НА МЕСТЕ (toPosition = его же последняя
        // позиция, эффект "улетает" даёт сама gif-анимация fly, не слайд),
        // после чего он просто перестаёт индексироваться на доске
        // (indexRunnersByCell пропускает segment==null) — не нужен
        // hiddenIds/DESTROYED_HIDE_DELAY_MS, как у обычного 'destroyed' (тот
        // МЕХАНИЗМ специально держит токен видимым ПОСЛЕ того, как реальная
        // позиция уже null — тут это не нужно, обнуление и так происходит
        // ровно к концу 'fly'). Ловим ДО statusWorsened-гейта ниже — для
        // Жнеца статус в этом случае не "ухудшается", гейт бы просто молча
        // проглотил событие (жалоба пользователя, 2026-09-08: "жнец не
        // уничтожил персонажа" была ПРО ДРУГОЙ бэковый баг — read-only
        // находка, Move::handle() не проверяет столкновение на danger/anomaly
        // клетках, — но раз уж разбирали этот же кусок кода, этот пробел для
        // возврата САМОГО Жнеца в резерв нашёлся тут же и тоже был пуст).
        if (e.event === 'runner_destroy' && patch.type === RUNNER_TYPES.REAPER && lastKnownPosition) {
            trigger(patch.id, 'fly', { toPosition: lastKnownPosition });
            return;
        }

        // "Смерть" на клетке типа fire/acid (2026-09-12/13, по прямому
        // запросу пользователя) — любой бегун, погибающий на такой клетке,
        // получает терминальную позу 'burn'/'acid' ВМЕСТО обычной 'destroyed'
        // — по прямому решению пользователя эта поза САМА ПО СЕБЕ служит
        // финальным кадром, отдельной 'destroyed' после неё не нужно (см.
        // useRunnerAnimations — оба kind обрабатываются ТЕМ ЖЕ терминальным
        // путём, что 'destroyed': очередь останавливается, токен прячется
        // через TERMINAL_HIDE_DELAY_MS). 2026-09-18: раньше тип клетки
        // ПРИХОДИЛОСЬ угадывать по последней известной позиции (cellTypeAt) —
        // теперь бэк прямо называет причину смерти в `e.reason`
        // (DEATH_KIND_BY_REASON выше), совпадение с картинкой самой клетки
        // гарантировано на уровне бэка (обе стороны берут значение из одного
        // и того же RoadType), не двумя независимыми клиентскими хэшами.
        // Проверяем ДО statusWorsened-гейта — тут это не нужно (destroy
        // всегда "хуже"), но порядок такой же, как у Жнеца выше, для
        // единообразия.
        if (e.event === 'runner_destroy' && lastKnownPosition) {
            const deathKind = DEATH_KIND_BY_REASON[e.reason];
            if (deathKind) {
                trigger(patch.id, deathKind, { toPosition: lastKnownPosition });
                return;
            }
        }

        if (!statusWorsened(prev.status, patch.status)) return;

        if (patch.status === 'destroyed') {
            // Ловушка Жнеца: "по правилам игры Жнец должен убить того
            // бегуна, который закончил ход на его клетке" (прямой запрос
            // пользователя, 2026-09-03). 2026-09-18: бэк теперь ЯВНО помечает
            // этот случай — reason:'reaper' (Collision::reaperCollision,
            // читанный бэкенд-код) — раньше сигнала не было вообще, ловушка
            // определялась ЧИСТО по совпадению позиций (см. историю файла).
            // Позиционный поиск всё ещё нужен — reason подтверждает САМ ФАКТ
            // ловушки, но не называет id конкретного Жнеца (тот в событии не
            // указан), искать всё равно приходится по последней известной
            // позиции жертвы. Порядок — bomb СНАЧАЛА (у Жнеца), жертва
            // получает 'destroyed' только ПОСЛЕ (см.
            // REAPER_BOMB_TO_DESTROYED_DELAY_MS выше), не одновременно (по
            // прямому запросу пользователя, 2026-09-08). Не через
            // useRunnerAnimations-очередь victim'а (та относится к ДРУГОМУ
            // runnerId — Жнецу — не годится для задержки жертвы), обычный
            // setTimeout поверх переданного trigger.
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
            // Метим — см. RECENTLY_SHOT_TTL_MS/consumeRecentlyShot выше:
            // следующий runner_save ЭТОГО бегуна (если он ещё придёт) должен
            // безусловно считаться отбросом (fly), не обычным шагом.
            markRecentlyShot(patch.id);
        }
        return;
    }

    if (e.event === 'ability_reaper') {
        // Первая (и единственная — бэк не даёт переставлять уже стоящего
        // Жнеца, см. CLAUDE.md) установка Жнеца на трассу. По прямому
        // запросу пользователя, 2026-09-03: Жнец не выходит из резерва как
        // обычный бегун — он "прилетает" сбоку, из-за края трассы, случайно
        // слева или справа (нет игровой логики, влияющей на сторону —
        // чистая визуальная монетка). kind остаётся 'start' (тот же общий
        // механизм отката в idle) — getRunnerAnimationImage сам подставит
        // bucket.move[side] вместо bucket.start, которого у Жнеца нет
        // (см. константы). Если игрок сразу выстрелил при размещении
        // (e.attack — направление n/ne/nw) — вторым шагом очереди играем
        // 'attack', геометрия направления считается ТАК ЖЕ, как у
        // step_shoot ниже (Жнец не двигается, целится через ту же
        // hex-клетку из СВОЕЙ свежепоставленной позиции).
        const side = Math.random() < 0.5 ? 'east' : 'west';
        const toPosition = { segment: e.reaper.segment, positionX: e.reaper.positionX, positionY: e.reaper.positionY };
        // runnerType — см. коммент у 'ball' выше, та же причина (звуковой
        // системе неоткуда иначе узнать тип в момент этого триггера).
        trigger(e.reaper.id, 'start', { side, toPosition, runnerType: RUNNER_TYPES.REAPER });

        if (e.attack) {
            const target = neighborPosition(e.reaper, e.attack);
            const depthChanged = target ? target.positionX !== e.reaper.positionX : false;
            const targetLaneShifted = target ? target.positionY % 2 === 0 : false;
            trigger(e.reaper.id, 'attack', { direction: e.attack, depthChanged, targetLaneShifted });
        }
    }
}

/**
 * Транзиентные события (без version, см. onTransient в useMercure) — уже
 * несут нужное направление напрямую в полях события, сравнивать старое/новое
 * состояние не нужно. gameRef — актуальный `game` НА МОМЕНТ события (нужен
 * только для anomaly — у неё нет activeRunner, только direction, см. ниже).
 */
export function handleTransientRunnerAnimEvent(e, gameRef, trigger) {
    switch (e.event) {
        case 'step_move':
            // pending: true — заготовка, не самостоятельный шаг очереди. Даёт
            // направление раньше, чем придёт реальная позиция, но описывает
            // ТУ ЖЕ передвижку, что последующий 'runner_save' — если его не
            // пометить, очередь (см. useRunnerAnimations) сыграла бы одно и
            // то же перемещение дважды подряд (двойная длительность на самый
            // частый случай — обычный шаг без каскада).
            trigger(e.activeRunner, 'move', { direction: e.direction ?? 'UP', pending: true }); // без direction — первый выход на трассу
            return;
        case 'step_shoot': {
            if (!e.accept) return;
            // Тот же geometry-нюанс, что и у ходьбы (см. runner_save выше и
            // constants/runnerAnimations#resolveMoveAssetDirection) — целится
            // в клетку через ТУ ЖЕ hex-геометрию (canShoot() на бэке проверяет
            // ровно тех же соседей, что и движение), значит клетка-цель может
            // ТАК ЖЕ визуально лежать south-* (если бегун стоит на дорожке,
            // соседняя с которой "смещена вперёд" — цель диагонали в таком
            // случае лежит south, не north), а не только north-* — жалоба
            // пользователя, 2026-09-01, четвёртый заход: "стрельба...
            // неправильная (у солдата по крайней мере), вместо north-west/east
            // должно быть south-west/east". Раньше (до этого захода) 'attack'
            // сознательно НЕ получал такую поправку — ошибочно, стрельба стоя
            // на месте всё равно целится через ту же гекс-клетку, что и шаг.
            const direction = e.direction ?? 'UP';
            const game = gameRef.current;
            const shooter = game?.runners?.find((r) => r.id === e.activeRunner);
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
            return;
        }
        case 'anomaly': {
            // Аномалию всегда переживает бегун, который СЕЙЧАС двигается —
            // событие направление несёт, а id бегуна — нет, достаём из
            // activeRunner текущего игрока по ходу (game.playerOrder).
            // pending: true — та же заготовка-мерж, что у step_move (см.
            // useRunnerAnimations/trigger): следующий runner_save (реальный
            // отлёт из аномалии) допишет сюда toPosition НА МЕСТЕ вместо
            // отдельного шага очереди, и, что важно именно тут (по прямому
            // запросу пользователя, 2026-09-01), kind ОСТАНЕТСЯ 'fly' —
            // мерж специально не даёт эвристике forwardNeighbors в
            // handleVersionedRunnerAnimEvent переопределить его на 'move',
            // даже если отлёт случайно приземлится на соседнюю клетку.
            const game = gameRef.current;
            const mover = game?.gamePlayers?.find((p) => String(p.id) === String(game.playerOrder));
            if (mover?.activeRunner != null) trigger(mover.activeRunner, 'fly', { pending: true });
            return;
        }
        default:
            return;
    }
}
