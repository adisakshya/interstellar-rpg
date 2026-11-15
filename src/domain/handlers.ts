import type { HandlerMap } from "./engine";

/**
 * Production command handlers. DOM-001 provides switching; TIME-001..004, RES-001 and later issues add
 * the rest. A command without a handler is rejected as INVALID rather than silently ignored.
 */
export const defaultHandlers: HandlerMap = {
  SwitchCharacter(state, command) {
    const target = state.characters[command.targetId];
    if (!target) return { kind: "rejected", code: "INVALID", detail: `unknown character ${command.targetId}` };
    if (target.unavailable !== null) {
      return { kind: "rejected", code: "CHARACTER_UNAVAILABLE", detail: target.unavailable };
    }
    // Switching is session state, not history: no events, no recorded id, nothing else changes (INV-03).
    return { kind: "commit", state: { ...state, controlled: command.targetId }, events: [], recordId: false };
  },
};
