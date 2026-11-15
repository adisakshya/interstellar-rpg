/**
 * How a character's body moves in each place (MOVE-001, FR-22, D-18). Presentation only: movement never changes game
 * state or the clocks (ARCHITECTURE §1); only the Interact and decision commands and free-roam ticks do.
 *
 * Miller's gravity is about 1.3 g (the film's figure; PHYSICS does not model it). Heavier gravity makes starting and
 * stopping slow and rules out jumping; wading through knee-deep water caps the speed and slows the stride. So on
 * Miller a character accelerates sluggishly to a modest top speed, while on Endurance they move briskly.
 */
export interface MovementProfile {
  /** Top speed, metres per second. */
  readonly topSpeed: number;
  /** How quickly velocity follows the stick, per second (higher is snappier). */
  readonly response: number;
  /** Knee-deep water: slow, high-stepped gait and a forward lean. */
  readonly wading: boolean;
  /** No jumping anywhere in Episode 1; kept explicit so a later scene cannot enable it by accident. */
  readonly canJump: false;
  /** Gravity as a multiple of Earth's, for presentation (camera bob weight). */
  readonly gravity: number;
}

export const MILLER_GRAVITY = 1.3;

export const MOVEMENT: Readonly<Record<"miller" | "endurance", MovementProfile>> = {
  miller: { topSpeed: 1.0, response: 2.0, wading: true, canJump: false, gravity: MILLER_GRAVITY },
  endurance: { topSpeed: 1.7, response: 7.0, wading: false, canJump: false, gravity: 1.0 },
};

export interface Velocity {
  x: number;
  y: number;
}

/** Move `v` toward the input vector for `dt` seconds under `profile`. Diagonals are no faster than straight lines. */
export function stepVelocity(v: Velocity, input: Velocity, profile: MovementProfile, dt: number): Velocity {
  const mag = Math.hypot(input.x, input.y);
  const scale = mag > 1 ? 1 / mag : 1;
  const tx = input.x * scale * profile.topSpeed;
  const ty = input.y * scale * profile.topSpeed;
  const k = 1 - Math.exp(-profile.response * Math.max(0, dt));
  return { x: v.x + (tx - v.x) * k, y: v.y + (ty - v.y) * k };
}

/** 0 (standing) to 1 (top speed): what the gait animation follows. */
export const gaitSpeed = (v: Velocity, profile: MovementProfile): number =>
  Math.min(1, Math.hypot(v.x, v.y) / profile.topSpeed);
