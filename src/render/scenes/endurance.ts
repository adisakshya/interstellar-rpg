// Endurance interior, first person (FR-11): a ring-module corridor where Romilly waits.
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { material, newScene, type SceneFactory } from "./common";

export const createEnduranceScene: SceneFactory = (engine) => {
  const scene = newScene(engine, new Color4(0.01, 0.01, 0.02, 1));
  const ambient = new HemisphericLight("ceiling", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.7;
  // Inside a closed module the ceiling faces down, so give the "ground" side of the light a colour too.
  ambient.groundColor = new Color3(0.55, 0.55, 0.55);

  const corridor = CreateBox("corridor", { width: 3, height: 2.6, depth: 24, sideOrientation: 1 }, scene);
  corridor.material = material(scene, "corridorMat", new Color3(0.62, 0.63, 0.6));
  for (let i = 0; i < 8; i++) {
    const strip = CreateBox(`light${i}`, { width: 1.2, height: 0.05, depth: 0.4 }, scene);
    strip.position = new Vector3(0, 1.27, -10 + i * 3);
    strip.material = material(scene, `lightMat${i}`, new Color3(0.9, 0.9, 0.85), {
      emissive: new Color3(0.8, 0.8, 0.72),
    });
  }
  const console_ = CreateBox("console", { width: 1.4, height: 0.9, depth: 0.5 }, scene);
  console_.position = new Vector3(0.9, -0.85, 4);
  console_.material = material(scene, "consoleMat", new Color3(0.15, 0.16, 0.18), {
    emissive: new Color3(0.05, 0.2, 0.3),
  });

  const camera = new UniversalCamera("romilly", new Vector3(0, 0.4, -8), scene);
  camera.setTarget(new Vector3(0, 0.3, 10));
  camera.minZ = 0.05;
  scene.activeCamera = camera;

  const move = { x: 0, y: 0 };
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    camera.position.z = Math.max(-10, Math.min(10, camera.position.z - move.y * dt * 2));
    camera.rotation.y += move.x * dt * 0.8;
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
