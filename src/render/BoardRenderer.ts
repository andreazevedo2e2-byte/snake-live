import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { AvatarFood, Direction, GameState, Vec2 } from "../game/types";
import { hueForLength, lerpHue } from "../game/colorHue";
import { LAYOUT, COLORS } from "./layout";
import { TextureCache } from "./TextureCache";

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

export class BoardRenderer {
  readonly view = new Container();
  private backgroundLayer = new Graphics();
  private gridLayer = new Graphics();
  private foodLayer = new Container();
  private snakeGlowLayer = new Container();
  private connectorLayer = new Graphics();
  private snakeLayer = new Container();
  private faceLayer = new Graphics();
  private cellSize: number;
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
  private apple: Graphics;

  constructor(
    boardSize: number,
    private avatarCache: TextureCache<Texture>
  ) {
    this.cellSize = LAYOUT.board.size / boardSize;
    this.view.x = LAYOUT.board.x;
    this.view.y = LAYOUT.board.y;
    this.view.addChild(
      this.backgroundLayer,
      this.gridLayer,
      this.foodLayer,
      this.snakeGlowLayer,
      this.connectorLayer,
      this.snakeLayer,
      this.faceLayer
    );

    this.apple = new Graphics();
    this.drawBackground();
    this.drawGrid();
    this.drawApple();
    this.foodLayer.addChild(this.apple);
  }

  update(state: GameState, speedMultiplier = 1): void {
    this.renderFoods(state);
    this.updateSnakeAnimation(state, speedMultiplier);
    this.renderSnake(state);
  }

  private updateSnakeAnimation(state: GameState, speedMultiplier: number): void {
    const nextKey = state.snake.map(key).join("|");
    const currentKey = this.currentSnake.map(key).join("|");
    if (nextKey === currentKey) return;
    this.previousSnake = this.interpolateSnake();
    this.currentSnake = state.snake.map((segment) => ({ ...segment }));
    this.snakeAnimationStart = performance.now();
    this.snakeAnimationMs = Math.max(90, 320 / speedMultiplier);
  }

  private drawBackground(): void {
    this.backgroundLayer
      .clear()
      .roundRect(-11, -11, LAYOUT.board.size + 22, LAYOUT.board.size + 22, 12)
      .fill({ color: COLORS.boardWallShadow, alpha: 0.9 })
      .roundRect(-5, -5, LAYOUT.board.size + 10, LAYOUT.board.size + 10, 9)
      .fill(COLORS.boardWall)
      .rect(0, 0, LAYOUT.board.size, LAYOUT.board.size)
      .fill(COLORS.boardBackground);

    const bandHeight = LAYOUT.board.size / 4;
    for (let i = 0; i < 4; i++) {
      this.backgroundLayer
        .rect(0, i * bandHeight, LAYOUT.board.size, bandHeight)
        .fill({ color: i % 2 === 0 ? COLORS.boardBandA : COLORS.boardBandB, alpha: 0.24 + i * 0.06 });
    }

    this.backgroundLayer
      .circle(LAYOUT.board.size * 0.18, LAYOUT.board.size * 0.7, LAYOUT.board.size * 0.12)
      .fill({ color: COLORS.boardWall, alpha: 0.08 })
      .circle(LAYOUT.board.size * 0.82, LAYOUT.board.size * 0.18, LAYOUT.board.size * 0.1)
      .fill({ color: COLORS.boardWall, alpha: 0.08 })
      .ellipse(LAYOUT.board.size * 0.55, LAYOUT.board.size * 0.92, LAYOUT.board.size * 0.22, LAYOUT.board.size * 0.07)
      .fill({ color: COLORS.boardWall, alpha: 0.06 });
  }

  private drawGrid(): void {
    this.gridLayer.clear();
    this.gridLayer
      .rect(18, 18, LAYOUT.board.size - 36, LAYOUT.board.size - 36)
      .stroke({ width: 2, color: COLORS.gridLine, alpha: 0.12 });
  }

  private drawApple(): void {
    const c = this.cellSize / 2;
    this.apple
      .clear()
      .circle(c + 2, c + 5, this.cellSize * 0.34)
      .fill(COLORS.baseAppleDark)
      .circle(c - 2, c, this.cellSize * 0.33)
      .fill(COLORS.baseApple)
      .ellipse(c - 10, c - 10, this.cellSize * 0.08, this.cellSize * 0.13)
      .fill({ color: COLORS.hud, alpha: 0.45 })
      .ellipse(c + 15, c - 26, this.cellSize * 0.15, this.cellSize * 0.08)
      .fill(0x4fe04e)
      .rect(c + 2, c - 31, 5, 18)
      .fill(0x5b2e16);
  }

  private getSegment(index: number): Graphics {
    let seg = this.segmentPool[index];
    if (!seg) {
      seg = new Graphics().circle(0, 0, this.cellSize * 0.33).fill(0xffffff);
      this.segmentPool[index] = seg;
      this.snakeLayer.addChild(seg);
    }
    return seg;
  }

  private getGlow(index: number): Graphics {
    let glow = this.segmentGlowPool[index];
    if (!glow) {
      glow = new Graphics().circle(0, 0, this.cellSize * 0.41).fill({ color: 0xffffff, alpha: 0.22 });
      this.segmentGlowPool[index] = glow;
      this.snakeGlowLayer.addChild(glow);
    }
    return glow;
  }

