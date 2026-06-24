export const MIN_MULTIPLIER = 1;
export const MAX_MULTIPLIER = 6;
const MAX_CHARGE = 50;
const CHARGE_PER_COMMENT = 1;

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

export function decay(state: SpeedMeterState, dtSeconds: number): SpeedMeterState {
  void dtSeconds;
  return state;
}
