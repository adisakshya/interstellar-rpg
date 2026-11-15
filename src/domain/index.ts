// Game-domain public API. Pure TypeScript: no Babylon, DOM, Date or Math.random (ARCHITECTURE §2).
// See docs/ARCHITECTURE.md §3 and docs/TIMELINES.md.

/** Version of the domain state schema; bump with a migration (ADR-003). */
export const SCHEMA_VERSION = 1;

export * from "./ids";
export * from "./state";
export * from "./commands";
export { apply, createEngine, deepFreeze, PROCESSED_ID_WINDOW } from "./engine";
export type { EngineRules, Forecaster, GameEngine, Handler, HandlerMap, HandlerOutcome } from "./engine";
export { createHandlers, defaultHandlers } from "./handlers";
export { createClockHandlers } from "./clocks";
export type { RateTable } from "./clocks";
