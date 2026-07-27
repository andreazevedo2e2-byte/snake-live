import type { ChatEvent } from "./types";

/**
 * Minimal seed blocklist. Global YouTube chat is public and adversarial, so
 * this is deliberately conservative — it only needs to keep the worst stuff
 * off the live screen, not perform real moderation. Portuguese first since
 * the target audience is a Brazilian stream chat; English kept for
 * continuity with the original blocklist. Matched as whole words only (see
 * isAllowed) so short entries never false-positive on an innocent word that
 * merely contains them (e.g. "estupidamente" doesn't contain the word
 * "estupido" as a separate token).
 */
const BLOCKED_WORDS = [
  // English (original seed list)
  "idiot",
  "stupid",
  "fuck",
  "shit",
  "nigger",
  "retard",
  // Portuguese: heavy profanity (accents stripped before comparison, so only
  // the unaccented form needs listing — see stripAccents below)
  "caralho",
  "cacete",
  "porra",
  "merda",
  "buceta",
  "cuzao",
  "fdp",
  "fodase",
  "foda",
  "arrombado",
  "arrombada",
  "corno",
  "piranha",
  "puta",
  "putona",
  "vagabundo",
  "vagabunda",
  // Portuguese: slurs / heavy insults
  "viado",
  "bicha",
  "traveco",
  "macaco",
  "retardado",
  "mongoloide",
  "aleijado",
  "idiota",
  "imbecil",
  "estupido",
  "otario",
];

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function wordsOf(text: string): Set<string> {
  return new Set(stripAccents(text.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean));
}

export function isAllowed(event: ChatEvent): boolean {
  const tokens = wordsOf(`${event.authorName} ${event.text}`);
  return !BLOCKED_WORDS.some((word) => tokens.has(stripAccents(word.toLowerCase())));
}
