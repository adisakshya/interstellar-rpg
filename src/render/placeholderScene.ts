import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";

/** Placeholder scene for SETUP-001: one mesh, proves the Babylon pipeline works. Replaced by SCENE-001. */
export function createPlaceholderScene(canvas: HTMLCanvasElement): { engine: Engine; scene: Scene } {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 1);

  const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 6, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  // With deep ES-module imports the default material is not registered implicitly, so assign one explicitly.
  const material = new StandardMaterial("planetMaterial", scene);
  material.diffuseColor = new Color3(0.35, 0.55, 0.8);
  const planet = CreateSphere("planet", { diameter: 2, segments: 32 }, scene);
  planet.material = material;

  return { engine, scene };
}
