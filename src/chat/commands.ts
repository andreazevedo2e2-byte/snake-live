export type ChatCommand = "food" | "speed" | "none";

/** Whole words (not substrings) that trigger each command. Portuguese first
 * since the target audience is a Brazilian stream chat; English kept for
 * continuity with the original (English-only) behavior. Edit freely — this
 * is the single list callers should update, no parsing logic to touch. */
const SPEED_WORDS = ["velocidade", "veloz", "rapido", "acelera", "acelerar", "speed"];
const FOOD_WORDS = ["comida", "fruta", "adicionar", "food", "add"];

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function wordsOf(text: string): Set<string> {
  return new Set(stripAccents(text.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean));
}

/** Classifies a chat message into a command by whole-word match only — e.g.
 * "seafood" or "addiction" never trigger "food", and accents are ignored
 * ("rápido" and "rapido" both match). Speed takes precedence when a message
 * somehow contains both a speed and a food word. */
export function parseChatCommand(text: string): ChatCommand {
  const tokens = wordsOf(text);
  if (SPEED_WORDS.some((word) => tokens.has(word))) return "speed";
  if (FOOD_WORDS.some((word) => tokens.has(word))) return "food";
  return "none";
}
