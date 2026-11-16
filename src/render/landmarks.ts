/** A place on Miller's plain the player can walk to (PLAY-001). */
export interface Landmark {
  readonly x: number;
  readonly z: number;
  /** How close counts as "there", in metres. */
  readonly reach: number;
}

/**
 * Where the things you do on Miller are. Content names a landmark on an interaction ("near": "beacon"); the scene puts
 * the prop here and the app checks the player's distance. Metres, +z is toward Gargantua.
 */
export const MILLER_LANDMARKS: Readonly<Record<string, Landmark>> = {
  beacon: { x: 4, z: 32, reach: 6 },
  wreck: { x: -13, z: 42, reach: 10 },
  ranger: { x: 12, z: 9, reach: 8 },
};

export const distanceTo = (landmark: Landmark, at: { readonly x: number; readonly z: number }): number =>
  Math.hypot(landmark.x - at.x, landmark.z - at.z);

/** Is a position within reach of the named landmark? An unknown name is never "near". */
export function isNearLandmark(name: string, at: { readonly x: number; readonly z: number }): boolean {
  const l = MILLER_LANDMARKS[name];
  return l !== undefined && distanceTo(l, at) <= l.reach;
}
