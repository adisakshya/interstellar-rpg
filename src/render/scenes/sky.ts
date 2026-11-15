import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { Scene } from "@babylonjs/core/scene";

export interface SkyOptions {
  /** Rotation about the vertical axis, in degrees: which way Gargantua lies. */
  readonly yawDeg?: number;
  /** Tilt, in degrees: positive lifts Gargantua above the horizon. */
  readonly pitchDeg?: number;
}

/**
 * The Gargantua sky (D-16): an inside-out sphere that follows the camera, textured with the equirectangular image from
 * `tools/gargantua`. It is lit by nothing and ignores fog, so it reads as infinitely far away. In the image the black
 * hole sits at the centre (longitude 0, on the equator); `pitchDeg` and `yawDeg` place it in the scene.
 */
export function addSky(
  scene: Scene,
  url: string,
  options: SkyOptions = {},
  makeTexture: (url: string, scene: Scene) => BaseTexture = (u, s) => new Texture(u, s),
): Mesh {
  const dome = CreateSphere("sky", { diameter: 400, segments: 32, sideOrientation: 1 }, scene);
  const mat = new StandardMaterial("skyMat", scene);
  mat.backFaceCulling = false;
  mat.disableLighting = true;
  mat.fogEnabled = false;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  const texture = makeTexture(url, scene);
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  mat.emissiveTexture = texture;
  dome.material = mat;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  dome.rotation.y = ((options.yawDeg ?? 0) * Math.PI) / 180;
  dome.rotation.x = (-(options.pitchDeg ?? 0) * Math.PI) / 180;
  return dome;
}
