import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { LeaderboardEntry } from "../game/Leaderboard";
import type { Direction, GameMode, GameStatus, InterfaceMode, MapThemeId } from "../game/types";
import { LAYOUT, COLORS, SCREEN_WIDTH } from "./layout";
import { TextureCache } from "./TextureCache";
import { reconcileSlots } from "./leaderboardTextures";
import { MAX_MULTIPLIER, MIN_MULTIPLIER } from "../game/SpeedMeter";
import { HUD_STRINGS, formatGameMode, formatMapTheme } from "./strings";

const LEADERBOARD_ROWS = 3;
const NOTIFICATION_LIFETIME_MS = 2200;
const FONT = '"Arial Black", "Trebuchet MS", Arial, sans-serif';

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

/** #112: setSpeed/setCounters/setScene are all called once per render frame
 * (60fps) from main.ts's ticker, but the values they carry only actually
 * change once per game tick (every few hundred ms) — most frames redraw
 * identical Graphics geometry and reassign identical Text strings for
 * nothing. A shallow-equal guard turns those into no-ops. */
export function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  for (const key in a) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export class HudRenderer {
  readonly view = new Container();

  private mode: InterfaceMode = "live";

  private liveContainer = new Container();
  private shortsContainer = new Container();

  private liveChrome = new Graphics();
  private livePulseDot = new Graphics();
  private liveSpeedBarFill = new Graphics();
  private liveSpeedLabel = label(`x${MIN_MULTIPLIER.toFixed(1)}`, 30, COLORS.speedBarFill);
  private liveBadgeText = label(`${formatMapTheme("classic")} - ${formatGameMode("classic")}`, 22, 0x89f7ff);
  private liveWinsText = label(HUD_STRINGS.wins("0"), 30, COLORS.heroGold);
  private liveFoodText = label(HUD_STRINGS.food("0"), 22, COLORS.heroGold);
  private liveTimerText = label("00:00.000", 22, COLORS.hud);
  private liveLevelText = label(HUD_STRINGS.level(1), 22, COLORS.hudMuted);
  private liveLeaderboardTitle = label(HUD_STRINGS.topViewersTitle, 35);
  private liveTierTexts: Text[] = [];

  // v3.1: the video HUD keeps only what a viewer actually uses — a pulsing
  // live badge, the two chat commands WITH their purpose, the stat pills,
  // the leaderboard and the d-pad. No narration headlines, no board-%
  // chatter (André's feedback: "a pessoa que está assistindo quer ver só o
  // jogo acontecendo" + "tem que ter o para-que-serve de cada comando").
  private shortsChrome = new Graphics();
  private shortsLiveDot = new Graphics();
  private shortsBrandText = label(HUD_STRINGS.liveBadge, 26, 0xff5a5a);
  private shortsCommentHeader = label(HUD_STRINGS.commentHeader, 24, COLORS.hudMuted);
  private shortsFoodCommand = label(HUD_STRINGS.foodCommand, 44, COLORS.heroGold);
  private shortsSpeedCommand = label(HUD_STRINGS.speedCommand, 44, 0x72f6d1);
  private shortsMapModeText = label(`${formatMapTheme("classic")} - ${formatGameMode("classic")}`, 20, 0x89f7ff);
  private shortsSpeedText = label(HUD_STRINGS.speed("1.0"), 24, 0x111111);
  private shortsWinsText = label(HUD_STRINGS.wins("0"), 24, 0x111111);
  private shortsFoodText = label(HUD_STRINGS.food("0"), 24, 0x111111);
  private shortsTimerText = label("00:00.000", 24, 0x111111);
  private shortsLeaderboardTitle = label(HUD_STRINGS.topChatTitle, 30, 0x9df6d8);
  private shortsDpad = new Graphics();
  private shortsDpadTexts: Record<Direction, Text> = {
    up: label("^", 30, 0xcaf7ff),
    down: label("v", 30, 0xcaf7ff),
    left: label("<", 30, 0xcaf7ff),
    right: label(">", 30, 0xcaf7ff),
  };

  private leaderboardRows: Text[] = [];
  private leaderboardAvatars: Sprite[] = [];
  private rowBgs: Graphics[] = [];
  private slotUrls: Array<string | null> = new Array(LEADERBOARD_ROWS).fill(null);

  private notificationText = label("", 33, COLORS.notification);
  private notificationBg = new Graphics();
  private notificationTimer: ReturnType<typeof setTimeout> | null = null;

  private lastSpeedMultiplier: number | null = null;
  private lastTop: LeaderboardEntry[] = [];

  private counters = {
    victories: 0,
    breads: 0,
    timer: "00:00.000",
    level: 1,
  };

  private scene = {
    status: "start" as GameStatus,
    mapTheme: "classic" as MapThemeId,
    gameMode: "classic" as GameMode,
    coverage: 0,
    speed: 1,
    snakeLength: 2,
    queuedFoods: 0,
    direction: "right" as Direction,
    score: 0,
    foodGoal: null as number | null,
  };

  constructor(private avatarCache: TextureCache<Texture>) {
    this.buildLiveHud();
    this.buildShortsHud();

    this.notificationText.anchor.set(0.5);
    this.notificationText.alpha = 0;
    this.notificationBg.alpha = 0;

    this.view.addChild(this.liveContainer, this.shortsContainer);

    for (let i = 0; i < LEADERBOARD_ROWS; i++) {
      const bg = new Graphics();
      const avatar = new Sprite(Texture.WHITE);
      avatar.visible = false;
      const text = label("", 27);
      this.rowBgs.push(bg);
      this.leaderboardAvatars.push(avatar);
      this.leaderboardRows.push(text);
      this.view.addChild(bg, avatar, text);
    }

    this.view.addChild(this.notificationBg, this.notificationText);
    this.setInterfaceMode("live");
  }

  /** Per-frame animation hook (called from the app ticker): pulses the
   * "AO VIVO" dot so the badge reads as genuinely live. Deliberately the
   * only thing here — everything else in the HUD is dirty-checked (#112). */
  tick(now: number = performance.now()): void {
    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 380));
    this.shortsLiveDot.alpha = pulse;
    this.livePulseDot.alpha = pulse;
    const scale = 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(now / 380));
    this.shortsLiveDot.scale.set(scale, scale);
    this.livePulseDot.scale.set(scale, scale);
  }

  setInterfaceMode(mode: InterfaceMode): void {
    this.mode = mode;
    this.liveContainer.visible = mode === "live";
    this.shortsContainer.visible = mode === "shorts";
    this.positionNotification();
    this.updateCounterTexts();
    this.updateShortsTexts();
    // Re-render the rows for the new mode's geometry — and on a fresh round
    // with no chat yet, this is also what paints the "aguardando atividade"
    // placeholders instead of leaving the panel blank.
    this.setLeaderboard(this.lastTop);
  }

  setCounters(next: {
    victories: number;
    breads: number;
    timer: string;
    level: number;
  }): void {
    if (shallowEqual(this.counters, next)) return;
    this.counters = next;
    this.updateCounterTexts();
  }

  setScene(next: {
    status: GameStatus;
    mapTheme: MapThemeId;
    gameMode: GameMode;
    coverage: number;
    speed: number;
    snakeLength: number;
    queuedFoods: number;
    direction: Direction;
    score: number;
    foodGoal: number | null;
  }): void {
    if (shallowEqual(this.scene, next)) return;
    this.scene = next;
    this.updateShortsTexts();
  }

  setSpeed(multiplier: number): void {
    if (multiplier === this.lastSpeedMultiplier) return;
    this.lastSpeedMultiplier = multiplier;
    const ratio = Math.max(0, Math.min(1, (multiplier - MIN_MULTIPLIER) / (MAX_MULTIPLIER - MIN_MULTIPLIER)));
    const bar = LAYOUT.speedBar;
    this.liveSpeedBarFill
      .clear()
      .roundRect(bar.x, bar.y, bar.width, bar.height, 8)
      .fill({ color: COLORS.speedBarTrack, alpha: 0.95 })
      .roundRect(bar.x, bar.y, Math.max(10, bar.width * ratio), bar.height, 8)
      .fill(COLORS.speedBarFill);
    this.liveSpeedLabel.text = `x${multiplier.toFixed(1)}`;
    this.scene.speed = multiplier;
    this.updateShortsTexts();
  }

  setLeaderboard(top: LeaderboardEntry[]): void {
    this.lastTop = top;
    const nextUrls: Array<string | null> = new Array(LEADERBOARD_ROWS).fill(null);

    for (let i = 0; i < LEADERBOARD_ROWS; i++) {
      const entry = top[i];
      const text = this.leaderboardRows[i]!;
      const avatar = this.leaderboardAvatars[i]!;
      const bg = this.rowBgs[i]!;
      const y = this.mode === "live" ? LAYOUT.leaderboard.y + 96 + i * 68 : 1508 + i * 72;
      const x = this.mode === "live" ? LAYOUT.leaderboard.x + 22 : 48;
      // Shorts rows stop short of the d-pad box (x=716..972) on their right.
      const width = this.mode === "live" ? LAYOUT.leaderboard.width - 44 : 640;

      bg
        .clear()
        .roundRect(x, y, width, this.mode === "live" ? 60 : 62, 16)
        .fill({
          color: this.mode === "live" ? (i === 0 ? 0x183c0c : 0x121212) : (i === 0 ? 0x101717 : 0x0b1111),
          alpha: this.mode === "live" ? 0.86 : 0.92,
        })
        .stroke({
          width: i === 0 ? 2 : 1,
          color: this.mode === "live" ? (i === 0 ? COLORS.heroGold : COLORS.panelLine) : (i === 0 ? 0x92ff70 : 0x2b6d6d),
          alpha: i === 0 ? 0.92 : 0.42,
        });

      avatar.width = this.mode === "live" ? 48 : 46;
      avatar.height = this.mode === "live" ? 48 : 46;
      avatar.x = this.mode === "live" ? LAYOUT.leaderboard.x + 130 : 72;
      avatar.y = this.mode === "live" ? LAYOUT.leaderboard.y + 104 + i * 68 : 1516 + i * 72;

      text.x = this.mode === "live" ? LAYOUT.leaderboard.x + 200 : 126;
      text.y = this.mode === "live" ? LAYOUT.leaderboard.y + 113 + i * 68 : 1526 + i * 72;
      text.style.fontSize = this.mode === "live" ? 27 : 22;

      if (!entry) {
        text.text = this.mode === "shorts" ? HUD_STRINGS.waitingForActivity(i + 1) : "";
        avatar.visible = false;
        continue;
      }

      avatar.visible = true;
      text.text =
        this.mode === "live"
          ? HUD_STRINGS.leaderboardRowLive(i + 1, entry.name, entry.foodCount, entry.speedCount)
          : HUD_STRINGS.leaderboardRowShorts(i + 1, entry.name, entry.foodCount, entry.speedCount);
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
    const radius = this.mode === "live" ? 7 : 18;
    const x = this.mode === "live" ? LAYOUT.notification.x : 72;
    const y = this.mode === "live" ? LAYOUT.notification.y : 1372;
    const width = this.mode === "live" ? LAYOUT.notification.width : SCREEN_WIDTH - 144;
    const height = this.mode === "live" ? LAYOUT.notification.height : 66;
    this.notificationBg
      .clear()
      .roundRect(x, y, width, height, radius)
      .fill({ color: this.mode === "live" ? COLORS.panel : 0x07110f, alpha: this.mode === "live" ? 0.9 : 0.94 })
      .stroke({ width: 2, color: this.mode === "live" ? COLORS.panelLine : 0x72f6d1, alpha: 0.86 });
    this.notificationText.text = message;
    this.notificationText.x = x + width / 2;
    this.notificationText.y = y + height / 2;
    this.notificationText.alpha = 1;
    this.notificationBg.alpha = 1;
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notificationTimer = setTimeout(() => {
      this.notificationText.alpha = 0;
      this.notificationBg.alpha = 0;
    }, NOTIFICATION_LIFETIME_MS);
  }

  private buildLiveHud(): void {
    const live = label(HUD_STRINGS.live, 34);
    live.x = 74;
    live.y = 38;

    this.liveBadgeText.x = 220;
    this.liveBadgeText.y = 44;
    this.liveWinsText.x = 420;
    this.liveWinsText.y = 41;
    this.liveFoodText.x = 560;
    this.liveFoodText.y = 45;
    this.liveTimerText.x = 694;
    this.liveTimerText.y = 45;
    this.liveLevelText.x = 974;
    this.liveLevelText.y = 46;

    const command = label(HUD_STRINGS.commentHeader, 24, COLORS.hudMuted);
    command.x = 64;
    command.y = 124;

    const commandFood = label(HUD_STRINGS.foodCommand, 28, COLORS.heroGold);
    commandFood.x = 64;
    commandFood.y = 162;

    const commandSpeed = label(HUD_STRINGS.speedCommand, 28, 0x72f6d1);
    commandSpeed.x = 64;
    commandSpeed.y = 204;

    const chatTitle = label(HUD_STRINGS.chatTitle, 25, COLORS.hudMuted);
    chatTitle.anchor.set(0.5, 0);
    chatTitle.x = SCREEN_WIDTH / 2;
    chatTitle.y = 128;

    const chatBody = label(HUD_STRINGS.chatBody, 29, COLORS.speedBarFill);
    chatBody.anchor.set(0.5, 0);
    chatBody.x = SCREEN_WIDTH / 2;
    chatBody.y = 176;

    const objective = label(HUD_STRINGS.objectiveTitle, 25, COLORS.hudMuted);
    objective.x = 746;
    objective.y = 128;

    const objectiveBody = label(HUD_STRINGS.objectiveBody, 25, COLORS.notification);
    objectiveBody.x = 742;
    objectiveBody.y = 178;

    const speedTitle = label(HUD_STRINGS.commentSpeedTitle, 22);
    speedTitle.x = 64;
    speedTitle.y = 292;

    this.liveSpeedLabel.x = 305;
    this.liveSpeedLabel.y = 288;

    const speedBarPosition = (value: number): number =>
      LAYOUT.speedBar.x + ((value - MIN_MULTIPLIER) / (MAX_MULTIPLIER - MIN_MULTIPLIER)) * LAYOUT.speedBar.width;
    // v3.4: bar now runs 1..12 — tiers rescaled to mark the new range.
    const tiers = [
      { value: 1, text: "x1", color: COLORS.hudMuted },
      { value: 3, text: "x3", color: 0x42ddff },
      { value: 6, text: "x6", color: COLORS.speedBarFill },
      { value: 9, text: "x9", color: COLORS.heroGold },
      { value: 12, text: "x12", color: COLORS.speedBarHot },
    ];
    this.liveTierTexts = tiers.map((tier) => {
      const t = label(tier.text, 28, tier.color);
      t.x = speedBarPosition(tier.value) + 10;
      t.y = 287;
      return t;
    });

    this.liveLeaderboardTitle.x = LAYOUT.leaderboard.x + 38;
    this.liveLeaderboardTitle.y = LAYOUT.leaderboard.y + 22;

    // Pulsing dot inside the LIVE box (animated in tick()).
    this.livePulseDot.circle(0, 0, 11).fill(COLORS.hud);
    this.livePulseDot.x = 58;
    this.livePulseDot.y = 56;

    this.drawLiveChrome();
    this.liveContainer.addChild(
      this.liveChrome,
      this.livePulseDot,
      live,
      this.liveBadgeText,
      this.liveWinsText,
      this.liveFoodText,
      this.liveTimerText,
      this.liveLevelText,
      command,
      commandFood,
      commandSpeed,
      chatTitle,
      chatBody,
      objective,
      objectiveBody,
      speedTitle,
      this.liveSpeedLabel,
      ...this.liveTierTexts,
      this.liveSpeedBarFill,
      this.liveLeaderboardTitle,
    );
  }

  private buildShortsHud(): void {
    // Pulsing red dot next to the AO VIVO badge (animated in tick()).
    this.shortsLiveDot.circle(0, 0, 10).fill(0xff3b3b);
    this.shortsLiveDot.x = 76;
    this.shortsLiveDot.y = 68;
    this.shortsBrandText.x = 96;
    this.shortsBrandText.y = 52;

    this.shortsCommentHeader.x = 62;
    this.shortsCommentHeader.y = 94;
    this.shortsFoodCommand.x = 62;
    this.shortsFoodCommand.y = 128;
    this.shortsSpeedCommand.x = 62;
    this.shortsSpeedCommand.y = 184;
    this.shortsMapModeText.x = 66;
    this.shortsMapModeText.y = 244;

    // Stat pills sit at x=716..1022 (306 wide, 52 tall) — center each text in
    // its pill instead of hand-tuned offsets, so longer PT-BR strings
    // ("VELOCIDADE x1.0") stay framed instead of hugging the pill edge.
    const pillCenterX = 716 + 306 / 2;
    const pillTexts = [this.shortsSpeedText, this.shortsWinsText, this.shortsFoodText, this.shortsTimerText];
    pillTexts.forEach((text, i) => {
      text.anchor.set(0.5);
      text.x = pillCenterX;
      text.y = 48 + i * 58 + 26;
    });

    this.shortsLeaderboardTitle.x = 60;
    this.shortsLeaderboardTitle.y = 1452;

    this.shortsDpadTexts.up.x = 826;
    this.shortsDpadTexts.up.y = 1492;
    this.shortsDpadTexts.left.x = 762;
    this.shortsDpadTexts.left.y = 1554;
    this.shortsDpadTexts.down.x = 826;
    this.shortsDpadTexts.down.y = 1554;
    this.shortsDpadTexts.right.x = 890;
    this.shortsDpadTexts.right.y = 1554;

    this.drawShortsChrome();
    this.shortsContainer.addChild(
      this.shortsChrome,
      this.shortsLiveDot,
      this.shortsBrandText,
      this.shortsCommentHeader,
      this.shortsFoodCommand,
      this.shortsSpeedCommand,
      this.shortsMapModeText,
      this.shortsSpeedText,
      this.shortsWinsText,
      this.shortsFoodText,
      this.shortsTimerText,
      this.shortsLeaderboardTitle,
      this.shortsDpad,
      this.shortsDpadTexts.up,
      this.shortsDpadTexts.left,
      this.shortsDpadTexts.down,
      this.shortsDpadTexts.right,
    );
  }

  private updateCounterTexts(): void {
    this.liveWinsText.text = HUD_STRINGS.wins(this.counters.victories.toLocaleString("pt-BR"));
    this.liveFoodText.text = HUD_STRINGS.food(this.counters.breads.toLocaleString("pt-BR"));
    this.liveTimerText.text = this.counters.timer;
    this.liveLevelText.text = HUD_STRINGS.level(this.counters.level);

    this.shortsWinsText.text = HUD_STRINGS.wins(this.counters.victories.toLocaleString("pt-BR"));
    this.shortsFoodText.text = HUD_STRINGS.food(this.counters.breads.toLocaleString("pt-BR"));
    this.shortsTimerText.text = this.counters.timer;
  }

  private updateShortsTexts(): void {
    const mapLabel = formatMapTheme(this.scene.mapTheme);
    const modeLabel = formatGameMode(this.scene.gameMode);

    this.shortsMapModeText.text = `${mapLabel} - ${modeLabel}`;
    this.liveBadgeText.text = `${mapLabel} - ${modeLabel}`;
    this.shortsSpeedText.text = HUD_STRINGS.speed(this.scene.speed.toFixed(1));

    this.drawShortsDpad();
  }

  private drawShortsDpad(): void {
    const buttons: Array<{ direction: Direction; x: number; y: number }> = [
      { direction: "up", x: 804, y: 1488 },
      { direction: "left", x: 740, y: 1550 },
      { direction: "down", x: 804, y: 1550 },
      { direction: "right", x: 868, y: 1550 },
    ];

    this.shortsDpad.clear();
    for (const button of buttons) {
      const active = button.direction === this.scene.direction;
      this.shortsDpad
        .roundRect(button.x, button.y, 56, 56, 14)
        .fill({ color: active ? 0xbefc58 : 0x0b1515, alpha: active ? 1 : 0.94 })
        .stroke({ width: 2, color: active ? 0xffffff : 0x2c6969, alpha: active ? 0.58 : 0.5 });
      this.shortsDpadTexts[button.direction].style.fill = active ? 0x111111 : 0xcaf7ff;
    }
  }

  private positionNotification(): void {
    if (this.notificationText.alpha === 0) return;
    const x = this.mode === "live" ? LAYOUT.notification.x : 72;
    const y = this.mode === "live" ? LAYOUT.notification.y : 1372;
    const width = this.mode === "live" ? LAYOUT.notification.width : SCREEN_WIDTH - 144;
    const height = this.mode === "live" ? LAYOUT.notification.height : 66;
    this.notificationText.x = x + width / 2;
    this.notificationText.y = y + height / 2;
  }

  private drawLiveChrome(): void {
    this.liveChrome
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

  private drawShortsChrome(): void {
    this.shortsChrome
      .clear()
      .roundRect(34, 32, SCREEN_WIDTH - 68, 252, 28)
      .fill({ color: 0x050b0b, alpha: 0.92 })
      .stroke({ width: 2, color: 0x68f0cb, alpha: 0.34 })
      .roundRect(716, 48, 306, 52, 24)
      .fill({ color: 0xc8ff53, alpha: 0.98 })
      .roundRect(716, 106, 306, 52, 24)
      .fill({ color: 0xffd33c, alpha: 0.98 })
      .roundRect(716, 164, 306, 52, 24)
      .fill({ color: 0x72f6d1, alpha: 0.98 })
      .roundRect(716, 222, 306, 52, 24)
      .fill({ color: 0x89f7ff, alpha: 0.98 })
      .roundRect(34, 1428, SCREEN_WIDTH - 68, 430, 28)
      .fill({ color: 0x061010, alpha: 0.92 })
      .stroke({ width: 2, color: 0x72f6d1, alpha: 0.26 })
      .roundRect(716, 1460, 256, 176, 20)
      .fill({ color: 0x081414, alpha: 0.9 })
      .stroke({ width: 1, color: 0x285d5d, alpha: 0.6 });
  }
}
