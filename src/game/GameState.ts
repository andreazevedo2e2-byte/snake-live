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

/** A recursive-backtracker maze normally carves a lattice of "node" cells
 * spaced 2 apart, with a wall-or-corridor cell between each pair of adjacent
 * nodes. Anchoring that lattice to the far edge (width-1 / height-1) instead
 * of always starting at 0 means an even dimension still lands a node exactly
 * on that border — only the one edge that can't also be a node (only one
 * parity can hit both ends unless the dimension is odd) ends up as a single
 * genuine boundary wall, never a free ring around the whole board and never
 * an extra dead strip inside it. Because this is a spanning TREE (no loops),
 * full connectivity and "no fully-walled internal row/column" both follow
 * automatically: a disconnecting row/column would require a cycle around it,
 * which a tree by definition cannot contain.
 */
function generateMazeWalls(config: GameConfig, rng: Rng): Set<string> {
  const width = config.boardWidth;
  const height = config.boardHeight;
  const parityX = (width - 1) % 2;
  const parityY = (height - 1) % 2;

  const nodeDirections = [
    { x: 2, y: 0 },
    { x: -2, y: 0 },
    { x: 0, y: 2 },
    { x: 0, y: -2 },
  ];

  const shuffled = (): typeof nodeDirections => {
    const copy = [...nodeDirections];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };

  const start: Vec2 = { x: parityX, y: parityY };
  const carved = new Set<string>([cellKey(start)]);
  const visited = new Set<string>([cellKey(start)]);
  const stack: Vec2[] = [start];

  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const next = shuffled()
      .map((dir) => ({ x: current.x + dir.x, y: current.y + dir.y }))
      .find((pos) => pos.x >= 0 && pos.y >= 0 && pos.x < width && pos.y < height && !visited.has(cellKey(pos)));

    if (!next) {
      stack.pop();
      continue;
    }

    const between = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };
    visited.add(cellKey(next));
    carved.add(cellKey(between));
    carved.add(cellKey(next));
    stack.push(next);
  }

  const walls = new Set<string>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const pos = { x, y };
      if (!carved.has(cellKey(pos))) walls.add(cellKey(pos));
    }
  }
  return braidMaze(width, height, walls, rng, MAZE_BRAID_FRACTION);
}

// A pure spanning tree has no loops at all, which means every branch that
// isn't exactly where the round ends is an unconditional trap: the no-U-turn
// rule blocks ever backing out of a 1-wide dead-end corridor, no matter how
// far away it is. A real maze still needs *some* alternate routes for a
// growing snake to have any realistic chance of surviving to a food goal —
// braiding at 1.0 resolves every dead end into a small loop, so the "maze"
// keeps its 1-wide-corridor character (most cells still have only 2 open
// neighbors) without the guaranteed-fatal branches a true tree produces.
const MAZE_BRAID_FRACTION = 1;

/** Resolves dead ends into small loops: for each free cell with exactly one
 * free neighbor (a leaf of the spanning tree), knock down one of its wall
 * neighbors that also touches a *different* already-free cell, connecting
 * the dead end to another part of the maze. Braiding only ever removes
 * walls, so it can only add connectivity — it can never break the
 * invariants generateMazeWalls already guarantees (full connectivity, no
 * dead strip, a bordered perimeter). */
