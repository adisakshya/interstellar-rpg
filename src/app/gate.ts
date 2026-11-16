import { isNearLandmark } from "../render";

/**
 * Is the player near this landmark? Fail closed: with no position yet (the surface scene is still loading, or the
 * character is on a scene with no plain) nothing counts as near, so an action tied to a landmark can never run before the
 * player is known to be there (PLAY-001). Only interactions that name a landmark ask; those exist only on the surface.
 */
export function makeNearGate(position: () => { readonly x: number; readonly z: number } | null) {
  return (landmark: string): boolean => {
    const at = position();
    return at !== null && isNearLandmark(landmark, at);
  };
}
