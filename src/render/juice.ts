import type { Vec2 } from "../game/types";

/** v3.1 "juice" (André: o jogo tem que ser viciante DE ASSISTIR): the pure
 * math behind the attention-grabbing effects — screen shake, spawn pop,
 * head squash, floating score text and victory confetti. Same split as
 * particles.ts: numbers here (unit-testable in Node), PixiJS drawing in
 * BoardRenderer. All effects are driven by elapsed time so they stay smooth
 * at any frame rate and cost nothing when idle. */

export const SHAKE_DURATION_MS = 160;
export const SHAKE_AMPLITUDE_PX = 5;

/** Board offset for the eat screen-shake: a decaying sine wobble. Returns
 * {0,0} once expired (and for negative elapsed — clock skew safety). */
export function shakeOffset(elapsedMs: number, seed = 0): Vec2 {
  if (elapsedMs < 0 || elapsedMs >= SHAKE_DURATION_MS) return { x: 0, y: 0 };
  const t = elapsedMs / SHAKE_DURATION_MS;
  const falloff = (1 - t) * (1 - t);
  const angle = seed + elapsedMs * 0.13;
  return {
    x: Math.sin(angle * 2.3) * SHAKE_AMPLITUDE_PX * falloff,
    y: Math.cos(angle * 1.7) * SHAKE_AMPLITUDE_PX * falloff,
  };
}

export const SPAWN_POP_MS = 240;

/** Scale for a food sprite that just appeared: overshoots slightly past 1
 * then settles (pop-in). 1 exactly once the window has elapsed. */
export function spawnPopScale(elapsedMs: number): number {
  if (elapsedMs >= SPAWN_POP_MS) return 1;
  if (elapsedMs < 0) return 0;
  const t = elapsedMs / SPAWN_POP_MS;
  // Ease-out-back: starts at 0, overshoots to ~1.1 around t=0.6, ends at 1.
  // Clamped at 0 — the raw polynomial dips a hair below zero at t=0 from
  // floating-point error, and a sprite scale must never go negative.
  const c = 1.70158;
  const p = t - 1;
  return Math.max(0, 1 + p * p * ((c + 1) * p + c));
}

export const HEAD_SQUASH_MS = 180;

/** Head scale multiplier right after eating: bulges up to ~1.35 then relaxes
 * back to 1 — the classic "gulp". */
export function headSquashScale(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= HEAD_SQUASH_MS) return 1;
  const t = elapsedMs / HEAD_SQUASH_MS;
  return 1 + 0.35 * Math.sin(Math.PI * t);
}

export const FLOAT_TEXT_MS = 650;
export const FLOAT_TEXT_RISE_PX = 46;

/** Position offset + alpha for the floating "+1" above the head after
 * eating: rises and fades. Null once done. */
export function floatingTextFrame(elapsedMs: number): { dy: number; alpha: number } | null {
  if (elapsedMs < 0 || elapsedMs >= FLOAT_TEXT_MS) return null;
  const t = elapsedMs / FLOAT_TEXT_MS;
  const eased = 1 - (1 - t) * (1 - t);
  return { dy: -FLOAT_TEXT_RISE_PX * eased, alpha: 1 - t * t };
}

export interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  spin: number;
  startedAt: number;
}

export const CONFETTI_LIFETIME_MS = 1600;
export const CONFETTI_COUNT = 42;
const CONFETTI_COLORS = [0xffd33c, 0xbefc58, 0x72f6d1, 0x89f7ff, 0xff5a8a, 0xffffff];

/** Victory confetti: pieces launch upward in a fan and fall under gravity. */
export function spawnConfetti(
  cx: number,
  cy: number,
  spreadPx: number,
  now: number,
  rng: () => number = Math.random,
): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const angle = -Math.PI / 2 + (rng() - 0.5) * Math.PI * 0.9;
    const speed = spreadPx * (0.5 + rng() * 0.9);
    pieces.push({
      x: cx + (rng() - 0.5) * spreadPx * 0.4,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: CONFETTI_COLORS[Math.floor(rng() * CONFETTI_COLORS.length) % CONFETTI_COLORS.length]!,
      spin: (rng() - 0.5) * 10,
      startedAt: now,
    });
  }
  return pieces;
}

/** Where/how to draw one confetti piece at `now`; gravity pulls it down over
 * its lifetime, alpha fades in the last third. Null once expired. */
export function confettiFrame(
  piece: ConfettiPiece,
  now: number,
  gravityPx: number,
): { x: number; y: number; rotation: number; alpha: number } | null {
  const t = (now - piece.startedAt) / CONFETTI_LIFETIME_MS;
  if (t >= 1 || t < 0) return null;
  return {
    x: piece.x + piece.vx * t,
    y: piece.y + piece.vy * t + gravityPx * t * t,
    rotation: piece.spin * t,
    alpha: t < 0.66 ? 1 : 1 - (t - 0.66) / 0.34,
  };
}
