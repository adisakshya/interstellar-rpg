import { switchRejection } from "./availability";
import { createClockHandlers, createForecaster } from "./clocks";
import type { EngineRules, Handler, HandlerMap } from "./engine";
import type { ActivityDef, TimeTables } from "./rules";

/** SwitchCharacter: changes only `controlled` (INV-03), following the rule in availability.ts. */
function createSwitchHandler(activities?: Readonly<Record<string, ActivityDef>>): Handler<"SwitchCharacter"> {
  return (state, command) => {
    const rejection = switchRejection(state, command.targetId, activities);
    if (rejection) {
      return rejection.detail === undefined
        ? { kind: "rejected", code: rejection.code }
        : { kind: "rejected", code: rejection.code, detail: rejection.detail };
    }
    // Session state, not history: no events, no recorded id, nothing else changes.
    return { kind: "commit", state: { ...state, controlled: command.targetId }, events: [], recordId: false };
  };
}

/**
 * Production command handlers. DOM-001 provides switching; TIME-001..004, RES-001 and later issues add
 * the rest. A command without a handler is rejected as INVALID rather than silently ignored.
 */
export const defaultHandlers: HandlerMap = { SwitchCharacter: createSwitchHandler() };

/** All production handlers for the given content-derived tables. */
export function createHandlers(tables: TimeTables): HandlerMap {
  return { SwitchCharacter: createSwitchHandler(tables.activities), ...createClockHandlers(tables) };
}

/** Handlers plus the forecast query, ready for `createEngine`. */
export function createRules(tables: TimeTables): EngineRules {
  return { handlers: createHandlers(tables), forecast: createForecaster(tables) };
}
