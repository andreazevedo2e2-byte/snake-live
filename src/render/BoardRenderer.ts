import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { BoardFood, Direction, FoodType, GameState, Vec2 } from "../game/types";
import { hueForLength, lerpHue } from "../game/colorHue";
import { LAYOUT, COLORS } from "./layout";
import { TextureCache } from "./TextureCache";
import { mapCellColor } from "./mapThemes";

const START_SNAKE_LENGTH = 2;
const HUE_LERP_SPEED = 0.04;

function key(pos: Vec2): string {
  return `${pos.x},${pos.y}`;
}

function hueToRgb(hue: number, saturation = 0.68, lightness = 0.55): number {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toByte = (v: number) => Math.round((v + m) * 255);
  return (toByte(r) << 16) | (toByte(g) << 8) | toByte(b);
}

function mixRgb(a: number, b: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return (rr << 16) | (rg << 8) | rb;
}

function isFlagTheme(theme: GameState["config"]["mapTheme"]): boolean {
  return theme === "brazil" || theme === "france" || theme === "norway";
}

export class BoardRenderer {
  readonly view = new Container();
  private backgroundLayer = new Graphics();
  private mapLayer = new Graphics();
  private wallLayer = new Graphics();
  private gridLayer = new Graphics();
  private foodLayer = new Container();
  private snakeGlowLayer = new Container();
  private connectorLayer = new Graphics();
  private snakeLayer = new Container();
  private faceLayer = new Graphics();
  private cellSize: number;
  private boardPixelWidth: number;
  private boardPixelHeight: number;
  private displayedHue = 0;
  private previousSnake: Vec2[] = [];
  private currentSnake: Vec2[] = [];
  private snakeAnimationStart = performance.now();
  private snakeAnimationMs = 260;
  private avatarSprites = new Map<
    string,
    { sprite: Sprite; ring: Graphics; mask: Graphics; avatarUrl: string }
  >();
  private segmentPool: Graphics[] = [];
  private segmentGlowPool: Graphics[] = [];
  private basicFoodSprites = new Map<string, Sprite>();
  private foodGlowLayer = new Graphics();
  private boardWidth: number;
  private boardHeight: number;
  // Dirty-flag state for static layers — sentinel values force the initial draw.
  private prevWallKey = "";
  private prevMapKey = "";
  private prevAccentColor = -1;
  private prevBaseHueRounded = -1;
  private prevCssHue = "";

  constructor(
    boardWidth: number,
    boardHeight: number,
    private avatarCache: TextureCache<Texture>,
    private foodTextures: Record<FoodType, Texture>,
  ) {
    // Board cells stay square; size them to fill the wider axis, then center
    // the (possibly shorter) board vertically within the layout's square
    // budget so a non-square board doesn't look like a cropped square.
    this.boardWidth = boardWidth;
    this.boardHeight = boardHeight;
    this.cellSize = LAYOUT.board.size / Math.max(boardWidth, boardHeight);
    this.boardPixelWidth = this.cellSize * boardWidth;
    this.boardPixelHeight = this.cellSize * boardHeight;
    this.view.x = LAYOUT.board.x + (LAYOUT.board.size - this.boardPixelWidth) / 2;
    this.view.y = LAYOUT.board.y + (LAYOUT.board.size - this.boardPixelHeight) / 2;
    this.view.addChild(
      this.backgroundLayer,
      this.mapLayer,
      this.wallLayer,
      this.gridLayer,
      this.foodGlowLayer,
      this.foodLayer,
      this.snakeGlowLayer,
      this.connectorLayer,
      this.snakeLayer,
      this.faceLayer
    );
    this.drawBackground();
    this.drawGrid();
  }

  update(state: GameState, speedMultiplier = 1): void {
    this.drawWalls(state);
    this.renderFoods(state);
    this.updateSnakeAnimation(state, speedMultiplier);
    this.renderSnake(state);
  }

