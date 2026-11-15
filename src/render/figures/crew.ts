import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { SuitLook } from "./suit";

/**
 * The four crew members as they look in a suit (D-15): one base figure, told apart at a distance by trim colour and
 * height. Keys are the game's character ids.
 */
export const CREW: Readonly<Record<string, SuitLook>> = {
  "char.cooper": {
    name: "cooper",
    fabric: new Color3(0.8, 0.8, 0.76),
    accent: new Color3(0.9, 0.55, 0.12),
    height: 1.85,
  },
  "char.brand": {
    name: "brand",
    fabric: new Color3(0.82, 0.82, 0.8),
    accent: new Color3(0.18, 0.62, 0.62),
    height: 1.7,
  },
  "char.doyle": {
    name: "doyle",
    fabric: new Color3(0.74, 0.75, 0.78),
    accent: new Color3(0.75, 0.2, 0.2),
    height: 1.8,
  },
  "char.romilly": {
    name: "romilly",
    fabric: new Color3(0.86, 0.85, 0.8),
    accent: new Color3(0.4, 0.66, 0.32),
    height: 1.78,
  },
};
