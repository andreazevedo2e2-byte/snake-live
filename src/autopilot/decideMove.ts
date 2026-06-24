import type { Direction, GameState, Rng, Vec2 } from "../game/types";
import { availableVariants, buildCycleOrder, cycleIndex, type CycleVariant } from "./hamiltonian";

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

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

function key(p: Vec2): string {
  return `${p.x},${p.y}`;
}

function inBounds(pos: Vec2, w: number, h: number): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < w && pos.y < h;
}

function isFood(pos: Vec2, state: GameState): boolean {
  return state.foods.some((food) => food.pos.x === pos.x && food.pos.y === pos.y);
}

function isWall(pos: Vec2, state: GameState): boolean {
  return state.walls.has(key(pos));
}

function legalDirections(state: GameState): Direction[] {
  const head = state.snake[0]!;
  const w = state.config.boardWidth;
  const h = state.config.boardHeight;
  const bodyWithoutTail = new Set(state.snake.slice(0, -1).map(key));
  const fullBody = new Set(state.snake.map(key));
  const out: Direction[] = [];

  for (const dir of DIRECTIONS) {
    if (state.snake.length > 1 && dir === OPPOSITE[state.direction]) continue;
    const v = DIRECTION_VECTORS[dir];
    const pos = { x: head.x + v.x, y: head.y + v.y };
    if (!inBounds(pos, w, h) || isWall(pos, state)) continue;
    const blocked = isFood(pos, state) ? fullBody : bodyWithoutTail;
    if (blocked.has(key(pos))) continue;
    out.push(dir);
  }
  return out;
}

function simulateMove(state: GameState, dir: Direction): Vec2[] {
  const head = state.snake[0]!;
  const v = DIRECTION_VECTORS[dir];
  const newHead = { x: head.x + v.x, y: head.y + v.y };
  const grows = isFood(newHead, state);
  return grows ? [newHead, ...state.snake] : [newHead, ...state.snake.slice(0, -1)];
}

function legalDirectionsForSnake(
  snake: Vec2[],
  direction: Direction,
  w: number,
  h: number,
  walls: Set<string> = new Set(),
): Direction[] {
  const head = snake[0]!;
  const blocked = new Set(snake.slice(0, -1).map(key));
  const out: Direction[] = [];

  for (const dir of DIRECTIONS) {
    if (snake.length > 1 && dir === OPPOSITE[direction]) continue;
    const v = DIRECTION_VECTORS[dir];
    const pos = { x: head.x + v.x, y: head.y + v.y };
    const posKey = key(pos);
    if (!inBounds(pos, w, h) || walls.has(posKey) || blocked.has(posKey)) continue;
    out.push(dir);
  }
  return out;
}

function simulateSnakeMove(snake: Vec2[], dir: Direction): Vec2[] {
  const head = snake[0]!;
  const vec = DIRECTION_VECTORS[dir];
  const nextHead = { x: head.x + vec.x, y: head.y + vec.y };
  return [nextHead, ...snake.slice(0, -1)];
}

function directionBetween(from: Vec2, to: Vec2): Direction {
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  if (to.y > from.y) return "down";
  return "up";
}

function canReachOwnTail(snake: Vec2[], w: number, h: number, walls: Set<string> = new Set()): boolean {
  if (snake.length <= 1) return true;
  const head = snake[0]!;
  const tail = snake[snake.length - 1]!;
  const blocked = new Set(snake.slice(0, -1).map(key));
  const seen = new Set<string>([key(head)]);
  const queue: Vec2[] = [head];
  let qi = 0;

  while (qi < queue.length) {
    const cur = queue[qi++]!;
    if (cur.x === tail.x && cur.y === tail.y) return true;
    for (const dir of DIRECTIONS) {
      const v = DIRECTION_VECTORS[dir];
      const np = { x: cur.x + v.x, y: cur.y + v.y };
      const npKey = key(np);
      if (!inBounds(np, w, h) || seen.has(npKey) || blocked.has(npKey) || walls.has(npKey)) continue;
      seen.add(npKey);
      queue.push(np);
    }
  }

  return false;
}

