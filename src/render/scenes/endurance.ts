// Endurance interior, first person (FR-11, SCENE-004): a ring-module corridor where Romilly waits, with a window onto
// Gargantua at the far end. The room shows how long he has waited (ART_DIRECTION §6): a wall of tally marks, logbooks
// piling up, dust in the air and on the panels, and a plant that has outgrown its shelf. Built in code (D-17).
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { ageKey, enduranceAge, type EnduranceAge } from "./endurance-age";
import { addBloom } from "./post";
import { material, newScene, type SceneFactory } from "./common";

const CLEAN_WALL = new Color3(0.66, 0.67, 0.64);
const DUSTY_WALL = new Color3(0.5, 0.45, 0.38);
const lerp = (a: Color3, b: Color3, k: number) =>
  new Color3(a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k);

export const createEnduranceScene: SceneFactory = (engine, tier, assets) => {
  const scene = newScene(engine, new Color4(0.01, 0.01, 0.02, 1));
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.2, 0.17, 0.13);
  scene.fogDensity = 0.002;

  const ambient = new HemisphericLight("ceiling", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.8;
  ambient.diffuse = new Color3(1, 0.93, 0.82); // warm practical light
  ambient.groundColor = new Color3(0.42, 0.4, 0.38);
  // Cold light from the window, so the far end reads as outside.
  const windowLight = new PointLight("window", new Vector3(0, 0.2, 4.6), scene);
  windowLight.diffuse = new Color3(0.55, 0.65, 0.9);
  windowLight.intensity = 0.5;

  // Floor, ceiling and walls are separate so the far end can be open to the window.
  const wallMat = material(scene, "corridorMat", CLEAN_WALL);
  const floorMat = material(scene, "floorMat", new Color3(0.3, 0.3, 0.3));
  const panel = (name: string, w: number, h: number, d: number, at: Vector3, mat = wallMat) => {
    const m = CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.position = at;
    m.material = mat;
    return m;
  };
  panel("floor", 3, 0.1, 12, new Vector3(0, -1.3, 0), floorMat);
  panel("ceiling", 3, 0.1, 12, new Vector3(0, 1.3, 0));
  panel("wallL", 0.1, 2.6, 12, new Vector3(-1.5, 0, 0));
  panel("wallR", 0.1, 2.6, 12, new Vector3(1.5, 0, 0));
  panel("back", 3, 2.6, 0.1, new Vector3(0, 0, -6));
  const ribMat = material(scene, "ribMat", new Color3(0.38, 0.39, 0.4));
  for (let i = 0; i < 6; i++) {
    const z = -5 + i * 2;
    panel(`ribL${i}`, 0.12, 2.6, 0.18, new Vector3(-1.42, 0, z), ribMat);
    panel(`ribR${i}`, 0.12, 2.6, 0.18, new Vector3(1.42, 0, z), ribMat);
    const strip = CreateBox(`light${i}`, { width: 1.0, height: 0.05, depth: 0.4 }, scene);
    strip.position = new Vector3(0, 1.24, z + 1);
    strip.material = material(scene, `lightMat${i}`, new Color3(0.95, 0.88, 0.7), {
      emissive: new Color3(0.55, 0.42, 0.26),
    });
  }

  // The window: a frame, and glass with a faint cold tint. The room ends here; beyond is Gargantua.
  const frame = material(scene, "frameMat", new Color3(0.3, 0.31, 0.33));
  panel("frameTop", 3, 0.5, 0.2, new Vector3(0, 1.2, 6), frame);
  panel("frameBottom", 3, 0.5, 0.2, new Vector3(0, -1.2, 6), frame);
  panel("frameL", 0.5, 2.6, 0.2, new Vector3(-1.4, 0, 6), frame);
  panel("frameR", 0.5, 2.6, 0.2, new Vector3(1.4, 0, 6), frame);
  // The view: Gargantua's baked image (the same one that is Miller's sky), cropped to the window at true angular scale
  // (about 94 by 74 degrees around the hole) and lit by nothing, so it glows as the real sky does. Dark space around it.
  const view = CreateBox("view", { width: 2.8, height: 2.2, depth: 0.02 }, scene);
  view.position = new Vector3(0, 0, 5.97);
  const viewMat = new StandardMaterial("viewMat", scene);
  viewMat.disableLighting = true;
  viewMat.fogEnabled = false;
  viewMat.diffuseColor = new Color3(0, 0, 0);
  viewMat.emissiveColor = new Color3(0.02, 0.02, 0.03);
  if (assets) {
    const picture = new Texture(assets.baseUrl + tier.skyFile, scene);
    picture.wrapU = Texture.CLAMP_ADDRESSMODE;
    picture.wrapV = Texture.CLAMP_ADDRESSMODE;
    picture.uScale = 0.26;
    picture.vScale = 0.41;
    picture.uOffset = 0.37;
    picture.vOffset = 0.295;
    viewMat.emissiveTexture = picture;
    viewMat.emissiveColor = new Color3(0, 0, 0); // the texture is added to this colour, so it must be black
  }
  view.material = viewMat;

  // Romilly's workstation on the right: a desk, a screen that glows cold, a shelf for the logbooks and the plant.
  const deskMat = material(scene, "deskMat", new Color3(0.22, 0.24, 0.28));
  panel("desk", 0.8, 0.12, 1.3, new Vector3(1.12, -0.35, 2.3), deskMat);
  panel("deskBody", 0.7, 0.85, 1.2, new Vector3(1.14, -0.85, 2.3), deskMat);
  const screen = panel(
    "screen",
    0.03,
    0.26,
    0.46,
    new Vector3(1.4, -0.12, 2.3),
    material(scene, "screenMat", new Color3(0.03, 0.05, 0.07), { emissive: new Color3(0.06, 0.24, 0.36) }),
  );
  screen.rotation.z = -0.25;
  // Wall banding and an amber accent line, so the walls read as designed panels and not as flat grey.
  const bandMat = material(scene, "bandMat", new Color3(0.2, 0.21, 0.23));
  const accentMat = material(scene, "accentMat", new Color3(0.6, 0.35, 0.1), {
    emissive: new Color3(0.55, 0.32, 0.08),
  });
  for (const side of [-1, 1]) {
    panel(`band${side}`, 0.06, 0.9, 12, new Vector3(side * 1.47, -0.85, 0), bandMat);
    panel(`accent${side}`, 0.04, 0.04, 12, new Vector3(side * 1.45, -0.35, 0), accentMat);
  }
  panel("shelf", 0.45, 0.05, 1.4, new Vector3(1.25, 0.1, 3.4), ribMat);

  // The marks of the wait. These parts are rebuilt only when the room has visibly aged.
  const aged = new TransformNode("aged", scene);
  const markMat = material(scene, "markMat", new Color3(0.08, 0.08, 0.08));
  const bookColours = [
    new Color3(0.5, 0.2, 0.15),
    new Color3(0.2, 0.3, 0.45),
    new Color3(0.35, 0.35, 0.2),
    new Color3(0.3, 0.3, 0.3),
  ];
  let shownKey = "";
  const rebuild = (age: EnduranceAge) => {
    aged.getChildren().forEach((c) => c.dispose());
    const add = <T extends { parent: unknown }>(m: T): T => {
      m.parent = aged;
      return m;
    };
    // Tally marks on the left wall, in groups of five (four strokes and a slash), eight groups to a row.
    for (let n = 0; n < age.tallies; n++) {
      const group = Math.floor(n / 5);
      const within = n % 5;
      const col = group % 8;
      const row = Math.floor(group / 8);
      const x0 = -1.43;
      const z0 = -0.6 + col * 0.36;
      const y0 = 0.55 - row * 0.4;
      if (within < 4) {
        const stroke = CreateBox("tally", { width: 0.01, height: 0.28, depth: 0.012 }, scene);
        stroke.position = new Vector3(x0, y0, z0 + within * 0.055);
        stroke.material = markMat;
        add(stroke);
      } else {
        const slash = CreateBox("tally", { width: 0.01, height: 0.32, depth: 0.012 }, scene);
        slash.position = new Vector3(x0, y0, z0 + 0.09);
        slash.rotation.x = 1.15;
        slash.material = markMat;
        add(slash);
      }
    }
    // Logbooks piling up on the shelf.
    for (let b = 0; b < age.logbooks; b++) {
      const book = CreateBox("logbook", { width: 0.3, height: 0.05, depth: 0.22 }, scene);
      book.position = new Vector3(1.25, 0.16 + b * 0.055, 2.9 + ((b * 7) % 3) * 0.02);
      book.rotation.y = ((b * 37) % 11) * 0.04 - 0.2;
      book.material = material(scene, `bookMat${b}`, bookColours[b % bookColours.length]!);
      add(book);
    }
    // The plant: a stem and leaves that grow with the years until they spill off the shelf.
    const height = 0.12 + 0.95 * age.plant;
    const stem = CreateCylinder("stem", { diameterTop: 0.02, diameterBottom: 0.045, height, tessellation: 6 }, scene);
    stem.position = new Vector3(1.25, 0.13 + height / 2, 3.95);
    stem.material = material(scene, "stemMat", new Color3(0.2, 0.34, 0.15));
    add(stem);
    const leaves = 2 + Math.round(age.plant * 12);
    for (let l = 0; l < leaves; l++) {
      const leaf = CreateSphere("leaf", { diameter: 0.14 + 0.1 * age.plant, segments: 5 }, scene);
      const t = (l + 1) / leaves;
      const angle = l * 2.4;
      leaf.scaling.y = 0.3;
      leaf.position = new Vector3(
        1.25 + Math.cos(angle) * 0.18 * (0.4 + t),
        0.13 + height * t,
        3.95 + Math.sin(angle) * 0.18 * (0.4 + t),
      );
      leaf.material = material(scene, `leafMat${l}`, new Color3(0.18, 0.4 + (0.1 * (l % 3)) / 3, 0.16));
      add(leaf);
    }
    // Dust: the panels dull and the air thickens.
    wallMat.diffuseColor = lerp(CLEAN_WALL, DUSTY_WALL, age.dust);
    scene.fogDensity = 0.002 + 0.014 * age.dust;
  };
  const show = (T: number) => {
    const age = enduranceAge(T);
    const key = ageKey(age);
    if (key === shownKey) return;
    shownKey = key;
    rebuild(age);
  };
  show(0);

  const camera = new UniversalCamera("romilly", new Vector3(0, 0.1, -0.6), scene);
  camera.setTarget(new Vector3(0, 0, 6));
  camera.minZ = 0.05;
  camera.maxZ = 600;
  scene.activeCamera = camera;
  addBloom(scene, camera, tier);

  const move = { x: 0, y: 0 };
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    camera.position.z = Math.max(-4.5, Math.min(3.2, camera.position.z - move.y * dt * 2));
    camera.rotation.y += move.x * dt * 0.8;
  });

  return {
    scene,
    update: (view) => show(view.T),
    setMove(x, y) {
      move.x = x;
      move.y = y;
    },
    dispose: () => scene.dispose(),
  };
};
