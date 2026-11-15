import type { DecisionForecast, EventDraft } from "./commands";
import type { CheckpointCapture, Forecaster, HandlerMap, HandlerOutcome } from "./engine";
import type { CharacterId, DecisionId, LocationId } from "./ids";
import type { DecisionDef, DecisionEffect, TimeTables } from "./rules";
import type { CharacterState, GameState } from "./state";

export type { RateTable } from "./rules";

type Rejected = Extract<HandlerOutcome, { kind: "rejected" }>;
const reject = (code: Rejected["code"], detail?: string): Rejected =>
  detail === undefined ? { kind: "rejected", code } : { kind: "rejected", code, detail };

/** Clock state after moving the reference time from T0 to T (TIMELINES §2). Only + − × ÷ (§1). */
function clocksAt(
  start: GameState,
  current: GameState,
  rateOf: (loc: LocationId) => number,
  actorId: CharacterId,
  T: number,
  actorTau: number,
): GameState {
  const dT = T - start.T;
  const characters: Record<CharacterId, CharacterState> = {};
  for (const [id, c] of Object.entries(start.characters) as [CharacterId, CharacterState][]) {
    characters[id] = { ...c, tau: id === actorId ? actorTau : c.tau + rateOf(c.location) * dT };
  }
  return { ...current, T, characters };
}

const isOpen = (state: GameState, def: DecisionDef) => state.decisions[def.id]?.status !== "resolved";

function effectsOf(state: GameState, def: DecisionDef, optionId: string): { state: GameState; events: EventDraft[] } {
  const events: EventDraft[] = [];
  let s = state;
  for (const effect of def.options[optionId] ?? ([] as readonly DecisionEffect[])) {
    if (effect.kind === "SetAvailability") {
      const c = s.characters[effect.characterId];
      if (!c) continue;
      s = { ...s, characters: { ...s.characters, [c.id]: { ...c, unavailable: effect.reason } } };
      events.push({ kind: "AvailabilityChanged", T: s.T, characterId: c.id, reason: effect.reason });
    } else {
      const known = s.knowledge[effect.characterId] ?? [];
      if (known.includes(effect.factId)) continue;
      s = { ...s, knowledge: { ...s.knowledge, [effect.characterId]: [...known, effect.factId] } };
      events.push({ kind: "FactLearned", T: s.T, characterId: effect.characterId, factId: effect.factId });
    }
  }
  return { state: s, events };
}

