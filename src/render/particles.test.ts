import { describe, expect, test } from "vitest";
import { isParticleAlive, PARTICLE_COUNT, PARTICLE_LIFETIME_MS, particleFrame, spawnEatBurst } from "./particles";

const CELL = 100;

describe("spawnEatBurst (#115b)", () => {
  test("spawns the fixed particle count, all starting at the burst origin", () => {
    const burst = spawnEatBurst(50, 60, 0xff0000, CELL, 1000, () => 0.5);
    expect(burst.length).toBe(PARTICLE_COUNT);
    for (const p of burst) {
      expect(p.x).toBe(50);
      expect(p.y).toBe(60);
      expect(p.color).toBe(0xff0000);
      expect(p.startedAt).toBe(1000);
    }
  });

  test("particles fly outward in distinct directions (radial burst, not a clump)", () => {
    const burst = spawnEatBurst(0, 0, 0xffffff, CELL, 0, () => 0);
    const angles = burst.map((p) => Math.atan2(p.vy, p.vx));
    expect(new Set(angles.map((a) => a.toFixed(3))).size).toBe(PARTICLE_COUNT);
  });

  test("velocity magnitude scales with cell size within the documented band", () => {
    const burst = spawnEatBurst(0, 0, 0xffffff, CELL, 0, () => 0.5);
    for (const p of burst) {
      const speed = Math.hypot(p.vx, p.vy);
      expect(speed).toBeGreaterThanOrEqual(CELL * 0.9);
      expect(speed).toBeLessThanOrEqual(CELL * 1.5);
    }
  });
});

describe("isParticleAlive / particleFrame (#115b)", () => {
  const particle = spawnEatBurst(10, 20, 0xffffff, CELL, 1000, () => 0.5)[0]!;

  test("alive within the lifetime, dead at/after it", () => {
    expect(isParticleAlive(particle, 1000)).toBe(true);
    expect(isParticleAlive(particle, 1000 + PARTICLE_LIFETIME_MS - 1)).toBe(true);
    expect(isParticleAlive(particle, 1000 + PARTICLE_LIFETIME_MS)).toBe(false);
  });

  test("frame at t=0 sits at the origin with full alpha", () => {
    const frame = particleFrame(particle, 1000, CELL)!;
    expect(frame.x).toBe(10);
    expect(frame.y).toBe(20);
    expect(frame.alpha).toBe(1);
  });

  test("frame advances along the velocity and fades toward the end of life", () => {
    const half = particleFrame(particle, 1000 + PARTICLE_LIFETIME_MS / 2, CELL)!;
    expect(half.x).toBeCloseTo(10 + particle.vx * 0.5, 5);
    expect(half.y).toBeCloseTo(20 + particle.vy * 0.5, 5);
    expect(half.alpha).toBeCloseTo(0.5, 5);
    const late = particleFrame(particle, 1000 + PARTICLE_LIFETIME_MS * 0.9, CELL)!;
    expect(late.alpha).toBeLessThan(half.alpha);
    expect(late.radius).toBeLessThan(particleFrame(particle, 1000, CELL)!.radius);
  });

  test("returns null once expired (nothing left to draw)", () => {
    expect(particleFrame(particle, 1000 + PARTICLE_LIFETIME_MS, CELL)).toBeNull();
    expect(particleFrame(particle, 1000 + PARTICLE_LIFETIME_MS * 5, CELL)).toBeNull();
  });
});
