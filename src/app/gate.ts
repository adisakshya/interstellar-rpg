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

/**
 * The move to hand the scene this frame. Walking on the plain is paid for by free-roam ticks (every second of wading is a
 * second of the character's time), so the character must stand still exactly when free-roam is not running: a subtitle
 * on screen, a decision open, the title up, a hidden tab. Otherwise a player could cross to a landmark for free and
 * then act there (PLAY-001). Scenes with no position (Endurance's corridor) are cosmetic and keep their movement.
 */
export function effectiveMove(
  desired: { readonly x: number; readonly y: number },
  state: { readonly runs: boolean; readonly paidFor: boolean },
): { x: number; y: number } {
  return state.paidFor && !state.runs ? { x: 0, y: 0 } : { x: desired.x, y: desired.y };
}
