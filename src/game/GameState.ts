import { FOOD_TYPES } from "./foodCatalog";
import { DEFAULT_CONFIG, type AvatarFood, type BoardFood, type Direction, type FoodType, type GameConfig, type GameState, type Rng, type Vec2 } from "./types";

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

function cellKey(pos: Vec2): string {
  return `${pos.x},${pos.y}`;
}

function occupiedCells(state: Pick<GameState, "snake" | "foods" | "walls">): Set<string> {
  const cells = new Set<string>();
  for (const seg of state.snake) cells.add(cellKey(seg));
  for (const food of state.foods) cells.add(cellKey(food.pos));
  for (const wall of state.walls) cells.add(wall);
  return cells;
}

function inBounds(pos: Vec2, boardWidth: number, boardHeight: number): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < boardWidth && pos.y < boardHeight;
}

function neighbors4(pos: Vec2): Vec2[] {
  return Object.values(DIRECTION_VECTORS).map((vec) => ({ x: pos.x + vec.x, y: pos.y + vec.y }));
}

function freeNeighborCount(pos: Vec2, occupied: Set<string>, boardWidth: number, boardHeight: number): number {
  return neighbors4(pos).filter((next) => inBounds(next, boardWidth, boardHeight) && !occupied.has(cellKey(next))).length;
}

function reachableCells(
  start: Vec2,
  occupied: Set<string>,
  boardWidth: number,
  boardHeight: number,
): Set<string> {
  const seen = new Set<string>();
  const startKey = cellKey(start);
  if (occupied.has(startKey)) return seen;
  const queue: Vec2[] = [start];
  seen.add(startKey);
  let cursor = 0;

  while (cursor < queue.length) {
    const current = queue[cursor++]!;
    for (const next of neighbors4(current)) {
      const nextKey = cellKey(next);
      if (!inBounds(next, boardWidth, boardHeight) || occupied.has(nextKey) || seen.has(nextKey)) continue;
      seen.add(nextKey);
      queue.push(next);
    }
  }

  return seen;
}

function randomEmptyCell(boardWidth: number, boardHeight: number, occupied: Set<string>, rng: Rng): Vec2 {
  const free: Vec2[] = [];
  for (let x = 0; x < boardWidth; x++) {
    for (let y = 0; y < boardHeight; y++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return { x: 0, y: 0 };
  const idx = Math.floor(rng() * free.length) % free.length;
  return free[idx]!;
}

function randomChoice<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length) % items.length]!;
}

function randomFoodType(config: GameConfig, rng: Rng): FoodType {
  const pool = config.foodTypes.length > 0 ? config.foodTypes : FOOD_TYPES;
  const index = Math.floor(rng() * pool.length) % pool.length;
  return pool[index]!;
}

