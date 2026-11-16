// The cinematic grade (ART_DIRECTION §8): ACES tone mapping, a little contrast and a soft vignette on every scene, which
// cost nothing extra because they run inside the material shaders; and a mild bloom on the `high` tier, so Gargantua's
// disk and the lamps glow instead of just being bright. Tiers change looks only, never rules.
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { Scene } from "@babylonjs/core/scene";
import type { TierSettings } from "../quality";

export function gradeScene(scene: Scene): void {
  const c = scene.imageProcessingConfiguration;
  c.toneMappingEnabled = true;
  c.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  c.exposure = 1.3;
  c.contrast = 1.05;
  c.vignetteEnabled = true;
  c.vignetteWeight = 1.1;
  c.vignetteStretch = 0.4;
}

/** Bloom on the `high` tier only. A device or engine that cannot do it keeps the plain image. */
export function addBloom(scene: Scene, camera: Camera, tier: TierSettings): DefaultRenderingPipeline | null {
  if (!tier.bloom) return null;
  try {
    const pipeline = new DefaultRenderingPipeline("grade", false, scene, [camera]);
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.92;
    pipeline.bloomWeight = 0.18;
    pipeline.bloomKernel = 48;
    pipeline.bloomScale = 0.5;
    return pipeline;
  } catch {
    return null;
  }
}
