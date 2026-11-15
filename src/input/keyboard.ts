import type { Emit } from "./actions";

const DIRECTIONS: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

type KeyLike = Event & { code: string; repeat?: boolean };

const closest = (target: EventTarget | null, selector: string): boolean => {
  const el = target as { closest?: (s: string) => unknown } | null;
  return typeof el?.closest === "function" && el.closest(selector) !== null;
};
/** Text entry owns every key. */
const isTextEntry = (t: EventTarget | null) => closest(t, "input, textarea, select, [contenteditable='true']");
/** A focused button or link turns Enter into its own click, so the shortcut must not also fire. */
const activatesOnEnter = (t: EventTarget | null) => closest(t, "button, a[href], summary");

/**
 * Keyboard adapter: WASD / arrows move, E or Enter interacts, Q switches to the next character, 1–9 pick a roster
 * slot. Tab is left alone so keyboard focus navigation keeps working (NFR-04). Returns a function that detaches it. Held keys are tracked, so opposite keys cancel out.
 */
export function createKeyboardAdapter(target: EventTarget, emit: Emit): () => void {
  const held = new Set<string>();
  let last = { x: 0, y: 0 };
  const moveFromHeld = () => {
    let x = 0;
    let y = 0;
    for (const code of held) {
      const d = DIRECTIONS[code];
      if (d) {
        x += d[0];
        y += d[1];
      }
    }
    // Diagonals are normalised, matching a stick pushed to the same direction.
    const length = Math.hypot(x, y);
    const v =
      length === 0
        ? { x: 0, y: 0 }
        : { x: Math.round((x / length) * 100) / 100, y: Math.round((y / length) * 100) / 100 };
    if (v.x !== last.x || v.y !== last.y) {
      last = v;
      emit({ kind: "Move", x: v.x, y: v.y });
    }
  };

  const onDown = (event: Event) => {
    const e = event as KeyLike;
    if (isTextEntry(event.target)) return;
    if (e.code in DIRECTIONS) {
      held.add(e.code);
      moveFromHeld();
    } else if (e.repeat) {
      return; // holding an action key does not repeat it
    } else if (e.code === "Enter" && activatesOnEnter(event.target)) {
      return; // the focused control handles Enter itself: one press, one action
    } else if (e.code === "KeyE" || e.code === "Enter") emit({ kind: "Interact" });
    else if (e.code === "KeyQ") emit({ kind: "SwitchNext" });
    else if (/^Digit[1-9]$/.test(e.code)) emit({ kind: "SwitchTo", index: Number(e.code.slice(5)) });
  };
  const onUp = (event: Event) => {
    const e = event as KeyLike;
    if (held.delete(e.code)) moveFromHeld();
  };
  // Losing focus must not leave keys "stuck" down.
  const onBlur = () => {
    held.clear();
    moveFromHeld();
  };

  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  target.addEventListener("blur", onBlur);
  return () => {
    target.removeEventListener("keydown", onDown);
    target.removeEventListener("keyup", onUp);
    target.removeEventListener("blur", onBlur);
  };
}
