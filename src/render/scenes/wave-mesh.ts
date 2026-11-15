import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import { waveLook, type WaveLook } from "../wave";

export interface WaveMesh {
  readonly mesh: Mesh;
  /** Place and shape the wave for a progress value (see `waveLook`). */
  show(progress: number, baseY: number): WaveLook;
  dispose(): void;
}

const SEGMENTS = 96;
const HALF_WIDTH = 170;

/**
 * The tidal wave as a single dark wall (WAVE-001): a ribbon of unit height with an irregular crest, scaled to the wave's
 * height and placed at its distance each frame. Near-black, with a thin cold rim on the crest so it reads against
 * Gargantua's glow rather than as a flat cut-out.
 */
export function createWaveMesh(scene: Scene): WaveMesh {
  const mesh = new Mesh("wave", scene);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  // Three rows: a dark foot, a darker body and a pale crest that catches Gargantua's light, so it reads as water.
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const x = (t - 0.5) * 2 * HALF_WIDTH;
    // A long swell with smaller crests riding it, never the same height twice.
    const crest = 0.8 + 0.12 * Math.sin(t * 9.1 + 0.6) + 0.07 * Math.sin(t * 31.7) + 0.04 * Math.sin(t * 77.3 + 1.1);
    positions.push(x, 0, 0, x, crest * 0.82, 0, x, crest, 0);
    colors.push(0.01, 0.015, 0.02, 1, 0.03, 0.04, 0.055, 1, 0.34, 0.38, 0.44, 1);
    if (i < SEGMENTS) {
      const a = i * 3;
      indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
  }
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  const mat = new StandardMaterial("waveMat", scene);
  mat.diffuseColor = new Color3(0.02, 0.03, 0.04);
  mat.emissiveColor = new Color3(0.012, 0.018, 0.024);
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  mat.fogEnabled = false;
  mesh.material = mat;
  mesh.hasVertexAlpha = false;
  mesh.useVertexColors = true;
  mesh.isPickable = false;
  mesh.setEnabled(false);

  return {
    mesh,
    show(progress, baseY) {
      const look = waveLook(progress);
      mesh.setEnabled(look.phase !== "none");
      if (look.phase === "none") return look;
      mesh.position.set(0, baseY, look.distance);
      mesh.scaling.set(1, look.height, 1);
      mat.alpha = look.opacity;
      return look;
    },
    dispose() {
      mesh.dispose(false, true);
    },
  };
}
