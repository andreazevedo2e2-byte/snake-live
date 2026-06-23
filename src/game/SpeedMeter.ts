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

export function createSpeedMeter(): SpeedMeterState {
  return { charge: 0, multiplier: MIN_MULTIPLIER };
}

export function addComment(state: SpeedMeterState): SpeedMeterState {
  const charge = Math.min(MAX_CHARGE, state.charge + CHARGE_PER_COMMENT);
  return { charge, multiplier: multiplierForCharge(charge) };
}

export function decay(state: SpeedMeterState, dtSeconds: number): SpeedMeterState {
  void dtSeconds;
  return state;
}
