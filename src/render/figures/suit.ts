import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

/** What makes each crew member read as a different person at a distance: suit trim and a colour band (D-15). */
export interface SuitLook {
  readonly name: string;
  /** Main fabric colour (off-white to grey). */
  readonly fabric: Color3;
  /** Trim and band colour: shoulders, the chest panel and the helmet ring. */
  readonly accent: Color3;
  /** Height in metres of the standing figure (default 1.85). */
  readonly height?: number;
}

/** How the figure moves: presentation only, never state (ARCHITECTURE §1). */
export interface Gait {
  /** 0 standing, 1 full walking speed. */
  readonly speed: number;
  /** Heavy-gravity wade (MOVE-001): slower cadence, lifted knees, forward lean. */
  readonly wading?: boolean;
}

export interface SuitedFigure {
  readonly root: TransformNode;
  /** Advance the animation by `dt` seconds. */
  update(dt: number, gait: Gait): void;
  /** Joint transforms, exposed so tests and later systems (kneel, radio gesture) can read and drive them. */
  readonly joints: Readonly<
    Record<
      "hipL" | "hipR" | "kneeL" | "kneeR" | "shoulderL" | "shoulderR" | "elbowL" | "elbowR" | "spine" | "head",
      TransformNode
    >
  >;
  /** The visor mesh, for reflections. */
  readonly visor: Mesh;
  dispose(): void;
}

const mat = (
  scene: Scene,
  name: string,
  color: Color3,
  o: { spec?: number; power?: number; emissive?: Color3; alpha?: number } = {},
) => {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  const s = o.spec ?? 0.06;
  m.specularColor = new Color3(s, s, s);
  m.specularPower = o.power ?? 24;
  if (o.emissive) m.emissiveColor = o.emissive;
  if (o.alpha !== undefined) m.alpha = o.alpha;
  return m;
};

/**
 * A spacesuit figure built entirely from primitives in code: no downloaded model, so no licence or download cost
 * (D-17). Joints are a TransformNode hierarchy, driven by a small procedural gait.
 */
