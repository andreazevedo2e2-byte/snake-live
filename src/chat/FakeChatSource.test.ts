import { describe, test, expect } from "vitest";
import { nextFakeChatEvent } from "./FakeChatSource";

describe("nextFakeChatEvent", () => {
  test("returns a well-formed chat event", () => {
    const event = nextFakeChatEvent(0);
    expect(event.id).toBeTruthy();
    expect(event.authorName).toBeTruthy();
    expect(event.avatarUrl).toBeTruthy();
    expect(event.text).toBeTruthy();
  });

  test("is deterministic for the same index", () => {
    expect(nextFakeChatEvent(3)).toEqual(nextFakeChatEvent(3));
  });

  test("cycles through multiple distinct authors", () => {
    const names = new Set(Array.from({ length: 12 }, (_, i) => nextFakeChatEvent(i).authorName));
    expect(names.size).toBeGreaterThan(1);
  });

  test("marks a member at a predictable cadence", () => {
    const members = Array.from({ length: 20 }, (_, i) => nextFakeChatEvent(i)).filter(
      (e) => e.isMember
    );
    expect(members.length).toBeGreaterThan(0);
  });

  test("includes an occasional super chat to exercise the Phase 2 schema", () => {
    const superchats = Array.from({ length: 30 }, (_, i) => nextFakeChatEvent(i)).filter(
      (e) => e.superchat !== undefined
    );
    expect(superchats.length).toBeGreaterThan(0);
    expect(superchats[0]!.superchat).toHaveProperty("amount");
    expect(superchats[0]!.superchat).toHaveProperty("color");
  });
});
