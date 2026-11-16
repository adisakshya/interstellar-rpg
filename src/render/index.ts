// Babylon scenes, cameras and quality tiers (SCENE-001, ARCHITECTURE §7). Reads domain state; never mutates it.
export { createRenderer, SCENE_BY_LOCATION, sceneFor } from "./renderer";
export type { Renderer, RendererOptions, SceneKind } from "./renderer";
export { detectTier, scalingLevel, TIERS } from "./quality";
export type { Tier, TierSettings } from "./quality";
export { createAdaptiveScaler } from "./adaptive";
export type { AdaptiveOptions, AdaptiveScaler } from "./adaptive";
export type { SceneAssets } from "./scenes/common";
export { addSky } from "./scenes/sky";
export { waveAt, waveLook, waveProgress, waveScheduleOf } from "./wave";
export type { WaveLook, WaveSchedule } from "./wave";
export type { SceneContent } from "./scenes/common";
export { distanceTo, isNearLandmark, MILLER_LANDMARKS } from "./landmarks";
export type { Landmark } from "./landmarks";
