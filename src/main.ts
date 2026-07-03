import { Application, Assets, Texture } from "pixi.js";
import { createGame, enqueueAvatarFood, nextGrowthConfig, setDirection, tick } from "./game/GameState";
import {
  DEFAULT_CONFIG,
  type ColorMode,
  type FoodType,
  type GameConfig,
  type GameMode,
  type InterfaceMode,
  type MapThemeId,
  type SnakeStyle,
} from "./game/types";
import { decideMove } from "./autopilot/decideMove";
import { isErrorPhase, pickDeliberateMistake } from "./autopilot/humanError";
import { availableVariants, type CycleVariant } from "./autopilot/hamiltonian";
import { addComment, cappedEffectiveSpeed, createSpeedMeter, decay } from "./game/SpeedMeter";
import { createLeaderboard, creditViewer, getHero, topViewers } from "./game/Leaderboard";
import { hasStalledTooLong } from "./game/watchdog";
import { BoardRenderer } from "./render/BoardRenderer";
import { HudRenderer } from "./render/HudRenderer";
import { ScreensRenderer } from "./render/ScreensRenderer";
import { TextureCache } from "./render/TextureCache";
import { AudioManager } from "./audio/AudioManager";
import { connectChatClient } from "./net/ChatClient";
import { DEFAULT_AVATAR_URL } from "./chat/normalize";
import { COLORS, SCREEN_HEIGHT, SCREEN_WIDTH } from "./render/layout";

const BASE_TICK_MS = 420;
const AUTO_RESTART_DELAY_MS = 2000;
const DEFAULT_VOLUME = 0.6;
const CHAT_WS_URL = (import.meta.env.VITE_CHAT_WS_URL as string | undefined) ?? "ws://localhost:8787";
const MAX_START_WIDTH = 36;
const MAX_START_HEIGHT = 24;
const MAP_PRESET_SIZE: Record<MapThemeId, { width: number; height: number }> = {
  classic: { width: 10, height: 8 },
  heart: { width: 18, height: 16 },
  brazil: { width: 32, height: 20 },
  france: { width: 24, height: 16 },
  norway: { width: 30, height: 20 },
  creeper: { width: 20, height: 20 },
};
const MODE_PRESET_SIZE: Partial<Record<GameMode, { width: number; height: number }>> = {
  maze_race: { width: 16, height: 12 },
  maze_harvest: { width: 18, height: 14 },
  pudding: { width: 16, height: 12 },
};

const FOOD_TEXTURE_URLS: Record<FoodType, string> = {
  apple_red: "/assets/foods/apple-red.png",
  apple_gold: "/assets/foods/apple-gold.png",
  bread: "/assets/foods/bread.png",
  watermelon: "/assets/foods/watermelon.png",
};

