import type { CharacterId, GameState, RateTable } from "../domain";

/** What Interact can do at a place, from content (SLICE-001). */
export interface InteractionDef {
  readonly id: string;
  readonly location: string;
  readonly label: string;
  readonly activityId: string;
  readonly dTau: number;
  readonly requires?: readonly string[] | undefined;
  readonly unless?: readonly string[] | undefined;
  /** Decisions that must already be resolved. */
  readonly after?: readonly string[] | undefined;
  /** Decisions that must not have been raised yet (neither pending nor resolved). */
  readonly before?: readonly string[] | undefined;
}

const resolved = (state: GameState, id: string) => state.decisions[id as never]?.status === "resolved";

/**
 * The interaction the controlled character is offered now, or null. The first entry whose place matches and whose
 * conditions hold wins. Facts are checked against what that character knows, not what the player knows (INV-08).
 */
export function currentInteraction(state: GameState, defs: readonly InteractionDef[]): InteractionDef | null {
  const actor = state.characters[state.controlled];
  if (!actor || actor.unavailable !== null) return null;
  const known = new Set<string>(state.knowledge[actor.id] ?? []);
  return (
    defs.find(
      (d) =>
        d.location === actor.location &&
        (d.requires ?? []).every((f) => known.has(f)) &&
        !(d.unless ?? []).some((f) => known.has(f)) &&
        (d.after ?? []).every((id) => resolved(state, id)) &&
        (d.before ?? []).every((id) => state.decisions[id as never] === undefined),
    ) ?? null
  );
}

/** What an interaction costs: the actor's own time, and how much time passes for everyone else. */
export interface Offer {
  readonly id: string;
  readonly label: string;
  /** Seconds of the actor's proper time. */
  readonly dTau: number;
  readonly others: readonly { readonly id: CharacterId; readonly dTau: number }[];
}

/**
 * The cost shown before the player commits (TIMELINES §1): the activity moves the reference clock by
 * `dTau / r(actor's place)`, and each other character ages `r(their place)` times that. Only + − × ÷, so it
 * matches the domain exactly. Characters who cannot age (no rate, or dead) are left out.
 */
export function offerFor(state: GameState, defs: readonly InteractionDef[], rates: RateTable): Offer | null {
  const def = currentInteraction(state, defs);
  const actor = state.characters[state.controlled];
  if (!def || !actor) return null;
  const rate = rates[actor.location];
  if (rate === undefined || !(rate > 0)) return null;
  const dT = def.dTau / rate;
  const others = Object.values(state.characters)
    .filter((c) => c.id !== actor.id && c.unavailable !== "DEAD" && rates[c.location] !== undefined)
    .map((c) => ({ id: c.id, dTau: dT * rates[c.location]! }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  return { id: def.id, label: def.label, dTau: def.dTau, others };
}
