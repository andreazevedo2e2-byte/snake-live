import { describe, test, expect } from "vitest";
import { normalize, DEFAULT_AVATAR_URL } from "./normalize";
import { isAllowed } from "./contentFilter";
import type { RawChatItem } from "./types";

function rawItem(overrides: Partial<RawChatItem> = {}): RawChatItem {
  return {
    id: "msg-1",
    author: { name: "Ana", channelId: "UC123" },
    message: [{ text: "hello there" }],
    isMembership: false,
    isModerator: false,
    isOwner: false,
    ...overrides,
  };
}

describe("normalize", () => {
  test("maps a plain text message to a ChatEvent", () => {
    const event = normalize(rawItem());
    expect(event).toEqual({
      id: "msg-1",
      authorName: "Ana",
      authorChannelId: "UC123",
      avatarUrl: DEFAULT_AVATAR_URL,
      text: "hello there",
      isMember: false,
      isMod: false,
      isOwner: false,
      superchat: undefined,
    });
  });

  test("uses the author's real avatar URL when present", () => {
    const event = normalize(
      rawItem({ author: { name: "Ana", channelId: "UC123", thumbnail: { url: "https://cdn/a.png" } } })
    );
    expect(event.avatarUrl).toBe("https://cdn/a.png");
  });

  test("concatenates multiple message runs (text + emoji) into one string", () => {
    const event = normalize(
      rawItem({ message: [{ text: "nice " }, { emojiText: ":fire:" }, { text: " play" }] })
    );
    expect(event.text).toBe("nice :fire: play");
  });

  test("maps a super chat with amount and color", () => {
    const event = normalize(rawItem({ superchat: { amount: "$5.00", color: "#ff0000" } }));
    expect(event.superchat).toEqual({ amount: "$5.00", color: "#ff0000" });
  });

  test("maps membership, moderator and owner flags", () => {
    const event = normalize(rawItem({ isMembership: true, isModerator: true, isOwner: true }));
    expect(event.isMember).toBe(true);
    expect(event.isMod).toBe(true);
    expect(event.isOwner).toBe(true);
  });
});

describe("isAllowed (content filter)", () => {
  test("allows a clean message", () => {
    const event = normalize(rawItem());
    expect(isAllowed(event)).toBe(true);
  });

  test("blocks a message whose text contains a blocked word", () => {
    const event = normalize(rawItem({ message: [{ text: "you are an idiot" }] }));
    expect(isAllowed(event)).toBe(false);
  });

  test("blocks a message whose author name contains a blocked word", () => {
    const event = normalize(rawItem({ author: { name: "idiot_99", channelId: "UC999" } }));
    expect(isAllowed(event)).toBe(false);
  });

  test("blocked-word matching is case-insensitive", () => {
    const event = normalize(rawItem({ message: [{ text: "IDIOT move" }] }));
    expect(isAllowed(event)).toBe(false);
  });
});