const cycleCache = new Map<string, number[]>();

function getCycle(width: number, height: number, variant: CycleVariant): number[] | null {
  const cacheKey = `${width}x${height}:${variant}`;
  let order = cycleCache.get(cacheKey);
  if (!order) {
    try {
      order = buildCycleOrder(width, height, variant);
    } catch {
      return null;
    }
    cycleCache.set(cacheKey, order);
  }
  return order;
}

function variantForBoard(width: number, height: number): CycleVariant {
  const variants = availableVariants(width, height);
  if (variants.length === 0) return "row";
  return variants[0]!;
}

function cycleForwardStep(
  state: GameState,
  order: number[],
  legal: Direction[],
  w: number,
): Direction | null {
  const head = state.snake[0]!;
  const tail = state.snake[state.snake.length - 1]!;
  const n = order.length;
  const headOrder = cycleIndex(order, head, w);
  const tailOrder = cycleIndex(order, tail, w);
  const distToTail = (tailOrder - headOrder + n) % n;

  for (const dir of legal) {
    const v = DIRECTION_VECTORS[dir];
    const pos = { x: head.x + v.x, y: head.y + v.y };
    if (!isFood(pos, state)) continue;
    const forward = (cycleIndex(order, pos, w) - headOrder + n) % n;
    if (forward > 0 && forward < distToTail) return dir;
  }

  if (distToTail > 1) {
    for (const dir of legal) {
      const v = DIRECTION_VECTORS[dir];
      const pos = { x: head.x + v.x, y: head.y + v.y };
      const forward = (cycleIndex(order, pos, w) - headOrder + n) % n;
      if (forward === 1) return dir;
    }
  }

  return null;
}

function cycleShortcutPath(state: GameState, order: number[], w: number, h: number): Vec2[] | null {
  const head = state.snake[0]!;
  const tail = state.snake[state.snake.length - 1]!;
  const n = order.length;
  const headOrder = cycleIndex(order, head, w);
  const tailOrder = cycleIndex(order, tail, w);
  const distToTail = (tailOrder - headOrder + n) % n;
  const targetSet = new Set(state.foods.map((food) => key(food.pos)));

  const rankOf = (pos: Vec2): number => (cycleIndex(order, pos, w) - headOrder + n) % n;
  const parent = new Map<string, Vec2>();
  const seen = new Set<string>([key(head)]);
  const queue: Vec2[] = [head];
  let qi = 0;
  let target: Vec2 | null = null;

  while (qi < queue.length) {
    const cur = queue[qi++]!;
    if (targetSet.has(key(cur)) && key(cur) !== key(head)) {
      target = cur;
      break;
    }
    const curRank = rankOf(cur);
    for (const dir of DIRECTIONS) {
      const v = DIRECTION_VECTORS[dir];
      const np = { x: cur.x + v.x, y: cur.y + v.y };
      if (!inBounds(np, w, h)) continue;
      const npKey = key(np);
      if (seen.has(npKey)) continue;
      const npRank = rankOf(np);
      if (npRank <= curRank || npRank >= distToTail) continue;
      seen.add(npKey);
      parent.set(npKey, cur);
      queue.push(np);
    }
  }

  if (!target) return null;

  const path: Vec2[] = [];
  let cur: Vec2 | undefined = target;
  while (cur && key(cur) !== key(head)) {
    path.unshift(cur);
    cur = parent.get(key(cur));
  }
  return path;
}

