import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { AvatarFood, GameState } from "../game/types";
import { hueForLength } from "../game/colorHue";
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
  private avatarSprites = new Map<string, Sprite>();

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

    this.drawGrid();
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
    this.snakeLayer.removeChildren();
    const targetHue = hueForLength(state.snake.length, START_SNAKE_LENGTH);
    this.displayedHue += (targetHue - this.displayedHue) * HUE_LERP_SPEED;
    const bodyColor = hueToRgb(this.displayedHue);

    state.snake.forEach((segment, index) => {
      const isHead = index === 0;
      const g = new Graphics()
        .roundRect(2, 2, this.cellSize - 4, this.cellSize - 4, 6)
        .fill(isHead ? COLORS.snakeHead : bodyColor);
      g.x = segment.x * this.cellSize;
      g.y = segment.y * this.cellSize;
      this.snakeLayer.addChild(g);
    });
  }

  private renderFoods(state: GameState): void {
    const apple = new Graphics()
      .circle(this.cellSize / 2, this.cellSize / 2, this.cellSize * 0.35)
      .fill(COLORS.baseApple);
    apple.x = state.baseApple.x * this.cellSize;
    apple.y = state.baseApple.y * this.cellSize;

    this.foodLayer.removeChildren();
    this.foodLayer.addChild(apple);

    const presentIds = new Set(state.avatarFoods.map((f) => f.id));
    for (const [id, sprite] of this.avatarSprites) {
      if (!presentIds.has(id)) {
        this.avatarSprites.delete(id);
        sprite.destroy();
      }
    }

    for (const food of state.avatarFoods) {
      this.renderAvatarFood(food);
    }
  }

  private renderAvatarFood(food: AvatarFood): void {
    let sprite = this.avatarSprites.get(food.id);
    if (!sprite) {
      sprite = new Sprite(Texture.WHITE);
      sprite.width = this.cellSize - 4;
      sprite.height = this.cellSize - 4;
      sprite.anchor.set(0.5);
      this.avatarSprites.set(food.id, sprite);
      this.avatarCache.acquire(food.avatarUrl).then((texture) => {
        if (this.avatarSprites.get(food.id) === sprite) sprite!.texture = texture;
      });
    }
    sprite.x = food.pos.x * this.cellSize + this.cellSize / 2;
    sprite.y = food.pos.y * this.cellSize + this.cellSize / 2;
    this.foodLayer.addChild(sprite);
  }

  /** Must be called whenever a food is consumed so its texture can be released back to the cache. */
  releaseAvatarFood(food: AvatarFood): void {
    const sprite = this.avatarSprites.get(food.id);
    if (sprite) {
      this.avatarSprites.delete(food.id);
      sprite.destroy();
    }
    this.avatarCache.release(food.avatarUrl, (texture) => texture.destroy(true));
  }
}
