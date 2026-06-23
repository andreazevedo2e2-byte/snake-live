export interface ViewerIdentity {
  channelId: string;
  name: string;
  avatarUrl: string;
}

export interface LeaderboardEntry extends ViewerIdentity {
  score: number;
  foodCount: number;
  speedCount: number;
}

export interface LeaderboardState {
  entries: Map<string, LeaderboardEntry>;
}

export function createLeaderboard(): LeaderboardState {
  return { entries: new Map() };
}

export type LeaderboardAction = "food" | "speed" | "comment";

export function creditViewer(
  state: LeaderboardState,
  viewer: ViewerIdentity,
  action: LeaderboardAction = "comment"
): LeaderboardState {
  const entries = new Map(state.entries);
  const existing = entries.get(viewer.channelId);
  const foodCount = (existing?.foodCount ?? 0) + (action === "food" ? 1 : 0);
  const speedCount = (existing?.speedCount ?? 0) + (action === "speed" ? 1 : 0);
  entries.set(viewer.channelId, {
    ...viewer,
    score: (existing?.score ?? 0) + 1,
    foodCount,
    speedCount,
  });
  return { entries };
}

export function topViewers(state: LeaderboardState, limit: number): LeaderboardEntry[] {
  return [...state.entries.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getHero(state: LeaderboardState): LeaderboardEntry | null {
  const top = topViewers(state, 1);
  return top[0] ?? null;
}
