import { describe, expect, test } from "vitest";
import { isAllowed } from "./contentFilter";
import type { ChatEvent } from "./types";

function event(text: string, authorName = "Viewer"): ChatEvent {
  return {
    id: "1",
    authorName,
    authorChannelId: "channel-1",
    avatarUrl: "https://example.com/a.png",
    text,
    isMember: false,
    isMod: false,
    isOwner: false,
  };
}

describe("isAllowed", () => {
  test.each([
    "caralho",
    "cacete",
    "porra",
    "merda",
    "buceta",
    "cuzao",
    "cuzão",
    "fdp",
    "foda-se",
    "foda",
    "arrombado",
    "corno",
    "piranha",
    "puta",
    "vagabundo",
    "viado",
    "bicha",
    "traveco",
    "retardado",
    "mongoloide",
    "aleijado",
    "idiota",
    "imbecil",
    "estupido",
    "estúpido",
    "otario",
    "otário",
  ])("blocks Portuguese heavy word/slur: %s", (word) => {
    expect(isAllowed(event(`voce e um ${word} mesmo`))).toBe(false);
  });

  test.each(["idiot", "stupid", "fuck", "shit", "nigger", "retard"])(
    "blocks original English seed word: %s",
    (word) => {
      expect(isAllowed(event(`you are so ${word}`))).toBe(false);
    },
  );

  test("blocks a blocked word appearing in the author name, not just the text", () => {
    expect(isAllowed(event("oi gente", "puta merda"))).toBe(false);
  });

  test("is case-insensitive and accent-insensitive", () => {
    expect(isAllowed(event("CARALHO"))).toBe(false);
    expect(isAllowed(event("ESTÚPIDO"))).toBe(false);
  });

  test.each([
    "innocent message about the game",
    "essa cobra e rapida demais",
    "gostei muito dessa fase",
    "estupidamente rápido esse jogo", // contains "estupid..." as a prefix, not the whole word
    "otariozinho não é a mesma palavra", // contains "otario" as a prefix only
  ])("allows innocent message: %s", (text) => {
    expect(isAllowed(event(text))).toBe(true);
  });
});
