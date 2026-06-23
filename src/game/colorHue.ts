/**
 * Degrees of hue advanced per segment of growth. Slow enough that the color
 * shift reads as a gradual mood change, not a strobe.
 */
const DEGREES_PER_SEGMENT = 9;

export function hueForLength(length: number, startLength: number): number {
  const grown = Math.max(0, length - startLength);
  return (grown * DEGREES_PER_SEGMENT) % 360;
}

/**
 * Eases `current` toward `target` by fraction `t`, taking the SHORTER way
 * around the hue circle. Without this, a naive lerp sweeps backward through
 * every color when the target wraps past 360° (e.g. 350 -> 10 would crawl
 * 350→180→10 instead of 350→0→10), causing a jarring reverse-rainbow flash.
 */
export function lerpHue(current: number, target: number, t: number): number {
  let delta = ((target - current + 540) % 360) - 180; // shortest signed arc, in (-180, 180]
  const next = current + delta * t;
  return ((next % 360) + 360) % 360;
}
