import { Application, Assets, Texture } from "pixi.js";
import { createGame, setDirection, tick, enqueueAvatarFood } from "./game/GameState";
import { DEFAULT_CONFIG } from "./game/types";
import { decideMove } from "./autopilot/decideMove";
import { createSpeedMeter, addComment, decay } from "./game/SpeedMeter";
import { createLeaderboard, creditViewer, topViewers, getHero } from "./game/Leaderboard";
import { BoardRenderer } from "./render/BoardRenderer";
import { HudRenderer } from "./render/HudRenderer";
import { ScreensRenderer } from "./render/ScreensRenderer";
import { TextureCache } from "./render/TextureCache";
import { AudioManager } from "./audio/AudioManager";
import { connectChatClient } from "./net/ChatClient";
import { DEFAULT_AVATAR_URL } from "./chat/normalize";
import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from "./render/layout";

const BASE_TICK_MS = 320;
const AUTO_RESTART_DELAY_MS = 2000;
const CHAT_WS_URL = (import.meta.env.VITE_CHAT_WS_URL as string | undefined) ?? "ws://localhost:8787";

async function loadMusicPlaylist(): Promise<string[]> {
  try {
    const res = await fetch("/assets/music/playlist.json");
    const tracks = (await res.json()) as string[];
    return Array.isArray(tracks) ? tracks : [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    background: COLORS.background,
    antialias: true,
    autoDensity: false,
    resolution: 1,
  });
  document.getElementById("app")!.appendChild(app.canvas);

  // Avatar URLs (YouTube CDN, pravatar.cc in rehearsal) often have no file
  // extension, which breaks PixiJS Assets.load's extension-based parser
  // sniffing. Loading through a plain <img> with crossOrigin sidesteps that
  // and gives us explicit control over CORS (per the design spec's avatar
  // stability requirements).
  function loadImageTexture(url: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(Texture.from(img));
      img.onerror = () => reject(new Error(`failed to load avatar image: ${url}`));
      img.src = url;
    });
  }

  const avatarCache = new TextureCache<Texture>(loadImageTexture, () => Assets.load(DEFAULT_AVATAR_URL));

  const board = new BoardRenderer(DEFAULT_CONFIG.boardSize, avatarCache);
  const hud = new HudRenderer(avatarCache);
  const screens = new ScreensRenderer();
  app.stage.addChild(board.view, hud.view, screens.view);

  const audio = new AudioManager(await loadMusicPlaylist());
  // Autoplay policy: audio can only start from a user gesture. AndrÃ© clicks
  // the window once when setting up OBS, which unlocks both SFX and music.
  const startAudioOnce = () => {
    audio.start();
    window.removeEventListener("pointerdown", startAudioOnce);
    window.removeEventListener("keydown", startAudioOnce);
  };
  window.addEventListener("pointerdown", startAudioOnce);
  window.addEventListener("keydown", startAudioOnce);

  let state = createGame(DEFAULT_CONFIG);
  let speed = createSpeedMeter();
  let leaderboard = createLeaderboard();
  let victoryCount = 0;
  let lastSpeedMilestone = 1;
  // Pure safety net: if a round somehow goes a long time without scoring,
  // restart it. With the Hamiltonian autopilot this should never fire.
  let ticksWithoutScore = 0;
  let autoStartHandle: ReturnType<typeof setTimeout> | null = null;

  function scheduleAutoStart(resetGame: boolean): void {
    if (autoStartHandle) clearTimeout(autoStartHandle);
    autoStartHandle = setTimeout(() => {
      if (resetGame) {
        ticksWithoutScore = 0;
        state = createGame(DEFAULT_CONFIG);
        speed = createSpeedMeter();
        lastSpeedMilestone = 1;
      }
      audio.onStartClick();
      state = { ...state, status: "playing" };
    }, AUTO_RESTART_DELAY_MS);
  }

  function refreshLeaderboardHud(): void {
    hud.setLeaderboard(topViewers(leaderboard, 5), getHero(leaderboard));
  }

  connectChatClient(CHAT_WS_URL, (event) => {
    const viewer = {
      channelId: event.authorChannelId,
      name: event.authorName,
      avatarUrl: event.avatarUrl,
    };

    const normalized = event.text.toLowerCase();
    if (normalized.includes("speed")) {
      leaderboard = creditViewer(leaderboard, viewer, "speed");
      speed = addComment(speed);
      hud.notify(`Speed up! @${event.authorName}`);
    } else if (normalized.includes("food") || normalized.includes("add")) {
      leaderboard = creditViewer(leaderboard, viewer, "food");
      state = enqueueAvatarFood(state, {
        id: event.id,
        avatarUrl: event.avatarUrl,
        authorName: event.authorName,
      });
      hud.notify(`Add food! @${event.authorName}`);
    }
    refreshLeaderboardHud();
  });

  scheduleAutoStart(false);

  // The game simulation runs on its own setTimeout-driven loop rather than
  // PixiJS's ticker (which rides requestAnimationFrame). rAF is throttled or
  // fully paused by the browser when the page is backgrounded/hidden â€” which
  // can happen during a long unattended OBS session â€” and the snake must
  // keep actually playing even if nothing is being drawn that instant.
  let gameLoopHandle: ReturnType<typeof setTimeout> | null = null;
  let lastTickTime = performance.now();

  function runGameLoop(): void {
    const now = performance.now();
    const dt = (now - lastTickTime) / 1000;
    lastTickTime = now;

    speed = decay(speed, dt);
    const milestone = Math.floor(speed.multiplier);
    if (milestone >= 2 && milestone > lastSpeedMilestone) {
      lastSpeedMilestone = milestone;
      audio.onSpeedMilestone();
    }

    if (state.status === "playing") {
      const scoreBefore = state.score;
      const directionBefore = state.direction;

      // Safety net only: a healthy round always keeps scoring.
      if (ticksWithoutScore > 400) {
        state = { ...state, status: "lost" };
        audio.onLost();
        scheduleAutoStart(true);
        gameLoopHandle = setTimeout(runGameLoop, BASE_TICK_MS / speed.multiplier);
        return;
      }

      // One consistent brain every tick: the Hamiltonian autopilot takes safe
      // shortcuts toward food while the board is open (natural early play —
      // it never strolls past a piece next to it) and tightens to the cycle as
      // it fills, which guarantees it completes the board and wins.
      const direction = decideMove(state);
      const next = tick(setDirection(state, direction));

      // Texture release for consumed/cleared foods is handled by the render
      // reconciliation in BoardRenderer; here we only react with sound.
      if (next.score > scoreBefore) {
        ticksWithoutScore = 0;
        audio.onEat();
      } else {
        ticksWithoutScore += 1;
      }
      if (next.status === "victory") {
        victoryCount += 1;
        audio.onVictory();
        scheduleAutoStart(true);
      } else if (next.status === "lost") {
        audio.onLost();
        scheduleAutoStart(true);
      } else {
        if (next.direction !== directionBefore) audio.onTurn();
        else audio.onMove();
      }

      state = next;
    }

    gameLoopHandle = setTimeout(runGameLoop, BASE_TICK_MS / speed.multiplier);
  }

  runGameLoop();
  window.addEventListener("beforeunload", () => {
    if (gameLoopHandle) clearTimeout(gameLoopHandle);
  });

  // Rendering stays on the Pixi ticker â€” there's no point drawing a frame
  // nobody can see, and it catches up instantly once the page is visible again.
  app.ticker.add(() => {
    hud.setSpeed(speed.multiplier);
    hud.setCounters({ subscribers: 0, victories: victoryCount });
    board.update(state, speed.multiplier);
    screens.setStatus(state.status);
  });

  // Dev-only inspection handle (stripped from production builds).
  if (import.meta.env.DEV) {
    (window as unknown as { __game: unknown }).__game = {
      getState: () => state,
      getVictories: () => victoryCount,
    };
  }
}

main().catch((err) => {
  console.error("[main] fatal error during boot:", err);
});