function createBasicFood(id: string, pos: Vec2, type: FoodType): BoardFood {
  return { id, pos, type, kind: "basic" };
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function generateMazeWalls(config: GameConfig): Set<string> {
  const walls = new Set<string>();
  for (let x = 0; x < config.boardWidth; x++) {
    for (let y = 0; y < config.boardHeight; y++) {
      walls.add(`${x},${y}`);
    }
  }

  const start = { x: 1, y: 1 };
  const visited = new Set<string>([cellKey(start)]);
  const stack: Vec2[] = [start];
  walls.delete(cellKey(start));

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const candidates = shuffle([
      { x: current.x + 2, y: current.y, between: { x: current.x + 1, y: current.y } },
      { x: current.x - 2, y: current.y, between: { x: current.x - 1, y: current.y } },
      { x: current.x, y: current.y + 2, between: { x: current.x, y: current.y + 1 } },
      { x: current.x, y: current.y - 2, between: { x: current.x, y: current.y - 1 } },
    ], Math.random).filter((entry) => {
      if (entry.x <= 0 || entry.y <= 0 || entry.x >= config.boardWidth - 1 || entry.y >= config.boardHeight - 1) return false;
      return !visited.has(`${entry.x},${entry.y}`);
    });

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const next = candidates[0]!;
    visited.add(`${next.x},${next.y}`);
    walls.delete(`${next.x},${next.y}`);
    walls.delete(cellKey(next.between));
    stack.push({ x: next.x, y: next.y });
  }

  const loopCarves = Math.max(2, Math.floor((config.boardWidth * config.boardHeight) * 0.03));
  const removableWalls = shuffle([...walls].filter((wallKey) => {
    const [xText, yText] = wallKey.split(",");
    const x = Number(xText);
    const y = Number(yText);
    if (x <= 0 || y <= 0 || x >= config.boardWidth - 1 || y >= config.boardHeight - 1) return false;
    const horizontalOpen = !walls.has(`${x - 1},${y}`) && !walls.has(`${x + 1},${y}`);
    const verticalOpen = !walls.has(`${x},${y - 1}`) && !walls.has(`${x},${y + 1}`);
    return horizontalOpen || verticalOpen;
  }), Math.random);
  for (let i = 0; i < loopCarves && i < removableWalls.length; i++) {
    walls.delete(removableWalls[i]!);
  }

  const openCells = [...visited].map((entry) => {
    const [xText, yText] = entry.split(",");
    return { x: Number(xText), y: Number(yText) };
  });

  for (const cell of openCells) {
    const openNeighbors = neighbors4(cell).filter((next) => inBounds(next, config.boardWidth, config.boardHeight) && !walls.has(cellKey(next)));
    if (openNeighbors.length === 1 && Math.random() < 0.45) {
      const extensions = shuffle(neighbors4(cell), Math.random).filter((next) => {
        if (!inBounds(next, config.boardWidth, config.boardHeight)) return false;
        if (!walls.has(cellKey(next))) return false;
        const beyond = { x: next.x + (next.x - cell.x), y: next.y + (next.y - cell.y) };
        return inBounds(beyond, config.boardWidth, config.boardHeight) && !walls.has(cellKey(beyond));
      });
      if (extensions.length > 0) walls.delete(cellKey(extensions[0]!));
    }
  }

  for (let x = 1; x < config.boardWidth - 1; x++) {
    if (!walls.has(`${x},1`)) walls.delete(`${x},0`);
    if (!walls.has(`${x},${config.boardHeight - 2}`)) walls.delete(`${x},${config.boardHeight - 1}`);
  }
  for (let y = 1; y < config.boardHeight - 1; y++) {
    if (!walls.has(`1,${y}`)) walls.delete(`0,${y}`);
    if (!walls.has(`${config.boardWidth - 2},${y}`)) walls.delete(`${config.boardWidth - 1},${y}`);
  }

  ["1,1", "1,2", "2,1", "2,2"].forEach((openKey) => walls.delete(openKey));
  return walls;
}

function initialWalls(config: GameConfig): Set<string> {
  if (config.gameMode === "maze_race" || config.gameMode === "maze_harvest") return generateMazeWalls(config);
  return new Set<string>();
}

function initialSnake(config: GameConfig, walls: Set<string>): { snake: Vec2[]; direction: Direction } {
  if (config.gameMode !== "maze_race" && config.gameMode !== "maze_harvest") {
    return {
      snake: [
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ],
      direction: "right",
    };
  }

  const anchor = { x: 1, y: 1 };
  const neighbors = neighbors4(anchor).filter((pos) => inBounds(pos, config.boardWidth, config.boardHeight) && !walls.has(cellKey(pos)));
  const tail = neighbors.find((pos) => pos.y > anchor.y) ?? neighbors.find((pos) => pos.x > anchor.x) ?? neighbors[0] ?? { x: 1, y: 2 };
  return {
    snake: [anchor, tail],
    direction: tail.x < anchor.x ? "right" : tail.x > anchor.x ? "left" : tail.y < anchor.y ? "down" : "up",
  };
}

