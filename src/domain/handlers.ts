import { createClockHandlers, createForecaster } from "./clocks";
import type { EngineRules, HandlerMap } from "./engine";
import type { TimeTables } from "./rules";

/**
 * Production command handlers. DOM-001 provides switching; TIME-001..004, RES-001 and later issues add
 * the rest. A command without a handler is rejected as INVALID rather than silently ignored.
 */
export const defaultHandlers: HandlerMap = {
  SwitchCharacter(state, command) {
    const target = state.characters[command.targetId];
    if (!target) return { kind: "rejected", code: "INVALID", detail: `unknown character ${command.targetId}` };
    // A locked sequence denies switching away (TIMELINES §4).
    const current = state.characters[state.controlled];
    if (command.targetId !== state.controlled && current?.unavailable === "LOCKED_SEQUENCE") {
      return { kind: "rejected", code: "LOCKED_SEQUENCE" };
    }
    if (target.unavailable !== null) {
      return { kind: "rejected", code: "CHARACTER_UNAVAILABLE", detail: target.unavailable };
    }
    // Switching is session state, not history: no events, no recorded id, nothing else changes (INV-03).
    return { kind: "commit", state: { ...state, controlled: command.targetId }, events: [], recordId: false };
  },
};

/** All production handlers for the given content-derived tables. */
export function createHandlers(tables: TimeTables): HandlerMap {
  return { ...defaultHandlers, ...createClockHandlers(tables) };
}

/** Handlers plus the forecast query, ready for `createEngine`. */
export function createRules(tables: TimeTables): EngineRules {
  return { handlers: createHandlers(tables), forecast: createForecaster(tables) };
}
