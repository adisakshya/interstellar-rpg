import type { Emit } from "./actions";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Stick vector for a pointer at `p` relative to `origin`: dead zone near the centre, clamped to the unit circle. */
export function stickVector(origin: Point, p: Point, radius: number, deadzone = 0.15): Point {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length === 0 || length / radius < deadzone) return { x: 0, y: 0 };
  const scale = Math.min(1, length / radius) / length;
  // Round so tiny pointer jitter does not flood the action log.
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round(dx * scale), y: round(dy * scale) };
}

/**
 * One virtual stick driven by one pointer. A second pointer is ignored, so nothing needs two fingers (ARCHITECTURE §8).
 * The touch pad uses a fixed origin (its centre); the mouse uses the point where the drag began.
 */
export function createStick(emit: Emit, options: { radius: number; deadzone?: number }) {
  let active: number | null = null;
  let origin: Point = { x: 0, y: 0 };
  let last: Point = { x: 0, y: 0 };
  const set = (v: Point) => {
    if (v.x === last.x && v.y === last.y) return;
    last = v;
    emit({ kind: "Move", x: v.x, y: v.y });
  };
  const vector = (p: Point) => stickVector(origin, p, options.radius, options.deadzone);
  return {
    begin(pointerId: number, at: Point, p: Point): boolean {
      if (active !== null) return false;
      active = pointerId;
      origin = at;
      set(vector(p));
      return true;
    },
    move(pointerId: number, p: Point): void {
      if (pointerId === active) set(vector(p));
    },
    end(pointerId: number): void {
      if (pointerId !== active) return;
      active = null;
      set({ x: 0, y: 0 });
    },
    get active() {
      return active !== null;
    },
  };
}
