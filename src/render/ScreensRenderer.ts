import { Container, Graphics, Text } from "pixi.js";
import type { GameMode, GameStatus } from "../game/types";
import { LAYOUT, COLORS, SCREEN_WIDTH } from "./layout";
import { SCREEN_STRINGS } from "./strings";

const SCREEN_CONTENT: Record<"start" | "victory" | "lost", { icon: string; title: string; sub: string; color: number }> = {
  start: { icon: "▶", title: SCREEN_STRINGS.start.title, sub: SCREEN_STRINGS.start.sub, color: COLORS.speedBarFill },
  victory: { icon: "🏆", title: SCREEN_STRINGS.victory.title, sub: SCREEN_STRINGS.victoryBoardCoverage(100), color: COLORS.heroGold },
  lost: { icon: "💥", title: SCREEN_STRINGS.lost.title, sub: SCREEN_STRINGS.lost.sub, color: COLORS.baseApple },
};

export interface VictoryContext {
  gameMode: GameMode;
  score: number;
  foodGoal: number | null;
  coverage: number;
  timer: string;
}

/** Each mode's win condition tells a different story: the maze sprint is
 * about how fast you reached the target, harvest/pudding are about how much
 * food you collected toward the goal, and the rest is about how much of the
 * board got covered. */
/** #115(d) pure core, exported for tests: scales the score/coverage fields
 * down during the count-up window; returns the context unchanged once the
 * animation window has elapsed, so the subtitle lands on the real final
 * numbers. `elapsedMs` < 0 is treated as 0 (clock skew safety). */
export function animateVictoryContext(context: VictoryContext, elapsedMs: number, durationMs: number): VictoryContext {
  const t = Math.min(1, Math.max(0, elapsedMs) / durationMs);
  if (t >= 1) return context;
  const eased = 1 - Math.pow(1 - t, 2);
  return { ...context, score: Math.round(context.score * eased), coverage: context.coverage * eased };
}

function victorySubtitle(context: VictoryContext): string {
  switch (context.gameMode) {
    case "maze_race":
      return SCREEN_STRINGS.victoryFinishedIn(context.timer);
    case "maze_harvest":
    case "pudding":
      return SCREEN_STRINGS.victoryFoodCollected(context.score, context.foodGoal);
    default:
      return SCREEN_STRINGS.victoryBoardCoverage(Math.round(Math.min(1, context.coverage) * 100));
  }
}

function makeText(text: string, size: number, fill: number): Text {
  return new Text({
    text,
    style: {
      fill,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: size,
      fontWeight: "900",
      letterSpacing: 1,
      dropShadow: { color: 0x000000, alpha: 0.75, blur: 3, distance: 3 },
    },
  });
}

export class ScreensRenderer {
  readonly view = new Container();
  private overlay: Graphics;
  private icon: Text;
  private title: Text;
  private subtitle: Text;
  private buttonText: Text;

  /** Actual board pixel rectangle, updated by setBoardConfig() whenever the
   * board is replaced. Starts at the full layout square (the default board). */
  private boardRect: { x: number; y: number; width: number; height: number } = {
    x: LAYOUT.board.x,
    y: LAYOUT.board.y,
    width: LAYOUT.board.size,
    height: LAYOUT.board.size,
  };
  private currentStatus: GameStatus = "start";
  private currentVictoryContext: VictoryContext | undefined;
  private lastDrawnStatus: GameStatus | null = null;
  private victoryAnimStart: number | null = null;
  private static readonly SCORE_COUNT_MS = 700;

  constructor() {
    this.overlay = new Graphics();

    this.icon = makeText("", 130, COLORS.hud);
    this.icon.anchor.set(0.5);
    this.icon.x = SCREEN_WIDTH / 2;
    this.icon.y = LAYOUT.board.y + LAYOUT.board.size / 2 - 140;

    this.title = makeText("", 70, COLORS.hud);
    this.title.anchor.set(0.5);
    this.title.x = SCREEN_WIDTH / 2;
    this.title.y = LAYOUT.board.y + LAYOUT.board.size / 2 + 5;

    this.subtitle = makeText("", 31, COLORS.hudMuted);
    this.subtitle.anchor.set(0.5);
    this.subtitle.x = SCREEN_WIDTH / 2;
    this.subtitle.y = LAYOUT.board.y + LAYOUT.board.size / 2 + 82;

    this.buttonText = makeText(SCREEN_STRINGS.startButton, 34, COLORS.background);
    this.buttonText.anchor.set(0.5);
    this.buttonText.x = SCREEN_WIDTH / 2;
    this.buttonText.y = LAYOUT.board.y + LAYOUT.board.size / 2 + 170;

    this.view.addChild(this.overlay, this.icon, this.title, this.subtitle, this.buttonText);
    this.setStatus("start");
  }

