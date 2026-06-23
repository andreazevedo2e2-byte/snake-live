import type {
  AvatarFood,
  Direction,
  GameConfig,
  GameState,
  Rng,
  Vec2,
} from "./types";

const DIRECTION_VECTORS: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function occupiedCells(state: GameState): Set<string> {
  const cells = new Set<string>();
  for (const seg of state.snake) cells.add(`${seg.x},${seg.y}`);
  cells.add(`${state.baseApple.x},${state.baseApple.y}`);
  for (const food of state.avatarFoods) cells.add(`${food.pos.x},${food.pos.y}`);
  return cells;
}

function randomEmptyCell(
  boardSize: number,
  occupied: Set<string>,
  rng: Rng
): Vec2 {
  const free: Vec2[] = [];
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) {
    // Board is full; caller is expected to have already detected victory.
    return { x: 0, y: 0 };
  }
  const idx = Math.floor(rng() * free.length) % free.length;
  return free[idx];
}

export function createGame(config: GameConfig, rng: Rng = Math.random): GameState {
  const snake: Vec2[] = [
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ];
  const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
  const baseApple = randomEmptyCell(config.boardSize, occupied, rng);

  return {
    config,
    snake,
    direction: "right",
    pendingDirection: null,
    baseApple,
    avatarFoods: [],
    avatarQueue: [],
    status: "start",
    score: 0,
  };
}

export function setDirection(state: GameState, dir: Direction): GameState {
  const isReversal = state.snake.length > 1 && dir === OPPOSITE[state.direction];
  if (isReversal) return { ...state, pendingDirection: null };
  return { ...state, pendingDirection: dir };
}

function isOutOfBounds(pos: Vec2, boardSize: number): boolean {
  return pos.x < 0 || pos.y < 0 || pos.x >= boardSize || pos.y >= boardSize;
}

export function tick(state: GameState, rng: Rng = Math.random): GameState {
  if (state.status !== "playing") return state;

  const direction = state.pendingDirection ?? state.direction;
  const vec = DIRECTION_VECTORS[direction];
  const head = state.snake[0];
  const nextHead: Vec2 = { x: head.x + vec.x, y: head.y + vec.y };

  if (isOutOfBounds(nextHead, state.config.boardSize)) {
    return { ...state, status: "lost", direction, pendingDirection: null };
  }

  const eatsBaseApple =
    nextHead.x === state.baseApple.x && nextHead.y === state.baseApple.y;
  const eatenAvatarIndex = state.avatarFoods.findIndex(
    (f) => f.pos.x === nextHead.x && f.pos.y === nextHead.y
  );
  const eatsAvatarFood = eatenAvatarIndex !== -1;
  const isGrowing = eatsBaseApple || eatsAvatarFood;

  // Classic rule: the tail cell vacates this tick unless the snake is growing.
  const bodyToCheck = isGrowing ? state.snake : state.snake.slice(0, -1);
  const hitsSelf = bodyToCheck.some((seg) => seg.x === nextHead.x && seg.y === nextHead.y);
  if (hitsSelf) {
    return { ...state, status: "lost", direction, pendingDirection: null };
  }

  const newSnake = isGrowing
    ? [nextHead, ...state.snake]
    : [nextHead, ...state.snake.slice(0, -1)];

  if (newSnake.length >= state.config.boardSize * state.config.boardSize) {
    return {
      ...state,
      snake: newSnake,
      direction,
      pendingDirection: null,
      status: "victory",
    };
  }

  let avatarFoods = state.avatarFoods;
  let avatarQueue = state.avatarQueue;
  let baseApple = state.baseApple;
  let score = state.score;

  if (eatsAvatarFood) {
    score += 1;
    avatarFoods = state.avatarFoods.filter((_, i) => i !== eatenAvatarIndex);
    if (avatarQueue.length > 0) {
      const [promoted, ...rest] = avatarQueue;
      const occupied = occupiedCells({ ...state, snake: newSnake, avatarFoods });
      const pos = randomEmptyCell(state.config.boardSize, occupied, rng);
      avatarFoods = [...avatarFoods, { ...promoted, pos }];
      avatarQueue = rest;
    }
  }

  if (eatsBaseApple) {
    score += 1;
    const occupied = occupiedCells({ ...state, snake: newSnake, avatarFoods });
    baseApple = randomEmptyCell(state.config.boardSize, occupied, rng);
  }

  return {
    ...state,
    snake: newSnake,
    direction,
    pendingDirection: null,
    baseApple,
    avatarFoods,
    avatarQueue,
    score,
  };
}

export function enqueueAvatarFood(
  state: GameState,
  food: Omit<AvatarFood, "pos">,
  rng: Rng = Math.random
): GameState {
  if (state.avatarFoods.length < state.config.maxAvatarFoods) {
    const occupied = occupiedCells(state);
    const pos = randomEmptyCell(state.config.boardSize, occupied, rng);
    return { ...state, avatarFoods: [...state.avatarFoods, { ...food, pos }] };
  }
  return { ...state, avatarQueue: [...state.avatarQueue, { ...food, pos: { x: -1, y: -1 } }] };
}
