import type { Direction, GameState, Rng, Vec2 } from "../game/types";
import { buildCycleOrder, cycleIndex } from "./hamiltonian";

export interface AutopilotConfig {
  /**
   * How much of the board may still be empty for the bot to allow "shortcuts"
   * off the safe Hamiltonian cycle. Higher = beelines to food for longer
   * (more natural, more risk); lower = tightens to the guaranteed-safe cycle
   * sooner. Expressed as a fraction of total cells that must remain empty.
   */
  shortcutWhileEmptierThan: number;
}

export const DEFAULT_AUTOPILOT_CONFIG: AutopilotConfig = { shortcutWhileEmptierThan: 0.5 };

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

// Hamiltonian cycles are fixed per board size; build each one only once.
const cycleCache = new Map<string, number[]>();
function getCycle(width: number, height: number): number[] | null {
  const k = `${width}x${height}`;
  let order = cycleCache.get(k);
  if (!order) {
    try {
      order = buildCycleOrder(width, height);
    } catch {
      return null; // odd-odd board: no cycle exists, fall back to flood-fill survival
    }
    cycleCache.set(k, order);
  }
  return order;
}

interface Candidate {
  dir: Direction;
  pos: Vec2;
  forward: number; // distance ahead of the head along the cycle (1..N-1)
}

function legalCandidates(state: GameState, order: number[], w: number, headOrder: number): Candidate[] {
  const head = state.snake[0]!;
  const n = order.length;
  const bodyWithoutTail = new Set(state.snake.slice(0, -1).map(key));
  const out: Candidate[] = [];
  for (const dir of DIRECTIONS) {
    if (state.snake.length > 1 && dir === OPPOSITE[state.direction]) continue;
    const v = DIRECTION_VECTORS[dir];
    const pos = { x: head.x + v.x, y: head.y + v.y };
    if (pos.x < 0 || pos.y < 0 || pos.x >= state.config.boardSize || pos.y >= state.config.boardSize) continue;
    if (bodyWithoutTail.has(key(pos))) continue;
    const forward = (cycleIndex(order, pos, w) - headOrder + n) % n;
    out.push({ dir, pos, forward });
  }
  return out;
}

/** Reachable empty space from a candidate move — used only as a last-resort
 * survival heuristic when the cycle successor is somehow blocked. */
function floodFillFrom(state: GameState, start: Vec2): number {
  const size = state.config.boardSize;
  const blocked = new Set(state.snake.slice(0, -1).map(key));
  const seen = new Set<string>([key(start)]);
  const queue: Vec2[] = [start];
  let count = 0;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    count++;
    for (const dir of DIRECTIONS) {
      const v = DIRECTION_VECTORS[dir];
      const np = { x: cur.x + v.x, y: cur.y + v.y };
      if (np.x < 0 || np.y < 0 || np.x >= size || np.y >= size) continue;
      const kk = key(np);
      if (seen.has(kk) || blocked.has(kk)) continue;
      seen.add(kk);
      queue.push(np);
    }
  }
  return count;
}

export function decideMove(
  state: GameState,
  config: AutopilotConfig = DEFAULT_AUTOPILOT_CONFIG,
  rng: Rng = Math.random
): Direction {
  void rng;
  const w = state.config.boardSize;
  const h = state.config.boardSize;
  const order = getCycle(w, h);

  const head = state.snake[0]!;
  const tail = state.snake[state.snake.length - 1]!;

  // No cycle available (odd-odd board): survive by maximizing open space.
  if (!order) return survivalMove(state);

  const n = order.length;
  const headOrder = cycleIndex(order, head, w);
  const tailOrder = cycleIndex(order, tail, w);
  const candidates = legalCandidates(state, order, w, headOrder);
  if (candidates.length === 0) return state.direction; // trapped — a real loss

  const empty = n - state.snake.length;
  const distToTail = (tailOrder - headOrder + n) % n;

  // Nearest food measured as forward distance along the cycle.
  let distToFood = n;
  for (const food of [state.baseApple, ...state.avatarFoods.map((f) => f.pos)]) {
    const d = (cycleIndex(order, food, w) - headOrder + n) % n;
    if (d > 0 && d < distToFood) distToFood = d;
  }

  // While the board is still roomy, allow shortcuts toward the food. The
  // safety rule: never advance so far that we'd cut in front of the tail
  // (leave a growing margin as the board fills), and don't overshoot the food.
  if (empty > n * config.shortcutWhileEmptierThan) {
    const margin = 1 + Math.floor((state.snake.length * 3) / n);
    let best: Candidate | null = null;
    for (const c of candidates) {
      if (c.forward === 0) continue;
      if (c.forward >= distToTail - margin) continue; // stay safely behind the tail
      if (c.forward > distToFood) continue; // don't jump past the food
      if (!best || c.forward > best.forward) best = c; // greatest progress toward food
    }
    if (best) return best.dir;
  }

  // Otherwise follow the Hamiltonian cycle exactly — this is what guarantees
  // the board eventually fills and the bot wins.
  const cycleMove = candidates.find((c) => c.forward === 1);
  if (cycleMove) return cycleMove.dir;

  return survivalMove(state);
}

function survivalMove(state: GameState): Direction {
  const head = state.snake[0]!;
  const size = state.config.boardSize;
  const bodyWithoutTail = new Set(state.snake.slice(0, -1).map(key));
  let best: { dir: Direction; space: number } | null = null;
  for (const dir of DIRECTIONS) {
    if (state.snake.length > 1 && dir === OPPOSITE[state.direction]) continue;
    const v = DIRECTION_VECTORS[dir];
    const pos = { x: head.x + v.x, y: head.y + v.y };
    if (pos.x < 0 || pos.y < 0 || pos.x >= size || pos.y >= size) continue;
    if (bodyWithoutTail.has(key(pos))) continue;
    const space = floodFillFrom(state, pos);
    if (!best || space > best.space) best = { dir, space };
  }
  return best?.dir ?? state.direction;
}
