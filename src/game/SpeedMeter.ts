export const MIN_MULTIPLIER = 1.6;
export const MAX_MULTIPLIER = 6;
const MAX_CHARGE = 30;
const CHARGE_PER_COMMENT = 3;
const DECAY_PER_SECOND = 1.5;

export interface SpeedMeterState {
  charge: number; // 0..MAX_CHARGE
  multiplier: number; // derived, MIN_MULTIPLIER..MAX_MULTIPLIER
}

function multiplierForCharge(charge: number): number {
  const ratio = charge / MAX_CHARGE;
  return MIN_MULTIPLIER + (MAX_MULTIPLIER - MIN_MULTIPLIER) * ratio;
}

export function createSpeedMeter(): SpeedMeterState {
  return { charge: 0, multiplier: MIN_MULTIPLIER };
}

export function addComment(state: SpeedMeterState): SpeedMeterState {
  const charge = Math.min(MAX_CHARGE, state.charge + CHARGE_PER_COMMENT);
  return { charge, multiplier: multiplierForCharge(charge) };
}

export function decay(state: SpeedMeterState, dtSeconds: number): SpeedMeterState {
  const charge = Math.max(0, state.charge - DECAY_PER_SECOND * dtSeconds);
  return { charge, multiplier: multiplierForCharge(charge) };
}
