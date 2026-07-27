export const MIN_MULTIPLIER = 1;
export const MAX_MULTIPLIER = 6;
/** Hard ceiling for the product speed.multiplier × config.baseSpeedMultiplier.
 * Above this the tick interval drops below ~70 ms — faster than the snake
 * animation's minimum frame time, making the game an unreadable blur. */
export const MAX_EFFECTIVE_SPEED = 6;

/** Returns the effective tick speed after applying the ceiling. */
export function cappedEffectiveSpeed(chatMultiplier: number, baseMultiplier: number): number {
  return Math.min(chatMultiplier * baseMultiplier, MAX_EFFECTIVE_SPEED);
}
const MAX_CHARGE = 50;
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
