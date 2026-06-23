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

const BASE_TICK_MS = 260;
const AUTO_RESTART_DELAY_MS = 1000;
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
  await app.init({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, background: COLORS.background, antialias: true });
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
  // Autoplay policy: audio can only start from a user gesture. André clicks
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
  let autoStartHandle: ReturnType<typeof setTimeout> | null = null;

  function scheduleAutoStart(resetGame: boolean): void {
    if (autoStartHandle) clearTimeout(autoStartHandle);
    autoStartHandle = setTimeout(() => {
      if (resetGame) state = createGame(DEFAULT_CONFIG);
      state = { ...state, status: "playing" };
    }, AUTO_RESTART_DELAY_MS);
  }

  function refreshLeaderboardHud(): void {
    hud.setLeaderboard(topViewers(leaderboard, 5), getHero(leaderboard));
  }

  connectChatClient(CHAT_WS_URL, (event) => {
    speed = addComment(speed);
    leaderboard = creditViewer(leaderboard, {
      channelId: event.authorChannelId,
      name: event.authorName,
      avatarUrl: event.avatarUrl,
    });
    state = enqueueAvatarFood(state, {
      id: event.id,
      avatarUrl: event.avatarUrl,
      authorName: event.authorName,
    });
    hud.notify(`🍎 Add food! @${event.authorName}`);
    refreshLeaderboardHud();
  });

  scheduleAutoStart(false);

  // The game simulation runs on its own setTimeout-driven loop rather than
  // PixiJS's ticker (which rides requestAnimationFrame). rAF is throttled or
  // fully paused by the browser when the page is backgrounded/hidden — which
  // can happen during a long unattended OBS session — and the snake must
  // keep actually playing even if nothing is being drawn that instant.
  let gameLoopHandle: ReturnType<typeof setTimeout> | null = null;
  let lastTickTime = performance.now();

  function runGameLoop(): void {
    const now = performance.now();
    const dt = (now - lastTickTime) / 1000;
    lastTickTime = now;

    speed = decay(speed, dt);

    if (state.status === "playing") {
      const scoreBefore = state.score;

      const direction = decideMove(state);
      const next = tick(setDirection(state, direction));

      // Texture release for consumed/cleared foods is handled by the render
      // reconciliation in BoardRenderer; here we only react with sound.
      if (next.score > scoreBefore) audio.onEat();
      if (next.status === "victory") {
        audio.onVictory();
        scheduleAutoStart(true);
      } else if (next.status === "lost") {
        audio.onLost();
        scheduleAutoStart(true);
      } else {
        audio.onTurn();
      }

      state = next;
    }

    gameLoopHandle = setTimeout(runGameLoop, BASE_TICK_MS / speed.multiplier);
  }

  runGameLoop();
  window.addEventListener("beforeunload", () => {
    if (gameLoopHandle) clearTimeout(gameLoopHandle);
  });

  // Rendering stays on the Pixi ticker — there's no point drawing a frame
  // nobody can see, and it catches up instantly once the page is visible again.
  app.ticker.add(() => {
    hud.setSpeed(speed.multiplier);
    board.update(state);
    screens.setStatus(state.status);
  });
}

main().catch((err) => {
  console.error("[main] fatal error during boot:", err);
});