  private drawFoodGlows(foods: BoardFood[]): void {
    this.foodGlowLayer.clear();
    if (foods.length === 0) return;
    const t = performance.now();
    for (const food of foods) {
      const x = food.pos.x * this.cellSize + this.cellSize / 2;
      const y = food.pos.y * this.cellSize + this.cellSize / 2;
      const color = food.kind === "avatar" ? COLORS.avatarRing : COLORS.baseApple;
      // Outer ring breathes slowly; inner ring is constant
      const breathe = 0.5 + 0.5 * Math.sin(t / 780 + food.pos.x * 0.8 + food.pos.y * 1.2);
      this.foodGlowLayer
        .circle(x, y, this.cellSize * (0.52 + 0.09 * breathe))
        .fill({ color, alpha: 0.07 + 0.04 * breathe })
        .circle(x, y, this.cellSize * 0.33)
        .fill({ color, alpha: 0.11 });
      // Subtle ground shadow
      this.foodGlowLayer
        .ellipse(x, y + this.cellSize * 0.30, this.cellSize * 0.26, this.cellSize * 0.06)
        .fill({ color: 0x000000, alpha: 0.16 });
    }
  }

  private tongueExtension(): number {
    const t = (performance.now() / 1500) % 1;
    if (t < 0.12) return t / 0.12;
    if (t < 0.42) return 1;
    if (t < 0.54) return 1 - (t - 0.42) / 0.12;
    return 0;
  }

  private directionVec(direction: Direction): Vec2 {
    if (direction === "right") return { x: 1, y: 0 };
    if (direction === "left") return { x: -1, y: 0 };
    if (direction === "up") return { x: 0, y: -1 };
    return { x: 0, y: 1 };
  }

  private updateSnakeAnimation(state: GameState, speedMultiplier: number): void {
    const nextKey = state.snake.map(key).join("|");
    const currentKey = this.currentSnake.map(key).join("|");
    if (nextKey === currentKey) return;
    this.previousSnake = this.interpolateSnake();
    this.currentSnake = state.snake.map((segment) => ({ ...segment }));
    this.snakeAnimationStart = performance.now();
    // Keep the animation duration below the gameplay tick at high speeds so
    // 5x/6x does not visually "queue" two turns into one blurred motion.
    this.snakeAnimationMs = Math.max(48, 300 / speedMultiplier);
  }

  private drawBackground(accentColor: number = COLORS.boardWall, accentHue = 205): void {
    this.drawDynamicBackground(accentColor, accentHue);
  }

  private drawClassicBackground(accentColor: number, accentHue: number): void {
    const w = this.boardPixelWidth;
    const h = this.boardPixelHeight;
    const haloColor = mixRgb(accentColor, 0x050909, 0.35);
    const panelColor = mixRgb(accentColor, 0x081008, 0.48);
    const orbColor = hueToRgb((accentHue + 18) % 360, 0.62, 0.48);
    this.backgroundLayer
      .clear()
      .roundRect(-11, -11, w + 22, h + 22, 12)
      .fill({ color: haloColor, alpha: 0.28 })
      .roundRect(-5, -5, w + 10, h + 10, 9)
      .fill(panelColor)
      .roundRect(-5, -5, w + 10, h + 10, 9)
      .stroke({ width: 4, color: accentColor, alpha: 0.96 })
      .rect(0, 0, w, h)
      .fill(COLORS.boardBackground);

    const bandHeight = h / 4;
    for (let i = 0; i < 4; i++) {
      this.backgroundLayer
        .rect(0, i * bandHeight, w, bandHeight)
        .fill({ color: i % 2 === 0 ? COLORS.boardBandA : COLORS.boardBandB, alpha: 0.2 + i * 0.04 });
    }

    this.backgroundLayer
      .circle(w * 0.18, h * 0.7, Math.min(w, h) * 0.12)
      .fill({ color: orbColor, alpha: 0.08 })
      .circle(w * 0.82, h * 0.18, Math.min(w, h) * 0.1)
      .fill({ color: orbColor, alpha: 0.08 })
      .ellipse(w * 0.55, h * 0.92, w * 0.22, h * 0.07)
      .fill({ color: accentColor, alpha: 0.06 });
  }

