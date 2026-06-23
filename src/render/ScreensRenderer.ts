import { Container, Graphics, Text } from "pixi.js";
import type { GameStatus } from "../game/types";
import { LAYOUT, COLORS, SCREEN_WIDTH } from "./layout";

const SCREEN_CONTENT: Record<"start" | "victory" | "lost", { icon: string; title: string; sub: string; color: number }> = {
  start: { icon: "▶", title: "GET READY", sub: "auto start", color: COLORS.speedBarFill },
  victory: { icon: "🏆", title: "VICTORY!", sub: "full board", color: COLORS.heroGold },
  lost: { icon: "💥", title: "I LOST!", sub: "restarting", color: COLORS.baseApple },
};

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

  setStatus(status: GameStatus): void {
    if (status === "playing") {
      this.view.visible = false;
      return;
    }

    this.view.visible = true;
    const content = SCREEN_CONTENT[status];
    this.overlay
      .clear()
      .rect(LAYOUT.board.x, LAYOUT.board.y, LAYOUT.board.size, LAYOUT.board.size)
      .fill({ color: 0x000000, alpha: 0.62 })
      .roundRect(SCREEN_WIDTH / 2 - 245, LAYOUT.board.y + LAYOUT.board.size / 2 - 230, 490, 470, 8)
      .fill({ color: COLORS.panel, alpha: 0.92 })
      .stroke({ width: 4, color: content.color, alpha: 0.95 })
      .roundRect(SCREEN_WIDTH / 2 - 115, LAYOUT.board.y + LAYOUT.board.size / 2 + 130, 230, 76, 8)
      .fill(content.color);

    this.icon.text = content.icon;
    this.title.text = content.title;
    this.title.style.fill = content.color;
    this.subtitle.text = content.sub;
  }
}
