import { Container, Graphics, Text, Sprite, Texture } from "pixi.js";
import type { LeaderboardEntry } from "../game/Leaderboard";
import { LAYOUT, COLORS, SCREEN_WIDTH } from "./layout";
import { TextureCache } from "./TextureCache";
import { reconcileSlots } from "./leaderboardTextures";
import { MAX_MULTIPLIER, MIN_MULTIPLIER } from "../game/SpeedMeter";

const LEADERBOARD_ROWS = 5;
const NOTIFICATION_LIFETIME_MS = 2200;

export class HudRenderer {
  readonly view = new Container();

  private heroLabel: Text;
  private speedBarTrack: Graphics;
  private speedBarFill: Graphics;
  private speedLabel: Text;
  private leaderboardRows: Text[] = [];
  private leaderboardAvatars: Sprite[] = [];
  /** URL currently held (acquired) by each leaderboard slot, so we only
   * acquire on real changes and release what we replace — see reconcileSlots. */
  private slotUrls: Array<string | null> = new Array(LEADERBOARD_ROWS).fill(null);
  private notificationText: Text;
  private notificationTimer: ReturnType<typeof setTimeout> | null = null;
  private instructionsText: Text;

  constructor(private avatarCache: TextureCache<Texture>) {
    const heroBg = new Graphics()
      .roundRect(LAYOUT.heroBanner.x + 30, LAYOUT.heroBanner.y, SCREEN_WIDTH - 60, LAYOUT.heroBanner.height, 16)
      .fill({ color: COLORS.panel, alpha: 0.9 });
    this.heroLabel = new Text({
      text: "🏆 #1 HERO: —",
      style: { fill: COLORS.heroGold, fontSize: 34, fontWeight: "bold" },
    });
    this.heroLabel.anchor.set(0.5);
    this.heroLabel.x = SCREEN_WIDTH / 2;
    this.heroLabel.y = LAYOUT.heroBanner.y + LAYOUT.heroBanner.height / 2;

    this.speedBarTrack = new Graphics()
      .roundRect(LAYOUT.speedBar.x, LAYOUT.speedBar.y, LAYOUT.speedBar.width, LAYOUT.speedBar.height, 10)
      .fill(COLORS.speedBarTrack);
    this.speedBarFill = new Graphics();
    this.speedLabel = new Text({
      text: `⚡ x${MIN_MULTIPLIER.toFixed(1)}`,
      style: { fill: COLORS.hud, fontSize: 24, fontWeight: "bold" },
    });
    this.speedLabel.x = LAYOUT.speedBar.x;
    this.speedLabel.y = LAYOUT.speedBar.y - 34;

    this.notificationText = new Text({
      text: "",
      style: { fill: COLORS.notification, fontSize: 30, fontWeight: "bold" },
    });
    this.notificationText.anchor.set(0.5, 0);
    this.notificationText.x = SCREEN_WIDTH / 2;
    this.notificationText.y = LAYOUT.notification.y;
    this.notificationText.alpha = 0;

    this.instructionsText = new Text({
      text: "💬 Comment to add food & speed up! 🍎",
      style: { fill: COLORS.hudMuted, fontSize: 26 },
    });
    this.instructionsText.anchor.set(0.5);
    this.instructionsText.x = SCREEN_WIDTH / 2;
    this.instructionsText.y = LAYOUT.instructions.y + LAYOUT.instructions.height / 2;

    this.view.addChild(
      heroBg,
      this.heroLabel,
      this.speedLabel,
      this.speedBarTrack,
      this.speedBarFill,
      this.notificationText,
      this.instructionsText
    );

    for (let i = 0; i < LEADERBOARD_ROWS; i++) {
      const avatar = new Sprite(Texture.WHITE);
      avatar.width = 48;
      avatar.height = 48;
      avatar.x = LAYOUT.leaderboard.x;
      avatar.y = LAYOUT.leaderboard.y + i * 64;
      const text = new Text({ text: "", style: { fill: COLORS.hud, fontSize: 28 } });
      text.x = LAYOUT.leaderboard.x + 64;
      text.y = LAYOUT.leaderboard.y + i * 64 + 8;
      this.leaderboardAvatars.push(avatar);
      this.leaderboardRows.push(text);
      this.view.addChild(avatar, text);
    }
  }

  setSpeed(multiplier: number): void {
    const ratio = (multiplier - MIN_MULTIPLIER) / (MAX_MULTIPLIER - MIN_MULTIPLIER);
    this.speedBarFill
      .clear()
      .roundRect(
        LAYOUT.speedBar.x,
        LAYOUT.speedBar.y,
        Math.max(0, LAYOUT.speedBar.width * ratio),
        LAYOUT.speedBar.height,
        10
      )
      .fill(COLORS.speedBarFill);
    this.speedLabel.text = `⚡ x${multiplier.toFixed(1)}`;
  }

  setLeaderboard(top: LeaderboardEntry[], hero: LeaderboardEntry | null): void {
    this.heroLabel.text = hero ? `🏆 #1 HERO: ${hero.name}` : "🏆 #1 HERO: —";

    const nextUrls: Array<string | null> = new Array(LEADERBOARD_ROWS).fill(null);
    for (let i = 0; i < LEADERBOARD_ROWS; i++) {
      const entry = top[i];
      const text = this.leaderboardRows[i]!;
      const avatar = this.leaderboardAvatars[i]!;
      if (!entry) {
        text.text = "";
        avatar.visible = false;
        continue;
      }
      avatar.visible = true;
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      text.text = `${medal} ${entry.name}  🍎${entry.score}`;
      nextUrls[i] = entry.avatarUrl;
    }

    // Only touch the cache for slots that actually changed, and acquire before
    // releasing so a viewer moving rank doesn't transiently evict their avatar.
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
    this.notificationText.text = message;
    this.notificationText.alpha = 1;
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notificationTimer = setTimeout(() => {
      this.notificationText.alpha = 0;
    }, NOTIFICATION_LIFETIME_MS);
  }
}
