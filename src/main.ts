import { Application, Assets, Texture } from "pixi.js";
import { createGame, enqueueAvatarFood, nextGrowthConfig, setDirection, tick } from "./game/GameState";
import {
  DEFAULT_CONFIG,
  type ColorMode,
  type Direction,
  type FoodType,
  type GameConfig,
  type GameMode,
  type GameState,
  type MapThemeId,
  type SnakeStyle,
  type Vec2,
} from "./game/types";
import { decideMove } from "./autopilot/decideMove";
import { availableVariants, type CycleVariant } from "./autopilot/hamiltonian";
import { addComment, createSpeedMeter, decay } from "./game/SpeedMeter";
import { createLeaderboard, creditViewer, getHero, topViewers } from "./game/Leaderboard";
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
const MAX_START_WIDTH = 28;
const MAX_START_HEIGHT = 20;
const MAP_MIN_SIZE: Record<MapThemeId, { width: number; height: number }> = {
  classic: { width: 10, height: 8 },
  heart: { width: 16, height: 14 },
  brazil: { width: 28, height: 18 },
  creeper: { width: 18, height: 18 },
};

const DIRECTION_VECTORS: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const FOOD_TEXTURE_URLS: Record<FoodType, string> = {
  apple_red: "/assets/foods/apple-red.png",
  apple_gold: "/assets/foods/apple-gold.png",
  bread: "/assets/foods/bread.png",
  watermelon: "/assets/foods/watermelon.png",
};

function posKey(pos: Vec2): string {
  return `${pos.x},${pos.y}`;
}

function inBounds(pos: Vec2, state: GameState): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < state.config.boardWidth && pos.y < state.config.boardHeight;
}

function isFoodAt(pos: Vec2, state: GameState): boolean {
  return state.foods.some((food) => food.pos.x === pos.x && food.pos.y === pos.y);
}

function simulateSnakeAfterMove(state: GameState, direction: Direction): Vec2[] | null {
  if (state.snake.length > 1 && direction === OPPOSITE[state.direction]) return null;
  const head = state.snake[0]!;
  const vec = DIRECTION_VECTORS[direction];
  const nextHead = { x: head.x + vec.x, y: head.y + vec.y };
  if (!inBounds(nextHead, state)) return null;
  if (state.walls.has(posKey(nextHead))) return null;

  const grows = isFoodAt(nextHead, state);
  const bodyToCheck = grows ? state.snake : state.snake.slice(0, -1);
  if (bodyToCheck.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y)) return null;
  return grows ? [nextHead, ...state.snake] : [nextHead, ...state.snake.slice(0, -1)];
}

