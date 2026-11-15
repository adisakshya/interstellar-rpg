// Action map and device adapters (INPUT-001, ARCHITECTURE §8). Emits actions only; `app` turns them into commands.
export { TOUCH_TARGET_MIN } from "./actions";
export type { Emit, InputAction } from "./actions";
export { createKeyboardAdapter } from "./keyboard";
export { createMouseAdapter } from "./pointer";
export { createStick, stickVector } from "./stick";
export type { Point } from "./stick";
export { BUTTON_SIZE, createTouchAdapter, mountTouchControls, PAD_SIZE } from "./touch";
export type { TouchControls } from "./touch";
