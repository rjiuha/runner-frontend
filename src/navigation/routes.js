// src/navigation/routes.js
/**
 * Имена экранов — строки, которые легко опечатать.
 * Константы дают автодополнение и ошибку сразу, а не «ничего не происходит».
 * Названия зеркалят контроллеры бека: Lobby* → LobbyController, RunnerGame → RunnerGameController.
 */
export const ROUTES = {
    AUTH: 'Auth',
    MAIN_MENU: 'MainMenu',
    LOBBY_SEARCH: 'LobbySearch', // GET /api/lobbies
    LOBBY: 'Lobby',              // GET /api/lobby/{id} + SSE lobby_{id}
    RUNNER_GAME: 'RunnerGame',   // GET /api/runner_game + SSE runner_game_{id}
};