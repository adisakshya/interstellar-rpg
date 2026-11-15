import { TOUCH_TARGET_MIN, type Emit } from "./actions";
import { createStick } from "./stick";

type PointerLike = Event & { pointerId: number; clientX: number; clientY: number };

/** The parts of the on-screen controls the adapter needs, so it can be tested without a DOM. */
export interface TouchControls {
  readonly pad: EventTarget & {
    rect(): { left: number; top: number; width: number; height: number };
    capture?(pointerId: number): void;
  };
  readonly interact: EventTarget;
  readonly switchNext: EventTarget;
}

/** Touch adapter: a fixed-centre joystick plus two buttons. One finger at a time; no gestures. */
export function createTouchAdapter(controls: TouchControls, emit: Emit): () => void {
  const radius = () => controls.pad.rect().width / 2;
  const stick = createStick(emit, {
    get radius() {
      return radius();
    },
  });
  const centre = () => {
    const r = controls.pad.rect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const down = (event: Event) => {
    const e = event as PointerLike;
    if (stick.begin(e.pointerId, centre(), { x: e.clientX, y: e.clientY })) controls.pad.capture?.(e.pointerId);
  };
  const move = (event: Event) => {
    const e = event as PointerLike;
    stick.move(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const up = (event: Event) => stick.end((event as PointerLike).pointerId);
  const interact = () => emit({ kind: "Interact" });
  const switchNext = () => emit({ kind: "SwitchNext" });

  controls.pad.addEventListener("pointerdown", down);
  controls.pad.addEventListener("pointermove", move);
  controls.pad.addEventListener("pointerup", up);
  controls.pad.addEventListener("pointercancel", up);
  controls.interact.addEventListener("click", interact);
  controls.switchNext.addEventListener("click", switchNext);
  return () => {
    controls.pad.removeEventListener("pointerdown", down);
    controls.pad.removeEventListener("pointermove", move);
    controls.pad.removeEventListener("pointerup", up);
    controls.pad.removeEventListener("pointercancel", up);
    controls.interact.removeEventListener("click", interact);
    controls.switchNext.removeEventListener("click", switchNext);
  };
}

export const PAD_SIZE = 128;
export const BUTTON_SIZE = 64;

/** Build the on-screen controls inside `root` (the HUD overlay): sized and placed inside the safe areas. */
export function mountTouchControls(root: HTMLElement): { controls: TouchControls; element: HTMLElement } {
  const doc = root.ownerDocument;
  const wrap = doc.createElement("div");
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "Touch controls");
  Object.assign(wrap.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);

  const pad = doc.createElement("div");
  pad.setAttribute("role", "application");
  pad.setAttribute("aria-label", "Move");
  Object.assign(pad.style, {
    position: "absolute",
    left: "24px",
    bottom: "24px",
    width: `${PAD_SIZE}px`,
    height: `${PAD_SIZE}px`,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.1)",
    touchAction: "none",
    pointerEvents: "auto",
  } satisfies Partial<CSSStyleDeclaration>);

  const button = (label: string, right: number, bottom: number): HTMLButtonElement => {
    const b = doc.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("aria-label", label);
    Object.assign(b.style, {
      position: "absolute",
      right: `${right}px`,
      bottom: `${bottom}px`,
      minWidth: `${Math.max(BUTTON_SIZE, TOUCH_TARGET_MIN)}px`,
      minHeight: `${Math.max(BUTTON_SIZE, TOUCH_TARGET_MIN)}px`,
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.7)",
      background: "rgba(20,30,40,0.6)",
      color: "#fff",
      font: "600 14px system-ui, sans-serif",
      touchAction: "manipulation",
      pointerEvents: "auto",
    } satisfies Partial<CSSStyleDeclaration>);
    return b;
  };
  const interact = button("Act", 24, 96);
  const switchNext = button("Switch", 104, 40);
  wrap.append(pad, interact, switchNext);
  root.append(wrap);

  const controls: TouchControls = {
    pad: Object.assign(pad, {
      rect: () => pad.getBoundingClientRect(),
      capture: (id: number) => pad.setPointerCapture(id),
    }),
    interact,
    switchNext,
  };
  return { controls, element: wrap };
}
