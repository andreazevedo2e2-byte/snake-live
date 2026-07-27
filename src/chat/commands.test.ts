import { describe, expect, test } from "vitest";
import { parseChatCommand } from "./commands";

describe("parseChatCommand", () => {
  test.each([
    ["comida", "food"],
    ["Comida!", "food"],
    ["fruta", "food"],
    ["adicionar", "food"],
    ["food", "food"],
    ["add", "food"],
    ["velocidade", "speed"],
    ["veloz", "speed"],
    ["rapido", "speed"],
    ["rápido", "speed"],
    ["acelera", "speed"],
    ["acelerar", "speed"],
    ["speed", "speed"],
    ["oi gente tudo bem?", "none"],
    ["", "none"],
  ] as const)("%s -> %s", (text, expected) => {
    expect(parseChatCommand(text)).toBe(expected);
  });

  test("matches whole words even surrounded by punctuation", () => {
    expect(parseChatCommand("manda comida! por favor")).toBe("food");
    expect(parseChatCommand(">>> velocidade <<<")).toBe("speed");
  });

  test("does not trigger on substrings that merely contain a command word", () => {
    expect(parseChatCommand("seafood é bom")).toBe("none");
    expect(parseChatCommand("addiction is bad")).toBe("none");
    expect(parseChatCommand("velocidadee")).toBe("none");
    expect(parseChatCommand("frutaria")).toBe("none");
  });

  test("is case-insensitive and accent-insensitive", () => {
    expect(parseChatCommand("COMIDA")).toBe("food");
    expect(parseChatCommand("RÁPIDO")).toBe("speed");
  });

  test("speed takes precedence when a message contains both a speed and a food word", () => {
    expect(parseChatCommand("comida e velocidade por favor")).toBe("speed");
  });
});
