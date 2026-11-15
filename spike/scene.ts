// SPIKE-001: can a small terrain + water + capsule character + cockpit interior meet the P-03 budgets on the
// reference phone? Throwaway measurement code, not production (see docs/spikes/SPIKE-001.md).
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

export interface SpikeOptions {
  view: "surface" | "cockpit";
  /** Device pixels per rendered pixel: 1 = native resolution, 2 = half (the `low` tier idea). */
  scaling: number;
}

export interface SpikeScene {
  engine: Engine;
  scene: Scene;
  /** Set by the joystick; −1..1 on each axis. */
  input: { x: number; y: number };
  /** Moves the character one frame; returns whether it moved (used to time input latency). */
  step(dt: number): boolean;
}

function material(scene: Scene, name: string, color: Color3, alpha = 1, emissive?: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  m.alpha = alpha;
  if (emissive) m.emissiveColor = emissive;
  return m;
}

function terrain(scene: Scene): Mesh {
  const ground = CreateGround("terrain", { width: 200, height: 200, subdivisions: 128, updatable: true }, scene);
  const positions = ground.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const z = positions[i + 2]!;
    positions[i + 1] = 0.6 * Math.sin(x * 0.11) * Math.cos(z * 0.07) + 0.25 * Math.sin(x * 0.37 + z * 0.29) - 0.3;
  }
  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, ground.getIndices()!, normals);
  ground.updateVerticesData(VertexBuffer.NormalKind, normals);
  ground.material = material(scene, "terrainMat", new Color3(0.32, 0.3, 0.26));
  return ground;
}

export function createSpikeScene(canvas: HTMLCanvasElement, options: SpikeOptions): SpikeScene {
  const engine = new Engine(canvas, options.scaling <= 1, { preserveDrawingBuffer: false, stencil: false });
  // Render at device pixels divided by `scaling`: 1.5 on a 3x phone draws 2 pixels per CSS pixel.
  engine.setHardwareScalingLevel(options.scaling / devicePixelRatio);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.62, 0.7, 0.76, 1);
  new HemisphericLight("sky", new Vector3(0, 1, 0), scene).intensity = 0.8;
  new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3), scene).intensity = 0.6;
  const input = { x: 0, y: 0 };

  if (options.view === "cockpit") {
    // Ranger cockpit: an enclosed room, an instrument panel and a window onto the planet below.
    const shell = CreateBox("shell", { width: 4, height: 2.4, depth: 4, sideOrientation: 1 }, scene);
    shell.material = material(scene, "shellMat", new Color3(0.2, 0.21, 0.23));
    for (let i = 0; i < 12; i++) {
      const panel = CreateBox(`panel${i}`, { width: 0.45, height: 0.28, depth: 0.05 }, scene);
      panel.position = new Vector3(-1.4 + (i % 6) * 0.56, 0.1 + Math.floor(i / 6) * 0.34, 1.6);
      const lit = i % 3 === 0 ? new Color3(0.1, 0.5, 0.3) : new Color3(0.05, 0.12, 0.2);
      panel.material = material(scene, `panelMat${i}`, new Color3(0.1, 0.1, 0.1), 1, lit);
    }
    const window = CreatePlane("window", { width: 3, height: 1.1 }, scene);
    window.position = new Vector3(0, 0.95, 1.95);
    window.material = material(scene, "windowMat", new Color3(0.4, 0.55, 0.65), 0.85, new Color3(0.25, 0.35, 0.45));
    const camera = new UniversalCamera("pilot", new Vector3(0, 0.6, -0.6), scene);
    camera.setTarget(new Vector3(0, 0.5, 2));
    camera.minZ = 0.05;
    let yaw = 0;
    return {
      engine,
      scene,
      input,
      step(dt) {
        const turn = input.x !== 0 ? input.x : Math.sin(performance.now() / 2000) * 0.3;
        yaw = Math.max(-0.6, Math.min(0.6, yaw + turn * dt * 0.8));
        camera.rotation.y = yaw;
        return input.x !== 0;
      },
    };
  }

  terrain(scene);
  const water = CreateGround("water", { width: 400, height: 400, subdivisions: 1 }, scene);
  water.position.y = 0.05;
  water.material = material(scene, "waterMat", new Color3(0.25, 0.42, 0.52), 0.75);
  const cooper = CreateCapsule("cooper", { height: 1.8, radius: 0.35 }, scene);
  cooper.position = new Vector3(0, 0.9, 0);
  cooper.material = material(scene, "suitMat", new Color3(0.85, 0.85, 0.8));
  // Distant "mountains" that are really waves.
  for (let i = 0; i < 6; i++) {
    const wave = CreateBox(`wave${i}`, { width: 30, height: 12, depth: 4 }, scene);
    wave.position = new Vector3(-75 + i * 30, 6, 90);
    wave.material = material(scene, `waveMat${i}`, new Color3(0.35, 0.45, 0.5));
  }
  const camera = new ArcRotateCamera("follow", -Math.PI / 2, 1.2, 7, cooper.position, scene);
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 15;
  let angle = 0;
  return {
    engine,
    scene,
    input,
    step(dt) {
      const manual = input.x !== 0 || input.y !== 0;
      if (manual) {
        cooper.position.x += input.x * dt * 2.5;
        cooper.position.z -= input.y * dt * 2.5;
      } else {
        // Scripted walk in a circle so every frame has motion (VALIDATION §3 fly-through).
        angle += dt * 0.3;
        cooper.position.x = 8 * Math.cos(angle);
        cooper.position.z = 8 * Math.sin(angle);
      }
      camera.target.copyFrom(cooper.position);
      camera.alpha += dt * 0.05;
      return manual;
    },
  };
}
