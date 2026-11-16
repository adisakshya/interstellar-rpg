import { describe, expect, it } from "vitest";
import { ageKey, enduranceAge, MAX_LOGBOOKS, MAX_TALLIES, YEAR } from "../../src/render/scenes/endurance-age";

describe("the room shows how long Romilly has waited (SCENE-004)", () => {
  it("is clean at the start and gets a mark for every full year", () => {
    const start = enduranceAge(0);
    expect(start).toMatchObject({ tallies: 0, dust: 0, plant: 0, logbooks: 0 });
    expect(enduranceAge(3.9 * YEAR).tallies).toBe(3);
    expect(enduranceAge(12.2 * YEAR).tallies).toBe(12);
  });

  it("gets dustier, the plant grows and logbooks pile up, each capped", () => {
    const a = enduranceAge(5 * YEAR);
    const b = enduranceAge(15 * YEAR);
    const c = enduranceAge(500 * YEAR);
    expect(b.dust).toBeGreaterThan(a.dust);
    expect(b.plant).toBeGreaterThan(a.plant);
    expect(b.logbooks).toBeGreaterThan(a.logbooks);
    expect(c.dust).toBe(1);
    expect(c.plant).toBe(1);
    expect(c.tallies).toBe(MAX_TALLIES);
    expect(c.logbooks).toBe(MAX_LOGBOOKS);
  });

  it("never goes backwards for a negative clock, and rebuilds only when something visible changes", () => {
    expect(enduranceAge(-10).years).toBe(0);
    expect(ageKey(enduranceAge(3.1 * YEAR))).toBe(ageKey(enduranceAge(3.2 * YEAR)));
    expect(ageKey(enduranceAge(3.1 * YEAR))).not.toBe(ageKey(enduranceAge(4.1 * YEAR)));
  });
});
