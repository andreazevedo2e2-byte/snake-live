export const MIN_MULTIPLIER = 1;
export const MAX_MULTIPLIER = 12;
/** Hard ceiling for the product speed.multiplier × config.baseSpeedMultiplier.
 * v3.4: raised 6 → 12. At 12x the tick interval is 420/12 = 35 ms; measured
 * AI decision time stays well under that on every board (avg <1 ms, and even
 * the heaviest flag-size boards spike only rarely near the budget, which is
 * self-correcting — a slow tick only delays itself, never the whole loop).
 * The snake animation floor was lowered to 30 ms (see BoardRenderer) so the
 * motion still finishes between ticks instead of blurring. */
export const MAX_EFFECTIVE_SPEED = 12;

/** Returns the effective tick speed after applying the ceiling. */
export function cappedEffectiveSpeed(chatMultiplier: number, baseMultiplier: number): number {
  return Math.min(chatMultiplier * baseMultiplier, MAX_EFFECTIVE_SPEED);
}
// v3.4: 110 comments to max the bar (was 50), keeping the +0.1x-per-comment
// feel while letting chat drive all the way to 12x — so peak speed stays a
// rare, earned moment rather than something a handful of messages triggers.
const MAX_CHARGE = 110;
const CHARGE_PER_COMMENT = 1;
// The HUD says "MORE CHAT = FASTER" — every allowed comment should nudge the
// bar, not just ones that happen to say "speed". Smaller than the dedicated
// command's bump so typing the actual word still visibly matters more.
const PASSIVE_CHARGE_PER_COMMENT = 0.3;

export interface SpeedMeterState {
  charge: number; // 0..MAX_CHARGE
  multiplier: number; // derived, MIN_MULTIPLIER..MAX_MULTIPLIER
}

function multiplierForCharge(charge: number): number {
  return Math.min(MAX_MULTIPLIER, MIN_MULTIPLIER + charge * 0.1);
}

function chargeForMultiplier(multiplier: number): number {
  if (multiplier <= MIN_MULTIPLIER) return 0;
  return Math.min(MAX_CHARGE, Math.round((multiplier - MIN_MULTIPLIER) / 0.1));
}

export function createSpeedMeter(initialMultiplier = MIN_MULTIPLIER): SpeedMeterState {
  const multiplier = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, initialMultiplier));
  return { charge: chargeForMultiplier(multiplier), multiplier };
}

export function addComment(state: SpeedMeterState, isLocked = false): SpeedMeterState {
  if (isLocked) return state;
  const charge = Math.min(MAX_CHARGE, state.charge + CHARGE_PER_COMMENT);
  return { charge, multiplier: multiplierForCharge(charge) };
}

/** Any allowed chat message that isn't the dedicated "speed" command still
 * nudges the bar a little — matches the HUD's "MORE CHAT = FASTER" text,
 * which previously only the literal word "speed" made true. */
export function addPassiveComment(state: SpeedMeterState, isLocked = false): SpeedMeterState {
  if (isLocked) return state;
  const charge = Math.min(MAX_CHARGE, state.charge + PASSIVE_CHARGE_PER_COMMENT);
  return { charge, multiplier: multiplierForCharge(charge) };
}

export function decay(state: SpeedMeterState, dtSeconds: number): SpeedMeterState {
  void dtSeconds;
  return state;
}