export function createSuitedFigure(scene: Scene, look: SuitLook): SuitedFigure {
  const k = (look.height ?? 1.85) / 1.85;
  const root = new TransformNode(`${look.name}.figure`, scene);
  const fabric = mat(scene, `${look.name}.fabric`, look.fabric);
  const accent = mat(scene, `${look.name}.accent`, look.accent, { spec: 0.15 });
  const dark = mat(scene, `${look.name}.dark`, new Color3(0.12, 0.12, 0.13), { spec: 0.2 });
  const glass = mat(scene, `${look.name}.visor`, new Color3(0.05, 0.05, 0.07), {
    spec: 1,
    power: 120,
    emissive: new Color3(0.07, 0.06, 0.04),
  });
  const panelLight = mat(scene, `${look.name}.panel`, new Color3(0.05, 0.05, 0.05), {
    emissive: look.accent.scale(0.9),
  });
  const meshes: Mesh[] = [];
  const part = <T extends Mesh>(m: T, material: StandardMaterial, parent: TransformNode): T => {
    m.material = material;
    m.parent = parent;
    meshes.push(m);
    return m;
  };
  const node = (name: string, parent: TransformNode, x: number, y: number, z = 0) => {
    const n = new TransformNode(`${look.name}.${name}`, scene);
    n.parent = parent;
    n.position = new Vector3(x * k, y * k, z * k);
    return n;
  };

  // Pelvis is the pivot the whole body bobs around; feet rest on y = 0 when standing.
  const pelvis = node("pelvis", root, 0, 0.95);
  part(CreateSphere(`${look.name}.hips`, { diameter: 0.34 * k, segments: 12 }, scene), fabric, pelvis).scaling =
    new Vector3(1.1, 0.8, 0.8);
  const spine = node("spine", pelvis, 0, 0.12);
  const torso = part(
    CreateCapsule(
      `${look.name}.torso`,
      { height: 0.66 * k, radius: 0.2 * k, tessellation: 14, subdivisions: 2 },
      scene,
    ),
    fabric,
    spine,
  );
  torso.position.y = 0.26 * k;
  torso.scaling = new Vector3(1.12, 1, 0.78);
  const pack = part(
    CreateBox(`${look.name}.pack`, { width: 0.38 * k, height: 0.52 * k, depth: 0.22 * k }, scene),
    dark,
    spine,
  );
  pack.position = new Vector3(0, 0.32 * k, -0.2 * k);
  for (const side of [-1, 1]) {
    const hose = part(
      CreateCylinder(`${look.name}.hose${side}`, { height: 0.34 * k, diameter: 0.04 * k, tessellation: 8 }, scene),
      dark,
      spine,
    );
    hose.position = new Vector3(side * 0.12 * k, 0.5 * k, -0.04 * k);
    hose.rotation.z = side * 0.35;
  }
  const chest = part(
    CreateBox(`${look.name}.chest`, { width: 0.2 * k, height: 0.12 * k, depth: 0.03 * k }, scene),
    panelLight,
    spine,
  );
  chest.position = new Vector3(0, 0.36 * k, 0.16 * k);
  const belt = part(
    CreateCylinder(`${look.name}.belt`, { height: 0.05 * k, diameter: 0.4 * k, tessellation: 20 }, scene),
    accent,
    spine,
  );
  belt.position.y = 0.01 * k;
  belt.scaling = new Vector3(1.05, 1, 0.78);

  const head = node("head", spine, 0, 0.64);
  const helmet = part(CreateSphere(`${look.name}.helmet`, { diameter: 0.34 * k, segments: 16 }, scene), fabric, head);
  helmet.position.y = 0.11 * k;
  const visor = part(CreateSphere(`${look.name}.visorGlass`, { diameter: 0.26 * k, segments: 16 }, scene), glass, head);
  visor.position = new Vector3(0, 0.115 * k, 0.07 * k);
  visor.scaling = new Vector3(1, 0.86, 0.72);
  const ring = part(
    CreateCylinder(`${look.name}.neckRing`, { height: 0.04 * k, diameter: 0.25 * k, tessellation: 18 }, scene),
    accent,
    head,
  );
  ring.position.y = -0.02 * k;

  const limb = (side: -1 | 1) => {
    const shoulder = node(`shoulder${side}`, spine, side * 0.27, 0.5);
    part(
      CreateSphere(`${look.name}.shoulderCap${side}`, { diameter: 0.17 * k, segments: 10 }, scene),
      accent,
      shoulder,
    );
    const upperArm = part(
      CreateCapsule(
        `${look.name}.upperArm${side}`,
        { height: 0.34 * k, radius: 0.058 * k, tessellation: 10, subdivisions: 1 },
        scene,
      ),
      fabric,
      shoulder,
    );
    upperArm.position.y = -0.15 * k;
    const elbow = node(`elbow${side}`, shoulder, 0, -0.31);
    const foreArm = part(
      CreateCapsule(
        `${look.name}.foreArm${side}`,
        { height: 0.32 * k, radius: 0.05 * k, tessellation: 10, subdivisions: 1 },
        scene,
      ),
      fabric,
      elbow,
    );
    foreArm.position.y = -0.14 * k;
    const glove = part(
      CreateSphere(`${look.name}.glove${side}`, { diameter: 0.11 * k, segments: 8 }, scene),
      dark,
      elbow,
    );
    glove.position.y = -0.31 * k;
    const hip = node(`hip${side}`, pelvis, side * 0.1, -0.02);
    const thigh = part(
      CreateCapsule(
        `${look.name}.thigh${side}`,
        { height: 0.5 * k, radius: 0.085 * k, tessellation: 12, subdivisions: 1 },
        scene,
      ),
      fabric,
      hip,
    );
    thigh.position.y = -0.22 * k;
    const knee = node(`knee${side}`, hip, 0, -0.45);
    const shin = part(
      CreateCapsule(
        `${look.name}.shin${side}`,
        { height: 0.46 * k, radius: 0.07 * k, tessellation: 12, subdivisions: 1 },
        scene,
      ),
      fabric,
      knee,
    );
    shin.position.y = -0.2 * k;
    const boot = part(
      CreateBox(`${look.name}.boot${side}`, { width: 0.12 * k, height: 0.1 * k, depth: 0.27 * k }, scene),
      dark,
      knee,
    );
    boot.position = new Vector3(0, -0.43 * k, 0.05 * k);
    return { shoulder, elbow, hip, knee };
  };
  const L = limb(-1);
  const R = limb(1);

  let phase = 0;
  let breath = 0;
  let blend = 0; // 0 idle .. 1 walking, smoothed so starting and stopping is not a snap
  let wade = 0;
  const update = (dt: number, gait: Gait) => {
    const target = Math.min(1, Math.max(0, gait.speed));
    blend += (target - blend) * Math.min(1, dt * 6);
    wade += ((gait.wading ? 1 : 0) - wade) * Math.min(1, dt * 4);
    // Cadence in strides per second: a heavy wade is slow and high-stepped (1.3 g, knee-deep water).
    const cadence = 1.8 - 0.7 * wade;
    phase += dt * cadence * Math.PI * 2 * blend;
    breath += dt * 1.4;
    const swing = Math.sin(phase);
    const amp = (0.55 - 0.18 * wade) * blend;
    L.hip.rotation.x = swing * amp;
    R.hip.rotation.x = -swing * amp;
    const lift = 0.5 + 0.55 * wade;
    L.knee.rotation.x = Math.max(0, -Math.sin(phase + 0.6)) * lift * blend;
    R.knee.rotation.x = Math.max(0, Math.sin(phase + 0.6)) * lift * blend;
    L.shoulder.rotation.x = -swing * 0.4 * blend + 0.05;
    R.shoulder.rotation.x = swing * 0.4 * blend + 0.05;
    L.elbow.rotation.x = -0.25 - 0.2 * blend;
    R.elbow.rotation.x = -0.25 - 0.2 * blend;
    spine.rotation.x = 0.05 + 0.1 * blend + 0.08 * wade * blend + Math.sin(breath) * 0.008;
    spine.rotation.y = -swing * 0.08 * blend;
    head.rotation.x = -spine.rotation.x * 0.6;
    pelvis.position.y = (0.95 - 0.015 * wade - Math.abs(Math.sin(phase)) * (0.035 - 0.015 * wade) * blend) * k;
  };

  return {
    root,
    update,
    joints: {
      hipL: L.hip,
      hipR: R.hip,
      kneeL: L.knee,
      kneeR: R.knee,
      shoulderL: L.shoulder,
      shoulderR: R.shoulder,
      elbowL: L.elbow,
      elbowR: R.elbow,
      spine,
      head,
    },
    visor,
    dispose() {
      for (const m of meshes) m.dispose();
      root.dispose();
    },
  };
}