function braidMaze(width: number, height: number, walls: Set<string>, rng: Rng, fraction: number): Set<string> {
  const result = new Set(walls);
  const isFree = (pos: Vec2): boolean => inBounds(pos, width, height) && !result.has(cellKey(pos));

  const deadEnds: Vec2[] = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const pos = { x, y };
      if (!isFree(pos)) continue;
      if (neighbors4(pos).filter(isFree).length === 1) deadEnds.push(pos);
    }
  }

  for (const deadEnd of deadEnds) {
    if (rng() > fraction) continue;
    const candidates = neighbors4(deadEnd).filter((wallPos) => {
      if (!inBounds(wallPos, width, height) || isFree(wallPos)) return false;
      return neighbors4(wallPos).some(
        (beyond) => !(beyond.x === deadEnd.x && beyond.y === deadEnd.y) && isFree(beyond),
      );
    });
    if (candidates.length === 0) continue;
    const chosen = candidates[Math.floor(rng() * candidates.length) % candidates.length]!;
    result.delete(cellKey(chosen));
  }

  return result;
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

  const isFree = (pos: Vec2): boolean =>
    inBounds(pos, config.boardWidth, config.boardHeight) && !walls.has(cellKey(pos));
  const pickTail = (anchor: Vec2, free: Vec2[]): Vec2 =>
    free.find((pos) => pos.y > anchor.y) ?? free.find((pos) => pos.x > anchor.x) ?? free[0]!;

  // The maze generator's own DFS start cell is *always* a degree-1 leaf: its
  // neighbors all get absorbed into other branches before backtracking ever
  // returns to try a second edge from it. Spawning there (or nearby, on that
  // same terminal branch) means the snake's very first non-reversal move can
  // head straight down a dead end. A true junction (3+ free neighbors) can
  // never be a simple dead-end branch member, so scan for one instead of
  // trusting a fixed corner near the generator's start cell.
  const preferred = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 }];
  const isJunction = (cell: Vec2): Vec2[] | null => {
    if (!isFree(cell)) return null;
    const free = neighbors4(cell).filter(isFree);
    return free.length >= 3 ? free : null;
  };

  let anchor: Vec2 | null = null;
  let free: Vec2[] = [];
  for (const cell of preferred) {
    const result = isJunction(cell);
    if (result) {
      anchor = cell;
      free = result;
      break;
    }
  }
  if (!anchor) {
    outer: for (let y = 0; y < config.boardHeight; y++) {
      for (let x = 0; x < config.boardWidth; x++) {
        const result = isJunction({ x, y });
        if (result) {
          anchor = { x, y };
          free = result;
          break outer;
        }
      }
    }
  }
  // Degenerate fallback (no junction anywhere — an extremely thin maze) —
  // same best-effort last resort as before.
  if (!anchor) {
    anchor = firstOpenCell(config.boardWidth, config.boardHeight, walls, preferred);
    free = neighbors4(anchor).filter(isFree);
  }
  const finalAnchor = anchor;

  const tail = free.length > 0 ? pickTail(finalAnchor, free) : { x: finalAnchor.x, y: finalAnchor.y + 1 };
  return {
    snake: [finalAnchor, tail],
    direction: tail.x < finalAnchor.x ? "right" : tail.x > finalAnchor.x ? "left" : tail.y < finalAnchor.y ? "down" : "up",
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

function bfsDistances(start: Vec2, occupied: Set<string>, boardWidth: number, boardHeight: number): Map<string, number> {
  const dist = new Map<string, number>();
  const startKey = cellKey(start);
  if (occupied.has(startKey)) return dist;
  dist.set(startKey, 0);
  const queue: Vec2[] = [start];
  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor++]!;
    const currentDist = dist.get(cellKey(current))!;
    for (const next of neighbors4(current)) {
      const nextKey = cellKey(next);
      if (!inBounds(next, boardWidth, boardHeight) || occupied.has(nextKey) || dist.has(nextKey)) continue;
      dist.set(nextKey, currentDist + 1);
      queue.push(next);
    }
  }
  return dist;
}

/** Quadrant index (0–3) a cell falls into, splitting the board at its
 * midpoints. Used only to bias maze_harvest spawns away from wherever the
 * head currently is (#114) — the head's own quadrant changes as it moves,
 * so "avoid the head's current quadrant" naturally alternates regions over
 * a round without needing any persisted spawn history. */
function quadrantOf(pos: Vec2, boardWidth: number, boardHeight: number): number {
  return (pos.x < boardWidth / 2 ? 0 : 1) + (pos.y < boardHeight / 2 ? 0 : 2);
}

const MIN_MAZE_SPAWN_DISTANCE = 2;

/** The one spawn path every food origin (initial, reposition, avatar, queue
 * promotion) must go through: prefer a cell the head can actually reach with
 * room to maneuver, falling back to any free cell only when the board is so
 * packed that no such candidate exists. On walled boards, a maze corridor
 * has no loops to circle back through, so committing to a straight dead-end
 * stretch to reach food is the actual cause of traps — junction cells (3+
 * open neighbors) keep an escape option open, so prefer those when any
 * exist instead of treating every 2-neighbor corridor cell as equally safe.
 * #114: on a maze, also bias toward cells far from the head (forces actual
 * exploration instead of endless food right next to the snake) and, in
 * maze_harvest specifically, toward the quadrant the head *isn't* currently
 * in — both fall back gracefully when the board is too tight to satisfy. */
