import { FOOD_TYPES } from "./foodCatalog";
import { DEFAULT_CONFIG, defaultFoodGoal, type AvatarFood, type BoardFood, type Direction, type FoodType, type GameConfig, type GameState, type Rng, type Vec2 } from "./types";

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

function firstOpenCell(boardWidth: number, boardHeight: number, walls: Set<string>, preferred: Vec2[] = []): Vec2 {
  for (const cell of preferred) {
    if (inBounds(cell, boardWidth, boardHeight) && !walls.has(cellKey(cell))) return cell;
  }
  for (let y = 0; y < boardHeight; y++) {
    for (let x = 0; x < boardWidth; x++) {
      const cell = { x, y };
      if (!walls.has(cellKey(cell))) return cell;
    }
  }
  return { x: 0, y: 0 };
}

function generateMazeWalls(config: GameConfig, rng: Rng): Set<string> {
  const width = config.boardWidth;
  const height = config.boardHeight;
  const mazeWidth = width % 2 === 0 ? width - 1 : width;
  const mazeHeight = height % 2 === 0 ? height - 1 : height;
  const carved = new Set<string>();
  const visited = new Set<string>();
  const stack: Vec2[] = [{ x: 1, y: 1 }];
  const directions = [
    { x: 2, y: 0 },
    { x: -2, y: 0 },
    { x: 0, y: 2 },
    { x: 0, y: -2 },
  ];

  const insideMaze = (pos: Vec2): boolean =>
    pos.x > 0 && pos.y > 0 && pos.x < mazeWidth - 1 && pos.y < mazeHeight - 1;

  const shuffleDirections = (): typeof directions => {
    const copy = [...directions];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };

  carved.add("1,1");
  visited.add("1,1");

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const nextDirection = shuffleDirections().find((dir) => {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      return insideMaze(next) && !visited.has(cellKey(next));
    });

    if (!nextDirection) {
      stack.pop();
      continue;
    }

    const next = { x: current.x + nextDirection.x, y: current.y + nextDirection.y };
    const between = { x: current.x + nextDirection.x / 2, y: current.y + nextDirection.y / 2 };
    visited.add(cellKey(next));
    carved.add(cellKey(between));
    carved.add(cellKey(next));
    stack.push(next);
  }

  const walls = new Set<string>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const pos = { x, y };
      const onBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (onBorder) continue;
      if (!carved.has(cellKey(pos))) walls.add(cellKey(pos));
    }
  }

  const reserved = new Set(["1,1", "1,2", "2,1", "2,2"]);
  for (const cell of reserved) walls.delete(cell);
  return walls;
}

function initialWalls(config: GameConfig, rng: Rng): Set<string> {
  if (config.gameMode === "maze_race" || config.gameMode === "maze_harvest") return generateMazeWalls(config, rng);
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

  const anchor = firstOpenCell(config.boardWidth, config.boardHeight, walls, [
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 1 },
  ]);
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
  const merged = {
    ...DEFAULT_CONFIG,
    ...config,
    foodTypes: config.foodTypes && config.foodTypes.length > 0 ? config.foodTypes : DEFAULT_CONFIG.foodTypes,
  };
  // Most callers build configs by spreading DEFAULT_CONFIG (which itself has
  // foodGoal: null) and overriding a few fields, so plain undefined-checking
  // can't tell "caller wants the default" from "caller inherited null from
  // the spread." Only a concrete number counts as an explicit override —
  // anything else re-derives the goal from the (possibly just-overridden)
  // board size and game mode.
  return {
    ...merged,
    foodGoal: typeof config.foodGoal === "number" ? config.foodGoal : defaultFoodGoal(merged),
  };
}

function playableCellCount(config: GameConfig, walls: Set<string>): number {
  return Math.max(1, (config.boardWidth * config.boardHeight) - walls.size);
}

