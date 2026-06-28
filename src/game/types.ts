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
export type MapThemeId = "classic" | "heart" | "brazil" | "creeper";
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
  maxBoardWidth: 18,
  maxBoardHeight: 14,
};

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
}

export type Rng = () => number;