function farthestReachableCell(boardWidth: number, boardHeight: number, walls: Set<string>, start: Vec2): Vec2 {
  const queue: Vec2[] = [start];
  const seen = new Set<string>([cellKey(start)]);
  let cursor = 0;
  let farthest = start;
  while (cursor < queue.length) {
    const current = queue[cursor++]!;
    farthest = current;
    for (const vec of Object.values(DIRECTION_VECTORS)) {
      const next = { x: current.x + vec.x, y: current.y + vec.y };
      const key = cellKey(next);
      if (next.x < 0 || next.y < 0 || next.x >= boardWidth || next.y >= boardHeight) continue;
      if (walls.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return farthest;
}

function resolveConfig(config: Partial<GameConfig>): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    foodTypes: config.foodTypes && config.foodTypes.length > 0 ? config.foodTypes : DEFAULT_CONFIG.foodTypes,
  };
}

function playableCellCount(config: GameConfig, walls: Set<string>): number {
  return Math.max(1, (config.boardWidth * config.boardHeight) - walls.size);
}

function safeSpawnCandidates(config: GameConfig, snake: Vec2[], foods: BoardFood[], walls: Set<string>): Vec2[] {
  const occupied = occupiedCells({ snake, foods, walls });
  const bodyBlocked = new Set([...snake.slice(0, -1).map(cellKey), ...walls]);
  const reachable = reachableCells(snake[0]!, bodyBlocked, config.boardWidth, config.boardHeight);

  const free: Vec2[] = [];
  for (let x = 0; x < config.boardWidth; x++) {
    for (let y = 0; y < config.boardHeight; y++) {
      const pos = { x, y };
      const posKey = cellKey(pos);
      if (occupied.has(posKey)) continue;
      if (!reachable.has(posKey)) continue;
      if (freeNeighborCount(pos, occupied, config.boardWidth, config.boardHeight) < 2) continue;
      free.push(pos);
    }
  }
  return free;
}

function initialFoods(config: GameConfig, snake: Vec2[], walls: Set<string>, rng: Rng): BoardFood[] {
  const occupied = new Set([...snake.map(cellKey), ...walls]);
  if (config.gameMode === "maze_race") {
    const farthest = farthestReachableCell(config.boardWidth, config.boardHeight, walls, snake[0]!);
    return [createBasicFood("food-0", farthest, randomFoodType(config, rng))];
  }
  if (config.gameMode === "full_food") {
    const foods: BoardFood[] = [];
    let id = 0;
    for (let x = 0; x < config.boardWidth; x++) {
      for (let y = 0; y < config.boardHeight; y++) {
        const pos = { x, y };
        if (occupied.has(cellKey(pos))) continue;
        foods.push(createBasicFood(`food-${id++}`, pos, randomFoodType(config, rng)));
      }
    }
    return foods;
  }

  const safeCandidates = safeSpawnCandidates(config, snake, [], walls);
  const spawn = safeCandidates.length > 0
    ? randomChoice(safeCandidates, rng)
    : randomEmptyCell(config.boardWidth, config.boardHeight, occupied, rng);
  return [
    createBasicFood(
      "food-0",
      spawn,
      randomFoodType(config, rng),
    ),
  ];
}

export function createGame(config: Partial<GameConfig>, rng: Rng = Math.random): GameState {
  const resolvedConfig = resolveConfig(config);
  const walls = initialWalls(resolvedConfig);
  const { snake, direction } = initialSnake(resolvedConfig, walls);
  return {
    config: resolvedConfig,
    snake,
    direction,
    pendingDirection: null,
    foods: initialFoods(resolvedConfig, snake, walls, rng),
    foodQueue: [],
    status: "start",
    score: 0,
    breadsEaten: 0,
    revealedCells: new Set(snake.map(cellKey)),
    level: 1,
    walls,
  };
}

export function setDirection(state: GameState, dir: Direction): GameState {
  const isReversal = state.snake.length > 1 && dir === OPPOSITE[state.direction];
  if (isReversal) return { ...state, pendingDirection: null };
  return { ...state, pendingDirection: dir };
}

function isOutOfBounds(pos: Vec2, boardWidth: number, boardHeight: number): boolean {
  return pos.x < 0 || pos.y < 0 || pos.x >= boardWidth || pos.y >= boardHeight;
}

function maybeAddPuddingWall(state: GameState, snake: Vec2[], foods: BoardFood[], rng: Rng): Set<string> {
  if (state.config.gameMode !== "pudding") return state.walls;
  if ((state.score + 1) % 2 === 0) return state.walls;
  const blocked = occupiedCells({ snake, foods, walls: state.walls });
  const candidates: Vec2[] = [];
  for (let x = 0; x < state.config.boardWidth; x++) {
    for (let y = 0; y < state.config.boardHeight; y++) {
      const pos = { x, y };
      const key = cellKey(pos);
      if (blocked.has(key)) continue;
      if (Math.abs(pos.x - snake[0]!.x) + Math.abs(pos.y - snake[0]!.y) <= 3) continue;
      if (neighbors4(pos).some((neighbor) => state.walls.has(cellKey(neighbor)))) continue;
      const occupiedIfPlaced = new Set([...blocked, key]);
      if (freeNeighborCount(pos, blocked, state.config.boardWidth, state.config.boardHeight) < 2) continue;
      const reachableAfterPlacement = reachableCells(snake[0]!, new Set([...snake.slice(0, -1).map(cellKey), ...state.walls, key]), state.config.boardWidth, state.config.boardHeight);
      if (foods.some((food) => !reachableAfterPlacement.has(cellKey(food.pos)))) continue;
      const borderTrap = (pos.x === 1 || pos.y === 1 || pos.x === state.config.boardWidth - 2 || pos.y === state.config.boardHeight - 2)
        && freeNeighborCount(pos, occupiedIfPlaced, state.config.boardWidth, state.config.boardHeight) < 2;
      if (borderTrap) continue;
      candidates.push(pos);
    }
  }
  if (candidates.length === 0) return state.walls;
  const selected = candidates[Math.floor(rng() * candidates.length) % candidates.length]!;
  return new Set([...state.walls, cellKey(selected)]);
}

function ensureBasicFood(state: GameState, rng: Rng): BoardFood[] {
  if (state.config.gameMode === "full_food" || state.config.gameMode === "maze_race") return state.foods;
  if (state.foods.some((food) => food.kind === "basic")) return state.foods;
  const occupied = occupiedCells(state);
  const safeCandidates = safeSpawnCandidates(state.config, state.snake, state.foods, state.walls);
  const pos = safeCandidates.length > 0
    ? randomChoice(safeCandidates, rng)
    : randomEmptyCell(state.config.boardWidth, state.config.boardHeight, occupied, rng);
  return [
    ...state.foods,
    createBasicFood(`food-${state.score}-${state.snake.length}`, pos, randomFoodType(state.config, rng)),
  ];
}

function promoteQueuedFood(state: GameState, foods: BoardFood[], queue: BoardFood[], rng: Rng): { foods: BoardFood[]; queue: BoardFood[] } {
  if (queue.length === 0) return { foods, queue };
  const [promoted, ...rest] = queue;
  const occupied = occupiedCells({ snake: state.snake, foods, walls: state.walls });
  const pos = randomEmptyCell(state.config.boardWidth, state.config.boardHeight, occupied, rng);
  return {
    foods: [...foods, { ...promoted, pos }],
    queue: rest,
  };
}

export function tick(state: GameState, rng: Rng = Math.random): GameState {
  if (state.status !== "playing") return state;

  const direction = state.pendingDirection ?? state.direction;
  const vec = DIRECTION_VECTORS[direction];
  const head = state.snake[0]!;
  const nextHead: Vec2 = { x: head.x + vec.x, y: head.y + vec.y };

  if (isOutOfBounds(nextHead, state.config.boardWidth, state.config.boardHeight)) {
    return { ...state, status: "lost", direction, pendingDirection: null };
  }
  if (state.walls.has(cellKey(nextHead))) {
    return { ...state, status: "lost", direction, pendingDirection: null };
  }

  const eatenFoodIndex = state.foods.findIndex((food) => food.pos.x === nextHead.x && food.pos.y === nextHead.y);
  const eatenFood = eatenFoodIndex === -1 ? null : state.foods[eatenFoodIndex]!;
  const isGrowing = Boolean(eatenFood);
  const bodyToCheck = isGrowing ? state.snake : state.snake.slice(0, -1);
  const hitsSelf = bodyToCheck.some((seg) => seg.x === nextHead.x && seg.y === nextHead.y);
  if (hitsSelf) {
    return { ...state, status: "lost", direction, pendingDirection: null };
  }

  const newSnake = isGrowing
    ? [nextHead, ...state.snake]
    : [nextHead, ...state.snake.slice(0, -1)];

  const revealedCells = new Set(state.revealedCells);
  revealedCells.add(cellKey(nextHead));

  if (eatenFood && state.config.gameMode === "maze_race") {
    return {
      ...state,
      snake: newSnake,
      direction,
      pendingDirection: null,
      status: "victory",
      score: state.score + 1,
      breadsEaten: state.breadsEaten + (eatenFood.type === "bread" ? 1 : 0),
      revealedCells,
    };
  }

  if (newSnake.length >= playableCellCount(state.config, state.walls)) {
    return {
      ...state,
      snake: newSnake,
      direction,
      pendingDirection: null,
      status: "victory",
      revealedCells,
    };
  }

  let foods = state.foods;
  let foodQueue = state.foodQueue;
  let score = state.score;
  let breadsEaten = state.breadsEaten;
  let walls = state.walls;

  if (eatenFood) {
    score += 1;
    if (eatenFood.type === "bread") breadsEaten += 1;
    foods = state.foods.filter((_, index) => index !== eatenFoodIndex);
    if (eatenFood.kind === "avatar") {
      const promoted = promoteQueuedFood({ ...state, snake: newSnake }, foods, foodQueue, rng);
      foods = promoted.foods;
      foodQueue = promoted.queue;
    }
    walls = maybeAddPuddingWall(state, newSnake, foods, rng);
  }

  if (newSnake.length >= playableCellCount(state.config, walls)) {
    return {
      ...state,
      snake: newSnake,
      direction,
      pendingDirection: null,
      foods,
      foodQueue,
      score,
      breadsEaten,
      revealedCells,
      walls,
      status: "victory",
    };
  }

  const ensuredFoods = ensureBasicFood({ ...state, snake: newSnake, foods, walls }, rng);

  return {
    ...state,
    snake: newSnake,
    direction,
    pendingDirection: null,
    foods: ensuredFoods,
    foodQueue,
    score,
    breadsEaten,
    revealedCells,
    walls,
  };
}

export function enqueueAvatarFood(state: GameState, food: Omit<AvatarFood, "pos">, rng: Rng = Math.random): GameState {
  const avatarFood: BoardFood = {
    id: food.id,
    pos: { x: -1, y: -1 },
    type: randomFoodType(state.config, rng),
    kind: "avatar",
    avatarUrl: food.avatarUrl,
    authorName: food.authorName,
  };
  const avatarCount = state.foods.filter((entry) => entry.kind === "avatar").length;
  if (avatarCount < state.config.maxAvatarFoods) {
    const occupied = occupiedCells(state);
    const pos = randomEmptyCell(state.config.boardWidth, state.config.boardHeight, occupied, rng);
    return { ...state, foods: [...state.foods, { ...avatarFood, pos }] };
  }
  return { ...state, foodQueue: [...state.foodQueue, avatarFood] };
}

export function nextGrowthConfig(config: GameConfig): GameConfig {
  if (!config.growthEnabled) return config;
  return {
    ...config,
    boardWidth: Math.min(config.maxBoardWidth, config.boardWidth + 2),
    boardHeight: Math.min(config.maxBoardHeight, config.boardHeight + 1),
  };
}
