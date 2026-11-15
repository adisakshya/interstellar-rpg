// Babylon scenes, cameras and quality tiers (SCENE-001, ARCHITECTURE §7). Reads domain state; never mutates it.
export { createRenderer, SCENE_BY_LOCATION, sceneFor } from "./renderer";
export type { Renderer, RendererOptions, SceneKind } from "./renderer";
export { detectTier, scalingLevel, TIERS } from "./quality";
export type { Tier, TierSettings } from "./quality";
