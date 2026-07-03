import type { Direction, GameState, Rng, Vec2 } from "../game/types";

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const OPPOSITE: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
const VECS: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function key(p: Vec2): string { return `${p.x},${p.y}`; }
function inBounds(p: Vec2, w: number, h: number): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < w && p.y < h;
}

function legalMoves(state: GameState): Direction[] {
  const head = state.snake[0]!;
  const { boardWidth: w, boardHeight: h } = state.config;
  const body = new Set(state.snake.slice(0, -1).map(key));
  const fullBody = new Set(state.snake.map(key));
  return DIRECTIONS.filter((dir) => {
    if (state.snake.length > 1 && dir === OPPOSITE[state.direction]) return false;
    const v = VECS[dir];
    const pos = { x: head.x + v.x, y: head.y + v.y };
    if (!inBounds(pos, w, h) || state.walls.has(key(pos))) return false;
    const isFood = state.foods.some((f) => f.pos.x === pos.x && f.pos.y === pos.y);
    return !(isFood ? fullBody : body).has(key(pos));
  });
}

function floodFill(snake: Vec2[], w: number, h: number, walls: Set<string>): number {
  const head = snake[0]!;
  const blocked = new Set([...snake.slice(0, -1).map(key), ...walls]);
  const seen = new Set<string>([key(head)]);
  const q: Vec2[] = [head];
  let i = 0;
  let count = 0;
  while (i < q.length) {
    const c = q[i++]!;
    count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const np = { x: c.x + dx, y: c.y + dy };
      const npk = key(np);
      if (np.x < 0 || np.y < 0 || np.x >= w || np.y >= h || seen.has(npk) || blocked.has(npk)) continue;
      seen.add(npk);
      q.push(np);
    }
  }
  return count;
}

/** True when the round is in a phase where a deliberate mistake is dramatic:
 * late-game high fill (visually tense) is preferred, but a score-based
 * threshold ensures the error also fires on large/walled boards where fill
 * never gets high enough to trigger the fill check alone. */
export function isErrorPhase(state: GameState): boolean {
  if (state.score < 3) return false;
  const playable = Math.max(1, state.config.boardWidth * state.config.boardHeight - state.walls.size);
  const fill = state.snake.length / playable;
  return fill > 0.35 || state.score >= 8;
}

/** Picks a legal but deliberately bad move: the direction with the smallest
 * flood-fill from the next head position (most likely to cause problems soon).
 * Returns null only when there is exactly one legal move (no room to be wrong). */
export function pickDeliberateMistake(state: GameState, rng: Rng): Direction | null {
  const legal = legalMoves(state);
  if (legal.length <= 1) return null;

  const { boardWidth: w, boardHeight: h } = state.config;
  // Shuffle for variety on ties.
  const shuffled = [...legal].sort(() => rng() - 0.5);

  let worst: { dir: Direction; space: number } | null = null;
  for (const dir of shuffled) {
    const v = VECS[dir];
    const newHead = { x: state.snake[0]!.x + v.x, y: state.snake[0]!.y + v.y };
    const growing = state.foods.some((f) => f.pos.x === newHead.x && f.pos.y === newHead.y);
    const sim = growing ? [newHead, ...state.snake] : [newHead, ...state.snake.slice(0, -1)];
    const space = floodFill(sim, w, h, state.walls);
    if (!worst || space < worst.space) worst = { dir, space };
  }

  return worst?.dir ?? null;
}
