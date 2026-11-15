import { existsSync, statSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { afterEach, describe, expect, it } from "vitest";
import { addSky, TIERS } from "../../src/render";

let engine: NullEngine | null = null;
afterEach(() => engine?.dispose());

describe("Gargantua sky (GARG-001, D-16)", () => {
  it("is an inside-out dome that follows the camera, ignores fog and lighting, and can be placed", () => {
    engine = new NullEngine();
    const scene = new Scene(engine);
    const fake = (_url: string, s: Scene) => new RawTexture(new Uint8Array(4), 1, 1, 5, s);
    const dome = addSky(scene, "sky/test.webp", { yawDeg: 90, pitchDeg: 14 }, fake);
    expect(dome.infiniteDistance).toBe(true);
    expect(dome.isPickable).toBe(false);
    expect(dome.rotation.y).toBeCloseTo(Math.PI / 2, 10);
    expect(dome.rotation.x).toBeCloseTo((-14 * Math.PI) / 180, 10);
    const mat = dome.material as unknown as { disableLighting: boolean; fogEnabled: boolean; emissiveTexture: unknown };
    expect(mat.disableLighting).toBe(true);
    expect(mat.fogEnabled).toBe(false);
    expect(mat.emissiveTexture).toBeTruthy();
  });

  it("uses the tier's image, and the baked files exist within the download budgets (ART_DIRECTION §8, D-23)", () => {
    expect(TIERS.low.skyFile).toBe("sky/gargantua-low.webp");
    expect(TIERS.high.skyFile).toBe("sky/gargantua-high.webp");
    const size = (tier: "low" | "high") => {
      const path = new URL(`../../public/${TIERS[tier].skyFile}`, import.meta.url);
      expect(existsSync(path)).toBe(true);
      return statSync(path).size;
    };
    expect(size("low")).toBeLessThanOrEqual(1 * 1024 * 1024);
    expect(size("high")).toBeLessThanOrEqual(3 * 1024 * 1024);
  });
});
