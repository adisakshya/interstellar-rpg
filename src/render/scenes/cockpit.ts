// The Ranger cockpit, first person (FR-11): an enclosed room, instrument panels and a window.
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { material, newScene, type SceneFactory } from "./common";

export const createCockpitScene: SceneFactory = (engine) => {
  const scene = newScene(engine, new Color4(0.02, 0.02, 0.03, 1));
  const cabin = new HemisphericLight("cabin", new Vector3(0, 1, -0.3), scene);
  cabin.intensity = 0.7;
  cabin.groundColor = new Color3(0.3, 0.3, 0.3);

  const shell = CreateBox("shell", { width: 4, height: 2.4, depth: 4, sideOrientation: 1 }, scene);
  shell.material = material(scene, "shellMat", new Color3(0.2, 0.21, 0.23));
  for (let i = 0; i < 12; i++) {
    const panel = CreateBox(`panel${i}`, { width: 0.45, height: 0.28, depth: 0.05 }, scene);
    panel.position = new Vector3(-1.4 + (i % 6) * 0.56, 0.1 + Math.floor(i / 6) * 0.34, 1.6);
    const lit = i % 3 === 0 ? new Color3(0.1, 0.5, 0.3) : new Color3(0.05, 0.12, 0.2);
    panel.material = material(scene, `panelMat${i}`, new Color3(0.1, 0.1, 0.1), { emissive: lit });
  }
  const view = CreatePlane("window", { width: 3, height: 1.1 }, scene);
  view.position = new Vector3(0, 0.95, 1.95);
  view.material = material(scene, "windowMat", new Color3(0.4, 0.55, 0.65), {
    emissive: new Color3(0.25, 0.35, 0.45),
  });

  const camera = new UniversalCamera("pilot", new Vector3(0, 0.6, -0.6), scene);
  camera.setTarget(new Vector3(0, 0.5, 2));
  camera.minZ = 0.05;
  scene.activeCamera = camera;

  const look = { x: 0 };
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    camera.rotation.y = Math.max(-0.6, Math.min(0.6, camera.rotation.y + look.x * dt * 0.8));
  });

  return {
    scene,
    update: () => undefined,
    setMove(x) {
      look.x = x;
    },
    dispose: () => scene.dispose(),
  };
};