function shortestSafePathToFood(state: GameState, w: number, h: number): Vec2[] | null {
  const head = state.snake[0]!;
  const targetSet = new Set(state.foods.map((food) => key(food.pos)));
  const blocked = new Set([...state.snake.slice(0, -1).map(key), ...state.walls]);
  const parent = new Map<string, Vec2>();
  const seen = new Set<string>([key(head)]);
  const queue: Vec2[] = [head];
  let cursor = 0;
  let target: Vec2 | null = null;

  while (cursor < queue.length) {
    const current = queue[cursor++]!;
    if (targetSet.has(key(current)) && key(current) !== key(head)) {
      target = current;
      break;
    }

    for (const direction of DIRECTIONS) {
      const vec = DIRECTION_VECTORS[direction];
      const next = { x: current.x + vec.x, y: current.y + vec.y };
      const nextKey = key(next);
      if (!inBounds(next, w, h) || seen.has(nextKey) || blocked.has(nextKey)) continue;
      seen.add(nextKey);
      parent.set(nextKey, current);
      queue.push(next);
    }
  }

  if (!target) return null;

  const path: Vec2[] = [];
  let current: Vec2 | undefined = target;
  while (current && key(current) !== key(head)) {
    path.unshift(current);
    current = parent.get(key(current));
  }

  const simulated = simulatePath(state, path);
  if (!simulated) return null;
  if (!canReachOwnTail(simulated, w, h, state.walls)) return null;
  if (floodFillFrom(simulated, w, h, state.walls) < simulated.length) return null;
  return path;
}

function hasFutureTailRecovery(
  snake: Vec2[],
  direction: Direction,
  w: number,
  h: number,
  depth: number,
  walls: Set<string> = new Set(),
  seen = new Set<string>(),
): boolean {
  if (canReachOwnTail(snake, w, h, walls) && floodFillFrom(snake, w, h, walls) >= snake.length) return true;
  if (depth <= 0) return false;

  const stateKey = `${direction}|${snake.map(key).join(";")}`;
  if (seen.has(stateKey)) return false;
  seen.add(stateKey);

  const options = legalDirectionsForSnake(snake, direction, w, h, walls)
    .map((dir) => {
      const nextSnake = simulateSnakeMove(snake, dir);
      return { dir, nextSnake, room: floodFillFrom(nextSnake, w, h, walls) };
    })
    .sort((a, b) => b.room - a.room);

  for (const option of options) {
    if (option.room < option.nextSnake.length - 2) continue;
    if (hasFutureTailRecovery(option.nextSnake, option.dir, w, h, depth - 1, walls, seen)) return true;
  }

  return false;
}

function shortestProjectedFoodPathToFood(state: GameState, w: number, h: number): Vec2[] | null {
  const head = state.snake[0]!;
  const targetSet = new Set(state.foods.map((food) => key(food.pos)));
  const blocked = new Set([...state.snake.slice(0, -1).map(key), ...state.walls]);
  const parent = new Map<string, Vec2>();
  const seen = new Set<string>([key(head)]);
  const queue: Vec2[] = [head];
  let cursor = 0;
  let target: Vec2 | null = null;

  while (cursor < queue.length) {
    const current = queue[cursor++]!;
    if (targetSet.has(key(current)) && key(current) !== key(head)) {
      target = current;
      break;
    }

    for (const direction of DIRECTIONS) {
      const vec = DIRECTION_VECTORS[direction];
      const next = { x: current.x + vec.x, y: current.y + vec.y };
      const nextKey = key(next);
      if (!inBounds(next, w, h) || seen.has(nextKey) || blocked.has(nextKey)) continue;
      seen.add(nextKey);
      parent.set(nextKey, current);
      queue.push(next);
    }
  }

  if (!target) return null;

  const path: Vec2[] = [];
  let current: Vec2 | undefined = target;
  while (current && key(current) !== key(head)) {
    path.unshift(current);
    current = parent.get(key(current));
  }

  const simulated = simulatePath(state, path);
  if (!simulated) return null;
  const finalDirection = directionBetween(path[path.length - 2] ?? state.snake[0]!, path[path.length - 1]!);
  if (!hasFutureTailRecovery(simulated, finalDirection, w, h, 5, state.walls)) return null;
  if (floodFillFrom(simulated, w, h, state.walls) < Math.max(simulated.length - 3, 6)) return null;
  return path;
}

