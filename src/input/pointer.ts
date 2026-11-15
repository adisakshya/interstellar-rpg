import type { Emit } from "./actions";
import { createStick } from "./stick";

type PointerLike = Event & { pointerId: number; pointerType?: string; clientX: number; clientY: number };

/**
 * Mouse adapter: press and drag on the game view to steer, release to stop. Touch pointers are left to the touch pad.
 * The drag captures the pointer, so releasing over a button or outside the window still ends it; losing capture or
 * window focus also stops it, so movement can never get stuck on.
 */
export function createMouseAdapter(target: EventTarget, emit: Emit, radius = 90, blurTarget?: EventTarget): () => void {
  const stick = createStick(emit, { radius });
  const isMouse = (e: PointerLike) => e.pointerType === undefined || e.pointerType === "mouse";
  const down = (event: Event) => {
    const e = event as PointerLike;
    if (!isMouse(e)) return;
    const at = { x: e.clientX, y: e.clientY };
    if (stick.begin(e.pointerId, at, at)) (target as Partial<Element>).setPointerCapture?.(e.pointerId);
  };
  const move = (event: Event) => {
    const e = event as PointerLike;
    if (isMouse(e)) stick.move(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const up = (event: Event) => {
    const e = event as PointerLike;
    if (isMouse(e)) stick.end(e.pointerId);
  };
  let lastId: number | null = null;
  const track = (event: Event) => {
    lastId = (event as PointerLike).pointerId;
  };
  const stop = () => {
    if (lastId !== null) stick.end(lastId);
  };
  target.addEventListener("pointerdown", track, true);
  target.addEventListener("pointerdown", down);
  target.addEventListener("lostpointercapture", up);
  blurTarget?.addEventListener("blur", stop);
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", up);
  return () => {
    target.removeEventListener("pointerdown", track, true);
    target.removeEventListener("pointerdown", down);
    target.removeEventListener("lostpointercapture", up);
    blurTarget?.removeEventListener("blur", stop);
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", up);
  };
}
