export interface ViewerIdentity {
  channelId: string;
  name: string;
  avatarUrl: string;
}

export interface LeaderboardEntry extends ViewerIdentity {
  score: number;
}

export interface LeaderboardState {
  entries: Map<string, LeaderboardEntry>;
}

export function createLeaderboard(): LeaderboardState {
  return { entries: new Map() };
}

export function creditViewer(state: LeaderboardState, viewer: ViewerIdentity): LeaderboardState {
  const entries = new Map(state.entries);
  const existing = entries.get(viewer.channelId);
  entries.set(viewer.channelId, {
    ...viewer,
    score: (existing?.score ?? 0) + 1,
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