function reachableSpace(snake: Vec2[], state: GameState): number {
  const head = snake[0]!;
  const blocked = new Set(snake.slice(0, -1).map(posKey));
  const seen = new Set<string>([posKey(head)]);
  const queue: Vec2[] = [head];
  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor++]!;
    for (const direction of Object.keys(DIRECTION_VECTORS) as Direction[]) {
      const vec = DIRECTION_VECTORS[direction];
      const next = { x: current.x + vec.x, y: current.y + vec.y };
      const key = posKey(next);
      if (!inBounds(next, state) || blocked.has(key) || seen.has(key) || state.walls.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen.size;
}

function pickDifficultHumanMistake(state: GameState, correctDirection: Direction): Direction | null {
  const fill = state.snake.length / (state.config.boardWidth * state.config.boardHeight);
  if (fill < 0.72) return null;

  let worst: { direction: Direction; space: number } | null = null;
  for (const direction of Object.keys(DIRECTION_VECTORS) as Direction[]) {
    if (direction === correctDirection) continue;
    const snake = simulateSnakeAfterMove(state, direction);
    if (!snake) continue;
    const space = reachableSpace(snake, state);
    if (space > state.snake.length + 8) continue;
    if (!worst || space < worst.space) worst = { direction, space };
  }
  return worst?.direction ?? null;
}

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

  const settingsToggle = document.getElementById("settings-toggle") as HTMLButtonElement | null;
  const settingsPanel = document.getElementById("settings-panel") as HTMLFormElement | null;
  const volumeSlider = document.getElementById("volume-slider") as HTMLInputElement | null;
  const volumeValue = document.getElementById("volume-value");
  const volumeToggle = document.getElementById("volume-toggle");
  const volumeControl = document.getElementById("volume-control");

  const mapSelect = document.getElementById("setting-map") as HTMLSelectElement | null;
  const modeSelect = document.getElementById("setting-mode") as HTMLSelectElement | null;
  const colorsSelect = document.getElementById("setting-colors") as HTMLSelectElement | null;
  const snakeSelect = document.getElementById("setting-snake") as HTMLSelectElement | null;
  const commentSpeedModeSelect = document.getElementById("setting-comment-speed-mode") as HTMLSelectElement | null;
  const commentSpeedStartInput = document.getElementById("setting-comment-speed-start") as HTMLInputElement | null;
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

  volumeToggle?.addEventListener("click", () => {
    volumeControl?.classList.toggle("is-open");
  });
  volumeSlider?.addEventListener("input", () => {
    const value = Number(volumeSlider.value);
    audio.setVolume(value / 100);
    if (volumeValue) volumeValue.textContent = `${value}%`;
  });

  settingsToggle?.addEventListener("click", () => {
    settingsPanel?.classList.toggle("is-open");
  });

  mapSelect?.addEventListener("change", () => {
    const theme = (mapSelect.value as MapThemeId) ?? DEFAULT_CONFIG.mapTheme;
    const minSize = MAP_MIN_SIZE[theme];
    if (widthInput) widthInput.value = String(Math.max(Number(widthInput.value || DEFAULT_CONFIG.boardWidth), minSize.width));
    if (heightInput) heightInput.value = String(Math.max(Number(heightInput.value || DEFAULT_CONFIG.boardHeight), minSize.height));
    if (theme !== "classic" && snakeSelect && snakeSelect.value === "smooth") {
      snakeSelect.value = "google";
    }
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
    const minSize = MAP_MIN_SIZE[mapTheme];
    return {
      ...DEFAULT_CONFIG,
      boardWidth: clamp(Math.max(Number(widthInput?.value ?? DEFAULT_CONFIG.boardWidth), minSize.width), 8, MAX_START_WIDTH),
      boardHeight: clamp(Math.max(Number(heightInput?.value ?? DEFAULT_CONFIG.boardHeight), minSize.height), 6, MAX_START_HEIGHT),
      maxAvatarFoods: DEFAULT_CONFIG.maxAvatarFoods,
      mapTheme,
      gameMode: (modeSelect?.value as GameMode | undefined) ?? DEFAULT_CONFIG.gameMode,
      colorMode: (colorsSelect?.value as ColorMode | undefined) ?? DEFAULT_CONFIG.colorMode,
      snakeStyle: (snakeSelect?.value as SnakeStyle | undefined) ?? DEFAULT_CONFIG.snakeStyle,
      commentSpeedMode: commentSpeedModeSelect?.value === "fixed" ? "fixed" : "gradual",
      commentSpeedStart: clamp(Number(commentSpeedStartInput?.value ?? 1), 1, 6),
      foodTypes: readFoodTypes(),
      growthEnabled: Boolean(growthInput?.checked),
      baseSpeedMultiplier: clamp(Number(speedInput?.value ?? 1), 0.6, 2.4),
      gradientSpeed: clamp(Number(gradientInput?.value ?? 0.04), 0.01, 0.12),
      humanErrorRate: clamp(Number(errorsInput?.value ?? 20) / 100, 0, 1),
      maxBoardWidth: 28,
      maxBoardHeight: 20,
    };
  }

  function syncInputsFromConfig(config: GameConfig): void {
    if (mapSelect) mapSelect.value = config.mapTheme;
    if (modeSelect) modeSelect.value = config.gameMode;
    if (colorsSelect) colorsSelect.value = config.colorMode;
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

  function replaceBoard(config: GameConfig): void {
    app.stage.removeChild(board.view);
    board.view.destroy({ children: true });
    board = new BoardRenderer(config.boardWidth, config.boardHeight, avatarCache, foodTextures);
    app.stage.addChildAt(board.view, 0);
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
  let shouldFailThisRound = Math.random() < currentConfig.humanErrorRate;
  let failureUsedThisRound = false;
  let ticksWithoutScore = 0;
  let roundElapsedMs = 0;
  let autoStartHandle: ReturnType<typeof setTimeout> | null = null;

  function resetRound(config: GameConfig, level: number): void {
    currentConfig = { ...config };
    currentLevel = level;
    replaceBoard(currentConfig);
    state = { ...createGame(currentConfig), level: currentLevel };
    roundVariant = pickRoundVariant(currentConfig, roundVariant);
    speed = createSpeedMeter(currentConfig.commentSpeedStart);
    lastSpeedMilestone = 1;
    shouldFailThisRound = Math.random() < currentConfig.humanErrorRate;
    failureUsedThisRound = false;
    ticksWithoutScore = 0;
    roundElapsedMs = 0;
  }

  function scheduleAutoStart(prepare?: () => void): void {
    if (autoStartHandle) clearTimeout(autoStartHandle);
    autoStartHandle = setTimeout(() => {
      prepare?.();
      audio.onStartClick();
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
    const effectiveSpeed = speed.multiplier * currentConfig.baseSpeedMultiplier;
    const milestone = Math.floor(effectiveSpeed);
    if (milestone >= 2 && milestone > lastSpeedMilestone) {
      lastSpeedMilestone = milestone;
      audio.onSpeedMilestone();
    }

    if (state.status === "playing") {
      roundElapsedMs += dt * 1000;
      const scoreBefore = state.score;
      const directionBefore = state.direction;

      if (ticksWithoutScore > currentConfig.boardWidth * currentConfig.boardHeight * 5) {
        state = { ...state, status: "lost" };
        audio.onLost();
        scheduleAutoStart(() => resetRound(baseConfig, 1));
        gameLoopHandle = setTimeout(runGameLoop, BASE_TICK_MS / effectiveSpeed);
        return;
      }

      const correctDirection = decideMove(state, effectiveSpeed, Math.random, roundVariant);
      const humanMistake =
        shouldFailThisRound && !failureUsedThisRound
          ? pickDifficultHumanMistake(state, correctDirection)
          : null;
      const direction = humanMistake ?? correctDirection;
      if (humanMistake) failureUsedThisRound = true;

      const next = tick(setDirection(state, direction));
      if (next.score > scoreBefore) {
        ticksWithoutScore = 0;
        audio.onEat();
      } else {
        ticksWithoutScore += 1;
      }

      if (next.status === "victory") {
        victoryCount += 1;
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
    const effectiveSpeed = speed.multiplier * currentConfig.baseSpeedMultiplier;
    hud.setSpeed(effectiveSpeed);
    hud.setCounters({
      subscribers: 0,
      victories: victoryCount,
      breads: state.breadsEaten,
      timer: formatTimer(roundElapsedMs),
      level: currentLevel,
    });
    board.update(state, effectiveSpeed);
    screens.setStatus(state.status);
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