function safeSpawnCandidates(config: GameConfig, snake: Vec2[], foods: BoardFood[], walls: Set<string>): Vec2[] {
  const occupied = occupiedCells({ snake, foods, walls });
  // Body minus both head (the BFS start, must not be pre-blocked) and tail
  // (vacates this tick unless the snake grows).
  const bodyBlocked = new Set([...snake.slice(1, -1).map(cellKey), ...walls]);
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

/** The one spawn path every food origin (initial, reposition, avatar, queue
 * promotion) must go through: prefer a cell the head can actually reach with
 * room to maneuver, falling back to any free cell only when the board is so
 * packed that no such candidate exists. On walled boards, a maze corridor
 * has no loops to circle back through, so committing to a straight dead-end
 * stretch to reach food is the actual cause of traps — junction cells (3+
 * open neighbors) keep an escape option open, so prefer those when any
 * exist instead of treating every 2-neighbor corridor cell as equally safe. */
function pickSafeSpawn(config: GameConfig, snake: Vec2[], foods: BoardFood[], walls: Set<string>, rng: Rng): Vec2 {
  const safeCandidates = safeSpawnCandidates(config, snake, foods, walls);
  if (safeCandidates.length > 0) {
    if (walls.size > 0) {
      const occupied = occupiedCells({ snake, foods, walls });
      const junctions = safeCandidates.filter(
        (pos) => freeNeighborCount(pos, occupied, config.boardWidth, config.boardHeight) >= 3,
      );
      if (junctions.length > 0) return randomChoice(junctions, rng);
    }
    return randomChoice(safeCandidates, rng);
  }
  const occupied = occupiedCells({ snake, foods, walls });
  return randomEmptyCell(config.boardWidth, config.boardHeight, occupied, rng);
}

const STUCK_FOOD_RELOCATE_TICKS = 8;

/** Self-heal: any food that stays unreachable from the head for too many
 * consecutive ticks (e.g. sealed off by a freshly placed wall) gets moved to
 * a safe cell instead of permanently stalling the round. */
function relocateStuckFoods(
  config: GameConfig,
  snake: Vec2[],
  foods: BoardFood[],
  walls: Set<string>,
  blockedTicks: Record<string, number>,
  rng: Rng,
): { foods: BoardFood[]; foodBlockedTicks: Record<string, number> } {
  const bodyBlocked = new Set([...snake.slice(1, -1).map(cellKey), ...walls]);
  const reachable = reachableCells(snake[0]!, bodyBlocked, config.boardWidth, config.boardHeight);

  let nextFoods = foods;
  const nextBlockedTicks: Record<string, number> = {};

  for (const food of foods) {
    const isReachable = reachable.has(cellKey(food.pos));
    const count = isReachable ? 0 : (blockedTicks[food.id] ?? 0) + 1;
    if (count >= STUCK_FOOD_RELOCATE_TICKS) {
      const pos = pickSafeSpawn(config, snake, nextFoods, walls, rng);
      nextFoods = nextFoods.map((entry) => (entry.id === food.id ? { ...entry, pos } : entry));
      nextBlockedTicks[food.id] = 0;
    } else {
      nextBlockedTicks[food.id] = count;
    }
  }

  return { foods: nextFoods, foodBlockedTicks: nextBlockedTicks };
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

  const spawn = pickSafeSpawn(config, snake, [], walls, rng);
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
  const walls = initialWalls(resolvedConfig, rng);
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
    foodBlockedTicks: {},
    willMakeError: rng() < resolvedConfig.humanErrorRate,
    humanErrorUsed: false,
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

/** Returns true if placing a wall at `pos` would complete a 2×2 solid block of
 * walls. Checked by inspecting all four 2×2 grids that include `pos`. */
function createsSolidBlock(pos: Vec2, walls: Set<string>, boardWidth: number, boardHeight: number): boolean {
  for (let dx = 0; dx <= 1; dx++) {
    for (let dy = 0; dy <= 1; dy++) {
      const topLeft = { x: pos.x - dx, y: pos.y - dy };
      let allWalls = true;
      outer: for (let bx = 0; bx <= 1; bx++) {
        for (let by = 0; by <= 1; by++) {
          const cell = { x: topLeft.x + bx, y: topLeft.y + by };
          if (!inBounds(cell, boardWidth, boardHeight)) { allWalls = false; break outer; }
          const key = cellKey(cell);
          if (key !== cellKey(pos) && !walls.has(key)) { allWalls = false; break outer; }
        }
      }
      if (allWalls) return true;
    }
  }
  return false;
}

/** Returns true if all non-wall cells remain in one connected component after
 * placing a wall at `pos`. Prevents isolated pockets where food could get
 * permanently trapped even if the snake itself can still reach all current
 * food positions. */
function isConnectedAfterWall(pos: Vec2, walls: Set<string>, boardWidth: number, boardHeight: number): boolean {
  const newWalls = new Set([...walls, cellKey(pos)]);
  let start: Vec2 | null = null;
  let totalFree = 0;
  for (let x = 0; x < boardWidth; x++) {
    for (let y = 0; y < boardHeight; y++) {
      if (!newWalls.has(`${x},${y}`)) {
        if (!start) start = { x, y };
        totalFree++;
      }
    }
  }
  if (!start || totalFree === 0) return false;
  return reachableCells(start, newWalls, boardWidth, boardHeight).size === totalFree;
}

function maybeAddPuddingWall(state: GameState, snake: Vec2[], foods: BoardFood[], rng: Rng): Set<string> {
  if (state.config.gameMode !== "pudding") return state.walls;
  if ((state.score + 1) % 2 === 0) return state.walls;
  const maxWalls = Math.floor((state.config.boardWidth * state.config.boardHeight) * 0.12);
  if (state.walls.size >= maxWalls) return state.walls;
  const blocked = occupiedCells({ snake, foods, walls: state.walls });
  const candidates: Vec2[] = [];
  for (let x = 0; x < state.config.boardWidth; x++) {
    for (let y = 0; y < state.config.boardHeight; y++) {
      const pos = { x, y };
      const key = cellKey(pos);
      if (blocked.has(key)) continue;
      if (Math.abs(pos.x - snake[0]!.x) + Math.abs(pos.y - snake[0]!.y) <= 3) continue;
      if (neighbors4(pos).some((neighbor) => state.walls.has(cellKey(neighbor)))) continue;
      if (freeNeighborCount(pos, blocked, state.config.boardWidth, state.config.boardHeight) < 2) continue;
      if (createsSolidBlock(pos, state.walls, state.config.boardWidth, state.config.boardHeight)) continue;
      if (!isConnectedAfterWall(pos, state.walls, state.config.boardWidth, state.config.boardHeight)) continue;
      const reachableAfterPlacement = reachableCells(snake[0]!, new Set([...snake.slice(1, -1).map(cellKey), ...state.walls, key]), state.config.boardWidth, state.config.boardHeight);
      if (reachableAfterPlacement.size < snake.length + 10) continue;
      if (foods.some((food) => !reachableAfterPlacement.has(cellKey(food.pos)))) continue;
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
  const pos = pickSafeSpawn(state.config, state.snake, state.foods, state.walls, rng);
  return [
    ...state.foods,
    createBasicFood(`food-${state.score}-${state.snake.length}`, pos, randomFoodType(state.config, rng)),
  ];
}

function promoteQueuedFood(state: GameState, foods: BoardFood[], queue: BoardFood[], rng: Rng): { foods: BoardFood[]; queue: BoardFood[] } {
  if (queue.length === 0) return { foods, queue };
  const [promoted, ...rest] = queue;
  const pos = pickSafeSpawn(state.config, state.snake, foods, state.walls, rng);
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

  // maze_race's only "basic" food is the single target fruit placed at the
  // maze's farthest reachable cell (ensureBasicFood skips this mode, so no
  // other basic food ever spawns) — avatar foods from chat score and get
  // eaten normally below, but only the target ends the round.
  const eatsMazeRaceTarget = Boolean(eatenFood) && state.config.gameMode === "maze_race" && eatenFood!.kind === "basic";

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

  // Three ways to win: the board is completely full (small classic/full_food
  // boards, or a rare early full-clear), the round has a food-count goal
  // (large open boards and every walled mode) and just reached it, or —
  // maze_race only — the target fruit itself was just eaten.
  const boardFilled = newSnake.length >= playableCellCount(state.config, walls);
  const goalReached = state.config.foodGoal !== null && score >= state.config.foodGoal;
  if (boardFilled || goalReached || eatsMazeRaceTarget) {
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
  // relocateStuckFoods exists only to recover from a pudding wall sealing off food
  // permanently. On wall-less boards (and on maze boards where walls are static and
  // food is always placed reachably), temporary body-blocking resolves on its own —
  // running this there would spuriously teleport the apple mid-game.
  const healed = state.config.gameMode === "pudding"
    ? relocateStuckFoods(state.config, newSnake, ensuredFoods, walls, state.foodBlockedTicks, rng)
    : { foods: ensuredFoods, foodBlockedTicks: state.foodBlockedTicks };

  return {
    ...state,
    snake: newSnake,
    direction,
    pendingDirection: null,
    foods: healed.foods,
    foodQueue,
    score,
    breadsEaten,
    revealedCells,
    walls,
    foodBlockedTicks: healed.foodBlockedTicks,
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
    const pos = pickSafeSpawn(state.config, state.snake, state.foods, state.walls, rng);
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
