import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Scene } from "@babylonjs/core/scene";
import type { TierSettings } from "../quality";
import type { WaveSchedule } from "../wave";

/** What a scene shows for the current game state. Derived from domain state; never written back. */
export interface SceneView {
  readonly characterId: string;
  /** Reference time, for things that follow the timeline (the wave). */
  readonly T: number;
  /** Characters who are dead: they are no longer in the scene. */
  readonly dead: readonly string[];
}

export interface SceneHandle {
  readonly scene: Scene;
  /** Called on every committed state change while this scene is active (read-only). */
  update(view: SceneView): void;
  /** Presentation-only movement for the visible character (INPUT-001 drives it); −1..1 per axis. */
  setMove(x: number, y: number): void;
  dispose(): void;
}

/** Where a scene finds its image files. Omitted in tests, where scenes build without textures. */
export interface SceneAssets {
  /** Base URL that `public/` is served under, ending in a slash (Vite's `BASE_URL`). */
  readonly baseUrl: string;
}

/** Story timing a scene needs, from content. */
export interface SceneContent {
  /** When the wave is first seen and when it arrives; null in a story with no wave. */
  readonly wave: WaveSchedule | null;
}

export type SceneFactory = (
  engine: AbstractEngine,
  tier: TierSettings,
  assets?: SceneAssets,
  content?: SceneContent,
) => SceneHandle;

/** With deep imports Babylon registers no default material, so every mesh gets one explicitly (ARCHITECTURE §7). */
export function material(
  scene: Scene,
  name: string,
  color: Color3,
  options: { alpha?: number; emissive?: Color3 } = {},
): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  if (options.alpha !== undefined) m.alpha = options.alpha;
  if (options.emissive) m.emissiveColor = options.emissive;
  return m;
}

export function newScene(engine: AbstractEngine, clear: Color4): Scene {
  const scene = new Scene(engine);
  scene.clearColor = clear;
  return scene;
}
