// Surface materials from the CC0 texture set under public/textures (docs/ASSETS.md). Loaded only when a scene is given
// an asset base, so tests and tools build scenes without them.
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";
import type { SceneAssets } from "./common";

export interface Surface {
  readonly diffuse: Texture;
  readonly normal: Texture;
}

/** A tiling colour map and normal map. `repeat` is how many times each tiles across a box face. */
export function loadSurface(
  scene: Scene,
  assets: SceneAssets,
  name: "rusty_metal_02" | "metal_plate_02" | "concrete_floor_worn_001",
  repeat: { readonly u: number; readonly v: number },
): Surface {
  const make = (suffix: "diff" | "nor") => {
    const t = new Texture(`${assets.baseUrl}textures/${name}_${suffix}.webp`, scene);
    t.wrapU = Texture.WRAP_ADDRESSMODE;
    t.wrapV = Texture.WRAP_ADDRESSMODE;
    t.uScale = repeat.u;
    t.vScale = repeat.v;
    return t;
  };
  return { diffuse: make("diff"), normal: make("nor") };
}

/**
 * Put a surface on a material. The material's own colour still multiplies the map, so a tint (dust, a warm lamp's
 * cast) keeps working on top of it.
 */
export function applySurface(
  material: StandardMaterial,
  surface: Surface | null | undefined,
  tint?: { r: number; g: number; b: number },
): void {
  if (!surface) return;
  material.diffuseTexture = surface.diffuse;
  material.bumpTexture = surface.normal;
  if (tint) material.diffuseColor.set(tint.r, tint.g, tint.b);
}