  /** Update the pixel rect of the board area — call this every time a new
   * BoardRenderer is created (replaceBoard in main.ts). */
  setBoardConfig(boardWidth: number, boardHeight: number): void {
    const cellSize = LAYOUT.board.size / Math.max(boardWidth, boardHeight);
    const pw = cellSize * boardWidth;
    const ph = cellSize * boardHeight;
    this.boardRect = {
      x: LAYOUT.board.x + (LAYOUT.board.size - pw) / 2,
      y: LAYOUT.board.y + (LAYOUT.board.size - ph) / 2,
      width: pw,
      height: ph,
    };
    // Re-render with updated dimensions if currently showing a status screen.
    // Force the overlay redraw below even though the status itself isn't
    // changing — the board size is.
    if (this.currentStatus !== "playing") {
      this.lastDrawnStatus = null;
      this.setStatus(this.currentStatus, this.currentVictoryContext);
    }
  }

  setStatus(status: GameStatus, victoryContext?: VictoryContext): void {
    const isNewVictory = status === "victory" && this.currentStatus !== "victory";
    this.currentStatus = status;
    this.currentVictoryContext = victoryContext;

    if (status === "playing") {
      this.view.visible = false;
      this.victoryAnimStart = null;
      this.lastDrawnStatus = null;
      return;
    }

    this.view.visible = true;
    // #115(d): count the score/coverage up from 0 instead of snapping
    // straight to the final number — restarts only on an actual playing→
    // victory transition, never re-triggered by the every-frame calls this
    // gets while the screen is showing.
    if (isNewVictory) this.victoryAnimStart = performance.now();
    if (status !== "victory") this.victoryAnimStart = null;

    const content = SCREEN_CONTENT[status];
    // The overlay/icon/button are the same for every frame this status
    // screen is up — only redraw that Graphics/layout work on an actual
    // status or board-size change, not on every one of the ~60 calls/sec
    // this gets while just sitting on the end screen.
    if (status !== this.lastDrawnStatus) {
      this.lastDrawnStatus = status;
      const { x, y, width, height } = this.boardRect;
      const cx = x + width / 2;
      const cy = y + height / 2;
      this.overlay
        .clear()
        .rect(x, y, width, height)
        .fill({ color: 0x000000, alpha: 0.62 })
        .roundRect(cx - 245, cy - 230, 490, 470, 8)
        .fill({ color: COLORS.panel, alpha: 0.92 })
        .stroke({ width: 4, color: content.color, alpha: 0.95 })
        .roundRect(cx - 115, cy + 130, 230, 76, 8)
        .fill(content.color);

      this.icon.x = cx;
      this.icon.y = cy - 140;
      this.title.x = cx;
      this.title.y = cy + 5;
      this.subtitle.x = cx;
      this.subtitle.y = cy + 82;
      this.buttonText.x = cx;
      this.buttonText.y = cy + 170;

      this.icon.text = content.icon;
      this.title.text = content.title;
      this.title.style.fill = content.color;
    }

    this.subtitle.text = status === "victory" && victoryContext
      ? victorySubtitle(this.animatedVictoryContext(victoryContext))
      : content.sub;
  }

  /** Thin wrapper over the pure animateVictoryContext, tied to this
   * instance's animation clock (null = never started → final numbers). */
  private animatedVictoryContext(context: VictoryContext): VictoryContext {
    if (this.victoryAnimStart === null) return context;
    return animateVictoryContext(context, performance.now() - this.victoryAnimStart, ScreensRenderer.SCORE_COUNT_MS);
  }
}
