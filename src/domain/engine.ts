import type {
  CheckpointSnapshot,
  Command,
  CommandKind,
  DecisionForecast,
  DomainEvent,
  EventDraft,
  RejectCode,
  Result,
} from "./commands";
import type { DecisionId } from "./ids";
import type { GameState } from "./state";

/** How many processed command ids the state remembers for idempotency (ADR-002). */
export const PROCESSED_ID_WINDOW = 1024;

/** A checkpoint a handler captured: `afterEvents` = how many of its events precede the snapshot. */
export interface CheckpointCapture {
  readonly decisionId: DecisionId;
  readonly state: GameState;
  readonly afterEvents: number;
}

/** What a command handler decides. Handlers are pure: they never mutate `state`. */
export type HandlerOutcome =
  | {
      kind: "commit";
      state: GameState;
      events: readonly EventDraft[];
      /** Snapshots for CheckpointCreated; `afterEvents` = how many of `events` precede the snapshot. */
      checkpoints?: readonly CheckpointCapture[];
      /** Set when an activity stopped at a hard deadline (TIMELINES §3). */
      interruptedBy?: DecisionId;
      /** Record the command id for idempotency (default true). Session-only commands such as switching opt out. */
      recordId?: boolean;
    }
  | { kind: "blocked"; decisionId: DecisionId; deadlineT: number }
  | { kind: "rejected"; code: RejectCode; detail?: string };

export type Handler<K extends CommandKind> = (
  state: GameState,
  command: Extract<Command, { kind: K }>,
) => HandlerOutcome;
export type HandlerMap = { [K in CommandKind]?: Handler<K> };
/** Pure query used by the UI and for early resolution (TIMELINES §3). */
export type Forecaster = (state: GameState, decisionId: DecisionId) => DecisionForecast | null;

/** Everything the reducer needs besides state; built from loaded content by `app`. */
export interface EngineRules {
  readonly handlers: HandlerMap;
  readonly forecast?: Forecaster;
}

/**
 * Apply one command to a state. Pure: returns the next state and the result, never mutates the input.
 * Rejected, blocked and duplicate commands return the input state unchanged (INV-04, INV-05).
 */
export function apply(state: GameState, command: Command, handlers: HandlerMap): { state: GameState; result: Result } {
  if (state.processedCommandIds.includes(command.commandId)) return { state, result: { kind: "Duplicate" } };

  const handler = handlers[command.kind] as Handler<typeof command.kind> | undefined;
  if (!handler) {
    return { state, result: { kind: "Rejected", code: "INVALID", detail: `no handler for ${command.kind}` } };
  }
  const outcome = handler(state, command as never);
  if (outcome.kind === "rejected") {
    const result: Result = { kind: "Rejected", code: outcome.code };
    if (outcome.detail !== undefined) result.detail = outcome.detail;
    return { state, result };
  }
  if (outcome.kind === "blocked") {
    return { state, result: { kind: "Blocked", decisionId: outcome.decisionId, deadlineT: outcome.deadlineT } };
  }

  const base = state.seq;
  let lastT = state.T;
  const events: DomainEvent[] = outcome.events.map((draft, i) => {
    if (draft.T < lastT) throw new Error(`event ${draft.kind} at T=${draft.T} goes back in time (INV-01)`);
    lastT = draft.T;
    return { ...draft, seq: base + i + 1 };
  });
  const checkpoints: CheckpointSnapshot[] = (outcome.checkpoints ?? []).map((c) =>
    deepFreeze({ decisionId: c.decisionId, state: { ...c.state, seq: base + c.afterEvents } }),
  );

  const recordId = outcome.recordId ?? true;
  const next: GameState = {
    ...outcome.state,
    seq: base + events.length,
    processedCommandIds: recordId
      ? [...state.processedCommandIds, command.commandId].slice(-PROCESSED_ID_WINDOW)
      : state.processedCommandIds,
  };
  const frozenEvents = deepFreeze(events);
  const result: Result = outcome.interruptedBy
    ? { kind: "Interrupted", decisionId: outcome.interruptedBy, events: frozenEvents, checkpoints }
    : { kind: "Ok", events: frozenEvents, checkpoints };
  return { state: deepFreeze(next), result };
}

export interface GameEngine {
  /** The only way state changes (ARCHITECTURE §1). */
  dispatch(command: Command): Result;
  /** Current state, deeply frozen. */
  getState(): GameState;
  /** Called after every dispatch that changed state. Returns an unsubscribe function. */
  subscribe(listener: (state: GameState, events: readonly DomainEvent[]) => void): () => void;
  /** Pure: never changes state. `null` when the decision cannot be forecast. */
  forecast(decisionId: DecisionId): DecisionForecast | null;
}

export function createEngine(initial: GameState, rules: EngineRules): GameEngine {
  let state = deepFreeze(initial);
  const listeners = new Set<(state: GameState, events: readonly DomainEvent[]) => void>();
  return {
    dispatch(command) {
      const out = apply(state, command, rules.handlers);
      if (out.state !== state) {
        state = out.state;
        const events = out.result.kind === "Ok" || out.result.kind === "Interrupted" ? out.result.events : [];
        for (const listener of [...listeners]) listener(state, events);
      }
      return out.result;
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    forecast: (decisionId) => rules.forecast?.(state, decisionId) ?? null,
  };
}

/** Objects this module has frozen together with everything below them. */
const deeplyFrozen = new WeakSet<object>();

/**
 * Recursively freeze plain objects and arrays so consumers cannot mutate domain data. Subtrees already
 * deep-frozen here are skipped; anything else is traversed, even if it was shallow-frozen elsewhere.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || deeplyFrozen.has(value)) return value;
  deeplyFrozen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  return value;
}
