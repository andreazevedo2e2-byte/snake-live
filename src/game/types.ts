export type Direction = "up" | "down" | "left" | "right";

export interface Vec2 {
  x: number;
  y: number;
}

export interface AvatarFood {
  id: string;
  pos: Vec2;
  avatarUrl: string;
  authorName: string;
}

export type FoodType = "apple_red" | "apple_gold" | "bread" | "watermelon";
export type FoodKind = "basic" | "avatar";
export type MapThemeId = "classic" | "heart" | "brazil" | "france" | "norway" | "creeper";
export type GameMode = "classic" | "full_food" | "maze_race" | "maze_harvest" | "pudding";
export type ColorMode = "gradient" | "map";
export type SnakeStyle = "smooth" | "google";
export type CommentSpeedMode = "gradual" | "fixed";
export type InterfaceMode = "live" | "shorts";

export interface BoardFood {
  id: string;
  pos: Vec2;
  type: FoodType;
  kind: FoodKind;
  avatarUrl?: string;
  authorName?: string;
}

export type GameStatus = "start" | "playing" | "victory" | "lost";

export interface GameConfig {
  boardWidth: number;
  boardHeight: number;
  maxAvatarFoods: number;
  mapTheme: MapThemeId;
  gameMode: GameMode;
  foodTypes: FoodType[];
  colorMode: ColorMode;
  snakeStyle: SnakeStyle;
  commentSpeedMode: CommentSpeedMode;
  interfaceMode: InterfaceMode;
  commentSpeedStart: number;
  gradientSpeed: number;
  baseSpeedMultiplier: number;
  humanErrorRate: number;
  growthEnabled: boolean;
  maxBoardWidth: number;
  maxBoardHeight: number;
  /** Score at which the round wins instead of requiring a full board clear.
   * `null` means "no goal, win by filling the board" (small classic/full_food
   * boards, and maze_race which wins on its target fruit instead of score).
   * Left unset by callers, `resolveConfig` fills this in via
   * `defaultFoodGoal` so large/walled boards always have a reachable finish. */
  foodGoal: number | null;
}

export const DEFAULT_CONFIG: GameConfig = {
  boardWidth: 10,
  boardHeight: 8,
  maxAvatarFoods: 3,
  mapTheme: "classic",
  gameMode: "classic",
  foodTypes: ["apple_red"],
  colorMode: "gradient",
  snakeStyle: "smooth",
  commentSpeedMode: "gradual",
  interfaceMode: "shorts",
  commentSpeedStart: 1,
  gradientSpeed: 0.04,
  baseSpeedMultiplier: 1,
  humanErrorRate: 0.2,
  growthEnabled: false,
  maxBoardWidth: 36,
  maxBoardHeight: 24,
  foodGoal: null,
};

const MIN_FOOD_GOAL = 6;
const LARGE_BOARD_CELL_THRESHOLD = 150;
const CLASSIC_LARGE_BOARD_GOAL_RATIO = 0.35;
const MAZE_HARVEST_GOAL_RATIO = 0.20;
const PUDDING_GOAL_RATIO = 0.3;

/** Rounds that can't realistically finish by filling the whole board (large
 * open maps, or any board with walls eating into the playable space) get a
 * proportional food-count goal instead, so every configuration has a
 * reachable finish at live-friendly pacing (a few minutes per round). */
export function defaultFoodGoal(config: Pick<GameConfig, "boardWidth" | "boardHeight" | "gameMode">): number | null {
  const cells = config.boardWidth * config.boardHeight;
  switch (config.gameMode) {
    case "maze_harvest":
      return Math.max(MIN_FOOD_GOAL, Math.round(cells * MAZE_HARVEST_GOAL_RATIO));
    case "pudding":
      return Math.max(MIN_FOOD_GOAL, Math.round(cells * PUDDING_GOAL_RATIO));
    case "maze_race":
      return null;
    default:
      return cells > LARGE_BOARD_CELL_THRESHOLD
        ? Math.max(MIN_FOOD_GOAL, Math.round(cells * CLASSIC_LARGE_BOARD_GOAL_RATIO))
        : null;
  }
}

export interface GameState {
  config: GameConfig;
  snake: Vec2[];
  direction: Direction;
  pendingDirection: Direction | null;
  foods: BoardFood[];
  foodQueue: BoardFood[];
  status: GameStatus;
  score: number;
  breadsEaten: number;
  revealedCells: Set<string>;
  level: number;
  walls: Set<string>;
  /** Consecutive ticks each food id has been unreachable from the head;
   * a food crossing the relocation threshold gets moved to a safe cell. */
  foodBlockedTicks: Record<string, number>;
  /** Rolled once at round creation from config.humanErrorRate. True means the
   * autopilot will deliberately make one bad move this round for drama. */
  willMakeError: boolean;
  /** Set to true once the round's deliberate mistake has been executed, so
   * only exactly one error fires per round regardless of tick count. */
  humanErrorUsed: boolean;
}

export type Rng = () => number;