  private drawDynamicBackground(accentColor: number = COLORS.boardWall, accentHue = 205): void {
    const w = this.boardPixelWidth;
    const h = this.boardPixelHeight;
    const boardBase = hueToRgb(accentHue, 0.68, 0.1);
    const bandA = hueToRgb((accentHue + 8) % 360, 0.62, 0.15);
    const bandB = hueToRgb((accentHue + 22) % 360, 0.7, 0.2);
    this.backgroundLayer
      .clear()
      .roundRect(-11, -11, w + 22, h + 22, 12)
      .fill({ color: accentColor, alpha: 0.28 })
      .roundRect(-5, -5, w + 10, h + 10, 9)
      .fill(accentColor)
      .roundRect(-5, -5, w + 10, h + 10, 9)
      .stroke({ width: 4, color: accentColor, alpha: 0.96 })
      .rect(0, 0, w, h)
      .fill(boardBase);

    const bandHeight = h / 4;
    for (let i = 0; i < 4; i++) {
      this.backgroundLayer
        .rect(0, i * bandHeight, w, bandHeight)
        .fill({ color: i % 2 === 0 ? bandA : bandB, alpha: 0.25 + i * 0.055 });
    }

    this.backgroundLayer
      .circle(w * 0.18, h * 0.7, Math.min(w, h) * 0.12)
      .fill({ color: accentColor, alpha: 0.08 })
      .circle(w * 0.82, h * 0.18, Math.min(w, h) * 0.1)
      .fill({ color: accentColor, alpha: 0.08 })
      .ellipse(w * 0.55, h * 0.92, w * 0.22, h * 0.07)
      .fill({ color: accentColor, alpha: 0.06 });
  }

  private drawGrid(accentColor: number = COLORS.gridLine): void {
    const w = this.boardPixelWidth;
    const h = this.boardPixelHeight;
    this.gridLayer.clear();
    // Subtle cell lines to show the grid structure
    for (let x = 1; x < this.boardWidth; x++) {
      this.gridLayer
        .moveTo(x * this.cellSize, 0)
        .lineTo(x * this.cellSize, h)
        .stroke({ width: 1, color: accentColor, alpha: 0.08 });
    }
    for (let y = 1; y < this.boardHeight; y++) {
      this.gridLayer
        .moveTo(0, y * this.cellSize)
        .lineTo(w, y * this.cellSize)
        .stroke({ width: 1, color: accentColor, alpha: 0.08 });
    }
    // Board border
    this.gridLayer
      .rect(0, 0, w, h)
      .stroke({ width: 3, color: accentColor, alpha: 0.26 });
  }

  private getSegment(index: number): Graphics {
    let seg = this.segmentPool[index];
    if (!seg) {
      seg = new Graphics();
      this.segmentPool[index] = seg;
      this.snakeLayer.addChild(seg);
    }
    return seg;
  }

  private getGlow(index: number): Graphics {
    let glow = this.segmentGlowPool[index];
    if (!glow) {
      glow = new Graphics();
      this.segmentGlowPool[index] = glow;
      this.snakeGlowLayer.addChild(glow);
    }
    return glow;
  }

