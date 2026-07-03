import { Container, Graphics, Text } from "pixi.js";
import type { GameMode, GameStatus } from "../game/types";
import { LAYOUT, COLORS, SCREEN_WIDTH } from "./layout";

const SCREEN_CONTENT: Record<"start" | "victory" | "lost", { icon: string; title: string; sub: string; color: number }> = {
  start: { icon: "▶", title: "GET READY", sub: "auto start", color: COLORS.speedBarFill },
  victory: { icon: "🏆", title: "VICTORY!", sub: "full board", color: COLORS.heroGold },
  lost: { icon: "💥", title: "I LOST!", sub: "restarting", color: COLORS.baseApple },
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
function victorySubtitle(context: VictoryContext): string {
  switch (context.gameMode) {
    case "maze_race":
      return `finished in ${context.timer}`;
    case "maze_harvest":
    case "pudding":
      return `${context.score}${context.foodGoal !== null ? `/${context.foodGoal}` : ""} food collected`;
    default:
      return `${Math.round(Math.min(1, context.coverage) * 100)}% board coverage`;
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

    this.buttonText = makeText("START", 34, COLORS.background);
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
    if (this.currentStatus !== "playing") {
      this.setStatus(this.currentStatus, this.currentVictoryContext);
    }
  }

  setStatus(status: GameStatus, victoryContext?: VictoryContext): void {
    this.currentStatus = status;
    this.currentVictoryContext = victoryContext;

    if (status === "playing") {
      this.view.visible = false;
      return;
    }

    this.view.visible = true;
    const content = SCREEN_CONTENT[status];
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
    this.subtitle.text = status === "victory" && victoryContext ? victorySubtitle(victoryContext) : content.sub;
  }
}