function shortestBoldPathToFood(state: GameState, w: number, h: number): Vec2[] | null {
  const head = state.snake[0]!;
  const targetSet = new Set(state.foods.map((food) => key(food.pos)));
  const blocked = new Set([...state.snake.slice(0, -1).map(key), ...state.walls]);
  const parent = new Map<string, Vec2>();
  const seen = new Set<string>([key(head)]);
  const queue: Vec2[] = [head];
  let cursor = 0;
  let target: Vec2 | null = null;

  while (cursor < queue.length) {
    const current = queue[cursor++]!;
    if (targetSet.has(key(current)) && key(current) !== key(head)) {
      target = current;
      break;
    }

    for (const direction of DIRECTIONS) {
      const vec = DIRECTION_VECTORS[direction];
      const next = { x: current.x + vec.x, y: current.y + vec.y };
      const nextKey = key(next);
      if (!inBounds(next, w, h) || seen.has(nextKey) || blocked.has(nextKey)) continue;
      seen.add(nextKey);
      parent.set(nextKey, current);
      queue.push(next);
    }
  }

  if (!target) return null;

  const path: Vec2[] = [];
  let current: Vec2 | undefined = target;
  while (current && key(current) !== key(head)) {
    path.unshift(current);
    current = parent.get(key(current));
  }

  const simulated = simulatePath(state, path);
  if (!simulated) return null;
  const reachable = floodFillFrom(simulated, w, h, state.walls);
  const targetDistance = manhattan(head, target);
  const freeAfterEating = w * h - state.walls.size - simulated.length;
  const minimumEscapeRoom = Math.min(14, Math.max(5, Math.floor(freeAfterEating * 0.28)));
  if (path.length > Math.max(7, targetDistance + 2)) return null;
  if (reachable < minimumEscapeRoom) return null;
  return path;
}

function shortestPathToTail(snake: Vec2[], w: number, h: number, walls: Set<string> = new Set()): Vec2[] | null {
  if (snake.length <= 1) return null;
  const head = snake[0]!;
  const tail = snake[snake.length - 1]!;
  const blocked = new Set(snake.slice(0, -1).map(key));
  const parent = new Map<string, Vec2>();
  const seen = new Set<string>([key(head)]);
  const queue: Vec2[] = [head];
  let cursor = 0;

  while (cursor < queue.length) {
    const current = queue[cursor++]!;
    if (current.x === tail.x && current.y === tail.y) {
      const path: Vec2[] = [];
      let step: Vec2 | undefined = current;
      while (step && key(step) !== key(head)) {
        path.unshift(step);
        step = parent.get(key(step));
      }
      return path;
    }

    for (const direction of DIRECTIONS) {
      const vec = DIRECTION_VECTORS[direction];
      const next = { x: current.x + vec.x, y: current.y + vec.y };
      const nextKey = key(next);
      if (!inBounds(next, w, h) || seen.has(nextKey) || blocked.has(nextKey) || walls.has(nextKey)) continue;
      seen.add(nextKey);
      parent.set(nextKey, current);
      queue.push(next);
    }
  }

  return null;
}

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function distanceToNearestFood(pos: Vec2, state: GameState): number {
  const foods = state.foods.map((food) => food.pos);
  if (foods.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...foods.map((food) => manhattan(pos, food)));
}

function distanceToNearestUnrevealed(pos: Vec2, state: GameState): number {
  let best = Number.POSITIVE_INFINITY;
  for (let x = 0; x < state.config.boardWidth; x++) {
    for (let y = 0; y < state.config.boardHeight; y++) {
      const tileKey = `${x},${y}`;
      if (state.walls.has(tileKey) || state.revealedCells.has(tileKey)) continue;
      best = Math.min(best, manhattan(pos, { x, y }));
    }
  }
  return best;
}

function edgePressure(pos: Vec2, w: number, h: number): number {
  const edgeDistance = Math.min(pos.x, pos.y, w - 1 - pos.x, h - 1 - pos.y);
  return edgeDistance <= 0 ? 2 : edgeDistance === 1 ? 0.7 : 0;
}

