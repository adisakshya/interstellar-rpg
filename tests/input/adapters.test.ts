import { describe, expect, it } from "vitest";
import {
  BUTTON_SIZE,
  createKeyboardAdapter,
  createMouseAdapter,
  createStick,
  createTouchAdapter,
  PAD_SIZE,
  stickVector,
  TOUCH_TARGET_MIN,
  type InputAction,
  type TouchControls,
} from "../../src/input";

const key = (type: "keydown" | "keyup", code: string, repeat = false) =>
  Object.assign(new Event(type, { cancelable: true }), { code, repeat });
const pointer = (type: string, pointerId: number, clientX: number, clientY: number, pointerType = "touch") =>
  Object.assign(new Event(type), { pointerId, clientX, clientY, pointerType });

function fakeControls(): TouchControls & { pad: EventTarget; captured: number[] } {
  const captured: number[] = [];
  const pad = Object.assign(new EventTarget(), {
    rect: () => ({ left: 0, top: 500, width: PAD_SIZE, height: PAD_SIZE }),
    capture: (id: number) => captured.push(id),
  });
  return { pad, interact: new EventTarget(), switchNext: new EventTarget(), captured };
}

describe("stick maths", () => {
  const o = { x: 100, y: 100 };
  it("has a dead zone, clamps to the unit circle and keeps direction", () => {
    expect(stickVector(o, { x: 105, y: 100 }, 60)).toEqual({ x: 0, y: 0 });
    expect(stickVector(o, { x: 160, y: 100 }, 60)).toEqual({ x: 1, y: 0 });
    expect(stickVector(o, { x: 1000, y: 100 }, 60)).toEqual({ x: 1, y: 0 });
    const diag = stickVector(o, { x: 1100, y: 1100 }, 60);
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1, 1);
    expect(stickVector(o, { x: 100, y: 40 }, 60)).toEqual({ x: 0, y: -1 }); // up is negative y
  });

  it("follows one pointer only and ignores a second finger", () => {
    const log: InputAction[] = [];
    const stick = createStick((a) => log.push(a), { radius: 60 });
    expect(stick.begin(1, o, { x: 160, y: 100 })).toBe(true);
    expect(stick.begin(2, o, { x: 40, y: 100 })).toBe(false);
    stick.move(2, { x: 40, y: 100 });
    stick.end(2);
    expect(log).toEqual([{ kind: "Move", x: 1, y: 0 }]);
    stick.end(1);
    expect(log.at(-1)).toEqual({ kind: "Move", x: 0, y: 0 });
  });
});

describe("keyboard adapter", () => {
  it("moves with WASD and arrows, normalises diagonals and cancels opposite keys", () => {
    const target = new EventTarget();
    const log: InputAction[] = [];
    createKeyboardAdapter(target, (a) => log.push(a));
    target.dispatchEvent(key("keydown", "KeyW"));
    target.dispatchEvent(key("keydown", "ArrowRight"));
    target.dispatchEvent(key("keydown", "KeyS")); // cancels W
    target.dispatchEvent(key("keyup", "KeyS"));
    target.dispatchEvent(key("keyup", "KeyW"));
    target.dispatchEvent(key("keyup", "ArrowRight"));
    expect(log).toEqual([
      { kind: "Move", x: 0, y: -1 },
      { kind: "Move", x: 0.71, y: -0.71 },
      { kind: "Move", x: 1, y: 0 },
      { kind: "Move", x: 0.71, y: -0.71 },
      { kind: "Move", x: 1, y: 0 },
      { kind: "Move", x: 0, y: 0 },
    ]);
  });

  it("maps action keys once per press and ignores key repeat", () => {
    const target = new EventTarget();
    const log: InputAction[] = [];
    createKeyboardAdapter(target, (a) => log.push(a));
    for (const code of ["KeyE", "Enter", "KeyQ", "Digit2"]) target.dispatchEvent(key("keydown", code));
    target.dispatchEvent(key("keydown", "KeyE", true));
    expect(log).toEqual([
      { kind: "Interact" },
      { kind: "Interact" },
      { kind: "SwitchNext" },
      { kind: "SwitchTo", index: 2 },
    ]);
  });

  it("leaves Tab alone so keyboard focus navigation keeps working", () => {
    const target = new EventTarget();
    const log: InputAction[] = [];
    createKeyboardAdapter(target, (a) => log.push(a));
    const tab = key("keydown", "Tab");
    target.dispatchEvent(tab);
    expect(log).toEqual([]);
    expect(tab.defaultPrevented).toBe(false);
  });

  it("lets a focused button handle Enter itself: no second game action", () => {
    const target = new EventTarget();
    const log: InputAction[] = [];
    createKeyboardAdapter(target, (a) => log.push(a));
    const from = (selectorMatches: string) => ({ closest: (s: string) => (s.includes(selectorMatches) ? {} : null) });
    const enterOnButton = Object.defineProperty(key("keydown", "Enter"), "target", { value: from("button") });
    target.dispatchEvent(enterOnButton);
    expect(log).toEqual([]);
    // Movement and other shortcuts still work with a button focused (e.g. right after clicking it).
    target.dispatchEvent(Object.defineProperty(key("keydown", "KeyE"), "target", { value: from("button") }));
    expect(log).toEqual([{ kind: "Interact" }]);
    // And text entry owns every key.
    target.dispatchEvent(Object.defineProperty(key("keydown", "KeyE"), "target", { value: from("input") }));
    expect(log).toHaveLength(1);
  });

  it("stops moving when the window loses focus, and detaches cleanly", () => {
    const target = new EventTarget();
    const log: InputAction[] = [];
    const detach = createKeyboardAdapter(target, (a) => log.push(a));
    target.dispatchEvent(key("keydown", "KeyD"));
    target.dispatchEvent(new Event("blur"));
    expect(log.at(-1)).toEqual({ kind: "Move", x: 0, y: 0 });
    detach();
    target.dispatchEvent(key("keydown", "KeyE"));
    expect(log).toHaveLength(2);
  });
});

