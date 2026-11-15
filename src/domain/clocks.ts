import type { DecisionForecast, EventDraft } from "./commands";
import type { CheckpointCapture, Forecaster, HandlerMap, HandlerOutcome } from "./engine";
import type { CharacterId, DecisionId, LocationId } from "./ids";
import { deliver, learn } from "./knowledge";
import { decisionTimes, depletionTimes, resourcesAt } from "./resources";
import type { ActivityDef, DecisionDef, DecisionEffect, TimeTables } from "./rules";
import type { CharacterState, GameState, MessageState } from "./state";

export type { RateTable } from "./rules";

type Rejected = Extract<HandlerOutcome, { kind: "rejected" }>;
const reject = (code: Rejected["code"], detail?: string): Rejected =>
  detail === undefined ? { kind: "rejected", code } : { kind: "rejected", code, detail };

/** Clock state after moving the reference time from T0 to T (TIMELINES §2). Only + − × ÷ (§1). */
function clocksAt(
  start: GameState,
  current: GameState,
  tables: TimeTables,
  rateOf: (loc: LocationId) => number,
  actorId: CharacterId,
  T: number,
  actorTau: number,
): GameState {
  const dT = T - start.T;
  const characters: Record<CharacterId, CharacterState> = {};
  for (const [id, c] of Object.entries(start.characters) as [CharacterId, CharacterState][]) {
    // The dead stop living: their clock keeps the time they had when they died.
    const tau = id === actorId ? actorTau : c.unavailable === "DEAD" ? c.tau : c.tau + rateOf(c.location) * dT;
    characters[id] = { ...c, tau };
  }
  return { ...current, T, characters, resources: resourcesAt(start, tables, T, rateOf) };
}

const isAtomic = (def: ActivityDef | undefined) =>
  (def?.atomic ?? false) || (def?.piloting === true && def.assist !== true);

const isOpen = (state: GameState, def: DecisionDef) => state.decisions[def.id]?.status !== "resolved";

