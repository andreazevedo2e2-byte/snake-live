export const SCREEN_WIDTH = 1080;
export const SCREEN_HEIGHT = 1920;

export const COLORS = {
  background: 0x020403,
  backgroundGlow: 0x102d08,
  // v3.2 arena: a stable, neutral dark blue-graphite checkerboard. The old
  // background followed the snake's hue (board turned pink when the snake
  // did — everything blended into one monochrome mush) and layered banded
  // stripes + low-alpha orbs that read as rendering artifacts on stream.
  // A neutral two-tone checker gives instant cell legibility (the classic
  // snake-game look) and makes the colorful snake/food/walls pop; only the
  // neon frame follows the snake's accent now.
  boardBackground: 0x0d1420,
  boardTileAlt: 0x131c2c,
  boardWall: 0xa9ef12,
  boardWallShadow: 0x4b7208,
  gridLine: 0x7c1689,
  snakeBody: 0x0878ff,
  snakeBodyEdge: 0x00c8ff,
  snakeHead: 0x14a9ff,
  baseApple: 0xff4b1f,
  baseAppleDark: 0xbc1d2d,
  avatarRing: 0xffd22f,
  hud: 0xffffff,
  hudMuted: 0xa7ff4b,
  speedBarTrack: 0x121a10,
  speedBarFill: 0xa9ff12,
  speedBarHot: 0xff4242,
  heroGold: 0xffd33c,
  notification: 0xb4ff20,
  panel: 0x050905,
  panelLine: 0x69d20c,
  panelSoft: 0x10250b,
  liveRed: 0xea1010,
  purple: 0x8f35ff,
} as const;

export const LAYOUT = {
  topBar: { x: 24, y: 18, width: SCREEN_WIDTH - 48, height: 78 },
  commandPanel: { x: 28, y: 106, width: SCREEN_WIDTH - 56, height: 150 },
  heroBanner: { x: 28, y: 106, width: SCREEN_WIDTH - 56, height: 150 },
  speedPanel: { x: 28, y: 268, width: SCREEN_WIDTH - 56, height: 78 },
  speedBar: { x: 470, y: 332, width: 425, height: 12 },
  board: { x: 34, y: 370, size: SCREEN_WIDTH - 68 },
  notification: { x: 28, y: 1405, width: SCREEN_WIDTH - 56, height: 80 },
  leaderboard: { x: 28, y: 1510, width: SCREEN_WIDTH - 56, height: 348 },
  instructions: { x: 28, y: 1405, width: SCREEN_WIDTH - 56, height: 80 },
} as const;