  private renderSnake(state: GameState): void {
    const targetHue = hueForLength(state.snake.length, START_SNAKE_LENGTH);
    this.displayedHue = lerpHue(this.displayedHue, targetHue, HUE_LERP_SPEED);
    const baseHue = (205 + this.displayedHue) % 360;
    const visualSnake = this.interpolateSnake();
    const colorForSegment = (index: number): number =>
      hueToRgb((baseHue + index * 4.2) % 360, index === 0 ? 0.82 : 0.72, index === 0 ? 0.55 : 0.58);

    this.connectorLayer.clear();
    for (let i = 0; i < visualSnake.length - 1; i++) {
      this.drawConnector(visualSnake[i]!, visualSnake[i + 1]!, colorForSegment(i));
    }

    visualSnake.forEach((segment, index) => {
      const color = colorForSegment(index);
      const glow = this.getGlow(index);
      glow.visible = true;
      glow.tint = color;
      glow.alpha = index === 0 ? 0.58 : 0.3;
      glow.x = segment.x * this.cellSize + this.cellSize / 2;
      glow.y = segment.y * this.cellSize + this.cellSize / 2;

      const seg = this.getSegment(index);
      seg.visible = true;
      seg.tint = color;
      seg.x = segment.x * this.cellSize + this.cellSize / 2;
      seg.y = segment.y * this.cellSize + this.cellSize / 2;
      seg.scale.set(index === 0 ? 1.16 : 1, index === 0 ? 0.92 : 1);
      seg.rotation = index === 0 ? this.rotationForDirection(state.direction) : 0;
    });

    for (let i = visualSnake.length; i < this.segmentPool.length; i++) {
      this.segmentPool[i]!.visible = false;
      this.segmentGlowPool[i]!.visible = false;
    }

    this.renderFace(state, visualSnake[0] ?? state.snake[0]!);
  }

  private renderFoods(state: GameState): void {
    this.apple.x = state.baseApple.x * this.cellSize;
    this.apple.y = state.baseApple.y * this.cellSize;

    const presentIds = new Set(state.avatarFoods.map((f) => f.id));
    for (const [id, entry] of this.avatarSprites) {
      if (!presentIds.has(id)) {
        this.avatarSprites.delete(id);
        entry.ring.destroy();
        entry.mask.destroy();
        entry.sprite.destroy();
        this.avatarCache.release(entry.avatarUrl, (texture) => texture.destroy(true));
      }
    }

    for (const food of state.avatarFoods) {
      this.renderAvatarFood(food);
    }
  }

  private renderAvatarFood(food: AvatarFood): void {
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

  private drawConnector(from: Vec2, to: Vec2, color: number): void {
    const ax = from.x * this.cellSize + this.cellSize / 2;
    const ay = from.y * this.cellSize + this.cellSize / 2;
    const bx = to.x * this.cellSize + this.cellSize / 2;
    const by = to.y * this.cellSize + this.cellSize / 2;
    this.connectorLayer
      .moveTo(ax, ay)
      .lineTo(bx, by)
      .stroke({ width: this.cellSize * 0.64, color, alpha: 0.9 });
  }

  private renderFace(state: GameState, visualHead: Vec2): void {
    const head = visualHead;
    if (!head) return;

    const cx = head.x * this.cellSize + this.cellSize / 2;
    const cy = head.y * this.cellSize + this.cellSize / 2;
    const look = this.eyeOffset(state.direction);
    const eyeA = this.eyePosition(state.direction, cx, cy, -1);
    const eyeB = this.eyePosition(state.direction, cx, cy, 1);
    const mouthOpen = this.isFoodAhead(state.snake[0]!, state.direction, state);

    this.faceLayer
      .clear()
      .circle(eyeA.x, eyeA.y, this.cellSize * 0.12)
      .fill(COLORS.hud)
      .circle(eyeB.x, eyeB.y, this.cellSize * 0.12)
      .fill(COLORS.hud)
      .circle(eyeA.x + look.x, eyeA.y + look.y, this.cellSize * 0.052)
      .fill(0x050505)
      .circle(eyeB.x + look.x, eyeB.y + look.y, this.cellSize * 0.052)
      .fill(0x050505);

    if (mouthOpen) {
      this.faceLayer
        .ellipse(cx + look.x * 2, cy + look.y * 2, this.cellSize * 0.13, this.cellSize * 0.1)
        .fill(0x3b0627);
    } else {
      this.faceLayer
        .moveTo(cx - this.cellSize * 0.1, cy + this.cellSize * 0.16)
        .quadraticCurveTo(cx, cy + this.cellSize * 0.24, cx + this.cellSize * 0.1, cy + this.cellSize * 0.16)
        .stroke({ width: 5, color: 0x3b0627, alpha: 0.82 });
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

  private rotationForDirection(direction: Direction): number {
    if (direction === "right") return 0;
    if (direction === "down") return Math.PI / 2;
    if (direction === "left") return Math.PI;
    return -Math.PI / 2;
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

  private isFoodAhead(head: Vec2, direction: Direction, state: GameState): boolean {
    const next =
      direction === "left"
        ? { x: head.x - 1, y: head.y }
        : direction === "right"
          ? { x: head.x + 1, y: head.y }
          : direction === "up"
            ? { x: head.x, y: head.y - 1 }
            : { x: head.x, y: head.y + 1 };

    return (
      (next.x === state.baseApple.x && next.y === state.baseApple.y) ||
      state.avatarFoods.some((food) => food.pos.x === next.x && food.pos.y === next.y)
    );
  }
}
