import type { Emit } from "./actions";
import { createStick } from "./stick";

type PointerLike = Event & { pointerId: number; pointerType?: string; clientX: number; clientY: number };

/** Mouse adapter: press and drag on the game view to steer, release to stop. Touch pointers are left to the touch pad. */
export function createMouseAdapter(target: EventTarget, emit: Emit, radius = 90): () => void {
  const stick = createStick(emit, { radius });
  const isMouse = (e: PointerLike) => e.pointerType === undefined || e.pointerType === "mouse";
  const down = (event: Event) => {
    const e = event as PointerLike;
    if (isMouse(e)) stick.begin(e.pointerId, { x: e.clientX, y: e.clientY }, { x: e.clientX, y: e.clientY });
  };
  const move = (event: Event) => {
    const e = event as PointerLike;
    if (isMouse(e)) stick.move(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const up = (event: Event) => {
    const e = event as PointerLike;
    if (isMouse(e)) stick.end(e.pointerId);
  };
  target.addEventListener("pointerdown", down);
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", up);
  return () => {
    target.removeEventListener("pointerdown", down);
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", up);
  };
}
