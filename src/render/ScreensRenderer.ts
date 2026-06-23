import { Container, Graphics, Text } from "pixi.js";
import type { GameStatus } from "../game/types";
import { LAYOUT, COLORS, SCREEN_WIDTH } from "./layout";

const SCREEN_CONTENT: Record<"start" | "victory" | "lost", { icon: string; title: string; color: number }> = {
  start: { icon: "▶️", title: "GET READY", color: COLORS.hud },
  victory: { icon: "🏆", title: "VICTORY!", color: COLORS.heroGold },
  lost: { icon: "💥", title: "I LOST!", color: COLORS.baseApple },
};

export class ScreensRenderer {
  readonly view = new Container();
  private overlay: Graphics;
  private icon: Text;
  private title: Text;

  constructor() {
    this.overlay = new Graphics()
      .rect(LAYOUT.board.x, LAYOUT.board.y, LAYOUT.board.size, LAYOUT.board.size)
      .fill({ color: 0x000000, alpha: 0.55 });

    this.icon = new Text({ text: "", style: { fontSize: 120 } });
    this.icon.anchor.set(0.5);
    this.icon.x = SCREEN_WIDTH / 2;
    this.icon.y = LAYOUT.board.y + LAYOUT.board.size / 2 - 80;

    this.title = new Text({
      text: "",
      style: { fill: COLORS.hud, fontSize: 56, fontWeight: "bold" },
    });
    this.title.anchor.set(0.5);
    this.title.x = SCREEN_WIDTH / 2;
    this.title.y = LAYOUT.board.y + LAYOUT.board.size / 2 + 60;

    this.view.addChild(this.overlay, this.icon, this.title);
    this.setStatus("start");
  }

  setStatus(status: GameStatus): void {
    if (status === "playing") {
      this.view.visible = false;
      return;
    }
    this.view.visible = true;
    const content = SCREEN_CONTENT[status];
    this.icon.text = content.icon;
    this.title.text = content.title;
    this.title.style.fill = content.color;
  }
}
