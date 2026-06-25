import type { GameConfig, MapThemeId, Vec2 } from "../game/types";

function rgb(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

function normalize(pos: Vec2, config: GameConfig): { x: number; y: number } {
  return {
    x: config.boardWidth <= 1 ? 0 : pos.x / (config.boardWidth - 1),
    y: config.boardHeight <= 1 ? 0 : pos.y / (config.boardHeight - 1),
  };
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

function hexToRgb(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

function samplePalette(
  rows: readonly string[],
  palette: Record<string, string>,
  pos: Vec2,
  config: GameConfig,
): number {
  const { x, y } = normalize(pos, config);
  const px = Math.min(rows[0]!.length - 1, Math.floor(x * rows[0]!.length));
  const py = Math.min(rows.length - 1, Math.floor(y * rows.length));
  const token = rows[py]![px]!;
  return hexToRgb(palette[token] ?? "#101820");
}

const HEART_ROWS = [
  "0000000000000000",
  "0011110000111100",
  "0111111011111110",
  "1111111111111111",
  "1111111111111111",
  "0111111111111110",
  "0011111111111100",
  "0001111111111000",
  "0000111111110000",
  "0000011111100000",
  "0000001111000000",
  "0000000110000000",
  "0000000000000000",
  "0000000000000000",
] as const;

const HEART_PALETTE: Record<string, string> = {
  "0": "#243247",
  "1": "#edf4fb",
};

const BRAZIL_ROWS = [
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGYYGGGGGGGGGGGGGG",
  "GGGGGGGGGYYYYYYYYYGGGGGGGGGG",
  "GGGGGGYYYYYYYYYYYYYYYGGGGGGG",
  "GGGGYYYYYYYYBBBBYYYYYYYYGGGG",
  "GGGYYYYYYYBBBBBBBBYYYYYYYGGG",
  "GGYYYYYYYWBBBBBBBBBWYYYYYYGG",
  "GGYYYYYYYBBBBBBBBBBYYYYYYYGG",
  "GGYYYYYYYWBBBBBBBBBWYYYYYYGG",
  "GGGYYYYYYYBBBBBBBBYYYYYYYGGG",
  "GGGGYYYYYYYYBBBBYYYYYYYYGGGG",
  "GGGGGGYYYYYYYYYYYYYYYGGGGGGG",
  "GGGGGGGGGYYYYYYYYYGGGGGGGGGG",
  "GGGGGGGGGGGGYYGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGG",
] as const;

const BRAZIL_PALETTE: Record<string, string> = {
  G: "#16a14f",
  Y: "#ffd333",
  B: "#2440b8",
  W: "#f6f8fb",
};

const CREEPER_ROWS = [
  "aaaaaaaa",
  "abcbcdca",
  "cddeeffc",
  "cddeeffc",
  "cggdeehc",
  "bcfhhhhb",
  "achhhgba",
  "acghhgca",
] as const;

const CREEPER_PALETTE: Record<string, string> = {
  a: "#c4e2bd",
  b: "#4dcc37",
  c: "#399f45",
  d: "#0d0d0d",
  e: "#000000",
  f: "#70df68",
  g: "#8dc08f",
  h: "#5f8c62",
};

function heartColor(pos: Vec2, config: GameConfig): number {
  return samplePalette(HEART_ROWS, HEART_PALETTE, pos, config);
}

function brazilColor(pos: Vec2, config: GameConfig): number {
  return samplePalette(BRAZIL_ROWS, BRAZIL_PALETTE, pos, config);
}

function creeperColor(pos: Vec2, config: GameConfig): number {
  return samplePalette(CREEPER_ROWS, CREEPER_PALETTE, pos, config);
}

function classicColor(pos: Vec2, config: GameConfig): number {
  const { x, y } = normalize(pos, config);
  const hue = Math.floor((x * 220 + y * 140) % 360);
  const saturation = 0.56 + (0.12 * (1 - Math.abs(0.5 - y) * 2));
  const lightness = 0.2 + (0.16 * (1 - Math.abs(0.5 - x) * 2));
  return hslToRgb(hue, saturation, lightness);
}

export const MAP_THEME_LABELS: Record<MapThemeId, string> = {
  classic: "Clássico",
  heart: "Coração",
  brazil: "Bandeira do Brasil",
  creeper: "Creeper",
};

export function mapCellColor(theme: MapThemeId, pos: Vec2, config: GameConfig): number {
  switch (theme) {
    case "heart":
      return heartColor(pos, config);
    case "brazil":
      return brazilColor(pos, config);
    case "creeper":
      return creeperColor(pos, config);
    default:
      return classicColor(pos, config);
  }
}
