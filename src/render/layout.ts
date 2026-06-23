export const SCREEN_WIDTH = 1080;
export const SCREEN_HEIGHT = 1920;

export const COLORS = {
  background: 0x0b1021,
  boardBackground: 0x121933,
  gridLine: 0x1d2750,
  snakeBody: 0x39d98a,
  snakeHead: 0xffffff,
  baseApple: 0xff4d6d,
  hud: 0xffffff,
  hudMuted: 0x8a93c4,
  speedBarTrack: 0x1d2750,
  speedBarFill: 0xffc857,
  heroGold: 0xffd54a,
  notification: 0x39d98a,
  panel: 0x0e1430,
} as const;

export const LAYOUT = {
  heroBanner: { x: 0, y: 40, width: SCREEN_WIDTH, height: 90 },
  speedBar: { x: 60, y: 150, width: SCREEN_WIDTH - 120, height: 36 },
  board: { x: 60, y: 230, size: SCREEN_WIDTH - 120 },
  notification: { x: 0, y: 230 + (SCREEN_WIDTH - 120) + 30, width: SCREEN_WIDTH, height: 70 },
  leaderboard: { x: 40, y: 230 + (SCREEN_WIDTH - 120) + 120, width: SCREEN_WIDTH - 80, height: 420 },
  instructions: { x: 40, y: SCREEN_HEIGHT - 130, width: SCREEN_WIDTH - 80, height: 90 },
} as const;