function effectsOf(state: GameState, def: DecisionDef, optionId: string): { state: GameState; events: EventDraft[] } {
  const events: EventDraft[] = [];
  let s = state;
  for (const effect of def.options[optionId] ?? ([] as readonly DecisionEffect[])) {
    if (effect.kind === "SpendTime") {
      continue; // time passes after every effect has applied (see ResolveDecision)
    } else if (effect.kind === "SetAvailability") {
      const c = s.characters[effect.characterId];
      if (!c) continue;
      s = {
        ...s,
        characters: {
          ...s.characters,
          [c.id]: { ...c, unavailable: effect.reason, ...(effect.cause === undefined ? {} : { cause: effect.cause }) },
        },
      };
      events.push({ kind: "AvailabilityChanged", T: s.T, characterId: c.id, reason: effect.reason });
    } else {
      const out = learn(s, effect.characterId, effect.factId);
      s = out.state;
      events.push(...out.events);
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
    /** Never stop part-way at a hard deadline, even with no activity to resume (a choice's own time cost). */
    wholly = false,
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

    // Effective trigger and deadline of every decision, from the state at T0 (rates are constant in the span).
    const times = new Map(decisions.map((d) => [d.id, decisionTimes(state, tables, d, rateOf)]));
    const deadlineOf = (d: DecisionDef) => times.get(d.id)!.deadline;

    // The first unresolved hard deadline strictly inside the span stops T (INV-06).
    let barrier: DecisionDef | null = null;
    let barrierT = Number.POSITIVE_INFINITY;
    for (const d of decisions) {
      const dl = deadlineOf(d);
      if (dl === null || !isOpen(state, d) || dl >= T1) continue;
      if (!barrier || dl < barrierT || (dl === barrierT && d.id < barrier.id)) {
        barrier = d;
        barrierT = dl;
      }
    }
    if (barrier && (wholly || activity?.atomic || barrierT <= T0)) {
      // Atomic, or already held at the deadline: nothing commits (INV-05).
      return { kind: "blocked", decisionId: barrier.id, deadlineT: barrierT };
    }
    const Tend = barrier ? barrierT : T1;
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

    // Everything due in the span, in T order: message deliveries first (news can inform a decision at the same
    // moment), then resources running out, then decision triggers, each by id.
    type Step =
      | { T: number; order: 0; id: string; message: MessageState }
      | { T: number; order: 1; id: string }
      | { T: number; order: 2; id: string; decision: DecisionDef };
    const steps: Step[] = [
      ...state.messages
        .filter((m) => !m.delivered && m.deliverT <= Tend)
        .map((message): Step => ({ T: message.deliverT, order: 0, id: message.id, message })),
      ...depletionTimes(state, tables, rateOf)
        .filter((r) => r.T <= Tend)
        .map((r): Step => ({ T: r.T, order: 1, id: r.id })),
      ...decisions
        .filter((d) => state.decisions[d.id] === undefined && times.get(d.id)!.trigger <= Tend)
        .map((decision): Step => ({ T: times.get(decision.id)!.trigger, order: 2, id: decision.id, decision })),
    ];
    steps.sort((a, b) => a.T - b.T || a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const events: EventDraft[] = [];
    const checkpoints: CheckpointCapture[] = [];
    let s = state;
    for (const step of steps) {
      const at = step.T > s.T ? step.T : s.T;
      if (at > s.T) {
        const dT = at - s.T;
        s = clocksAt(state, s, tables, rateOf, actorId, at, tauAt(at));
        events.push({ kind: "ClockAdvanced", T: at, dT });
      }
      if (step.order === 0) {
        const out = deliver(s, step.message);
        s = out.state;
        events.push(...out.events);
        continue;
      }
      if (step.order === 1) {
        s = { ...s, resources: { ...s.resources, [step.id]: { amount: 0 } } };
        events.push({ kind: "ResourceDepleted", T: at, resourceId: step.id, amount: 0 });
        continue;
      }
      const d = step.decision;
      s = { ...s, decisions: { ...s.decisions, [d.id]: { status: "pending", optionId: null } } };
      // The snapshot is a full state at this moment, including how far the activity has got (§8).
      s = withProgress(s, progressAt(at));
      events.push({ kind: "DecisionPending", T: at, decisionId: d.id });
      // No checkpoint inside a choice's own time cost: a snapshot there would hold the choice already made but its
      // remaining cost unpaid, so restoring it would let the player skip that cost. The decision still opens normally.
      if (d.checkpoint && !wholly) {
        events.push({ kind: "CheckpointCreated", T: at, decisionId: d.id });
        checkpoints.push({ decisionId: d.id, state: s, afterEvents: events.length });
      }
    }
    if (Tend > s.T) {
      const dT = Tend - s.T;
      s = clocksAt(state, s, tables, rateOf, actorId, Tend, tauAt(Tend));
      events.push({ kind: "ClockAdvanced", T: Tend, dT });
    }
    for (const [id, r] of Object.entries(s.resources)) {
      const before = state.resources[id]?.amount;
      if (before !== undefined && r.amount !== before) {
        events.push({ kind: "ResourceChanged", T: Tend, resourceId: id, amount: r.amount });
      }
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
      for (const factId of tables.activities?.[activity.id]?.learns ?? []) {
        const out = learn(s, actorId, factId);
        s = out.state;
        events.push(...out.events);
      }
    }
    return { kind: "commit", state: s, events, checkpoints };
  }

  return {
    AdvanceTime: (state, command) =>
      advance(state, command.actorId, command.dTau, {
        id: command.activityId,
        // A flight with no assist can't be left mid-air: it must never stop part-way at a deadline, or the
        // player could not switch to the decision's owner (switching away is locked). So it runs atomically.
        atomic: isAtomic(tables.activities?.[command.activityId]),
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
        if (def.deadlineT === null && def.deadlineWhen === undefined) {
          return reject("INVALID", `decision ${def.id} is not pending`);
        }
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
      const committed = { state: effects.state, events: [...events, ...effects.events], checkpoints };
      // The choice's own time cost runs through the ordinary clock rules, so another decision that triggers inside it
      // is handled as for any activity. But it cannot stop half-way: there is no activity to resume, and the choice is
      // already made. So a hard deadline inside the span blocks the whole choice (nothing commits, INV-05); the player
      // resolves that decision first, which a hard decision allows even before it is pending, and then chooses.
      for (const effect of def.options[command.optionId] ?? []) {
        if (effect.kind !== "SpendTime") continue;
        const out = advance(committed.state, effect.characterId, effect.dTau, null, true);
        if (out.kind !== "commit") return out;
        const offset = committed.events.length;
        committed.state = out.state;
        committed.events = [...committed.events, ...out.events];
        committed.checkpoints = [
          ...committed.checkpoints,
          ...(out.checkpoints ?? []).map((c) => ({ ...c, afterEvents: c.afterEvents + offset })),
        ];
      }
      return { kind: "commit", ...committed };
    },
  };
}

/** Forecast for the UI and early resolution: when a decision triggers and its deadline if play continues as now. */
export function createForecaster(tables: TimeTables): Forecaster {
  const rateOf = (loc: LocationId) => {
    const r = tables.rates[loc];
    return r !== undefined && Number.isFinite(r) && r > 0 ? r : undefined;
  };
  const finite = (t: number) => (Number.isFinite(t) ? t : null);
  return (state: GameState, decisionId: DecisionId): DecisionForecast | null => {
    const def = tables.decisions?.[decisionId];
    if (!def || !isOpen(state, def)) return null;
    const t = decisionTimes(state, tables, def, rateOf);
    return { decisionId, triggerT: finite(t.trigger), deadlineT: t.deadline === null ? null : finite(t.deadline) };
  };
}
