// Game-domain public API. Pure TypeScript: no Babylon, DOM, Date or Math.random (ARCHITECTURE §2).
// See docs/ARCHITECTURE.md §3 and docs/TIMELINES.md.

export { createInitialState, SCHEMA_VERSION } from "./initial";
export type { InitialSpec } from "./initial";

export * from "./ids";
export * from "./state";
export * from "./commands";
export { apply, createEngine, deepFreeze, PROCESSED_ID_WINDOW } from "./engine";
export type {
  CheckpointCapture,
  EngineRules,
  Forecaster,
  GameEngine,
  Handler,
  HandlerMap,
  HandlerOutcome,
} from "./engine";
export { createHandlers, createRules, defaultHandlers } from "./handlers";
export { createClockHandlers, createForecaster } from "./clocks";
export { isIntroduced, switchRejection, switchView } from "./availability";
export { createKnowledgeHandlers, playerOnlyFacts } from "./knowledge";
export type { Handoff, SwitchOption, SwitchView } from "./availability";
export type {
  ActivityDef,
  DecisionDef,
  DecisionEffect,
  LinkDef,
  RateTable,
  ResourceDef,
  ResourceLevel,
  TimeTables,
} from "./rules";