  private renderSnake(state: GameState): void {
    const targetHue = hueForLength(state.snake.length, START_SNAKE_LENGTH);
    this.displayedHue = lerpHue(this.displayedHue, targetHue, state.config.gradientSpeed || HUE_LERP_SPEED);
    const baseHue = (205 + this.displayedHue) % 360;
    const visualSnake = this.interpolateSnake();
    const colorForSegment = (index: number): number => {
      if (state.config.colorMode === "map") {
        const segment = visualSnake[index] ?? visualSnake[visualSnake.length - 1] ?? state.snake[0]!;
        const mapColor = mapCellColor(state.config.mapTheme, {
          x: Math.max(0, Math.min(state.config.boardWidth - 1, Math.round(segment.x))),
          y: Math.max(0, Math.min(state.config.boardHeight - 1, Math.round(segment.y))),
        }, state.config);
        return mapColor;
      }
      return hueToRgb((baseHue + index * 4.2) % 360, index === 0 ? 0.82 : 0.72, index === 0 ? 0.55 : 0.58);
    };
    const accentColor = colorForSegment(0);
    const cssHue = baseHue.toFixed(1);
    if (cssHue !== this.prevCssHue) {
      this.prevCssHue = cssHue;
      document.documentElement.style.setProperty("--snake-accent-hue", cssHue);
      document.body.style.setProperty("--snake-accent-hue", cssHue);
    }
    const baseHueRounded = Math.round(baseHue);
    if (accentColor !== this.prevAccentColor || baseHueRounded !== this.prevBaseHueRounded) {
      this.prevAccentColor = accentColor;
      this.prevBaseHueRounded = baseHueRounded;
      if (state.config.mapTheme === "classic") this.drawClassicBackground(accentColor, baseHue);
      else this.drawDynamicBackground(accentColor, baseHue);
      if (state.config.snakeStyle === "google") this.gridLayer.clear();
      else this.drawGrid(state.config.mapTheme === "classic" ? COLORS.gridLine : accentColor);
    }
    this.drawMapOverlay(state);

    if (state.config.snakeStyle === "google") this.drawGoogleSnake(visualSnake, colorForSegment);
    else this.drawSnakeTube(visualSnake, colorForSegment);

    for (let i = 0; i < this.segmentPool.length; i++) {
      this.segmentPool[i]!.visible = false;
      this.segmentGlowPool[i]!.visible = false;
    }

    visualSnake.forEach((segment, index) => {
      if (index > 0) return;
      const color = colorForSegment(index);
      const glow = this.getGlow(index);
      glow.clear();
      glow.visible = state.config.snakeStyle !== "google";
      glow.x = segment.x * this.cellSize + this.cellSize / 2;
      glow.y = segment.y * this.cellSize + this.cellSize / 2;
      if (state.config.snakeStyle !== "google") {
        glow.circle(0, 0, this.cellSize * 0.34).fill({ color, alpha: index === 0 ? 0.42 : 0.16 });
      }

      const seg = this.getSegment(index);
      seg.clear();
      seg.visible = true;
      seg.x = segment.x * this.cellSize + this.cellSize / 2;
      seg.y = segment.y * this.cellSize + this.cellSize / 2;
      if (state.config.snakeStyle === "google") {
        seg
          .rect(-this.cellSize * 0.48, -this.cellSize * 0.48, this.cellSize * 0.96, this.cellSize * 0.96)
          .fill(color);
      } else {
        seg.circle(0, 0, this.cellSize * 0.32).fill(color);
      }
      seg.scale.set(1, 1);
      seg.rotation = 0;
    });

    this.renderFace(state, visualSnake[0] ?? state.snake[0]!);
  }

  private renderFoods(state: GameState): void {
    const presentIds = new Set(state.foods.map((f) => f.id));
    for (const [id, entry] of this.avatarSprites) {
      if (!presentIds.has(id)) {
        this.avatarSprites.delete(id);
        entry.ring.destroy();
        entry.mask.destroy();
        entry.sprite.destroy();
        this.avatarCache.release(entry.avatarUrl, (texture) => texture.destroy(true));
      }
    }

    for (const [id, sprite] of this.basicFoodSprites) {
      if (!presentIds.has(id)) {
        this.basicFoodSprites.delete(id);
        sprite.destroy();
      }
    }

    for (const food of state.foods) {
      if (food.kind === "avatar") this.renderAvatarFood(food);
      else this.renderBasicFood(food);
    }
    this.drawFoodGlows(state.foods);
  }

