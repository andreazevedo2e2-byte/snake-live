import type { GameConfig, MapThemeId, Vec2 } from "../game/types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rgb(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

function normalize(pos: Vec2, config: GameConfig): { x: number; y: number } {
  return {
    x: config.boardWidth <= 1 ? 0 : pos.x / (config.boardWidth - 1),
    y: config.boardHeight <= 1 ? 0 : pos.y / (config.boardHeight - 1),
  };
}

function heartColor(pos: Vec2, config: GameConfig): number {
  const { x, y } = normalize(pos, config);
  const px = x * 2 - 1;
  const py = 1 - y * 2;
  const equation = Math.pow(px * px + py * py - 1, 3) - px * px * py * py * py;
  const absEquation = Math.abs(equation);
  if (absEquation < 0.13) return rgb(236, 243, 246);
  if (equation < 0) return rgb(195, 214, 221);
  return rgb(133, 148, 153);
}

function brazilColor(pos: Vec2, config: GameConfig): number {
  const { x, y } = normalize(pos, config);
  const px = x * 2 - 1;
  const py = y * 2 - 1;
  const inDiamond = Math.abs(px) * 0.92 + Math.abs(py) * 1.18 < 1.02;
  const inCircle = px * px / 0.19 + py * py / 0.24 < 1;
  const stripe = Math.abs(py + px * 0.18) < 0.06 && inCircle;
  const starPoints = [
    [0.12, 0.44], [0.2, 0.4], [0.28, 0.46], [0.43, 0.53], [0.58, 0.48],
    [0.68, 0.52], [0.75, 0.56], [0.63, 0.66], [0.51, 0.63], [0.39, 0.61],
    [0.31, 0.65], [0.18, 0.6], [0.73, 0.36], [0.61, 0.31], [0.47, 0.3],
    [0.34, 0.33], [0.23, 0.28], [0.14, 0.32], [0.54, 0.76], [0.41, 0.74],
  ];
  const star = starPoints.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 0.03);

  if (star) return rgb(248, 248, 248);
  if (stripe) return rgb(240, 240, 240);
  if (inCircle) return rgb(31, 48, 150);
  if (inDiamond) return rgb(255, 209, 28);
  return rgb(18, 156, 67);
}

const CREEPER_PIXELS = [
  ["#a8d09f", "#47c92f", "#80c67c", "#90c49b", "#61db54", "#72d95f", "#b2d0a9", "#349b46"],
  ["#349b46", "#658f6c", "#11a900", "#47c92f", "#4c8d4e", "#72d95f", "#0f7a0f", "#d0d0d0"],
  ["#47c92f", "#000000", "#000000", "#b0d3aa", "#22da3f", "#000000", "#000000", "#d7d7d7"],
  ["#11d100", "#000000", "#000000", "#24ab38", "#127f13", "#000000", "#000000", "#58e84e"],
  ["#61db54", "#47c92f", "#61db54", "#000000", "#000000", "#72d95f", "#47c92f", "#47c92f"],
  ["#90c49b", "#349b46", "#000000", "#000000", "#000000", "#000000", "#658f6c", "#b2d0a9"],
  ["#bde0b8", "#59a85f", "#000000", "#000000", "#000000", "#000000", "#98ef91", "#349b46"],
  ["#24ab38", "#a8d09f", "#000000", "#80d980", "#b7e0b5", "#000000", "#47c92f", "#61db54"],
] as const;

function hexToRgb(hex: string): number {
  const clean = hex.replace("#", "");
  return Number.parseInt(clean, 16);
}

function creeperColor(pos: Vec2, config: GameConfig): number {
  const { x, y } = normalize(pos, config);
  const px = Math.min(CREEPER_PIXELS[0].length - 1, Math.floor(x * CREEPER_PIXELS[0].length));
  const py = Math.min(CREEPER_PIXELS.length - 1, Math.floor(y * CREEPER_PIXELS.length));
  return hexToRgb(CREEPER_PIXELS[py]![px]!);
}

function classicColor(pos: Vec2, config: GameConfig): number {
  const { x, y } = normalize(pos, config);
  const hue = Math.floor((x * 220 + y * 140) % 360);
  const saturation = 55 + Math.floor(20 * clamp01(1 - Math.abs(0.5 - y) * 2));
  const lightness = 22 + Math.floor(18 * clamp01(1 - Math.abs(0.5 - x) * 2));
  return hslToRgb(hue, saturation / 100, lightness / 100);
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