describe("mouse adapter", () => {
  it("steers while dragging from where the press began, and ignores touch pointers", () => {
    const target = new EventTarget();
    const log: InputAction[] = [];
    createMouseAdapter(target, (a) => log.push(a), 90);
    target.dispatchEvent(pointer("pointerdown", 1, 300, 300, "touch"));
    expect(log).toEqual([]);
    target.dispatchEvent(pointer("pointerdown", 7, 300, 300, "mouse"));
    target.dispatchEvent(pointer("pointermove", 7, 390, 300, "mouse"));
    target.dispatchEvent(pointer("pointerup", 7, 390, 300, "mouse"));
    expect(log).toEqual([
      { kind: "Move", x: 1, y: 0 },
      { kind: "Move", x: 0, y: 0 },
    ]);
  });
});

describe("mouse adapter: captured drags cannot get stuck", () => {
  const dragging = () => {
    const captured: number[] = [];
    const target = Object.assign(new EventTarget(), { setPointerCapture: (id: number) => captured.push(id) });
    const blur = new EventTarget();
    const log: InputAction[] = [];
    createMouseAdapter(target, (a) => log.push(a), 90, blur);
    target.dispatchEvent(pointer("pointerdown", 7, 300, 300, "mouse"));
    target.dispatchEvent(pointer("pointermove", 7, 390, 300, "mouse"));
    return { target, blur, log, captured };
  };

  it("captures the pointer on press", () => {
    expect(dragging().captured).toEqual([7]);
  });

  it("stops when capture is lost (release over a button or outside the window)", () => {
    const { target, log } = dragging();
    target.dispatchEvent(pointer("lostpointercapture", 7, 0, 0, "mouse"));
    expect(log.at(-1)).toEqual({ kind: "Move", x: 0, y: 0 });
  });

  it("stops when the window loses focus, and accepts a new drag afterwards", () => {
    const { target, blur, log } = dragging();
    blur.dispatchEvent(new Event("blur"));
    expect(log.at(-1)).toEqual({ kind: "Move", x: 0, y: 0 });
    target.dispatchEvent(pointer("pointerdown", 8, 100, 100, "mouse"));
    target.dispatchEvent(pointer("pointermove", 8, 190, 100, "mouse"));
    expect(log.at(-1)).toEqual({ kind: "Move", x: 1, y: 0 });
  });
});

describe("touch adapter", () => {
  it("drives the stick from the pad's centre and captures the pointer", () => {
    const controls = fakeControls();
    const log: InputAction[] = [];
    createTouchAdapter(controls, (a) => log.push(a));
    const centre = { x: PAD_SIZE / 2, y: 500 + PAD_SIZE / 2 };
    controls.pad.dispatchEvent(pointer("pointerdown", 3, centre.x + PAD_SIZE / 2, centre.y));
    controls.pad.dispatchEvent(pointer("pointerup", 3, centre.x, centre.y));
    expect(controls.captured).toEqual([3]);
    expect(log).toEqual([
      { kind: "Move", x: 1, y: 0 },
      { kind: "Move", x: 0, y: 0 },
    ]);
  });

  it("maps its buttons to actions", () => {
    const controls = fakeControls();
    const log: InputAction[] = [];
    createTouchAdapter(controls, (a) => log.push(a));
    controls.interact.dispatchEvent(new Event("click"));
    controls.switchNext.dispatchEvent(new Event("click"));
    expect(log).toEqual([{ kind: "Interact" }, { kind: "SwitchNext" }]);
  });

  it("sizes every touch target at 44 CSS px or more (NFR-04)", () => {
    expect(PAD_SIZE).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
    expect(BUTTON_SIZE).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
  });
});