function chooseNaturalSpaceMove(
  state: GameState,
  legal: Direction[],
  w: number,
  h: number,
  rng: Rng,
): Direction | null {
  let best: { dir: Direction; score: number } | null = null;
  const fill = state.snake.length / Math.max(1, (w * h) - state.walls.size);
  const prioritizesUnrevealed = state.config.colorMode === "map" || state.config.gameMode === "full_food";

  for (const dir of legal) {
    const sim = simulateMove(state, dir);
    if (!canReachOwnTail(sim, w, h, state.walls)) continue;
    const space = floodFillFrom(sim, w, h, state.walls);
    if (space < sim.length) continue;

    const head = sim[0]!;
    const ate = sim.length > state.snake.length;
    const foodDistance = distanceToNearestFood(head, state);
    const unrevealedDistance = distanceToNearestUnrevealed(head, state);
    const revealsNewTile = !state.revealedCells.has(key(head));
    const tailPath = shortestPathToTail(sim, w, h, state.walls);
    const tailRoom = tailPath ? Math.min(tailPath.length, 12) : 0;
    const turnCost = dir === state.direction ? 0 : 0.65;
    const pressure = edgePressure(head, w, h);
    const lateSafetyBonus = fill > 0.55 ? space * 1.3 + tailRoom * 1.1 : 0;
    const score =
      space * 0.9 +
      lateSafetyBonus +
      (ate ? 18 : 0) -
      foodDistance * (fill < 0.55 ? 3.1 : 1.25) -
      (prioritizesUnrevealed ? unrevealedDistance * 1.35 : 0) +
      (prioritizesUnrevealed && revealsNewTile ? 14 : 0) -
      turnCost -
      pressure +
      rng() * 0.25;

    if (!best || score > best.score) best = { dir, score };
  }

  return best?.dir ?? null;
}

function simulatePath(state: GameState, path: Vec2[]): Vec2[] | null {
  let snake = state.snake.map((segment) => ({ ...segment }));
  for (const nextHead of path) {
    if (!inBounds(nextHead, state.config.boardWidth, state.config.boardHeight)) return null;
    if (state.walls.has(key(nextHead))) return null;
    const grows = isFood(nextHead, state);
    const bodyToCheck = grows ? snake : snake.slice(0, -1);
    if (bodyToCheck.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y)) return null;
    snake = grows ? [nextHead, ...snake] : [nextHead, ...snake.slice(0, -1)];
  }
  return snake;
}