async function loadMusicPlaylist(): Promise<string[]> {
  try {
    const res = await fetch("/assets/music/playlist.json");
    const tracks = (await res.json()) as string[];
    return Array.isArray(tracks) ? tracks : [];
  } catch {
    return [];
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function minimumBoardSize(mapTheme: MapThemeId, gameMode: GameMode): { width: number; height: number } {
  const mapMinimum = MAP_PRESET_SIZE[mapTheme];
  const modeMinimum = MODE_PRESET_SIZE[gameMode];
  return {
    width: Math.max(mapMinimum.width, modeMinimum?.width ?? 0),
    height: Math.max(mapMinimum.height, modeMinimum?.height ?? 0),
  };
}

function defaultBoardSize(mapTheme: MapThemeId, gameMode: GameMode): { width: number; height: number } {
  return minimumBoardSize(mapTheme, gameMode);
}

async function loadFoodTextures(): Promise<Record<FoodType, Texture>> {
  return {
    apple_red: (await Assets.load(FOOD_TEXTURE_URLS.apple_red)) as Texture,
    apple_gold: (await Assets.load(FOOD_TEXTURE_URLS.apple_gold)) as Texture,
    bread: (await Assets.load(FOOD_TEXTURE_URLS.bread)) as Texture,
    watermelon: (await Assets.load(FOOD_TEXTURE_URLS.watermelon)) as Texture,
  };
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
  const foodTextures = await loadFoodTextures();

  const audio = new AudioManager(await loadMusicPlaylist());
  audio.setVolume(DEFAULT_VOLUME);

  const hud = new HudRenderer(avatarCache);
  const screens = new ScreensRenderer();
  let board = new BoardRenderer(DEFAULT_CONFIG.boardWidth, DEFAULT_CONFIG.boardHeight, avatarCache, foodTextures);
  app.stage.addChild(board.view, hud.view, screens.view);
  screens.setBoardConfig(DEFAULT_CONFIG.boardWidth, DEFAULT_CONFIG.boardHeight);

  const settingsToggle = document.getElementById("settings-toggle") as HTMLButtonElement | null;
  const settingsPanel = document.getElementById("settings-panel") as HTMLFormElement | null;
  const volumeSlider = document.getElementById("volume-slider") as HTMLInputElement | null;

  const mapSelect = document.getElementById("setting-map") as HTMLSelectElement | null;
  const modeSelect = document.getElementById("setting-mode") as HTMLSelectElement | null;
  const colorsSelect = document.getElementById("setting-colors") as HTMLSelectElement | null;
  const interfaceSelect = document.getElementById("setting-interface") as HTMLSelectElement | null;
  const snakeSelect = document.getElementById("setting-snake") as HTMLSelectElement | null;
  const commentSpeedModeSelect = document.getElementById("setting-comment-speed-mode") as HTMLSelectElement | null;
  const commentSpeedStartInput = document.getElementById("setting-comment-speed-start") as HTMLSelectElement | null;
  const widthInput = document.getElementById("setting-width") as HTMLInputElement | null;
  const heightInput = document.getElementById("setting-height") as HTMLInputElement | null;
  const growthInput = document.getElementById("setting-growth") as HTMLInputElement | null;
  const speedInput = document.getElementById("setting-speed") as HTMLInputElement | null;
  const gradientInput = document.getElementById("setting-gradient") as HTMLInputElement | null;
  const errorsInput = document.getElementById("setting-errors") as HTMLInputElement | null;
  const foodAppleRed = document.getElementById("food-apple-red") as HTMLInputElement | null;
  const foodAppleGold = document.getElementById("food-apple-gold") as HTMLInputElement | null;
  const foodBread = document.getElementById("food-bread") as HTMLInputElement | null;
  const foodWatermelon = document.getElementById("food-watermelon") as HTMLInputElement | null;

  volumeSlider?.addEventListener("input", () => {
    const value = Number(volumeSlider.value);
    audio.setVolume(value / 100);
  });

  settingsToggle?.addEventListener("click", () => {
    settingsPanel?.classList.toggle("is-open");
  });

  mapSelect?.addEventListener("change", () => {
    const theme = (mapSelect.value as MapThemeId) ?? DEFAULT_CONFIG.mapTheme;
    const gameMode = (modeSelect?.value as GameMode | undefined) ?? DEFAULT_CONFIG.gameMode;
    const preset = defaultBoardSize(theme, gameMode);
    if (widthInput) widthInput.value = String(preset.width);
    if (heightInput) heightInput.value = String(preset.height);
    if (theme !== "classic" && snakeSelect && snakeSelect.value === "smooth") {
      snakeSelect.value = "google";
    }
  });
  modeSelect?.addEventListener("change", () => {
    const theme = (mapSelect?.value as MapThemeId | undefined) ?? DEFAULT_CONFIG.mapTheme;
    const gameMode = (modeSelect.value as GameMode | undefined) ?? DEFAULT_CONFIG.gameMode;
    const preset = defaultBoardSize(theme, gameMode);
    if (widthInput) widthInput.value = String(preset.width);
    if (heightInput) heightInput.value = String(preset.height);
  });

  const startAudioOnce = () => {
    audio.start();
    window.removeEventListener("pointerdown", startAudioOnce);
    window.removeEventListener("keydown", startAudioOnce);
  };
  window.addEventListener("pointerdown", startAudioOnce);
  window.addEventListener("keydown", startAudioOnce);

  function readFoodTypes(): FoodType[] {
    const selected: FoodType[] = [];
    if (foodAppleRed?.checked) selected.push("apple_red");
    if (foodAppleGold?.checked) selected.push("apple_gold");
    if (foodBread?.checked) selected.push("bread");
    if (foodWatermelon?.checked) selected.push("watermelon");
    return selected.length > 0 ? selected : ["apple_red"];
  }

  function buildConfigFromInputs(): GameConfig {
    const mapTheme = (mapSelect?.value as MapThemeId | undefined) ?? DEFAULT_CONFIG.mapTheme;
    const gameMode = (modeSelect?.value as GameMode | undefined) ?? DEFAULT_CONFIG.gameMode;
    const minSize = minimumBoardSize(mapTheme, gameMode);
    return {
      ...DEFAULT_CONFIG,
      boardWidth: clamp(Math.max(Number(widthInput?.value ?? DEFAULT_CONFIG.boardWidth), minSize.width), 8, MAX_START_WIDTH),
      boardHeight: clamp(Math.max(Number(heightInput?.value ?? DEFAULT_CONFIG.boardHeight), minSize.height), 6, MAX_START_HEIGHT),
      maxAvatarFoods: DEFAULT_CONFIG.maxAvatarFoods,
      mapTheme,
      gameMode,
      colorMode: (colorsSelect?.value as ColorMode | undefined) ?? DEFAULT_CONFIG.colorMode,
      interfaceMode: (interfaceSelect?.value as InterfaceMode | undefined) ?? DEFAULT_CONFIG.interfaceMode,
      snakeStyle: (snakeSelect?.value as SnakeStyle | undefined) ?? DEFAULT_CONFIG.snakeStyle,
      commentSpeedMode: commentSpeedModeSelect?.value === "fixed" ? "fixed" : "gradual",
      commentSpeedStart: clamp(Number(commentSpeedStartInput?.value ?? 1), 1, 6),
      foodTypes: readFoodTypes(),
      growthEnabled: Boolean(growthInput?.checked),
      baseSpeedMultiplier: clamp(Number(speedInput?.value ?? 1), 0.6, 2.4),
      gradientSpeed: clamp(Number(gradientInput?.value ?? 0.04), 0.01, 0.12),
      humanErrorRate: clamp(Number(errorsInput?.value ?? 20) / 100, 0, 1),
      maxBoardWidth: 36,
      maxBoardHeight: 24,
    };
  }

  function syncInputsFromConfig(config: GameConfig): void {
    if (mapSelect) mapSelect.value = config.mapTheme;
    if (modeSelect) modeSelect.value = config.gameMode;
    if (colorsSelect) colorsSelect.value = config.colorMode;
    if (interfaceSelect) interfaceSelect.value = config.interfaceMode;
    if (snakeSelect) snakeSelect.value = config.snakeStyle;
    if (commentSpeedModeSelect) commentSpeedModeSelect.value = config.commentSpeedMode;
    if (commentSpeedStartInput) commentSpeedStartInput.value = String(config.commentSpeedStart);
    if (widthInput) widthInput.value = String(config.boardWidth);
    if (heightInput) heightInput.value = String(config.boardHeight);
    if (growthInput) growthInput.checked = config.growthEnabled;
    if (speedInput) speedInput.value = String(config.baseSpeedMultiplier);
    if (gradientInput) gradientInput.value = String(config.gradientSpeed);
    if (errorsInput) errorsInput.value = String(Math.round(config.humanErrorRate * 100));
    if (foodAppleRed) foodAppleRed.checked = config.foodTypes.includes("apple_red");
    if (foodAppleGold) foodAppleGold.checked = config.foodTypes.includes("apple_gold");
    if (foodBread) foodBread.checked = config.foodTypes.includes("bread");
    if (foodWatermelon) foodWatermelon.checked = config.foodTypes.includes("watermelon");
  }

  let baseConfig: GameConfig = { ...DEFAULT_CONFIG };
  let currentConfig: GameConfig = { ...baseConfig };
  syncInputsFromConfig(baseConfig);
  hud.setInterfaceMode(baseConfig.interfaceMode);

  function replaceBoard(config: GameConfig): void {
    app.stage.removeChild(board.view);
    board.destroy();
    board = new BoardRenderer(config.boardWidth, config.boardHeight, avatarCache, foodTextures);
    app.stage.addChildAt(board.view, 0);
    screens.setBoardConfig(config.boardWidth, config.boardHeight);
  }

  function pickRoundVariant(config: GameConfig, previous: CycleVariant): CycleVariant {
    const variants = availableVariants(config.boardWidth, config.boardHeight);
    const choices = variants.filter((variant) => variant !== previous);
    const pool = choices.length > 0 ? choices : variants;
    return pool[Math.floor(Math.random() * pool.length)] ?? "row";
  }

  let state = createGame(currentConfig);
  let roundVariant: CycleVariant = "row";
  roundVariant = pickRoundVariant(currentConfig, roundVariant);
  let speed = createSpeedMeter(currentConfig.commentSpeedStart);
  let leaderboard = createLeaderboard();
  let victoryCount = 0;
  let currentLevel = 1;
  let lastSpeedMilestone = 1;
  // Pure safety net: a healthy round always keeps scoring well within this
  // window. If it doesn't (an unforeseen bug traps the snake), force a
  // theatrical loss and restart rather than freezing the stream — measured
  // in wall-clock time so it fires consistently regardless of tick rate.
  let lastScoreAt = performance.now();
  let roundElapsedMs = 0;
  let roundStartedAt = 0;
  let autoStartHandle: ReturnType<typeof setTimeout> | null = null;

  function resetRound(config: GameConfig, level: number): void {
    currentConfig = { ...config };
    currentLevel = level;
    replaceBoard(currentConfig);
    hud.setInterfaceMode(currentConfig.interfaceMode);
    state = { ...createGame(currentConfig), level: currentLevel };
    roundVariant = pickRoundVariant(currentConfig, roundVariant);
    speed = createSpeedMeter(currentConfig.commentSpeedStart);
    lastSpeedMilestone = 1;
    lastScoreAt = performance.now();
    roundElapsedMs = 0;
    roundStartedAt = 0;
  }

  function scheduleAutoStart(prepare?: () => void): void {
    if (autoStartHandle) clearTimeout(autoStartHandle);
    autoStartHandle = setTimeout(() => {
      prepare?.();
      audio.onStartClick();
      roundElapsedMs = 0;
      roundStartedAt = performance.now();
      state = { ...state, status: "playing" };
    }, AUTO_RESTART_DELAY_MS);
  }

  if (settingsPanel) {
    settingsPanel.addEventListener("submit", (event) => {
      event.preventDefault();
      baseConfig = buildConfigFromInputs();
      resetRound(baseConfig, 1);
      settingsPanel.classList.remove("is-open");
      scheduleAutoStart();
    });
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
      speed = addComment(speed, currentConfig.commentSpeedMode === "fixed");
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

  scheduleAutoStart();

  let gameLoopHandle: ReturnType<typeof setTimeout> | null = null;
  let lastTickTime = performance.now();

  function runGameLoop(): void {
    const now = performance.now();
    const dt = (now - lastTickTime) / 1000;
    lastTickTime = now;

    speed = decay(speed, dt);
    const effectiveSpeed = cappedEffectiveSpeed(speed.multiplier, currentConfig.baseSpeedMultiplier);
    const milestone = Math.floor(effectiveSpeed);
    if (milestone >= 2 && milestone > lastSpeedMilestone) {
      lastSpeedMilestone = milestone;
      audio.onSpeedMilestone();
    }

    if (state.status === "playing") {
      const scoreBefore = state.score;
      const directionBefore = state.direction;

      if (hasStalledTooLong(lastScoreAt, performance.now())) {
        state = { ...state, status: "lost" };
        audio.onLost();
        scheduleAutoStart(() => resetRound(baseConfig, 1));
        gameLoopHandle = setTimeout(runGameLoop, BASE_TICK_MS / effectiveSpeed);
        return;
      }

      let stateForTick = state;
      let direction: ReturnType<typeof decideMove>;
      if (state.willMakeError && !state.humanErrorUsed && isErrorPhase(state)) {
        const errDir = pickDeliberateMistake(state, Math.random);
        if (errDir) {
          direction = errDir;
          stateForTick = { ...state, humanErrorUsed: true };
        } else {
          direction = decideMove(state, Math.random, roundVariant);
        }
      } else {
        direction = decideMove(state, Math.random, roundVariant);
      }
      const next = tick(setDirection(stateForTick, direction));
      if (next.score > scoreBefore) {
        lastScoreAt = performance.now();
        audio.onEat();
      }

      if (next.status === "victory") {
        victoryCount += 1;
        roundElapsedMs = roundStartedAt > 0 ? performance.now() - roundStartedAt : roundElapsedMs;
        roundStartedAt = 0;
        audio.onVictory();
        scheduleAutoStart(() => {
          if (baseConfig.growthEnabled) {
            const grown = nextGrowthConfig(currentConfig);
            const didGrow = grown.boardWidth !== currentConfig.boardWidth || grown.boardHeight !== currentConfig.boardHeight;
            resetRound(didGrow ? grown : currentConfig, didGrow ? currentLevel + 1 : currentLevel);
          } else {
            resetRound(baseConfig, 1);
          }
        });
      } else if (next.status === "lost") {
        roundElapsedMs = roundStartedAt > 0 ? performance.now() - roundStartedAt : roundElapsedMs;
        roundStartedAt = 0;
        audio.onLost();
        scheduleAutoStart(() => resetRound(baseConfig, 1));
      } else {
        if (next.direction !== directionBefore) audio.onTurn();
        else audio.onMove();
      }

      state = { ...next, level: currentLevel };
    }

    gameLoopHandle = setTimeout(runGameLoop, BASE_TICK_MS / effectiveSpeed);
  }

  runGameLoop();
  window.addEventListener("beforeunload", () => {
    if (gameLoopHandle) clearTimeout(gameLoopHandle);
  });

  app.ticker.add(() => {
    const effectiveSpeed = cappedEffectiveSpeed(speed.multiplier, currentConfig.baseSpeedMultiplier);
    const displayElapsedMs =
      state.status === "playing" && roundStartedAt > 0
        ? performance.now() - roundStartedAt
        : roundElapsedMs;
    const playableCells = Math.max(1, (state.config.boardWidth * state.config.boardHeight) - state.walls.size);
    hud.setSpeed(effectiveSpeed);
    hud.setCounters({
      subscribers: 0,
      victories: victoryCount,
      breads: state.score,
      timer: formatTimer(displayElapsedMs),
      level: currentLevel,
    });
    hud.setScene({
      status: state.status,
      mapTheme: state.config.mapTheme,
      gameMode: state.config.gameMode,
      coverage: state.snake.length / playableCells,
      speed: effectiveSpeed,
      snakeLength: state.snake.length,
      queuedFoods: state.foodQueue.length,
      direction: state.direction,
      score: state.score,
      foodGoal: state.config.foodGoal,
    });
    board.update(state, effectiveSpeed);
    screens.setStatus(state.status, {
      gameMode: state.config.gameMode,
      score: state.score,
      foodGoal: state.config.foodGoal,
      coverage: state.snake.length / playableCells,
      timer: formatTimer(displayElapsedMs),
    });
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __game: unknown }).__game = {
      getState: () => state,
      getVictories: () => victoryCount,
      getSpeed: () => speed,
      applyConfig: (config: Partial<GameConfig>) => {
        baseConfig = { ...baseConfig, ...config, foodTypes: config.foodTypes?.length ? config.foodTypes : baseConfig.foodTypes };
        resetRound(baseConfig, 1);
      },
    };
  }
}

main().catch((err) => {
  console.error("[main] fatal error during boot:", err);
});
