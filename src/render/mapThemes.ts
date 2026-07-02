import type { GameConfig, MapThemeId, Vec2 } from "../game/types";

function rgb(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

function hslToRgb(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toByte = (value: number) => Math.round((value + m) * 255);
  return rgb(toByte(r), toByte(g), toByte(b));
}

function normalize(pos: Vec2, config: GameConfig): { x: number; y: number } {
  return {
    x: config.boardWidth <= 1 ? 0 : pos.x / (config.boardWidth - 1),
    y: config.boardHeight <= 1 ? 0 : pos.y / (config.boardHeight - 1),
  };
}

function pointInDiamond(nx: number, ny: number, cx: number, cy: number, halfWidth: number, halfHeight: number): boolean {
  const dx = Math.abs(nx - cx) / halfWidth;
  const dy = Math.abs(ny - cy) / halfHeight;
  return dx + dy <= 1;
}

function pointInCircle(nx: number, ny: number, cx: number, cy: number, radius: number): boolean {
  const dx = nx - cx;
  const dy = ny - cy;
  return (dx * dx) + (dy * dy) <= radius * radius;
}

function classicColor(pos: Vec2, config: GameConfig): number {
  const { x, y } = normalize(pos, config);
  const hue = Math.floor((x * 220 + y * 140) % 360);
  const saturation = 0.56 + (0.12 * (1 - Math.abs(0.5 - y) * 2));
  const lightness = 0.2 + (0.16 * (1 - Math.abs(0.5 - x) * 2));
  return hslToRgb(hue, saturation, lightness);
}

function heartColor(pos: Vec2, config: GameConfig): number {
  const { x, y } = normalize(pos, config);
  const dx = x - 0.5;
  const dy = y - 0.42;
  const formula = Math.pow(dx * dx + dy * dy - 0.05, 3) - (dx * dx * Math.pow(dy, 3));
  return formula <= 0 ? 0xedf4fb : 0x243247;
}

function brazilColor(pos: Vec2, config: GameConfig): number {
  const { x, y } = normalize(pos, config);
  const green = 0x169c4a;
  const yellow = 0xffd33a;
  const blue = 0x2440b8;
  const white = 0xf5f8fb;

  if (pointInDiamond(x, y, 0.5, 0.5, 0.36, 0.28)) {
    if (pointInCircle(x, y, 0.5, 0.5, 0.18)) {
      const bandY = 0.47 - ((x - 0.5) * 0.2);
      const bandDistance = Math.abs(y - bandY);
      if (bandDistance < 0.022) return white;

      if (pointInCircle(x, y, 0.38, 0.44, 0.01)) return white;
      if (pointInCircle(x, y, 0.46, 0.47, 0.009)) return white;
      if (pointInCircle(x, y, 0.56, 0.43, 0.009)) return white;
      if (pointInCircle(x, y, 0.61, 0.5, 0.008)) return white;
      if (pointInCircle(x, y, 0.52, 0.56, 0.009)) return white;
      if (pointInCircle(x, y, 0.42, 0.55, 0.008)) return white;

      return blue;
    }
    return yellow;
  }

  return green;
}

function franceColor(pos: Vec2, config: GameConfig): number {
  const { x } = normalize(pos, config);
  if (x < 1 / 3) return 0x2245a3;
  if (x < 2 / 3) return 0xf4f7fb;
  return 0xd6223c;
}

function norwayColor(pos: Vec2, config: GameConfig): number {
  const { x, y } = normalize(pos, config);
  const red = 0xba2132;
  const white = 0xf6f8fb;
  const blue = 0x213d8c;

  const whiteVertical = x >= 0.26 && x <= 0.38;
  const whiteHorizontal = y >= 0.41 && y <= 0.59;
  const blueVertical = x >= 0.29 && x <= 0.35;
  const blueHorizontal = y >= 0.45 && y <= 0.55;

  if (blueVertical || blueHorizontal) return blue;
  if (whiteVertical || whiteHorizontal) return white;
  return red;
}

function creeperColor(pos: Vec2, config: GameConfig): number {
  const { x, y } = normalize(pos, config);
  const px = Math.floor(x * 8);
  const py = Math.floor(y * 8);
  const rows = [
    "aaaaaaaa",
    "abcbcdca",
    "cddeeffc",
    "cddeeffc",
    "cggdeehc",
    "bcfhhhhb",
    "achhhgba",
    "acghhgca",
  ] as const;
  const palette: Record<string, number> = {
    a: 0xc4e2bd,
    b: 0x4dcc37,
    c: 0x399f45,
    d: 0x0d0d0d,
    e: 0x000000,
    f: 0x70df68,
    g: 0x8dc08f,
    h: 0x5f8c62,
  };
  const token = rows[Math.min(rows.length - 1, py)]![Math.min(rows[0].length - 1, px)]!;
  return palette[token] ?? 0x101820;
}

export const MAP_THEME_LABELS: Record<MapThemeId, string> = {
  classic: "Clássico",
  heart: "Coração",
  brazil: "Bandeira do Brasil",
  france: "Bandeira da França",
  norway: "Bandeira da Noruega",
  creeper: "Creeper",
};

export function mapCellColor(theme: MapThemeId, pos: Vec2, config: GameConfig): number {
  switch (theme) {
    case "heart":
      return heartColor(pos, config);
    case "brazil":
      return brazilColor(pos, config);
    case "france":
      return franceColor(pos, config);
    case "norway":
      return norwayColor(pos, config);
    case "creeper":
      return creeperColor(pos, config);
    default:
      return classicColor(pos, config);
  }
}
