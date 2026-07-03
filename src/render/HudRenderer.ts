import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { LeaderboardEntry } from "../game/Leaderboard";
import type { Direction, GameMode, GameStatus, InterfaceMode, MapThemeId } from "../game/types";
import { LAYOUT, COLORS, SCREEN_WIDTH } from "./layout";
import { TextureCache } from "./TextureCache";
import { reconcileSlots } from "./leaderboardTextures";
import { MAX_MULTIPLIER, MIN_MULTIPLIER } from "../game/SpeedMeter";

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatMapTheme(theme: MapThemeId): string {
  switch (theme) {
    case "heart":
      return "Heart";
    case "brazil":
      return "Brasil";
    case "france":
      return "França";
    case "norway":
      return "Noruega";
    case "creeper":
      return "Creeper";
    default:
      return "Classic";
  }
}

function formatGameMode(mode: GameMode): string {
  switch (mode) {
    case "full_food":
      return "Full map";
    case "maze_race":
      return "Maze sprint";
    case "maze_harvest":
      return "Maze flow";
    case "pudding":
      return "Dynamic blocks";
    default:
      return "Classic run";
  }
}

export class HudRenderer {
  readonly view = new Container();

  private mode: InterfaceMode = "live";

  private liveContainer = new Container();
  private shortsContainer = new Container();

  private liveChrome = new Graphics();
  private liveSpeedBarFill = new Graphics();
  private liveSpeedLabel = label(`x${MIN_MULTIPLIER.toFixed(1)}`, 30, COLORS.speedBarFill);
  private liveBadgeText = label("Classic - Classic run", 22, 0x89f7ff);
  private liveWinsText = label("WINS 0", 30, COLORS.heroGold);
  private liveFoodText = label("FOOD 0", 22, COLORS.heroGold);
  private liveTimerText = label("00:00.000", 22, COLORS.hud);
  private liveLevelText = label("LV 1", 22, COLORS.hudMuted);
  private liveLeaderboardTitle = label("TOP VIEWERS", 35);
  private liveTierTexts: Text[] = [];

  private shortsChrome = new Graphics();
  private shortsBrandText = label("SNAKE LIVE", 26, 0xbefc58);
  private shortsHeadlineText = label("READY TO HUNT", 46, COLORS.hud);
  private shortsSublineText = label("Fast reads, smooth turns, and a clean line to the fruit.", 24, 0xe3ffd0);
  private shortsMapModeText = label("Classic - Classic run", 24, 0x89f7ff);
  private shortsSpeedText = label("SPEED x1.0", 24, 0x111111);
  private shortsWinsText = label("WINS 0", 24, 0x111111);
  private shortsFoodText = label("FOOD 0", 24, 0x111111);
  private shortsTimerText = label("00:00.000", 24, 0x111111);
  private shortsCoverageText = label("BOARD 0%", 26, COLORS.hud);
  private shortsSupportText = label("Length 0 - Queue 0", 22, 0xe3ffd0);
  private shortsMetaText = label("Food 0 - clean route", 22, 0x89f7ff);
  private shortsLeaderboardTitle = label("RUN DATA", 30, 0x111111);
  private shortsCoverageBar = new Graphics();
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

