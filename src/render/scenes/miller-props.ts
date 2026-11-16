// What stands on Miller's flooded plain (SCENE-002): the Ranger, the beacon, the half-sunk wreck, the water's glint and
// the rings around wading feet. All of it is built in code from boxes and cylinders (D-17): lit, fogged and placed
// carefully, not detailed. Nothing here reads game state; the scene decides where things go.
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";

const metal = (scene: Scene, name: string, color: Color3, emissive?: Color3): StandardMaterial => {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(0.35, 0.3, 0.26);
  m.specularPower = 24;
  if (emissive) m.emissiveColor = emissive;
  return m;
};

const part = (mesh: Mesh, parent: TransformNode, mat: StandardMaterial, at: Vector3): Mesh => {
  mesh.material = mat;
  mesh.parent = parent;
  mesh.position = at;
  return mesh;
};

/**
 * The Ranger standing on its legs in the water: a blunt fuselage, a cockpit window that glows amber, two engine pods and
 * four legs whose feet are below the surface. Dark grey, scuffed, cramped (ART_DIRECTION palette).
 */
export function createRanger(scene: Scene, at: Vector3, yaw: number): TransformNode {
  const root = new TransformNode("ranger", scene);
  root.position = at;
  root.rotation.y = yaw;
  const hull = metal(scene, "rangerHull", new Color3(0.6, 0.62, 0.68));
  const dark = metal(scene, "rangerDark", new Color3(0.16, 0.17, 0.19));
  const glass = metal(scene, "rangerGlass", new Color3(0.05, 0.05, 0.05), new Color3(0.9, 0.55, 0.18));

  part(CreateBox("ranger.body", { width: 3.2, height: 2.2, depth: 6.4 }, scene), root, hull, new Vector3(0, 3.1, 0));
  part(CreateBox("ranger.nose", { width: 2.4, height: 1.5, depth: 1.8 }, scene), root, hull, new Vector3(0, 2.9, 3.9));
  part(
    CreateBox("ranger.window", { width: 1.8, height: 0.55, depth: 0.12 }, scene),
    root,
    glass,
    new Vector3(0, 3.35, 4.85),
  );
  part(
    CreateBox("ranger.dorsal", { width: 1.2, height: 0.5, depth: 3.6 }, scene),
    root,
    dark,
    new Vector3(0, 4.45, -0.4),
  );
  for (const side of [-1, 1]) {
    const pod = CreateCylinder("ranger.engine", { diameter: 1.1, height: 3.2, tessellation: 12 }, scene);
    pod.rotation.x = Math.PI / 2;
    part(pod, root, dark, new Vector3(side * 2.1, 3.0, -1.6));
    for (const z of [-2, 2]) {
      const leg = CreateCylinder("ranger.leg", { diameter: 0.28, height: 3.6, tessellation: 8 }, scene);
      leg.rotation.z = side * 0.28;
      part(leg, root, dark, new Vector3(side * 1.85, 1.2, z));
      part(
        CreateBox("ranger.foot", { width: 0.9, height: 0.12, depth: 1.1 }, scene),
        root,
        dark,
        new Vector3(side * 2.35, -0.55, z),
      );
    }
  }
  return root;
}

/**
 * The beacon: a thin mast on a small base with a light that pulses amber, slowly, so it reads as a live signal from far
 * off. `update(t)` takes seconds.
 */
export function createBeacon(scene: Scene, at: Vector3): { root: TransformNode; update(t: number): void } {
  const root = new TransformNode("beacon", scene);
  root.position = at;
  const frame = metal(scene, "beaconFrame", new Color3(0.28, 0.29, 0.3));
  part(
    CreateCylinder("beacon.base", { diameter: 1.4, height: 0.5, tessellation: 10 }, scene),
    root,
    frame,
    new Vector3(0, 0, 0),
  );
  part(
    CreateCylinder("beacon.mast", { diameterTop: 0.08, diameterBottom: 0.16, height: 5.2, tessellation: 8 }, scene),
    root,
    frame,
    new Vector3(0, 2.6, 0),
  );
  const lampMat = metal(scene, "beaconLamp", new Color3(0.2, 0.1, 0.03), new Color3(1, 0.62, 0.2));
  lampMat.fogEnabled = false; // a lamp stays visible through the haze
  const lamp = part(
    CreateSphere("beacon.lamp", { diameter: 0.5, segments: 8 }, scene),
    root,
    lampMat,
    new Vector3(0, 5.4, 0),
  );
  return {
    root,
    update(t) {
      const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.2));
      lampMat.emissiveColor.set(1 * pulse, 0.62 * pulse, 0.2 * pulse);
      lamp.scaling.setAll(0.8 + 0.3 * pulse);
    },
  };
}