  private renderAvatarFood(food: BoardFood): void {
    if (!food.avatarUrl) return;
    let entry = this.avatarSprites.get(food.id);
    if (!entry) {
      const ring = new Graphics();
      const mask = new Graphics().circle(0, 0, this.cellSize * 0.3).fill(0xffffff);
      const sprite = new Sprite(Texture.WHITE);
      sprite.width = this.cellSize * 0.6;
      sprite.height = this.cellSize * 0.6;
      sprite.anchor.set(0.5);
      sprite.mask = mask;
      entry = { sprite, ring, mask, avatarUrl: food.avatarUrl };
      this.avatarSprites.set(food.id, entry);
      this.foodLayer.addChild(ring, mask, sprite);
      this.avatarCache.acquire(food.avatarUrl).then((texture) => {
        if (this.avatarSprites.get(food.id) === entry) sprite.texture = texture;
      });
    }

    const x = food.pos.x * this.cellSize + this.cellSize / 2;
    const y = food.pos.y * this.cellSize + this.cellSize / 2;
    entry.ring
      .clear()
      .circle(x, y, this.cellSize * 0.37)
      .fill({ color: COLORS.avatarRing, alpha: 0.18 })
      .circle(x, y, this.cellSize * 0.31)
      .stroke({ width: 5, color: COLORS.avatarRing, alpha: 0.96 })
      .circle(x + this.cellSize * 0.22, y - this.cellSize * 0.22, 5)
      .fill(COLORS.hud);
    entry.mask.x = x;
    entry.mask.y = y;
    entry.sprite.x = x;
    entry.sprite.y = y;
  }

  private renderBasicFood(food: BoardFood): void {
    let sprite = this.basicFoodSprites.get(food.id);
    if (!sprite) {
      sprite = new Sprite(this.foodTextures[food.type]);
      sprite.anchor.set(0.5);
      sprite.width = this.cellSize * 0.84;
      sprite.height = this.cellSize * 0.84;
      this.basicFoodSprites.set(food.id, sprite);
      this.foodLayer.addChild(sprite);
    }

    sprite.x = food.pos.x * this.cellSize + this.cellSize / 2;
    sprite.y = food.pos.y * this.cellSize + this.cellSize / 2;
  }

