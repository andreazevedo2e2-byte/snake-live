/**
 * Degrees of hue advanced per segment of growth. Slow enough that the color
 * shift reads as a gradual mood change, not a strobe.
 */
const DEGREES_PER_SEGMENT = 9;

export function hueForLength(length: number, startLength: number): number {
  const grown = Math.max(0, length - startLength);
  return (grown * DEGREES_PER_SEGMENT) % 360;
}
