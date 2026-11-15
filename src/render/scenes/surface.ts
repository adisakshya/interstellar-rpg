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
import { addSky } from "./sky";

export const createSurfaceScene: SceneFactory = (engine, tier, assets) => {
  const scene = newScene(engine, new Color4(0.01, 0.012, 0.016, 1));
  // Gargantua fills part of the sky, a little above the horizon, ahead of the starting camera direction.
  if (assets) addSky(scene, assets.baseUrl + tier.skyFile, { yawDeg: 90, pitchDeg: 14 });
  // There is no sun on Miller: the light is Gargantua's disk, low in the sky ahead (+z), so the key light is warm and
  // low, and the fill from the sky is dim and cool.
  const fill = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
  fill.intensity = 0.9;
  fill.diffuse = new Color3(0.55, 0.62, 0.72);
  fill.groundColor = new Color3(0.05, 0.06, 0.08);
  const key = new DirectionalLight("disk", new Vector3(0.1, -0.35, -1), scene);
  key.intensity = 0.9;
  key.diffuse = new Color3(1, 0.72, 0.45);
  // A dim cool light from behind the camera, so the character's front is not a silhouette against the glow.
  const front = new DirectionalLight("front", new Vector3(0, -0.5, 1), scene);
  front.intensity = 0.55;
  front.diffuse = new Color3(0.62, 0.72, 0.85);

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
  floor.material = material(scene, "seabedMat", new Color3(0.24, 0.24, 0.22));

  const water = CreateGround("water", { width: 400, height: 400, subdivisions: 1 }, scene);
  water.material = material(
    scene,
    "waterMat",
    new Color3(0.12, 0.2, 0.26),
    tier.transparentWater
      ? { alpha: 0.82, emissive: new Color3(0.04, 0.07, 0.09) }
      : { emissive: new Color3(0.04, 0.07, 0.09) },
  );

  // Distant "mountains" that are really waves (GDD B7): low, hazy silhouettes on the horizon.
  for (let i = 0; i < 5; i++) {
    const wave = CreateBox(`wave${i}`, { width: 26, height: 6 + (i % 2) * 3, depth: 4 }, scene);
    wave.position = new Vector3(-80 + i * 40, 3, 170);
    wave.material = material(scene, `waveMat${i}`, new Color3(0.03, 0.04, 0.05));
  }

  const cooper = CreateCapsule("character", { height: 1.8, radius: 0.35 }, scene);
  cooper.position = new Vector3(0, 0.9, 0);
  cooper.material = material(scene, "suitMat", new Color3(0.78, 0.78, 0.74));

  const camera = new ArcRotateCamera("follow", -Math.PI / 2, 1.42, 9, cooper.position.clone(), scene);
  camera.maxZ = 500;
  camera.fov = 1.05; // wide, as the art direction asks for a low camera and a dominant horizon
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