/**
 * The wreck of Miller's lander: a split hull lying on its side with one wing-plate standing, half under the water.
 * Rust brown, weathered, lit from behind by the sky.
 */
export function createWreck(scene: Scene, at: Vector3, yaw: number): TransformNode {
  const root = new TransformNode("wreck", scene);
  root.position = at;
  root.rotation.y = yaw;
  root.scaling.setAll(1.3);
  const rust = metal(scene, "wreckRust", new Color3(0.45, 0.25, 0.13));
  const plate = metal(scene, "wreckPlate", new Color3(0.34, 0.31, 0.29));
  const hullA = CreateCylinder("wreck.hullA", { diameter: 3.4, height: 6.5, tessellation: 14 }, scene);
  hullA.rotation.z = Math.PI / 2 - 0.12;
  part(hullA, root, rust, new Vector3(0, 0.3, 0));
  const hullB = CreateCylinder("wreck.hullB", { diameter: 3.0, height: 4.2, tessellation: 14 }, scene);
  hullB.rotation.set(0.2, 0.5, Math.PI / 2 + 0.25);
  part(hullB, root, rust, new Vector3(6.2, -0.2, 1.4));
  const wing = part(
    CreateBox("wreck.wing", { width: 0.18, height: 4.2, depth: 3.6 }, scene),
    root,
    plate,
    new Vector3(-1.4, 2.1, -2.2),
  );
  wing.rotation.z = 0.18;
  part(
    CreateBox("wreck.fin", { width: 0.14, height: 2.4, depth: 1.8 }, scene),
    root,
    plate,
    new Vector3(3.1, 1.6, 2.6),
  );
  return root;
}

/**
 * A small tileable height field turned into a normal map, scrolled over the water so it glints where the disk's light
 * lands. Made from a fixed pseudo-random sequence in code (no image file, no canvas, so it also builds in tests).
 */
export function createWaterBump(scene: Scene, size = 96): Texture {
  const height = new Float32Array(size * size);
  let seed = 7919;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  const waves = Array.from({ length: 7 }, () => ({
    kx: Math.round(1 + rand() * 4),
    ky: Math.round(1 + rand() * 4),
    phase: rand() * Math.PI * 2,
    amp: 0.35 + rand() * 0.65,
  }));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      for (const w of waves) h += w.amp * Math.sin(((x * w.kx + y * w.ky) / size) * Math.PI * 2 + w.phase);
      height[y * size + x] = h;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = RawTexture.CreateRGBATexture(data, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** A pale ring around a wading character's shins that spreads and fades with their pace. */
export function createWakeRing(scene: Scene, name: string): { mesh: Mesh; update(t: number, pace: number): void } {
  const ring = CreateTorus(name, { diameter: 1.1, thickness: 0.05, tessellation: 24 }, scene);
  const mat = new StandardMaterial(`${name}.mat`, scene);
  mat.diffuseColor = new Color3(0.6, 0.72, 0.8);
  mat.emissiveColor = new Color3(0.35, 0.42, 0.48);
  mat.specularColor = new Color3(0, 0, 0);
  mat.alpha = 0.4;
  ring.material = mat;
  ring.scaling.y = 0.4;
  ring.isPickable = false;
  return {
    mesh: ring,
    update(t, pace) {
      const phase = (t * (0.6 + pace * 1.4)) % 1; // faster ripples the faster they wade
      const spread = 1 + phase * (0.9 + pace);
      ring.scaling.x = spread;
      ring.scaling.z = spread;
      mat.alpha = (0.18 + 0.3 * Math.min(pace, 1)) * (1 - phase);
    },
  };
}
