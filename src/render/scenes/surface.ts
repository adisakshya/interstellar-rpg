// Miller's surface, third person (FR-11): knee-deep water, a capsule Cooper, wave "mountains" on the horizon.
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { material, newScene, type SceneFactory } from "./common";

export const createSurfaceScene: SceneFactory = (engine, tier) => {
  const scene = newScene(engine, new Color4(0.62, 0.7, 0.76, 1));
  new HemisphericLight("sky", new Vector3(0, 1, 0), scene).intensity = 0.8;
  new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3), scene).intensity = 0.6;

  const floor = CreateGround(
    "seabed",
    { width: 200, height: 200, subdivisions: tier.terrainSubdivisions, updatable: true },
    scene,
  );
  const positions = floor.getVerticesData(VertexBuffer.PositionKind) ?? [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const z = positions[i + 2]!;
    positions[i + 1] = 0.4 * Math.sin(x * 0.11) * Math.cos(z * 0.07) - 0.45;
  }
  floor.updateVerticesData(VertexBuffer.PositionKind, positions);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, floor.getIndices() ?? [], normals);
  floor.updateVerticesData(VertexBuffer.NormalKind, normals);
  floor.material = material(scene, "seabedMat", new Color3(0.3, 0.29, 0.25));

  const water = CreateGround("water", { width: 400, height: 400, subdivisions: 1 }, scene);
  water.material = material(
    scene,
    "waterMat",
    new Color3(0.25, 0.42, 0.52),
    tier.transparentWater ? { alpha: 0.75 } : {},
  );

  // Distant "mountains" that are really waves (GDD B7): low, hazy silhouettes on the horizon.
  for (let i = 0; i < 5; i++) {
    const wave = CreateBox(`wave${i}`, { width: 26, height: 6 + (i % 2) * 3, depth: 4 }, scene);
    wave.position = new Vector3(-80 + i * 40, 3, 170);
    wave.material = material(scene, `waveMat${i}`, new Color3(0.5, 0.58, 0.64));
  }

  const cooper = CreateCapsule("character", { height: 1.8, radius: 0.35 }, scene);
  cooper.position = new Vector3(0, 0.9, 0);
  cooper.material = material(scene, "suitMat", new Color3(0.86, 0.86, 0.82));

  const camera = new ArcRotateCamera("follow", -Math.PI / 2, 1.42, 9, cooper.position.clone(), scene);
  camera.maxZ = 500;
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 15;
  scene.activeCamera = camera;

  const move = { x: 0, y: 0 };
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    cooper.position.x += move.x * dt * 2.5;
    cooper.position.z -= move.y * dt * 2.5;
    camera.target.copyFrom(cooper.position);
  });

  return {
    scene,
    update: () => undefined,
    setMove(x, y) {
      move.x = x;
      move.y = y;
    },
    dispose: () => scene.dispose(),
  };
};
