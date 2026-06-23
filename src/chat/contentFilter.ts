import type { ChatEvent } from "./types";

/**
 * Minimal seed blocklist. Global YouTube chat is public and adversarial, so
 * this is deliberately conservative — it only needs to keep the worst stuff
 * off the live screen, not perform real moderation.
 */
const BLOCKED_WORDS = ["idiot", "stupid", "fuck", "shit", "nigger", "retard"];

export function isAllowed(event: ChatEvent): boolean {
  const haystack = `${event.authorName} ${event.text}`.toLowerCase();
  return !BLOCKED_WORDS.some((word) => haystack.includes(word));
}