/** Time handlers (TIME-001, TIME-002): clocks, decision triggers, hard deadlines and resolution. */
export function createClockHandlers(
  tables: TimeTables,
): Pick<HandlerMap, "AdvanceTime" | "FreeRoamTick" | "ResolveDecision"> {
  const decisions = Object.values(tables.decisions ?? {});
  const validRate = (loc: LocationId): number | undefined => {
    const r = tables.rates[loc];
    return r !== undefined && Number.isFinite(r) && r > 0 ? r : undefined;
  };

  function advance(
    state: GameState,
    actorId: CharacterId,
    dTau: number,
    activity: { id: string; atomic: boolean } | null,
  ): HandlerOutcome {
    const actor = state.characters[actorId];
    if (!actor) return reject("INVALID", `unknown character ${actorId}`);
    if (actorId !== state.controlled) return reject("NOT_CONTROLLED");
    // A locked sequence only stops switching away (TIMELINES §4); the controlled actor still acts.
    if (actor.unavailable !== null && actor.unavailable !== "LOCKED_SEQUENCE")
      return reject("CHARACTER_UNAVAILABLE", actor.unavailable);
    if (!Number.isFinite(dTau) || dTau <= 0) return reject("INVALID", `dTau must be > 0, got ${dTau}`);
    for (const c of Object.values(state.characters)) {
      if (validRate(c.location) === undefined) return reject("INVALID", `no rate for ${c.location}`);
    }
    const rateOf = (loc: LocationId) => validRate(loc)!;
    const actorRate = rateOf(actor.location);
    const T0 = state.T;
    const T1 = T0 + dTau / actorRate;

    // The first unresolved hard deadline strictly inside the span stops T (INV-06).
    let barrier: DecisionDef | null = null;
    for (const d of decisions) {
      if (d.deadlineT === null || !isOpen(state, d) || d.deadlineT >= T1) continue;
      if (!barrier || d.deadlineT < barrier.deadlineT! || (d.deadlineT === barrier.deadlineT && d.id < barrier.id))
        barrier = d;
    }
    if (barrier && (activity?.atomic || barrier.deadlineT! <= T0)) {
      // Atomic, or already held at the deadline: nothing commits (INV-05).
      return { kind: "blocked", decisionId: barrier.id, deadlineT: barrier.deadlineT! };
    }
    const Tend = barrier ? barrier.deadlineT! : T1;
    const tauAt = (T: number) => (T === T1 ? actor.tau + dTau : actor.tau + (T - T0) * actorRate);
    // A resumed activity's Δτ covers what was left, so progress accumulates on top of what was kept (§3).
    // Each character keeps their own interrupted work, so switching never loses another character's progress.
    const saved = state.activities[actorId];
    const resumed = activity !== null && saved?.activityId === activity.id;
    const kept = resumed ? saved.progress : 0;
    const withProgress = (g: GameState, progress: number): GameState =>
      activity
        ? { ...g, activities: { ...g.activities, [actorId]: { activityId: activity.id, actorId, progress } } }
        : g;
    const progressAt = (T: number) => kept + ((T - T0) / (T1 - T0)) * (1 - kept);

    // Decisions not yet triggered whose trigger is at or before Tend, in T order then id order.
    const triggers = decisions
      .filter((d) => state.decisions[d.id] === undefined && d.triggerT <= Tend)
      .sort((a, b) => a.triggerT - b.triggerT || (a.id < b.id ? -1 : 1));

    const events: EventDraft[] = [];
    const checkpoints: CheckpointCapture[] = [];
    let s = state;
    for (const d of triggers) {
      const at = d.triggerT > s.T ? d.triggerT : s.T;
      if (at > s.T) {
        const dT = at - s.T;
        s = clocksAt(state, s, rateOf, actorId, at, tauAt(at));
        events.push({ kind: "ClockAdvanced", T: at, dT });
      }
      s = { ...s, decisions: { ...s.decisions, [d.id]: { status: "pending", optionId: null } } };
      // The snapshot is a full state at this moment, including how far the activity has got (§8).
      s = withProgress(s, progressAt(at));
      events.push({ kind: "DecisionPending", T: at, decisionId: d.id });
      if (d.checkpoint) {
        events.push({ kind: "CheckpointCreated", T: at, decisionId: d.id });
        checkpoints.push({ decisionId: d.id, state: s, afterEvents: events.length });
      }
    }
    if (Tend > s.T) {
      const dT = Tend - s.T;
      s = clocksAt(state, s, rateOf, actorId, Tend, tauAt(Tend));
      events.push({ kind: "ClockAdvanced", T: Tend, dT });
    }

    if (barrier) {
      const progress = progressAt(Tend);
      if (activity) {
        s = withProgress(s, progress);
        events.push({ kind: "ActivityInterrupted", T: Tend, activityId: activity.id, progress });
      }
      return { kind: "commit", state: s, events, checkpoints, interruptedBy: barrier.id };
    }
    if (activity) {
      // Done: clear the resumed entry, or keep the actor's earlier unrelated entry as it was.
      const rest = Object.fromEntries(Object.entries(state.activities).filter(([id]) => id !== actorId));
      s = { ...s, activities: resumed ? rest : state.activities };
      events.push({ kind: "ActivityCompleted", T: Tend, activityId: activity.id, progress: 1 });
    }
    return { kind: "commit", state: s, events, checkpoints };
  }

  return {
    AdvanceTime: (state, command) =>
      advance(state, command.actorId, command.dTau, {
        id: command.activityId,
        atomic: tables.activities?.[command.activityId]?.atomic ?? false,
      }),
    FreeRoamTick: (state, command) => advance(state, command.actorId, command.dTau, null),

    ResolveDecision(state, command) {
      const def = tables.decisions?.[command.decisionId];
      if (!def) return reject("INVALID", `unknown decision ${command.decisionId}`);
      if (!Object.hasOwn(def.options, command.optionId)) return reject("INVALID", `unknown option ${command.optionId}`);
      const current = state.decisions[def.id];
      if (current?.status === "resolved") return reject("DECISION_ALREADY_RESOLVED");
      if (state.controlled !== def.owner) return reject("NOT_CONTROLLED");

      const events: EventDraft[] = [];
      const checkpoints: CheckpointCapture[] = [];
      let s = state;
      if (current === undefined) {
        // Early resolution of a forecast decision (TIMELINES §3): only hard decisions can block, so only they
        // may be resolved before their trigger. The checkpoint is taken before the choice.
        if (def.deadlineT === null) return reject("INVALID", `decision ${def.id} is not pending`);
        s = { ...s, decisions: { ...s.decisions, [def.id]: { status: "pending", optionId: null } } };
        events.push({ kind: "DecisionPending", T: s.T, decisionId: def.id });
        if (def.checkpoint) {
          events.push({ kind: "CheckpointCreated", T: s.T, decisionId: def.id });
          checkpoints.push({ decisionId: def.id, state: s, afterEvents: events.length });
        }
      }
      s = { ...s, decisions: { ...s.decisions, [def.id]: { status: "resolved", optionId: command.optionId } } };
      events.push({ kind: "DecisionResolved", T: s.T, decisionId: def.id, optionId: command.optionId });
      const effects = effectsOf(s, def, command.optionId);
      return { kind: "commit", state: effects.state, events: [...events, ...effects.events], checkpoints };
    },
  };
}

/** Forecast for the UI and early resolution: when a decision triggers and its deadline, if still open. */
export function createForecaster(tables: TimeTables): Forecaster {
  return (state: GameState, decisionId: DecisionId): DecisionForecast | null => {
    const def = tables.decisions?.[decisionId];
    if (!def || !isOpen(state, def)) return null;
    return { decisionId, triggerT: def.triggerT, deadlineT: def.deadlineT };
  };
}
