import { Container, Graphics, Text, Sprite, Texture } from "pixi.js";
import type { LeaderboardEntry } from "../game/Leaderboard";
import { LAYOUT, COLORS, SCREEN_WIDTH } from "./layout";
import { TextureCache } from "./TextureCache";
import { reconcileSlots } from "./leaderboardTextures";
import { MAX_MULTIPLIER, MIN_MULTIPLIER } from "../game/SpeedMeter";

const LEADERBOARD_ROWS = 3;
const NOTIFICATION_LIFETIME_MS = 2200;
const FONT = "Arial, Helvetica, sans-serif";

function label(text: string, size: number, fill: number = COLORS.hud): Text {
  return new Text({
    text,
    style: {
      fill,
      fontFamily: FONT,
      fontSize: size,
      fontWeight: "900",
      letterSpacing: 1,
      dropShadow: { color: 0x000000, alpha: 0.7, blur: 2, distance: 2 },
    },
  });
}

export class HudRenderer {
  readonly view = new Container();

  private chrome = new Graphics();
  private subsText: Text;
  private winsText: Text;
  private foodText: Text;
  private timerText: Text;
  private levelText: Text;
  private speedBarFill: Graphics;
  private speedNeedle: Graphics;
  private speedLabel: Text;
  private leaderboardRows: Text[] = [];
  private leaderboardAvatars: Sprite[] = [];
  private rowBgs: Graphics[] = [];
  private slotUrls: Array<string | null> = new Array(LEADERBOARD_ROWS).fill(null);
  private notificationText: Text;
  private notificationBg: Graphics;
  private notificationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private avatarCache: TextureCache<Texture>) {
    this.drawChrome();

    const live = label("LIVE", 34);
    live.x = 74;
    live.y = 38;

    this.subsText = label("SUBS 0", 30);
    this.subsText.x = 220;
    this.subsText.y = 41;

    this.winsText = label("WINS 0", 30, COLORS.heroGold);
    this.winsText.x = 420;
    this.winsText.y = 41;

    this.foodText = label("FOOD 0", 22, COLORS.heroGold);
    this.foodText.x = 560;
    this.foodText.y = 45;

    this.timerText = label("00:00.000", 22, COLORS.hud);
    this.timerText.x = 694;
    this.timerText.y = 45;

    this.levelText = label("LV 1", 22, COLORS.hudMuted);
    this.levelText.x = 974;
    this.levelText.y = 46;

    const command = label("COMMENT", 26, COLORS.hudMuted);
    command.x = 64;
    command.y = 128;
    const commandBody = label("FOOD OR SPEED", 35, COLORS.heroGold);
    commandBody.x = 64;
    commandBody.y = 176;

    const chatTitle = label("MORE CHAT", 25, COLORS.hudMuted);
    chatTitle.anchor.set(0.5, 0);
    chatTitle.x = SCREEN_WIDTH / 2;
    chatTitle.y = 128;
    const chatBody = label("= FASTER", 29, COLORS.speedBarFill);
    chatBody.anchor.set(0.5, 0);
    chatBody.x = SCREEN_WIDTH / 2;
    chatBody.y = 176;

    const objective = label("TOP CHAT", 25, COLORS.hudMuted);
    objective.x = 746;
    objective.y = 128;
    const objectiveBody = label("most comments", 25, COLORS.notification);
    objectiveBody.x = 742;
    objectiveBody.y = 178;

    const speedTitle = label("COMMENT SPEED", 22);
    speedTitle.x = 64;
    speedTitle.y = 292;
    this.speedLabel = label(`x${MIN_MULTIPLIER.toFixed(1)}`, 30, COLORS.speedBarFill);
    this.speedLabel.x = 305;
    this.speedLabel.y = 288;
    this.speedBarFill = new Graphics();
    this.speedNeedle = new Graphics();

    // Positions follow the exact same linear ratio as the fill bar in
    // setSpeed (value - MIN) / (MAX - MIN) — otherwise the labels drift out
    // of sync with where the fill actually reaches at a given multiplier.
    const speedBarPosition = (value: number): number =>
      LAYOUT.speedBar.x + ((value - MIN_MULTIPLIER) / (MAX_MULTIPLIER - MIN_MULTIPLIER)) * LAYOUT.speedBar.width;
    const tiers = [
      { value: 1, text: "x1", color: COLORS.hudMuted },
      { value: 2, text: "x2", color: 0x42ddff },
      { value: 3, text: "x3", color: COLORS.speedBarFill },
      { value: 4, text: "x4", color: COLORS.heroGold },
      { value: 6, text: "x6", color: COLORS.speedBarHot },
    ];
    const tierTexts = tiers.map((tier) => {
      const t = label(tier.text, 28, tier.color);
      t.x = speedBarPosition(tier.value) + 10;
      t.y = 287;
      return t;
    });

    this.notificationBg = new Graphics();
    this.notificationText = label("", 33, COLORS.notification);
    this.notificationText.anchor.set(0.5);
    this.notificationText.x = SCREEN_WIDTH / 2;
    this.notificationText.y = LAYOUT.notification.y + LAYOUT.notification.height / 2;
    this.notificationText.alpha = 0;
    this.notificationBg.alpha = 0;

    const topViewers = label("TOP VIEWERS", 35);
    topViewers.x = LAYOUT.leaderboard.x + 38;
    topViewers.y = LAYOUT.leaderboard.y + 22;

    this.view.addChild(
      this.chrome,
      live,
      this.subsText,
      this.winsText,
      this.foodText,
      this.timerText,
      this.levelText,
      command,
      commandBody,
      chatTitle,
      chatBody,
      objective,
      objectiveBody,
      speedTitle,
      this.speedLabel,
      ...tierTexts,
      this.speedBarFill,
      this.speedNeedle,
      this.notificationBg,
      this.notificationText,
      topViewers
    );

    for (let i = 0; i < LEADERBOARD_ROWS; i++) {
      const bg = new Graphics();
      const avatar = new Sprite(Texture.WHITE);
      avatar.width = 48;
      avatar.height = 48;
      avatar.x = LAYOUT.leaderboard.x + 130;
      avatar.y = LAYOUT.leaderboard.y + 104 + i * 68;
      avatar.visible = false;
      const text = label("", 27);
      text.x = LAYOUT.leaderboard.x + 200;
      text.y = LAYOUT.leaderboard.y + 113 + i * 68;
      this.rowBgs.push(bg);
      this.leaderboardAvatars.push(avatar);
      this.leaderboardRows.push(text);
      this.view.addChild(bg, avatar, text);
    }
  }

  setCounters({
    subscribers,
    victories,
    breads,
    timer,
    level,
  }: {
    subscribers: number;
    victories: number;
    breads: number;
    timer: string;
    level: number;
  }): void {
    this.subsText.text = `SUBS ${subscribers.toLocaleString("en-US")}`;
    this.winsText.text = `WINS ${victories.toLocaleString("en-US")}`;
    this.foodText.text = `FOOD ${breads.toLocaleString("en-US")}`;
    this.timerText.text = timer;
    this.levelText.text = `LV ${level}`;
  }

  setSpeed(multiplier: number): void {
    const ratio = Math.max(0, Math.min(1, (multiplier - MIN_MULTIPLIER) / (MAX_MULTIPLIER - MIN_MULTIPLIER)));
    const bar = LAYOUT.speedBar;
    this.speedBarFill
      .clear()
      .roundRect(bar.x, bar.y, bar.width, bar.height, 8)
      .fill({ color: COLORS.speedBarTrack, alpha: 0.95 })
      .roundRect(bar.x, bar.y, Math.max(10, bar.width * ratio), bar.height, 8)
      .fill(COLORS.speedBarFill);
    this.speedNeedle.clear();
    this.speedLabel.text = `x${multiplier.toFixed(1)}`;
  }

  setLeaderboard(top: LeaderboardEntry[], _hero: LeaderboardEntry | null): void {
    const nextUrls: Array<string | null> = new Array(LEADERBOARD_ROWS).fill(null);
    for (let i = 0; i < LEADERBOARD_ROWS; i++) {
      const entry = top[i];
      const text = this.leaderboardRows[i]!;
      const avatar = this.leaderboardAvatars[i]!;
      const bg = this.rowBgs[i]!;
      const y = LAYOUT.leaderboard.y + 96 + i * 68;

      bg
        .clear()
        .roundRect(LAYOUT.leaderboard.x + 22, y, LAYOUT.leaderboard.width - 44, 60, 7)
        .fill({ color: i === 0 ? 0x183c0c : 0x121212, alpha: 0.86 })
        .stroke({ width: i === 0 ? 2 : 1, color: i === 0 ? COLORS.heroGold : COLORS.panelLine, alpha: i === 0 ? 0.8 : 0.22 });

      if (!entry) {
        text.text = "";
        avatar.visible = false;
        continue;
      }
      avatar.visible = true;
      text.text = `${i + 1}   ${entry.name}    food ${entry.foodCount}   speed ${entry.speedCount}`;
      nextUrls[i] = entry.avatarUrl;
    }

    const { acquire, release, nextHeld } = reconcileSlots(this.slotUrls, nextUrls);
    for (const { slot, url } of acquire) {
      const avatar = this.leaderboardAvatars[slot]!;
      this.avatarCache.acquire(url).then((texture) => {
        if (this.slotUrls[slot] === url) avatar.texture = texture;
      });
    }
    for (const url of release) {
      this.avatarCache.release(url, (texture) => texture.destroy(true));
    }
    this.slotUrls = nextHeld;
  }

  notify(message: string): void {
    this.notificationBg
      .clear()
      .roundRect(LAYOUT.notification.x, LAYOUT.notification.y, LAYOUT.notification.width, LAYOUT.notification.height, 7)
      .fill({ color: COLORS.panel, alpha: 0.9 })
      .stroke({ width: 2, color: COLORS.panelLine, alpha: 0.85 });
    this.notificationText.text = message;
    this.notificationText.alpha = 1;
    this.notificationBg.alpha = 1;
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notificationTimer = setTimeout(() => {
      this.notificationText.alpha = 0;
      this.notificationBg.alpha = 0;
    }, NOTIFICATION_LIFETIME_MS);
  }

  private drawChrome(): void {
    this.chrome
      .clear()
      .rect(24, 18, SCREEN_WIDTH - 48, 1880)
      .stroke({ width: 2, color: COLORS.panelLine, alpha: 0.35 })
      .roundRect(34, 32, 136, 48, 6)
      .fill(COLORS.liveRed)
      .circle(58, 56, 11)
      .fill({ color: COLORS.hud, alpha: 0.55 })
      .roundRect(LAYOUT.commandPanel.x, LAYOUT.commandPanel.y, LAYOUT.commandPanel.width, LAYOUT.commandPanel.height, 8)
      .fill({ color: COLORS.panel, alpha: 0.92 })
      .stroke({ width: 3, color: COLORS.panelLine, alpha: 0.95 })
      .moveTo(390, LAYOUT.commandPanel.y)
      .lineTo(390, LAYOUT.commandPanel.y + LAYOUT.commandPanel.height)
      .moveTo(700, LAYOUT.commandPanel.y)
      .lineTo(700, LAYOUT.commandPanel.y + LAYOUT.commandPanel.height)
      .stroke({ width: 1, color: COLORS.panelLine, alpha: 0.4 })
      .roundRect(LAYOUT.speedPanel.x, LAYOUT.speedPanel.y, LAYOUT.speedPanel.width, LAYOUT.speedPanel.height, 8)
      .fill({ color: COLORS.panel, alpha: 0.9 })
      .stroke({ width: 2, color: COLORS.panelLine, alpha: 0.35 })
      .roundRect(LAYOUT.leaderboard.x, LAYOUT.leaderboard.y, LAYOUT.leaderboard.width, LAYOUT.leaderboard.height, 8)
      .fill({ color: COLORS.panel, alpha: 0.92 })
      .stroke({ width: 3, color: COLORS.panelLine, alpha: 0.95 })
      .roundRect(LAYOUT.leaderboard.x + 8, LAYOUT.leaderboard.y + 8, 320, 64, 7)
      .fill({ color: 0x24810e, alpha: 0.95 })
      .rect(60, 1870, SCREEN_WIDTH - 120, 34)
      .fill({ color: COLORS.speedBarFill, alpha: 0.16 });
  }
}