export function decideMove(
  state: GameState,
  speedMultiplier = 1,
  rng: Rng = Math.random,
  variant?: CycleVariant,
): Direction {
  const w = state.config.boardWidth;
  const h = state.config.boardHeight;
  const hasWalls = state.walls.size > 0;
  const prefersExploration = state.config.colorMode === "map" || state.config.gameMode === "full_food";
  const legal = legalDirections(state);
  if (legal.length === 0) return state.direction;

  void speedMultiplier;
  const isSafe = (dir: Direction): boolean => {
    const sim = simulateMove(state, dir);
    return canReachOwnTail(sim, w, h, state.walls) && floodFillFrom(sim, w, h, state.walls) >= sim.length;
  };

  const order = hasWalls || prefersExploration ? null : getCycle(w, h, variant ?? variantForBoard(w, h));
  const playableCells = Math.max(1, (w * h) - state.walls.size);
  const fill = state.snake.length / playableCells;

  const directPath = shortestSafePathToFood(state, w, h);
  if (directPath && directPath.length > 0 && (hasWalls || state.score < 3)) {
    const firstDir = directionBetween(state.snake[0]!, directPath[0]!);
    if (legal.includes(firstDir)) return firstDir;
  }

  if (hasWalls || prefersExploration) {
    const naturalMove = chooseNaturalSpaceMove(state, legal, w, h, rng);
    if (naturalMove && isSafe(naturalMove)) return naturalMove;

    const tailPath = shortestPathToTail(state.snake, w, h, state.walls);
    if (tailPath && tailPath.length > 0) {
      const firstDir = directionBetween(state.snake[0]!, tailPath[0]!);
      if (legal.includes(firstDir) && isSafe(firstDir)) return firstDir;
    }

    const bestSafe = legal
      .filter(isSafe)
      .map((dir) => {
        const sim = simulateMove(state, dir);
        const nextHead = sim[0]!;
        return {
          dir,
          space: floodFillFrom(sim, w, h, state.walls),
          distance: distanceToNearestFood(nextHead, state),
        };
      })
      .sort((a, b) => (b.space - a.space) || (a.distance - b.distance))[0];
    if (bestSafe) return bestSafe.dir;

    return legal[0] ?? state.direction;
  }

  const projectedPath = state.score < 3 && fill < 0.08
    ? shortestProjectedFoodPathToFood(state, w, h)
    : null;
  if (projectedPath && projectedPath.length > 0 && projectedPath.length <= 2) {
    const firstDir = directionBetween(state.snake[0]!, projectedPath[0]!);
    if (legal.includes(firstDir)) return firstDir;
  }

  const boldPath = state.score < 3 && fill < 0.1 ? shortestBoldPathToFood(state, w, h) : null;
  if (boldPath && boldPath.length > 0) {
    const firstDir = directionBetween(state.snake[0]!, boldPath[0]!);
    if (legal.includes(firstDir)) return firstDir;
  }

  const naturalMove = state.score < 3 && fill < 0.1 ? chooseNaturalSpaceMove(state, legal, w, h, rng) : null;
  if (naturalMove && isSafe(naturalMove)) return naturalMove;

  const tailPath = shortestPathToTail(state.snake, w, h);
  if (tailPath && tailPath.length > 0 && state.score < 3 && fill < 0.1) {
    const firstDir = directionBetween(state.snake[0]!, tailPath[0]!);
    if (legal.includes(firstDir) && isSafe(firstDir)) return firstDir;
  }

  if (order) {
    const shortcut = cycleShortcutPath(state, order, w, h);
    if (shortcut && shortcut.length > 0) {
      const firstDir = directionBetween(state.snake[0]!, shortcut[0]!);
      if (legal.includes(firstDir) && isSafe(firstDir)) return firstDir;
    }

    const cycleDir = cycleForwardStep(state, order, legal, w);
    if (cycleDir) return cycleDir;
  }

  if (tailPath && tailPath.length > 0) {
    const firstDir = directionBetween(state.snake[0]!, tailPath[0]!);
    if (legal.includes(firstDir) && isSafe(firstDir)) return firstDir;
  }

  const safeMoves = legal.filter(isSafe);
  if (safeMoves.length > 0) {
    let best: { dir: Direction; space: number; ate: boolean } | null = null;
    for (const dir of safeMoves) {
      const sim = simulateMove(state, dir);
      const ate = sim.length > state.snake.length;
      const space = floodFillFrom(sim, w, h, state.walls);
      if (!best || (ate && !best.ate) || (ate === best.ate && space > best.space)) {
        best = { dir, space, ate };
      }
    }
    return best!.dir;
  }

  if (order) {
    const cycleDir = cycleForwardStep(state, order, legal, w);
    if (cycleDir) return cycleDir;
  }

  let best: { dir: Direction; space: number } | null = null;
  for (const dir of legal) {
    const space = floodFillFrom(simulateMove(state, dir), w, h, state.walls);
    if (!best || space > best.space) best = { dir, space };
  }
  return best?.dir ?? state.direction;
}

function floodFillFrom(snake: Vec2[], w: number, h: number, walls: Set<string> = new Set()): number {
  const head = snake[0]!;
  const blocked = new Set(snake.slice(0, -1).map(key));
  const seen = new Set<string>([key(head)]);
  const queue: Vec2[] = [head];
  let qi = 0;
  let count = 0;

  while (qi < queue.length) {
    const cur = queue[qi++]!;
    count++;
    for (const dir of DIRECTIONS) {
      const v = DIRECTION_VECTORS[dir];
      const np = { x: cur.x + v.x, y: cur.y + v.y };
      const npKey = key(np);
      if (!inBounds(np, w, h) || seen.has(npKey) || blocked.has(npKey) || walls.has(npKey)) continue;
      seen.add(npKey);
      queue.push(np);
    }
  }

  return count;
}