  private counters = {
    subscribers: 0,
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

  setInterfaceMode(mode: InterfaceMode): void {
    this.mode = mode;
    this.liveContainer.visible = mode === "live";
    this.shortsContainer.visible = mode === "shorts";
    this.positionNotification();
    this.updateCounterTexts();
    this.updateShortsTexts();
    this.layoutLeaderboard();
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
    this.counters = { subscribers, victories, breads, timer, level };
    this.updateCounterTexts();
  }

  setScene(scene: {
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
    this.scene = scene;
    this.updateShortsTexts();
  }

  setSpeed(multiplier: number): void {
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

  setLeaderboard(top: LeaderboardEntry[], hero: LeaderboardEntry | null): void {
    const nextUrls: Array<string | null> = new Array(LEADERBOARD_ROWS).fill(null);

    for (let i = 0; i < LEADERBOARD_ROWS; i++) {
      const entry = top[i];
      const text = this.leaderboardRows[i]!;
      const avatar = this.leaderboardAvatars[i]!;
      const bg = this.rowBgs[i]!;
      const y = this.mode === "live" ? LAYOUT.leaderboard.y + 96 + i * 68 : 1618 + i * 72;
      const x = this.mode === "live" ? LAYOUT.leaderboard.x + 22 : 48;
      const width = this.mode === "live" ? LAYOUT.leaderboard.width - 44 : SCREEN_WIDTH - 96;

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
      avatar.y = this.mode === "live" ? LAYOUT.leaderboard.y + 104 + i * 68 : 1626 + i * 72;

      text.x = this.mode === "live" ? LAYOUT.leaderboard.x + 200 : 126;
      text.y = this.mode === "live" ? LAYOUT.leaderboard.y + 113 + i * 68 : 1636 + i * 72;
      text.style.fontSize = this.mode === "live" ? 27 : 22;

      if (!entry) {
        text.text = this.mode === "shorts" ? `${i + 1}. waiting for activity` : "";
        avatar.visible = false;
        continue;
      }

      avatar.visible = true;
      text.text =
        this.mode === "live"
          ? `${i + 1}   ${entry.name}    food ${entry.foodCount}   speed ${entry.speedCount}`
          : `${i + 1}. ${entry.name}  -  food ${entry.foodCount}  -  speed ${entry.speedCount}`;
      nextUrls[i] = entry.avatarUrl;
    }

    this.shortsSupportText.text = hero
      ? `Top chat ${hero.name} - food ${hero.foodCount} - speed ${hero.speedCount}`
      : `Length ${this.scene.snakeLength} - Queue ${this.scene.queuedFoods}`;

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
    const live = label("LIVE", 34);
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

    this.liveSpeedLabel.x = 305;
    this.liveSpeedLabel.y = 288;

    const speedBarPosition = (value: number): number =>
      LAYOUT.speedBar.x + ((value - MIN_MULTIPLIER) / (MAX_MULTIPLIER - MIN_MULTIPLIER)) * LAYOUT.speedBar.width;
    const tiers = [
      { value: 1, text: "x1", color: COLORS.hudMuted },
      { value: 2, text: "x2", color: 0x42ddff },
      { value: 3, text: "x3", color: COLORS.speedBarFill },
      { value: 4, text: "x4", color: COLORS.heroGold },
      { value: 6, text: "x6", color: COLORS.speedBarHot },
    ];
    this.liveTierTexts = tiers.map((tier) => {
      const t = label(tier.text, 28, tier.color);
      t.x = speedBarPosition(tier.value) + 10;
      t.y = 287;
      return t;
    });

    this.liveLeaderboardTitle.x = LAYOUT.leaderboard.x + 38;
    this.liveLeaderboardTitle.y = LAYOUT.leaderboard.y + 22;

    this.drawLiveChrome();
    this.liveContainer.addChild(
      this.liveChrome,
      live,
      this.liveBadgeText,
      this.liveWinsText,
      this.liveFoodText,
      this.liveTimerText,
      this.liveLevelText,
      command,
      commandBody,
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
    this.shortsHeadlineText.style.wordWrap = true;
    this.shortsHeadlineText.style.wordWrapWidth = 570;
    this.shortsSublineText.style.wordWrap = true;
    this.shortsSublineText.style.wordWrapWidth = 570;
    this.shortsMapModeText.style.wordWrap = true;
    this.shortsMapModeText.style.wordWrapWidth = 540;
    this.shortsSupportText.style.wordWrap = true;
    this.shortsSupportText.style.wordWrapWidth = 420;
    this.shortsMetaText.style.wordWrap = true;
    this.shortsMetaText.style.wordWrapWidth = 420;

    this.shortsBrandText.x = 66;
    this.shortsBrandText.y = 54;
    this.shortsHeadlineText.x = 60;
    this.shortsHeadlineText.y = 112;
    this.shortsSublineText.x = 62;
    this.shortsSublineText.y = 170;
    this.shortsMapModeText.x = 62;
    this.shortsMapModeText.y = 214;

    this.shortsSpeedText.x = 734;
    this.shortsSpeedText.y = 70;
    this.shortsWinsText.x = 744;
    this.shortsWinsText.y = 128;
    this.shortsFoodText.x = 744;
    this.shortsFoodText.y = 186;
    this.shortsTimerText.x = 720;
    this.shortsTimerText.y = 244;

    this.shortsCoverageText.x = 58;
    this.shortsCoverageText.y = 1450;
    this.shortsSupportText.x = 60;
    this.shortsSupportText.y = 1490;
    this.shortsMetaText.x = 60;
    this.shortsMetaText.y = 1532;
    this.shortsLeaderboardTitle.x = 60;
    this.shortsLeaderboardTitle.y = 1582;

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
      this.shortsBrandText,
      this.shortsHeadlineText,
      this.shortsSublineText,
      this.shortsMapModeText,
      this.shortsSpeedText,
      this.shortsWinsText,
      this.shortsFoodText,
      this.shortsTimerText,
      this.shortsCoverageText,
      this.shortsSupportText,
      this.shortsMetaText,
      this.shortsLeaderboardTitle,
      this.shortsCoverageBar,
      this.shortsDpad,
      this.shortsDpadTexts.up,
      this.shortsDpadTexts.left,
      this.shortsDpadTexts.down,
      this.shortsDpadTexts.right,
    );
  }

  private updateCounterTexts(): void {
    this.liveWinsText.text = `WINS ${this.counters.victories.toLocaleString("en-US")}`;
    this.liveFoodText.text = `FOOD ${this.counters.breads.toLocaleString("en-US")}`;
    this.liveTimerText.text = this.counters.timer;
    this.liveLevelText.text = `LV ${this.counters.level}`;

    this.shortsWinsText.text = `WINS ${this.counters.victories.toLocaleString("en-US")}`;
    this.shortsFoodText.text = `FOOD ${this.counters.breads.toLocaleString("en-US")}`;
    this.shortsTimerText.text = this.counters.timer;
  }

  private updateShortsTexts(): void {
    const { foodGoal } = this.scene;
    // A round with a food goal measures progress by score, not board
    // coverage — the board itself may never fill (large maps, or walls
    // eating into the playable space in maze/pudding modes).
    const progress = foodGoal !== null ? clamp(this.scene.score / foodGoal, 0, 1) : clamp(this.scene.coverage, 0, 1);
    const progressLabel = foodGoal !== null ? `GOAL ${this.scene.score}/${foodGoal}` : `BOARD ${Math.round(progress * 100)}%`;
    const mapLabel = formatMapTheme(this.scene.mapTheme);
    const modeLabel = formatGameMode(this.scene.gameMode);

    this.shortsMapModeText.text = `${mapLabel} - ${modeLabel}`;
    this.liveBadgeText.text = `${mapLabel} - ${modeLabel}`;
    this.shortsCoverageText.text = progressLabel;
    this.shortsSpeedText.text = `SPEED x${this.scene.speed.toFixed(1)}`;
    this.shortsSupportText.text = `Length ${this.scene.snakeLength} - Queue ${this.scene.queuedFoods}`;
    this.shortsMetaText.text = `Food ${this.scene.score} - ${mapLabel} - ${modeLabel}`;

    const coverage = progress; // headline/bar thresholds below read on progress either way
    if (this.scene.status === "victory") {
      this.shortsHeadlineText.text = foodGoal !== null ? "GOAL REACHED" : "BOARD CLEARED";
      this.shortsSublineText.text = foodGoal !== null
        ? `Food goal of ${foodGoal} hit. A fresh run starts right after the win.`
        : "Full coverage locked in. A fresh run starts right after the win.";
    } else if (this.scene.status === "lost") {
      this.shortsHeadlineText.text = "ROUGH RESET";
      this.shortsSublineText.text = "The line clipped out. Another attempt starts in two seconds.";
    } else if (coverage > 0.82) {
      this.shortsHeadlineText.text = "FINAL SWEEP";
      this.shortsSublineText.text = "Board is tight now. One clean path decides the finish.";
    } else if (this.scene.speed >= 4.5) {
      this.shortsHeadlineText.text = "CHASE MODE";
      this.shortsSublineText.text = "Speed is hot. The route is compressing and the run gets sharper.";
    } else if (coverage > 0.58) {
      this.shortsHeadlineText.text = "TIGHT CORRIDOR";
      this.shortsSublineText.text = "The snake is folding into smaller lanes while still chasing fruit.";
    } else if (coverage < 0.18) {
      this.shortsHeadlineText.text = "OPENING RUN";
      this.shortsSublineText.text = "Plenty of space, direct turns, and clean pressure on the next fruit.";
    } else {
      this.shortsHeadlineText.text = "CLEAN PATH";
      this.shortsSublineText.text = "Smooth corners, readable movement, and a sharp route into the next fruit.";
    }

    this.shortsCoverageBar
      .clear()
      .roundRect(56, 1560, 420, 10, 999)
      .fill({ color: 0x162220, alpha: 0.96 })
      .roundRect(56, 1560, Math.max(16, 420 * coverage), 10, 999)
      .fill({ color: coverage > 0.7 ? COLORS.heroGold : 0x6cf6d0, alpha: 1 });

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

  private layoutLeaderboard(): void {
    for (let i = 0; i < this.leaderboardRows.length; i++) {
      const entry = this.leaderboardRows[i]!;
      this.rowBgs[i]!.visible = true;
      entry.visible = true;
      this.leaderboardAvatars[i]!.visible = this.slotUrls[i] !== null;
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
      .roundRect(52, 1604, 456, 228, 20)
      .fill({ color: 0x081414, alpha: 0.9 })
      .stroke({ width: 1, color: 0x285d5d, alpha: 0.6 })
      .roundRect(716, 1460, 256, 176, 20)
      .fill({ color: 0x081414, alpha: 0.9 })
      .stroke({ width: 1, color: 0x285d5d, alpha: 0.6 })
      .circle(954, 1538, 126)
      .fill({ color: 0x72f6d1, alpha: 0.06 })
      .circle(118, 1728, 82)
      .fill({ color: COLORS.heroGold, alpha: 0.04 });
  }
}
