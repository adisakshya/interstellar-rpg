// Miller's surface, third person (FR-11): knee-deep water, a capsule Cooper, wave "mountains" on the horizon.
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { material, newScene, type SceneFactory } from "./common";
import { CREW } from "../figures/crew";
import { createSuitedFigure } from "../figures/suit";
import { gaitSpeed, MOVEMENT, stepVelocity, type Velocity } from "../movement";
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

  // The crew in their suits (CHAR-001). Standing in knee-deep water on a 1.3 g planet, they wade rather than walk
  // (MOVE-001). Brand and Doyle follow Cooper at a distance (GDD B3).
  const profile = MOVEMENT.miller;
  const cooper = createSuitedFigure(scene, CREW["char.cooper"]!);
  const followers = [
    {
      id: "char.brand",
      figure: createSuitedFigure(scene, CREW["char.brand"]!),
      offset: new Vector3(-2.2, 0, 1.2),
      v: { x: 0, y: 0 },
    },
    {
      id: "char.doyle",
      figure: createSuitedFigure(scene, CREW["char.doyle"]!),
      offset: new Vector3(2.4, 0, 2.2),
      v: { x: 0, y: 0 },
    },
  ];
  const WATER = -0.3; // the water is knee-deep: the feet are below the surface line
  const body = cooper.root;
  body.position = new Vector3(0, WATER, 0);
  for (const f of followers) {
    f.figure.root.position = new Vector3(f.offset.x, WATER, f.offset.z);
    f.figure.root.rotation.y = Math.PI; // facing the way they came
  }
  const camTarget = new Vector3(0, 1.1, 0);

  const camera = new ArcRotateCamera("follow", -Math.PI / 2, 1.42, 9, camTarget.clone(), scene);
  camera.maxZ = 500;
  camera.fov = 1.05; // wide, as the art direction asks for a low camera and a dominant horizon
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 15;
  scene.activeCamera = camera;

  const move = { x: 0, y: 0 };
  let vel: Velocity = { x: 0, y: 0 };
  let facing = 0;
  const turnToward = (current: number, vx: number, vz: number, dt: number) => {
    const delta = Math.atan2(Math.sin(Math.atan2(vx, vz) - current), Math.cos(Math.atan2(vx, vz) - current));
    return current + delta * Math.min(1, dt * 6);
  };
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    vel = stepVelocity(vel, move, profile, dt);
    // Screen "up" is +y on the stick and -z in the world.
    body.position.x += vel.x * dt;
    body.position.z -= vel.y * dt;
    const speed = gaitSpeed(vel, profile);
    if (speed > 0.05) {
      facing = turnToward(facing, vel.x, -vel.y, dt);
      body.rotation.y = facing;
    }
    cooper.update(dt, { speed, wading: profile.wading });
    // Followers keep to their offset behind Cooper, wading at the same pace.
    for (const f of followers) {
      const dx = body.position.x + f.offset.x - f.figure.root.position.x;
      const dz = body.position.z + f.offset.z - f.figure.root.position.z;
      const dist = Math.hypot(dx, dz);
      f.v = stepVelocity(f.v, dist > 0.15 ? { x: dx / dist, y: -dz / dist } : { x: 0, y: 0 }, profile, dt);
      f.figure.root.position.x += f.v.x * dt;
      f.figure.root.position.z -= f.v.y * dt;
      const fs = gaitSpeed(f.v, profile);
      if (fs > 0.05) f.figure.root.rotation.y = turnToward(f.figure.root.rotation.y, f.v.x, -f.v.y, dt);
      f.figure.update(dt, { speed: fs, wading: profile.wading });
    }
    camTarget.set(body.position.x, 1.1, body.position.z);
    camera.target.copyFrom(camTarget);
  });

  return {
    scene,
    update(view) {
      // Someone who has died is no longer in the scene (a rebuilt scene starts from the same state, so reloads agree).
      for (const f of followers) f.figure.root.setEnabled(!view.dead.includes(f.id));
    },
    setMove(x, y) {
      move.x = x;
      move.y = y;
    },
    dispose: () => {
      cooper.dispose();
      for (const f of followers) f.figure.dispose();
      scene.dispose();
    },
  };
};
