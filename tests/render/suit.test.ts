import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, describe, expect, it } from "vitest";
import { createSuitedFigure, type Gait } from "../../src/render/figures/suit";

let engine: NullEngine | null = null;
afterEach(() => engine?.dispose());

const make = (height?: number) => {
  engine = new NullEngine();
  const scene = new Scene(engine);
  const figure = createSuitedFigure(scene, {
    name: "cooper",
    fabric: new Color3(0.85, 0.85, 0.82),
    accent: new Color3(0.9, 0.5, 0.1),
    ...(height === undefined ? {} : { height }),
  });
  return { scene, figure };
};
/** World-space bounds of a mesh after placing the figure (no camera needed). */
const bounds = (scene: Scene, name: string) => {
  const m = scene.getMeshByName(name)!;
  m.computeWorldMatrix(true);
  m.refreshBoundingInfo({});
  return m.getBoundingInfo().boundingBox;
};
const run = (f: ReturnType<typeof make>["figure"], seconds: number, gait: Gait) => {
  for (let t = 0; t < seconds; t += 1 / 60) f.update(1 / 60, gait);
};

describe("suited figure (CHAR-001, D-15)", () => {
  it("is a person in a suit: helmet with a visor, backpack, a chest panel, two arms and two legs", () => {
    const { scene, figure } = make();
    const names = scene.meshes.map((m) => m.name);
    for (const part of [
      "helmet",
      "visorGlass",
      "pack",
      "chest",
      "upperArm-1",
      "upperArm1",
      "thigh-1",
      "thigh1",
      "boot-1",
      "boot1",
    ]) {
      expect(names).toContain(`cooper.${part}`);
    }
    expect(figure.visor.name).toBe("cooper.visorGlass");
    // Feet rest on the ground when standing: boot soles at y = 0 (within a centimetre).
    figure.update(0, { speed: 0 });
    const sole = bounds(scene, "cooper.boot1").minimumWorld.y;
    expect(Math.abs(sole)).toBeLessThan(0.03);
  });

  it("scales with the requested height", () => {
    const tall = make(2.0);
    tall.figure.update(0, { speed: 0 });
    const topTall = bounds(tall.scene, "cooper.helmet").maximumWorld.y;
    engine?.dispose();
    const short = make(1.6);
    short.figure.update(0, { speed: 0 });
    const topShort = bounds(short.scene, "cooper.helmet").maximumWorld.y;
    expect(topTall).toBeGreaterThan(topShort);
    expect(topTall / topShort).toBeCloseTo(2.0 / 1.6, 1);
  });

  it("stands still at speed 0, and legs and arms swing in opposition when walking", () => {
    const { figure } = make();
    run(figure, 1, { speed: 0 });
    expect(Math.abs(figure.joints.hipL.rotation.x)).toBeLessThan(1e-6);
    run(figure, 1, { speed: 1 });
    let opposed = 0;
    for (let i = 0; i < 120; i++) {
      figure.update(1 / 60, { speed: 1 });
      const l = figure.joints.hipL.rotation.x;
      const r = figure.joints.hipR.rotation.x;
      if (Math.abs(l) > 0.05) expect(Math.sign(l)).toBe(-Math.sign(r));
      // each arm swings against the leg on its side
      if (Math.abs(l) > 0.2) expect(Math.sign(figure.joints.shoulderL.rotation.x - 0.05)).toBe(-Math.sign(l));
      opposed++;
    }
    expect(opposed).toBe(120);
  });

  it("wading is slower and higher-stepped than walking (heavy gravity, FR-22)", () => {
    const measure = (wading: boolean) => {
      const { figure } = make();
      run(figure, 1, { speed: 1, wading });
      let crossings = 0;
      let maxKnee = 0;
      let prev = figure.joints.hipL.rotation.x;
      for (let i = 0; i < 600; i++) {
        figure.update(1 / 60, { speed: 1, wading });
        const x = figure.joints.hipL.rotation.x;
        if (prev < 0 && x >= 0) crossings++;
        prev = x;
        maxKnee = Math.max(maxKnee, figure.joints.kneeL.rotation.x, figure.joints.kneeR.rotation.x);
      }
      engine?.dispose();
      return { strides: crossings / 10, maxKnee }; // strides per second over 10 s
    };
    const walk = measure(false);
    const wade = measure(true);
    expect(wade.strides).toBeLessThan(walk.strides * 0.8);
    expect(wade.maxKnee).toBeGreaterThan(walk.maxKnee);
  });

  it("disposes everything it made", () => {
    const { scene, figure } = make();
    expect(scene.meshes.length).toBeGreaterThan(20);
    figure.dispose();
    expect(scene.meshes.filter((m) => m.name.startsWith("cooper."))).toHaveLength(0);
  });
});
