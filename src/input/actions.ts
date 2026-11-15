/**
 * What the player means, independent of the device (ARCHITECTURE §8). Adapters emit these; `app` turns them into
 * domain commands or presentation updates. Keyboard/mouse and touch therefore produce the same action log for the
 * same intent (INV-15, TIMELINES W6).
 */
export type InputAction =
  /** Stick position, −1..1 per axis; y grows downward like screen coordinates. (0, 0) means released. */
  | { readonly kind: "Move"; readonly x: number; readonly y: number }
  /** Do the thing available here (the context activity, e.g. scan the beacon). */
  | { readonly kind: "Interact" }
  /** Switch to the next character who can be switched to. */
  | { readonly kind: "SwitchNext" }
  /** Switch to roster slot `index` (1-based, in switcher order). */
  | { readonly kind: "SwitchTo"; readonly index: number };

export type Emit = (action: InputAction) => void;

/** Touch targets are at least 44 CSS px (NFR-04, ARCHITECTURE §8). */
export const TOUCH_TARGET_MIN = 44;
