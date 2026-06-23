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

export type GameStatus = "start" | "playing" | "victory" | "lost";

export interface GameConfig {
  boardSize: number;
  maxAvatarFoods: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  boardSize: 12,
  maxAvatarFoods: 8,
};

export interface GameState {
  config: GameConfig;
  snake: Vec2[];
  direction: Direction;
  pendingDirection: Direction | null;
  baseApple: Vec2;
  avatarFoods: AvatarFood[];
  avatarQueue: AvatarFood[];
  status: GameStatus;
  score: number;
}

export type Rng = () => number;
