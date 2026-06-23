import type { Direction, GameState, Rng, Vec2 } from "../game/types";

export interface AutopilotConfig {
  /**
   * Probability (0-1) that the bot skips the escape-room lookahead and
   * just takes the greedy shortest-distance move. This is what lets the
   * snake "play for real" and occasionally trap/kill itself, instead of
   * playing a mathematically perfect game forever.
   */
  riskLevel: number;
}

export const DEFAULT_AUTOPILOT_CONFIG: AutopilotConfig = { riskLevel: 0.12 };

const ALL_DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

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

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function nearestFood(state: GameState): Vec2 {
  const head = state.snake[0];
  let best = state.baseApple;
  let bestDist = manhattan(head, best);
  for (const food of state.avatarFoods) {
    const d = manhattan(head, food.pos);
    if (d < bestDist) {
      best = food.pos;
      bestDist = d;
    }
  }
  return best;
}

function isLegalMove(state: GameState, nextHead: Vec2): boolean {
  const { boardSize } = state.config;
  if (nextHead.x < 0 || nextHead.y < 0 || nextHead.x >= boardSize || nextHead.y >= boardSize) {
    return false;
  }
  const isGrowing =
    (nextHead.x === state.baseApple.x && nextHead.y === state.baseApple.y) ||
    state.avatarFoods.some((f) => f.pos.x === nextHead.x && f.pos.y === nextHead.y);
  const bodyToCheck = isGrowing ? state.snake : state.snake.slice(0, -1);
  return !bodyToCheck.some((seg) => seg.x === nextHead.x && seg.y === nextHead.y);
}

/** Flood-fill from `start` over empty cells (occupied by the snake's body after the move) to estimate escape room. */
function openSpaceFrom(state: GameState, start: Vec2, bodyAfterMove: Vec2[]): number {
  const { boardSize } = state.config;
  const blocked = new Set(bodyAfterMove.map(key));
  const seen = new Set<string>([key(start)]);
  const queue: Vec2[] = [start];
  let count = 0;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    count++;
    for (const dir of ALL_DIRECTIONS) {
      const v = DIRECTION_VECTORS[dir];
      const next = { x: cur.x + v.x, y: cur.y + v.y };
      if (next.x < 0 || next.y < 0 || next.x >= boardSize || next.y >= boardSize) continue;
      const k = key(next);
      if (seen.has(k) || blocked.has(k)) continue;
      seen.add(k);
      queue.push(next);
    }
  }
  return count;
}

export function decideMove(
  state: GameState,
  config: AutopilotConfig = DEFAULT_AUTOPILOT_CONFIG,
  rng: Rng = Math.random
): Direction {
  const head = state.snake[0];
  const food = nearestFood(state);
  const forbidden = state.snake.length > 1 ? OPPOSITE[state.direction] : null;

  const legal = ALL_DIRECTIONS.filter((dir) => dir !== forbidden).filter((dir) => {
    const v = DIRECTION_VECTORS[dir];
    return isLegalMove(state, { x: head.x + v.x, y: head.y + v.y });
  });

  if (legal.length === 0) {
    // Cornered: no safe move exists. Keep going forward — a real loss.
    return state.direction;
  }

  const distances = legal.map((dir) => {
    const v = DIRECTION_VECTORS[dir];
    const nextHead = { x: head.x + v.x, y: head.y + v.y };
    return { dir, nextHead, dist: manhattan(nextHead, food) };
  });

  const minDist = Math.min(...distances.map((d) => d.dist));
  const closest = distances.filter((d) => d.dist === minDist);

  const skipSafetyCheck = rng() < config.riskLevel;
  if (skipSafetyCheck || closest.length === 1) {
    return closest[0].dir;
  }

  // Tie-break by escape room: prefer the candidate that leaves the most
  // reachable open space, so the bot doesn't greedily wall itself in.
  let best = closest[0];
  let bestSpace = -1;
  for (const candidate of closest) {
    const isGrowing =
      (candidate.nextHead.x === state.baseApple.x && candidate.nextHead.y === state.baseApple.y) ||
      state.avatarFoods.some(
        (f) => f.pos.x === candidate.nextHead.x && f.pos.y === candidate.nextHead.y
      );
    const bodyAfterMove = isGrowing ? state.snake : state.snake.slice(0, -1);
    const space = openSpaceFrom(state, candidate.nextHead, bodyAfterMove);
    if (space > bestSpace) {
      bestSpace = space;
      best = candidate;
    }
  }

  return best.dir;
}