  private drawMapOverlay(state: GameState): void {
    // For flag themes, the map is fully opaque and has no dependency on
    // revealedCells — it's static once drawn. For gradient "map" mode,
    // the alpha of unrevealed cells differs, so redraw when the revealed
    // count changes.
    const revealedCount = isFlagTheme(state.config.mapTheme) ? 0 : state.revealedCells.size;
    const mapKey = `${state.config.mapTheme}:${state.config.colorMode}:${revealedCount}`;
    if (mapKey === this.prevMapKey) return;
    this.prevMapKey = mapKey;
    this.mapLayer.clear();
    if (state.config.mapTheme === "classic") return;
    for (let x = 0; x < state.config.boardWidth; x++) {
      for (let y = 0; y < state.config.boardHeight; y++) {
        const color = mapCellColor(state.config.mapTheme, { x, y }, state.config);
        const key = `${x},${y}`;
        const alpha = isFlagTheme(state.config.mapTheme)
          ? 0.96
          : state.revealedCells.has(key)
            ? 0.94
            : 0.2;
        this.mapLayer
          .rect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize)
          .fill({ color, alpha });
      }
    }
  }

  private drawWalls(state: GameState): void {
    const wallKey = `${state.walls.size}:${state.config.gameMode}`;
    if (wallKey === this.prevWallKey) return;
    this.prevWallKey = wallKey;
    this.wallLayer.clear();
    if (state.walls.size === 0) return;

    const wallFill =
      state.config.gameMode === "pudding"
        ? 0x4b8f1a
        : state.config.gameMode === "maze_race" || state.config.gameMode === "maze_harvest"
          ? 0xd8edff
          : 0x314b1d;
    const wallStroke =
      state.config.gameMode === "pudding"
        ? 0x8fff3d
        : state.config.gameMode === "maze_race" || state.config.gameMode === "maze_harvest"
          ? 0xffffff
          : COLORS.panelLine;

    for (const wall of state.walls) {
      const [xText, yText] = wall.split(",");
      const x = Number(xText);
      const y = Number(yText);
      this.wallLayer
        .rect(x * this.cellSize + 3, y * this.cellSize + 3, this.cellSize - 6, this.cellSize - 6)
        .fill({ color: wallFill, alpha: 0.94 })
        .rect(x * this.cellSize + 5, y * this.cellSize + 5, this.cellSize - 10, this.cellSize - 10)
        .stroke({ width: 2, color: wallStroke, alpha: 0.34 });
    }
  }

  private drawSnakeTube(points: Vec2[], colorForSegment: (index: number) => number): void {
    this.connectorLayer.clear();
    if (points.length === 0) return;
    const phase = performance.now() / 210;

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i]!;
      const to = points[i + 1]!;
      const color = colorForSegment(i);
      const outerColor = mixRgb(color, 0x060612, 0.34);
      const innerColor = mixRgb(color, 0xffffff, 0.16);
      const ax = from.x * this.cellSize + this.cellSize / 2;
      const ay = from.y * this.cellSize + this.cellSize / 2;
      const bx = to.x * this.cellSize + this.cellSize / 2;
      const by = to.y * this.cellSize + this.cellSize / 2;
      this.connectorLayer
        .moveTo(ax, ay)
        .lineTo(bx, by)
        .stroke({ width: this.cellSize * 0.74, color: outerColor, alpha: 0.94, cap: "round", join: "round" })
        .moveTo(ax, ay)
        .lineTo(bx, by)
        .stroke({ width: this.cellSize * 0.56, color, alpha: 0.97, cap: "round", join: "round" })
        .moveTo(ax, ay)
        .lineTo(bx, by)
        .stroke({ width: this.cellSize * 0.22, color: innerColor, alpha: 0.24, cap: "round", join: "round" });

      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const marks = Math.max(1, Math.floor(len / (this.cellSize * 0.38)));
      for (let mark = 0; mark < marks; mark++) {
        const travel = ((mark / marks) + i * 0.22 + phase * 0.055) % 1;
        const cx = ax + dx * travel;
        const cy = ay + dy * travel;
        const shimmer = 0.12 + 0.16 * (0.5 + 0.5 * Math.sin(phase + mark * 0.9 + i * 0.7));
        const bandHalf = this.cellSize * (0.11 + 0.035 * Math.sin(phase * 0.8 + mark + i));
        const slant = this.cellSize * 0.08;
        this.connectorLayer
          .moveTo(cx - nx * bandHalf - dx / len * slant, cy - ny * bandHalf - dy / len * slant)
          .lineTo(cx + nx * bandHalf + dx / len * slant, cy + ny * bandHalf + dy / len * slant)
          .stroke({ width: this.cellSize * 0.05, color: 0xffffff, alpha: shimmer, cap: "round" });
      }
    }

    for (let i = 2; i < points.length - 1; i += 3) {
      const point = points[i]!;
      const prev = points[i - 1] ?? point;
      const next = points[i + 1] ?? point;
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = (-dy / len) * this.cellSize * 0.12;
      const py = (dx / len) * this.cellSize * 0.12;
      const cx = point.x * this.cellSize + this.cellSize / 2;
      const cy = point.y * this.cellSize + this.cellSize / 2;
      this.connectorLayer
        .moveTo(cx - px, cy - py)
        .lineTo(cx + px, cy + py)
        .stroke({ width: this.cellSize * 0.055, color: 0xffffff, alpha: 0.12, cap: "round" });
    }
  }

  private drawGoogleSnake(points: Vec2[], colorForSegment: (index: number) => number): void {
    this.connectorLayer.clear();
    if (points.length === 0) return;

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i]!;
      const to = points[i + 1]!;
      const color = colorForSegment(i);
      const minX = Math.min(from.x, to.x);
      const minY = Math.min(from.y, to.y);
      const width = (Math.abs(to.x - from.x) + 1) * this.cellSize;
      const height = (Math.abs(to.y - from.y) + 1) * this.cellSize;
      this.connectorLayer
        .rect(minX * this.cellSize + this.cellSize * 0.02, minY * this.cellSize + this.cellSize * 0.02, width - this.cellSize * 0.04, height - this.cellSize * 0.04)
        .fill(color);
    }
  }

  private renderFace(state: GameState, visualHead: Vec2): void {
    const head = visualHead;
    if (!head) return;

    const cx = head.x * this.cellSize + this.cellSize / 2;
    const cy = head.y * this.cellSize + this.cellSize / 2;
    const look = this.eyeOffset(state.direction);
    const eyeA = this.eyePosition(state.direction, cx, cy, -1);
    const eyeB = this.eyePosition(state.direction, cx, cy, 1);
    const r = this.cellSize;

    this.faceLayer.clear();

    // Animated forked tongue (rendered first so eyes appear on top)
    const ext = this.tongueExtension();
    if (ext > 0.01 && state.config.snakeStyle !== "google") {
      const dv = this.directionVec(state.direction);
      const perp = { x: -dv.y, y: dv.x };
      const base = { x: cx + dv.x * r * 0.33, y: cy + dv.y * r * 0.33 };
      const stemEnd = { x: base.x + dv.x * r * 0.28 * ext, y: base.y + dv.y * r * 0.28 * ext };
      const forkReach = r * 0.18 * ext;
      const spread = r * 0.09;
      this.faceLayer
        .moveTo(base.x, base.y)
        .lineTo(stemEnd.x, stemEnd.y)
        .stroke({ width: r * 0.054, color: 0xff2060, alpha: 0.94, cap: "round" })
        .moveTo(stemEnd.x, stemEnd.y)
        .lineTo(stemEnd.x + dv.x * forkReach + perp.x * spread, stemEnd.y + dv.y * forkReach + perp.y * spread)
        .stroke({ width: r * 0.038, color: 0xff2060, alpha: 0.88, cap: "round" })
        .moveTo(stemEnd.x, stemEnd.y)
        .lineTo(stemEnd.x + dv.x * forkReach - perp.x * spread, stemEnd.y + dv.y * forkReach - perp.y * spread)
        .stroke({ width: r * 0.038, color: 0xff2060, alpha: 0.88, cap: "round" });
    }

    // Eyes: white sclera → green iris → dark pupil
    for (const eye of [eyeA, eyeB]) {
      this.faceLayer
        .circle(eye.x, eye.y, r * 0.148)
        .fill(0xffffff)
        .circle(eye.x + look.x * 0.55, eye.y + look.y * 0.55, r * 0.092)
        .fill(0x1fd96c)
        .circle(eye.x + look.x, eye.y + look.y, r * 0.050)
        .fill(0x030303);
    }
  }

  private interpolateSnake(): Vec2[] {
    if (this.currentSnake.length === 0) return [];
    const t = Math.min(1, (performance.now() - this.snakeAnimationStart) / this.snakeAnimationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    return this.currentSnake.map((segment, index) => {
      const prev = this.previousSnake[index] ?? this.previousSnake[this.previousSnake.length - 1] ?? segment;
      return {
        x: prev.x + (segment.x - prev.x) * eased,
        y: prev.y + (segment.y - prev.y) * eased,
      };
    });
  }

  private eyeOffset(direction: Direction): Vec2 {
    const amount = this.cellSize * 0.035;
    if (direction === "left") return { x: -amount, y: 0 };
    if (direction === "right") return { x: amount, y: 0 };
    if (direction === "up") return { x: 0, y: -amount };
    return { x: 0, y: amount };
  }

  private eyePosition(direction: Direction, cx: number, cy: number, side: -1 | 1): Vec2 {
    const across = this.cellSize * 0.18 * side;
    const forward = this.cellSize * 0.13;
    if (direction === "left") return { x: cx - forward, y: cy + across };
    if (direction === "right") return { x: cx + forward, y: cy + across };
    if (direction === "up") return { x: cx + across, y: cy - forward };
    return { x: cx + across, y: cy + forward };
  }


/** Release all avatar texture references back to the shared cache, then
   * destroy all display objects. Must be called instead of (not alongside)
   * view.destroy() so avatar textures don't accumulate in the cache across
   * board replacements. */
  destroy(): void {
    for (const [, entry] of this.avatarSprites) {
      this.avatarCache.release(entry.avatarUrl, (texture) => texture.destroy(true));
    }
    this.avatarSprites.clear();
    this.view.destroy({ children: true });
  }
}
