import { describe, expect, test } from "vitest";
import { HUD_STRINGS, SCREEN_STRINGS, formatGameMode, formatMapTheme } from "./strings";

describe("formatMapTheme (#113 — PT-BR interface)", () => {
  test.each([
    ["classic", "Clássico"],
    ["heart", "Coração"],
    ["brazil", "Brasil"],
    ["france", "França"],
    ["norway", "Noruega"],
    ["creeper", "Creeper"],
  ] as const)("%s -> %s", (theme, expected) => {
    expect(formatMapTheme(theme)).toBe(expected);
  });
});

describe("formatGameMode (#113 — PT-BR interface)", () => {
  test.each([
    ["classic", "Modo clássico"],
    ["full_food", "Mapa cheio"],
    ["maze_race", "Corrida no labirinto"],
    ["maze_harvest", "Colheita no labirinto"],
    ["pudding", "Blocos dinâmicos"],
  ] as const)("%s -> %s", (mode, expected) => {
    expect(formatGameMode(mode)).toBe(expected);
  });
});

describe("HUD_STRINGS formatters", () => {
  test("chat commands are the international words with icons, no PT translation (decisão do André 26/07)", () => {
    expect(HUD_STRINGS.foodCommand).toBe('"FOOD" = 🍎');
    expect(HUD_STRINGS.speedCommand).toBe('"SPEED" = ⚡');
    expect(HUD_STRINGS.foodCommand).not.toContain("COMIDA");
    expect(HUD_STRINGS.speedCommand).not.toContain("VELOCIDADE");
    expect(HUD_STRINGS.commentHeader).toBe("COMENTE:");
    expect(HUD_STRINGS.liveBadge).toContain("AO VIVO");
  });

  test("stat pills and leaderboard counts speak in icons, not words", () => {
    expect(HUD_STRINGS.wins("3")).toBe("🏆 3");
    expect(HUD_STRINGS.food("2")).toBe("🍎 2");
    expect(HUD_STRINGS.speed("2.0")).toBe("SPEED x2.0");
    expect(HUD_STRINGS.leaderboardRowShorts(1, "Ana", 3, 5)).toBe("1. Ana   🍎 3   ⚡ 5");
    expect(HUD_STRINGS.leaderboardRowLive(2, "Bia", 1, 0)).toContain("🍎 1");
  });
});

describe("SCREEN_STRINGS", () => {
  test("victory subtitle variants are in Portuguese", () => {
    expect(SCREEN_STRINGS.victoryFinishedIn("01:23.456")).toBe("terminou em 01:23.456");
    expect(SCREEN_STRINGS.victoryFoodCollected(10, 50)).toBe("10/50 comidas coletadas");
    expect(SCREEN_STRINGS.victoryFoodCollected(10, null)).toBe("10 comidas coletadas");
    expect(SCREEN_STRINGS.victoryBoardCoverage(100)).toBe("100% do mapa coberto");
  });

  test("start/victory/lost titles are in Portuguese", () => {
    expect(SCREEN_STRINGS.start.title).toBe("PREPARANDO");
    expect(SCREEN_STRINGS.victory.title).toBe("VITÓRIA!");
    expect(SCREEN_STRINGS.lost.title).toBe("PERDI!");
    expect(SCREEN_STRINGS.startButton).toBe("INICIAR");
  });
});
