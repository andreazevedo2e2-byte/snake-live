import type { GameMode, MapThemeId } from "../game/types";

/** #113: every user-facing string in the render layer, centralized here so
 * HudRenderer.ts/ScreensRenderer.ts never hardcode English literals — the
 * target audience is a Brazilian stream chat (same reasoning as #102/#103).
 * Keep this the one place to touch for wording changes or a future
 * language toggle.
 *
 * v3.1 (feedback do André, 26/07): the "shorts" video HUD was carrying
 * narration-style headlines ("ROTA LIMPA", "Curvas suaves...") and progress
 * chatter (MAPA %, Tamanho/Fila) that viewers don't care about — a live
 * viewer wants the game, a tiny live badge, the chat commands, and the
 * leaderboard. Everything else was cut, so this module shrank on purpose. */

export function formatMapTheme(theme: MapThemeId): string {
  switch (theme) {
    case "heart":
      return "Coração";
    case "brazil":
      return "Brasil";
    case "france":
      return "França";
    case "norway":
      return "Noruega";
    case "creeper":
      return "Creeper";
    default:
      return "Clássico";
  }
}

export function formatGameMode(mode: GameMode): string {
  switch (mode) {
    case "full_food":
      return "Mapa cheio";
    case "maze_race":
      return "Corrida no labirinto";
    case "maze_harvest":
      return "Colheita no labirinto";
    case "pudding":
      return "Blocos dinâmicos";
    default:
      return "Modo clássico";
  }
}

export const HUD_STRINGS = {
  live: "AO VIVO",
  liveBadge: "AO VIVO",
  // Stat pills and leaderboard counts use icons + the international words —
  // André's direction (26/07): the commands are "food" and "speed", period,
  // no PT translation ("todo brasileiro sabe o que é food e o que é speed");
  // 🍎 already says what food means, ⚡ what speed means.
  wins: (n: string) => `🏆 ${n}`,
  food: (n: string) => `🍎 ${n}`,
  level: (n: number) => `NV ${n}`,
  commentHeader: "COMENTE:",
  foodCommand: '"FOOD" = 🍎',
  speedCommand: '"SPEED" = ⚡',
  chatTitle: "MAIS CHAT",
  chatBody: "= MAIS RÁPIDO",
  objectiveTitle: "TOP CHAT",
  objectiveBody: "mais comentários",
  commentSpeedTitle: "VELOCIDADE DO COMENTÁRIO",
  topViewersTitle: "TOP ESPECTADORES",
  topChatTitle: "TOP DO CHAT",
  waitingForActivity: (rank: number) => `${rank}. aguardando atividade`,
  leaderboardRowLive: (rank: number, name: string, foodCount: number, speedCount: number) =>
    `${rank}   ${name}    🍎 ${foodCount}   ⚡ ${speedCount}`,
  leaderboardRowShorts: (rank: number, name: string, foodCount: number, speedCount: number) =>
    `${rank}. ${name}   🍎 ${foodCount}   ⚡ ${speedCount}`,

  speed: (n: string) => `SPEED x${n}`,
} as const;

export const SCREEN_STRINGS = {
  start: { title: "PREPARANDO", sub: "início automático" },
  victory: { title: "VITÓRIA!" },
  lost: { title: "PERDI!", sub: "reiniciando" },
  startButton: "INICIAR",
  victoryFinishedIn: (timer: string) => `terminou em ${timer}`,
  victoryFoodCollected: (score: number, foodGoal: number | null) =>
    `${score}${foodGoal !== null ? `/${foodGoal}` : ""} comidas coletadas`,
  victoryBoardCoverage: (percent: number) => `${percent}% do mapa coberto`,
} as const;
