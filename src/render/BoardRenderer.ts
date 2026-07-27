import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { BoardFood, Direction, FoodType, GameState, Vec2 } from "../game/types";
import { hueForLength, lerpHue } from "../game/colorHue";
import { LAYOUT, COLORS } from "./layout";
import { TextureCache } from "./TextureCache";
import { mapCellColor } from "./mapThemes";
import { isParticleAlive, particleFrame, spawnEatBurst, type EatParticle } from "./particles";
import {
  confettiFrame,
  floatingTextFrame,
  headSquashScale,
  shakeOffset,
  spawnConfetti,
  spawnPopScale,
  SPAWN_POP_MS,
  type ConfettiPiece,
} from "./juice";

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
  private snakeShadowLayer = new Graphics();
  private snakeGlowLayer = new Container();
  private connectorLayer = new Graphics();
  private snakeLayer = new Container();
  private enchantLayer = new Graphics();
  private particleLayer = new Graphics();
  private faceLayer = new Graphics();
  private enchanted = false;
  private particles: EatParticle[] = [];
  private prevScore = 0;
  // v3.1 juice state — all timestamp-driven, so every effect costs nothing
  // once its window has elapsed.
  private baseViewX = 0;
  private baseViewY = 0;
  private lastEatAt = Number.NEGATIVE_INFINITY;
  private floatText = new Text({ text: "+1", style: { fill: 0xffffff, fontFamily: '"Arial Black", Arial, sans-serif', fontSize: 30, fontWeight: "900", dropShadow: { color: 0x000000, alpha: 0.8, blur: 2, distance: 2 } } });
  private floatTextOrigin = { x: 0, y: 0 };
  private confetti: ConfettiPiece[] = [];
  private confettiLayer = new Graphics();
  private prevStatus: GameState["status"] = "start";
  private foodSpawnAt = new Map<string, number>();
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
    this.baseViewX = LAYOUT.board.x + (LAYOUT.board.size - this.boardPixelWidth) / 2;
    this.baseViewY = LAYOUT.board.y + (LAYOUT.board.size - this.boardPixelHeight) / 2;
    this.view.x = this.baseViewX;
    this.view.y = this.baseViewY;
    this.floatText.anchor.set(0.5);
    this.floatText.alpha = 0;
    this.floatText.style.fontSize = Math.round(this.cellSize * 0.5);
    this.view.addChild(
      this.backgroundLayer,
      this.mapLayer,
      this.wallLayer,
      this.gridLayer,
      this.foodGlowLayer,
      this.foodLayer,
      this.snakeShadowLayer,
      this.snakeGlowLayer,
      this.connectorLayer,
      this.snakeLayer,
      this.enchantLayer,
      this.particleLayer,
      this.confettiLayer,
      this.floatText,
      this.faceLayer
    );
    this.drawBackground();
    this.drawGrid();
  }

  /** v3.3: called from the ticker each frame — true while the golden-apple
   * enchant window is active (drives the snake shimmer aura). */
  setEnchanted(value: boolean): void {
    this.enchanted = value;
  }

  update(state: GameState, speedMultiplier = 1): void {
    this.drawWalls(state);
    this.renderFoods(state);
    this.updateSnakeAnimation(state, speedMultiplier);
    this.renderSnake(state);
    this.drawEnchantAura();
    this.maybeSpawnEatParticles(state);
    this.updateParticles();
    this.updateJuice(state);
  }

  /** v3.1 juice: per-frame driver for the watch-appeal effects. Everything
   * keys off timestamps set on the eat/victory transitions, so idle frames
   * reduce to a handful of "window elapsed?" checks. */
  private updateJuice(state: GameState): void {
    const now = performance.now();

    // Eat screen-shake — a short decaying wobble of the whole board.
    const shake = shakeOffset(now - this.lastEatAt, this.lastEatAt % 977);
    this.view.x = this.baseViewX + shake.x;
    this.view.y = this.baseViewY + shake.y;

    // Floating "+1" above where the food was eaten.
    const floatFrame = floatingTextFrame(now - this.lastEatAt);
    if (floatFrame) {
      this.floatText.alpha = floatFrame.alpha;
      this.floatText.x = this.floatTextOrigin.x;
      this.floatText.y = this.floatTextOrigin.y + floatFrame.dy;
    } else {
      this.floatText.alpha = 0;
    }

    // Victory confetti — spawned once on the playing→victory transition.
    if (state.status === "victory" && this.prevStatus !== "victory") {
      this.confetti = spawnConfetti(
        this.boardPixelWidth / 2,
        this.boardPixelHeight * 0.35,
        this.boardPixelWidth * 0.5,
        now,
      );
    }
    this.prevStatus = state.status;

    this.confettiLayer.clear();
    if (this.confetti.length > 0) {
      const gravity = this.boardPixelHeight * 0.55;
      let anyAlive = false;
      const size = Math.max(4, this.cellSize * 0.16);
      for (const piece of this.confetti) {
        const frame = confettiFrame(piece, now, gravity);
        if (!frame) continue;
        anyAlive = true;
        // Fake the tumble by squeezing the width with the rotation phase.
        const w = size * (0.35 + 0.65 * Math.abs(Math.cos(frame.rotation)));
        this.confettiLayer.rect(frame.x - w / 2, frame.y - size / 2, w, size).fill({ color: piece.color, alpha: frame.alpha });
      }
      if (!anyAlive) this.confetti = [];
    }
  }

  /** #115(b): a brief particle burst where the snake just ate gives the
   * moment some punch beyond the food sprite simply vanishing. Detected by
   * score increasing since the last update() call (not by diffing food
   * lists) since food removal for other reasons — e.g. relocateStuckFoods —
   * shouldn't trigger it. The math lives in the pure, unit-tested
   * particles.ts module; this class only draws the resulting frames. */
  private maybeSpawnEatParticles(state: GameState): void {
    if (state.score > this.prevScore) {
      const head = state.snake[0]!;
      const cx = head.x * this.cellSize + this.cellSize / 2;
      const cy = head.y * this.cellSize + this.cellSize / 2;
      const color = state.config.colorMode === "map" ? COLORS.hud : COLORS.baseApple;
      const now = performance.now();
      this.particles.push(...spawnEatBurst(cx, cy, color, this.cellSize, now));
      // Kick off the rest of the eat juice: shake, head squash and the
      // floating "+1" all share this timestamp.
      this.lastEatAt = now;
      this.floatTextOrigin = { x: cx, y: cy - this.cellSize * 0.55 };
    }
    this.prevScore = state.score;
  }

  /** Pruned and redrawn every frame regardless of tick changes, so the burst
   * animates smoothly rather than jumping between tick snapshots — same
   * dirty-Graphics tradeoff as everything else here: cheap when empty
   * (the common case), a `.clear()` + a handful of circles when active. */
  private updateParticles(): void {
    if (this.particles.length === 0) {
      this.particleLayer.clear();
      return;
    }
    const now = performance.now();
    this.particles = this.particles.filter((p) => isParticleAlive(p, now));
    this.particleLayer.clear();
    for (const p of this.particles) {
      const frame = particleFrame(p, now, this.cellSize);
      if (!frame) continue;
      this.particleLayer.circle(frame.x, frame.y, frame.radius).fill({ color: p.color, alpha: frame.alpha });
    }
  }

  private drawFoodGlows(foods: BoardFood[]): void {
    this.foodGlowLayer.clear();
    if (foods.length === 0) return;
    const t = performance.now();
    for (const food of foods) {
      const x = food.pos.x * this.cellSize + this.cellSize / 2;
      const y = food.pos.y * this.cellSize + this.cellSize / 2;
      if (food.kind === "golden") {
        this.drawGoldenGlow(x, y, t, food.pos);
        continue;
      }
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

  /** v3.3 golden apple: a Minecraft-enchanted-apple look — a strong warm gold
   * halo that pulses faster than a normal apple, plus a rotating magenta
   * "enchant" glint and a few orbiting sparkles. Draws on the glow layer so
   * it sits under the apple sprite. */
  private drawGoldenGlow(x: number, y: number, t: number, pos: Vec2): void {
    const pulse = 0.5 + 0.5 * Math.sin(t / 260 + pos.x + pos.y);
    // Warm gold halo (two rings).
    this.foodGlowLayer
      .circle(x, y, this.cellSize * (0.62 + 0.14 * pulse))
      .fill({ color: 0xffd23c, alpha: 0.12 + 0.08 * pulse })
      .circle(x, y, this.cellSize * 0.4)
      .fill({ color: 0xffe98a, alpha: 0.18 });
    // Enchant glint: magenta, the Minecraft-shimmer signature.
    this.foodGlowLayer
      .circle(x, y, this.cellSize * (0.3 + 0.1 * pulse))
      .fill({ color: 0xd657ff, alpha: 0.1 + 0.08 * (1 - pulse) });
    // Orbiting sparkles.
    for (let i = 0; i < 3; i++) {
      const a = t / 340 + (i * Math.PI * 2) / 3;
      const r = this.cellSize * 0.5;
      this.foodGlowLayer
        .circle(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.max(1, this.cellSize * 0.06))
        .fill({ color: 0xffffff, alpha: 0.5 + 0.4 * Math.sin(t / 120 + i) });
    }
    // Ground shadow.
    this.foodGlowLayer
      .ellipse(x, y + this.cellSize * 0.3, this.cellSize * 0.26, this.cellSize * 0.06)
      .fill({ color: 0x000000, alpha: 0.16 });
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

  /** v3.2 arena (see COLORS.boardBackground note): neutral dark two-tone
   * checkerboard — the classic snake-game floor — with a neon frame that is
   * the ONLY element following the snake's accent color. The tiles never
   * change hue, so the colorful snake, the glowing food and the light maze
   * walls always sit on a stable, high-contrast stage. Redrawn only when
   * the accent changes (same dirty-check as before), never per frame. */
  private drawBackground(accentColor: number = COLORS.boardWall): void {
    const w = this.boardPixelWidth;
    const h = this.boardPixelHeight;
    this.backgroundLayer
      .clear()
      // Soft outer glow, then the neon frame itself.
      .roundRect(-13, -13, w + 26, h + 26, 14)
      .fill({ color: accentColor, alpha: 0.16 })
      .roundRect(-6, -6, w + 12, h + 12, 10)
      .fill({ color: mixRgb(accentColor, 0x02060c, 0.72) })
      .roundRect(-6, -6, w + 12, h + 12, 10)
      .stroke({ width: 4, color: accentColor, alpha: 0.9 })
      // Arena base.
      .rect(0, 0, w, h)
      .fill(COLORS.boardBackground);

    // Two-tone checkerboard: draw only the alternate tiles over the base.
    for (let x = 0; x < this.boardWidth; x++) {
      for (let y = 0; y < this.boardHeight; y++) {
        if ((x + y) % 2 === 0) continue;
        this.backgroundLayer
          .rect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize)
          .fill(COLORS.boardTileAlt);
      }
    }

    // Subtle inner vignette: darkens the arena edges so the eye settles on
    // the center where the action is. Two thin inset strokes fake a gradient.
    this.backgroundLayer
      .rect(1, 1, w - 2, h - 2)
      .stroke({ width: this.cellSize * 0.5, color: 0x000000, alpha: 0.1 })
      .rect(1, 1, w - 2, h - 2)
      .stroke({ width: this.cellSize * 0.18, color: 0x000000, alpha: 0.12 });
  }

  private drawGrid(accentColor: number = COLORS.gridLine): void {
    const w = this.boardPixelWidth;
    const h = this.boardPixelHeight;
    this.gridLayer.clear();
    // The checkerboard already communicates the cell structure — interior
    // grid lines would just add noise on top of it. Keep only a crisp
    // arena boundary.
    this.gridLayer
      .rect(0, 0, w, h)
      .stroke({ width: 3, color: accentColor, alpha: 0.3 });
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
    this.drawSnakeShadow(visualSnake, state.config.snakeStyle);
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
      this.drawBackground(accentColor);
      // Boundary follows the same accent as the frame on every theme — the
      // old purple gridLine clashes with the neutral navy arena.
      if (state.config.snakeStyle === "google") this.gridLayer.clear();
      else this.drawGrid(accentColor);
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
      // v3.1 juice: the head "gulps" (brief bulge) right after eating.
      const squash = index === 0 ? headSquashScale(performance.now() - this.lastEatAt) : 1;
      seg.scale.set(squash, squash);
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
        this.foodSpawnAt.delete(id);
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
      this.basicFoodSprites.set(food.id, sprite);
      this.foodLayer.addChild(sprite);
      // v3.1 juice: new food pops in (scale overshoot) instead of blinking
      // into existence. Also fires when a food is relocated under a new id.
      this.foodSpawnAt.set(food.id, performance.now());
    }

    const elapsed = performance.now() - (this.foodSpawnAt.get(food.id) ?? 0);
    const scale = spawnPopScale(elapsed);
    const size = this.cellSize * 0.84 * scale;
    sprite.width = size;
    sprite.height = size;
    if (elapsed >= SPAWN_POP_MS) this.foodSpawnAt.delete(food.id);

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

    // #115(a): a plain flat fill read as a painted-on rectangle rather than a
    // physical block — a light bevel on the top/left edge and a dark one on
    // bottom/right (like a raised button) gives each wall a sense of depth
    // without any per-frame cost (this whole layer only redraws when the
    // wall set actually changes, via the dirty-check above).
    const highlight = mixRgb(wallFill, 0xffffff, 0.4);
    const shadow = mixRgb(wallFill, 0x000000, 0.55);
    const bevel = Math.max(2, this.cellSize * 0.09);
    for (const wall of state.walls) {
      const [xText, yText] = wall.split(",");
      const x = Number(xText);
      const y = Number(yText);
      const left = x * this.cellSize + 3;
      const top = y * this.cellSize + 3;
      const size = this.cellSize - 6;
      this.wallLayer
        // Base block.
        .rect(left, top, size, size)
        .fill({ color: wallFill, alpha: 0.94 })
        // Top + left highlight (light hits from upper-left).
        .poly([left, top, left + size, top, left + size - bevel, top + bevel, left + bevel, top + bevel, left + bevel, top + size - bevel, left, top + size])
        .fill({ color: highlight, alpha: 0.5 })
        // Bottom + right shadow.
        .poly([left + size, top, left + size, top + size, left, top + size, left + bevel, top + size - bevel, left + size - bevel, top + size - bevel, left + size - bevel, top + bevel])
        .fill({ color: shadow, alpha: 0.5 })
        .rect(x * this.cellSize + 5, y * this.cellSize + 5, this.cellSize - 10, this.cellSize - 10)
        .stroke({ width: 2, color: wallStroke, alpha: 0.34 });
    }
  }

  /** #115(c): a soft ground shadow under the snake reads as "resting on the
   * board" rather than floating flat against it — cheap (one Graphics layer,
   * redrawn alongside the rest of the snake each frame it actually moves). */
  private drawSnakeShadow(points: Vec2[], snakeStyle: GameState["config"]["snakeStyle"]): void {
    this.snakeShadowLayer.clear();
    if (points.length === 0) return;
    const offset = this.cellSize * 0.06;
    const radiusX = this.cellSize * (snakeStyle === "google" ? 0.46 : 0.34);
    const radiusY = radiusX * 0.62;
    for (const point of points) {
      const cx = point.x * this.cellSize + this.cellSize / 2 + offset;
      const cy = point.y * this.cellSize + this.cellSize / 2 + offset;
      this.snakeShadowLayer.ellipse(cx, cy, radiusX, radiusY).fill({ color: 0x000000, alpha: 0.22 });
    }
  }

  /** v3.3: the golden-apple enchant aura — a pulsing gold/magenta halo that
   * traces the snake while the enchant window is active. Cleared instantly
   * when it ends, so it costs nothing outside the ~5s window. */
  private drawEnchantAura(): void {
    this.enchantLayer.clear();
    if (!this.enchanted) return;
    const points = this.interpolateSnake();
    if (points.length === 0) return;
    const t = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(t / 180);
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const cx = p.x * this.cellSize + this.cellSize / 2;
      const cy = p.y * this.cellSize + this.cellSize / 2;
      // Gold outer, magenta glint alternating along the body for the shimmer.
      const gold = 0xffd23c;
      const magenta = 0xd657ff;
      const color = (i + Math.floor(t / 90)) % 2 === 0 ? gold : magenta;
      this.enchantLayer
        .circle(cx, cy, this.cellSize * (0.42 + 0.12 * pulse))
        .fill({ color, alpha: 0.14 + 0.1 * pulse });
    }
    // A brighter halo around the head.
    const head = points[0]!;
    this.enchantLayer
      .circle(head.x * this.cellSize + this.cellSize / 2, head.y * this.cellSize + this.cellSize / 2, this.cellSize * (0.55 + 0.15 * pulse))
      .fill({ color: 0xfff2a8, alpha: 0.16 + 0.12 * pulse });
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
