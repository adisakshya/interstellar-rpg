import type { LocationId } from "./ids";
import type { DecisionDef, ResourceDef, ResourceLevel, TimeTables } from "./rules";
import type { GameState, ResourceState } from "./state";

export type RateOf = (loc: LocationId) => number | undefined;

/**
 * Units of `def` used per second of T in `state` (TIMELINES §7): the owner's per-τ rate times the owner's
 * location rate. Constant for the whole of one advance, because availability and location only change between
 * commands. Unknown owners and locations use nothing.
 */
export function usePerT(state: GameState, def: ResourceDef, rateOf: RateOf): number {
  if ("character" in def.owner) {
    const c = state.characters[def.owner.character];
    if (!c) return 0;
    const perTau =
      c.unavailable === null ? def.rate : (def.rateWhen?.[c.unavailable] ?? (c.unavailable === "DEAD" ? 0 : def.rate));
    return perTau * (rateOf(c.location) ?? 0);
  }
  return def.rate * (rateOf(def.owner.location) ?? 0);
}

/** T at which `level` is reached if play continues as in `state`; T now if already there; Infinity if never. */
export function levelT(state: GameState, tables: TimeTables, level: ResourceLevel, rateOf: RateOf): number {
  const def = tables.resources?.[level.resourceId];
  const amount = state.resources[level.resourceId]?.amount;
  if (!def || amount === undefined) return Number.POSITIVE_INFINITY;
  if (amount <= level.atOrBelow) return state.T;
  const k = usePerT(state, def, rateOf);
  return k > 0 ? state.T + (amount - level.atOrBelow) / k : Number.POSITIVE_INFINITY;
}

/** Effective trigger and deadline of a decision from `state` on: the earliest of the time and resource forms. */
export function decisionTimes(
  state: GameState,
  tables: TimeTables,
  d: DecisionDef,
  rateOf: RateOf,
): { trigger: number; deadline: number | null } {
  const trigger = Math.min(
    d.triggerT ?? Number.POSITIVE_INFINITY,
    d.triggerWhen ? levelT(state, tables, d.triggerWhen, rateOf) : Number.POSITIVE_INFINITY,
  );
  const hard = d.deadlineT !== null || d.deadlineWhen !== undefined;
  const deadline = Math.min(
    d.deadlineT ?? Number.POSITIVE_INFINITY,
    d.deadlineWhen ? levelT(state, tables, d.deadlineWhen, rateOf) : Number.POSITIVE_INFINITY,
  );
  return { trigger, deadline: hard ? deadline : null };
}

/** Resource amounts at T, moving on from `start` (never below zero, never refunded: INV-10). */
export function resourcesAt(
  start: GameState,
  tables: TimeTables,
  T: number,
  rateOf: RateOf,
): Readonly<Record<string, ResourceState>> {
  const out: Record<string, ResourceState> = { ...start.resources };
  for (const [id, r] of Object.entries(start.resources)) {
    const def = tables.resources?.[id];
    if (!def) continue;
    const used = usePerT(start, def, rateOf) * (T - start.T);
    out[id] = { amount: used >= r.amount ? 0 : r.amount - used };
  }
  return out;
}

/** T at which each consuming resource runs out, from `start`. */
export function depletionTimes(start: GameState, tables: TimeTables, rateOf: RateOf): { id: string; T: number }[] {
  const out: { id: string; T: number }[] = [];
  for (const [id, r] of Object.entries(start.resources)) {
    const def = tables.resources?.[id];
    if (!def || r.amount <= 0) continue;
    const k = usePerT(start, def, rateOf);
    if (k > 0) out.push({ id, T: start.T + r.amount / k });
  }
  return out;
}
