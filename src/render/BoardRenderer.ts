import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { AvatarFood, GameState } from "../game/types";
import { hueForLength, lerpHue } from "../game/colorHue";
import { LAYOUT, COLORS } from "./layout";
import { TextureCache } from "./TextureCache";

const START_SNAKE_LENGTH = 2;
/** How quickly the on-screen hue catches up to the target hue, per render frame. Smaller = slower/dreamier shift. */
const HUE_LERP_SPEED = 0.04;

function hueToRgb(hue: number, saturation = 0.65, lightness = 0.55): number {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  let r = 0, g = 0, b = 0;
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
  private gridLayer = new Graphics();
  private snakeLayer = new Container();
  private foodLayer = new Container();
  private cellSize: number;
  private displayedHue = 0;
  private avatarSprites = new Map<string, { sprite: Sprite; avatarUrl: string }>();
  /** Pool of reusable segment graphics, grown on demand and re-tinted each
   * frame instead of being recreated — avoids ~thousands of Graphics
   * allocations/sec (long snake × 60fps) and the GC hitches that follow. */
  private segmentPool: Graphics[] = [];
  private apple: Graphics;

  constructor(
    private boardSize: number,
    private avatarCache: TextureCache<Texture>
  ) {
    this.cellSize = LAYOUT.board.size / boardSize;
    this.view.x = LAYOUT.board.x;
    this.view.y = LAYOUT.board.y;

    const background = new Graphics()
      .rect(0, 0, LAYOUT.board.size, LAYOUT.board.size)
      .fill(COLORS.boardBackground);
    this.view.addChild(background, this.gridLayer, this.snakeLayer, this.foodLayer);

    // The base apple's geometry never changes — draw it once, just reposition.
    this.apple = new Graphics()
      .circle(this.cellSize / 2, this.cellSize / 2, this.cellSize * 0.35)
      .fill(COLORS.baseApple);
    this.foodLayer.addChild(this.apple);

    this.drawGrid();
  }

  private getSegment(index: number): Graphics {
    let seg = this.segmentPool[index];
    if (!seg) {
      // White geometry drawn once; per-frame color is applied via `tint`.
      seg = new Graphics().roundRect(2, 2, this.cellSize - 4, this.cellSize - 4, 6).fill(0xffffff);
      this.segmentPool[index] = seg;
      this.snakeLayer.addChild(seg);
    }
    return seg;
  }

  private drawGrid(): void {
    this.gridLayer.clear();
    for (let i = 1; i < this.boardSize; i++) {
      const pos = i * this.cellSize;
      this.gridLayer.moveTo(pos, 0).lineTo(pos, LAYOUT.board.size);
      this.gridLayer.moveTo(0, pos).lineTo(LAYOUT.board.size, pos);
    }
    this.gridLayer.stroke({ width: 1, color: COLORS.gridLine, alpha: 0.5 });
  }

  update(state: GameState): void {
    this.renderSnake(state);
    this.renderFoods(state);
  }

  private renderSnake(state: GameState): void {
    const targetHue = hueForLength(state.snake.length, START_SNAKE_LENGTH);
    this.displayedHue = lerpHue(this.displayedHue, targetHue, HUE_LERP_SPEED);
    const bodyColor = hueToRgb(this.displayedHue);

    state.snake.forEach((segment, index) => {
      const seg = this.getSegment(index);
      seg.visible = true;
      seg.tint = index === 0 ? COLORS.snakeHead : bodyColor;
      seg.x = segment.x * this.cellSize;
      seg.y = segment.y * this.cellSize;
    });

    // Hide any pooled segments beyond the current snake length.
    for (let i = state.snake.length; i < this.segmentPool.length; i++) {
      this.segmentPool[i]!.visible = false;
    }
  }

  private renderFoods(state: GameState): void {
    this.apple.x = state.baseApple.x * this.cellSize;
    this.apple.y = state.baseApple.y * this.cellSize;

    // Reconcile sprites against current state. Any food that left the board —
    // whether eaten OR wiped by a game reset — releases its cached texture here,
    // so this single path can never leak (the old eat-only release path could).
    const presentIds = new Set(state.avatarFoods.map((f) => f.id));
    for (const [id, entry] of this.avatarSprites) {
      if (!presentIds.has(id)) {
        this.avatarSprites.delete(id);
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
      const sprite = new Sprite(Texture.WHITE);
      sprite.width = this.cellSize - 4;
      sprite.height = this.cellSize - 4;
      sprite.anchor.set(0.5);
      entry = { sprite, avatarUrl: food.avatarUrl };
      this.avatarSprites.set(food.id, entry);
      this.foodLayer.addChild(sprite);
      this.avatarCache.acquire(food.avatarUrl).then((texture) => {
        if (this.avatarSprites.get(food.id) === entry) sprite.texture = texture;
      });
    }
    entry.sprite.x = food.pos.x * this.cellSize + this.cellSize / 2;
    entry.sprite.y = food.pos.y * this.cellSize + this.cellSize / 2;
  }
}
