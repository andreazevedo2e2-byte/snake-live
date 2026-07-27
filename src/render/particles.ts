/** #115(b) pure core, exported for tests: the eat-burst particle math,
 * kept free of PixiJS so it can be unit-tested in Node (same pattern as
 * shallowEqual in HudRenderer and animateVictoryContext in ScreensRenderer —
 * the Graphics drawing stays in BoardRenderer, the numbers live here). */

export interface EatParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  startedAt: number;
}

export const PARTICLE_LIFETIME_MS = 300;
export const PARTICLE_COUNT = 8;

/** Spawns a radial burst around (cx, cy). `rng` injects randomness so tests
 * can pin it; velocities are in pixels per lifetime (position = origin +
 * v·t with t in 0..1). */
export function spawnEatBurst(
  cx: number,
  cy: number,
  color: number,
  cellSize: number,
  now: number,
  rng: () => number = Math.random,
): EatParticle[] {
  const particles: EatParticle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + rng() * 0.4;
    const speed = cellSize * (0.9 + rng() * 0.6);
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      startedAt: now,
    });
  }
  return particles;
}

/** True while the particle should still be drawn. */
export function isParticleAlive(particle: EatParticle, now: number): boolean {
  return now - particle.startedAt < PARTICLE_LIFETIME_MS;
}

/** Where and how to draw one particle at time `now`: position advances
 * linearly along its velocity, alpha fades linearly to 0, radius shrinks to
 * half. Returns null once expired. */
export function particleFrame(
  particle: EatParticle,
  now: number,
  cellSize: number,
): { x: number; y: number; alpha: number; radius: number } | null {
  const t = (now - particle.startedAt) / PARTICLE_LIFETIME_MS;
  if (t >= 1 || t < 0) return null;
  return {
    x: particle.x + particle.vx * t,
    y: particle.y + particle.vy * t,
    alpha: 1 - t,
    radius: Math.max(0.5, cellSize * 0.09 * (1 - t * 0.5)),
  };
}
