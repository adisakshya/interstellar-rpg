import { describe, expect, it } from "vitest";
import { gaitSpeed, MILLER_GRAVITY, MOVEMENT, stepVelocity, type Velocity } from "../../src/render/movement";

const run = (profile: (typeof MOVEMENT)["miller"], input: Velocity, seconds: number): Velocity => {
  let v: Velocity = { x: 0, y: 0 };
  for (let t = 0; t < seconds; t += 1 / 60) v = stepVelocity(v, input, profile, 1 / 60);
  return v;
};
const speed = (v: Velocity) => Math.hypot(v.x, v.y);

describe("movement on Miller and on Endurance (MOVE-001, FR-22)", () => {
  it("is 1.3 g on Miller and Earth-normal on Endurance", () => {
    expect(MOVEMENT.miller.gravity).toBe(MILLER_GRAVITY);
    expect(MILLER_GRAVITY).toBe(1.3);
    expect(MOVEMENT.endurance.gravity).toBe(1);
  });

  it("starts sluggishly on Miller and briskly on Endurance", () => {
    const miller = speed(run(MOVEMENT.miller, { x: 0, y: 1 }, 0.5)) / MOVEMENT.miller.topSpeed;
    const endurance = speed(run(MOVEMENT.endurance, { x: 0, y: 1 }, 0.5)) / MOVEMENT.endurance.topSpeed;
    expect(miller).toBeLessThan(0.7);
    expect(endurance).toBeGreaterThan(0.95);
  });

  it("has a lower top speed on Miller than on Endurance, and reaches but never exceeds it", () => {
    expect(MOVEMENT.miller.topSpeed).toBeLessThan(MOVEMENT.endurance.topSpeed);
    for (const key of ["miller", "endurance"] as const) {
      const p = MOVEMENT[key];
      const v = run(p, { x: 1, y: 0 }, 10);
      expect(speed(v)).toBeLessThanOrEqual(p.topSpeed + 1e-9);
      expect(speed(v)).toBeGreaterThan(p.topSpeed * 0.99);
    }
  });

  it("makes diagonals no faster than straight lines, and ignores stick values beyond 1", () => {
    const p = MOVEMENT.miller;
    expect(speed(run(p, { x: 1, y: 1 }, 10))).toBeLessThanOrEqual(p.topSpeed + 1e-9);
    expect(speed(run(p, { x: 5, y: 0 }, 10))).toBeLessThanOrEqual(p.topSpeed + 1e-9);
  });

  it("slows to a stop gradually under the same heavy response", () => {
    const p = MOVEMENT.miller;
    let v = run(p, { x: 0, y: 1 }, 10);
    v = stepVelocity(v, { x: 0, y: 0 }, p, 0.25);
    expect(speed(v)).toBeGreaterThan(p.topSpeed * 0.5); // still moving a quarter second after letting go
    for (let t = 0; t < 5; t += 1 / 60) v = stepVelocity(v, { x: 0, y: 0 }, p, 1 / 60);
    expect(speed(v)).toBeLessThan(0.01);
  });

  it("wades on Miller only, and never jumps", () => {
    expect(MOVEMENT.miller.wading).toBe(true);
    expect(MOVEMENT.endurance.wading).toBe(false);
    expect(MOVEMENT.miller.canJump).toBe(false);
    expect(MOVEMENT.endurance.canJump).toBe(false);
  });

  it("reports gait speed from 0 to 1", () => {
    expect(gaitSpeed({ x: 0, y: 0 }, MOVEMENT.miller)).toBe(0);
    expect(gaitSpeed({ x: 0, y: MOVEMENT.miller.topSpeed }, MOVEMENT.miller)).toBe(1);
    expect(gaitSpeed({ x: 9, y: 9 }, MOVEMENT.miller)).toBe(1);
  });

  it("is presentation only: the module imports nothing from the game domain", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../src/render/movement.ts", import.meta.url), "utf8"),
    );
    expect(src).not.toMatch(/from\s+["'].*domain/);
  });
});