function pickSafeSpawn(config: GameConfig, snake: Vec2[], foods: BoardFood[], walls: Set<string>, rng: Rng): Vec2 {
  const safeCandidates = safeSpawnCandidates(config, snake, foods, walls);
  if (safeCandidates.length > 0) {
    if (walls.size > 0) {
      const occupied = occupiedCells({ snake, foods, walls });
      const bodyBlocked = new Set([...snake.slice(1, -1).map(cellKey), ...walls]);
      const distances = bfsDistances(snake[0]!, bodyBlocked, config.boardWidth, config.boardHeight);
      const farEnough = safeCandidates.filter((pos) => (distances.get(cellKey(pos)) ?? 0) >= MIN_MAZE_SPAWN_DISTANCE);
      let pool = farEnough.length > 0 ? farEnough : safeCandidates;

      if (config.gameMode === "maze_harvest") {
        const headQuadrant = quadrantOf(snake[0]!, config.boardWidth, config.boardHeight);
        const otherQuadrant = pool.filter(
          (pos) => quadrantOf(pos, config.boardWidth, config.boardHeight) !== headQuadrant,
        );
        if (otherQuadrant.length > 0) pool = otherQuadrant;
      }

      const junctions = pool.filter(
        (pos) => freeNeighborCount(pos, occupied, config.boardWidth, config.boardHeight) >= 3,
      );
      if (junctions.length > 0) return randomChoice(junctions, rng);
      return randomChoice(pool, rng);
    }
    return randomChoice(safeCandidates, rng);
  }
  const occupied = occupiedCells({ snake, foods, walls });
  return randomEmptyCell(config.boardWidth, config.boardHeight, occupied, rng);
}

/** In full_food mode every free cell already holds a basic food (the mode's
 * whole premise), so pickSafeSpawn's search for an empty cell always comes
 * up dry and falls back to a stale default position that likely overlaps
 * the snake or another food. Swap the avatar onto an existing basic food's
 * cell instead — the displaced basic food is simply removed (the board
 * still ends up as full as it was, just with one cell now an avatar).
 * Returns null when there's no basic food left to swap onto (a fully
 * avatar-packed board); the caller should queue instead of spawning. */
function pickAvatarSpawn(
  config: GameConfig,
  snake: Vec2[],
  foods: BoardFood[],
  walls: Set<string>,
  rng: Rng,
): { pos: Vec2; foods: BoardFood[] } | null {
  if (config.gameMode === "full_food") {
    const basicFoods = foods.filter((food) => food.kind === "basic");
    if (basicFoods.length === 0) return null;
    const target = randomChoice(basicFoods, rng);
    return { pos: target.pos, foods: foods.filter((food) => food.id !== target.id) };
  }
  return { pos: pickSafeSpawn(config, snake, foods, walls, rng), foods };
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
      // #116: never "cage" the current food by placing a wall directly next
      // to it (4-neighbor adjacency) — a wall there can start boxing food in
      // just as it's about to be chased, which reads as unfair on stream.
      if (foods.some((food) => neighbors4(pos).some((n) => n.x === food.pos.x && n.y === food.pos.y))) continue;
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
  const spawn = pickAvatarSpawn(state.config, state.snake, foods, state.walls, rng);
  if (!spawn) return { foods, queue };
  return {
    foods: [...spawn.foods, { ...promoted, pos: spawn.pos }],
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
    const spawn = pickAvatarSpawn(state.config, state.snake, state.foods, state.walls, rng);
    if (spawn) return { ...state, foods: [...spawn.foods, { ...avatarFood, pos: spawn.pos }] };
  }
  return { ...state, foodQueue: [...state.foodQueue, avatarFood] };
}

/** The chat-facing identity of an avatar food — enough to re-request it via
 * enqueueAvatarFood, independent of wherever it happened to be sitting. */
export type PendingAvatarFood = { id: string; avatarUrl: string; authorName: string };

/** Collects every avatar food still owed to a viewer at the end of a round —
 * both ones already on the board (not yet eaten) and ones still waiting in
 * the queue — so a round reset can carry them over instead of silently
 * discarding a viewer's requested homage (#111). */
export function carryOverAvatarFoods(state: GameState): PendingAvatarFood[] {
  const fromBoard = state.foods
    .filter((food) => food.kind === "avatar")
    .map((food) => ({ id: food.id, avatarUrl: food.avatarUrl!, authorName: food.authorName! }));
  const fromQueue = state.foodQueue.map((food) => ({ id: food.id, avatarUrl: food.avatarUrl!, authorName: food.authorName! }));
  return [...fromBoard, ...fromQueue];
}

/** Re-requests each carried-over avatar food on a fresh round's state, via
 * the same enqueueAvatarFood path a live chat message would use (spawns
 * immediately if there's room, queues otherwise). */
export function reenqueueAvatarFoods(state: GameState, avatars: PendingAvatarFood[], rng: Rng = Math.random): GameState {
  return avatars.reduce((next, avatar) => enqueueAvatarFood(next, avatar, rng), state);
}

export function nextGrowthConfig(config: GameConfig): GameConfig {
  if (!config.growthEnabled) return config;
  return {
    ...config,
    boardWidth: Math.min(config.maxBoardWidth, config.boardWidth + 2),
    boardHeight: Math.min(config.maxBoardHeight, config.boardHeight + 1),
  };
}
