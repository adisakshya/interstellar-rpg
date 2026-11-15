import type { HandlerMap, HandlerOutcome } from "./engine";
import type { CharacterId, LocationId } from "./ids";
import type { CharacterState, GameState } from "./state";

/** Location rate r(loc) = dτ/dT, where T is Endurance proper time (TIMELINES §1, PHYSICS §4). */
export type RateTable = Readonly<Record<LocationId, number>>;

/**
 * Spend `dTau` seconds of the controlled actor's proper time (TIMELINES §2):
 * ΔT = Δτ / r(actor), and every other character's τ advances by r(loc) × ΔT.
 * Only + − × ÷ on float64 (TIMELINES §1 arithmetic rule).
 */
function advance(
  state: GameState,
  rates: RateTable,
  actorId: CharacterId,
  dTau: number,
): { kind: "ok"; state: GameState; dT: number } | Extract<HandlerOutcome, { kind: "rejected" }> {
  const actor = state.characters[actorId];
  if (!actor) return { kind: "rejected", code: "INVALID", detail: `unknown character ${actorId}` };
  if (actorId !== state.controlled) return { kind: "rejected", code: "NOT_CONTROLLED" };
  if (actor.unavailable !== null) return { kind: "rejected", code: "CHARACTER_UNAVAILABLE", detail: actor.unavailable };
  if (!Number.isFinite(dTau) || dTau <= 0)
    return { kind: "rejected", code: "INVALID", detail: `dTau must be > 0, got ${dTau}` };

  const rateOf = (loc: LocationId): number | undefined => {
    const r = rates[loc];
    return r !== undefined && Number.isFinite(r) && r > 0 ? r : undefined;
  };
  const actorRate = rateOf(actor.location);
  if (actorRate === undefined) return { kind: "rejected", code: "INVALID", detail: `no rate for ${actor.location}` };
  const dT = dTau / actorRate;

  const characters: Record<CharacterId, CharacterState> = {};
  for (const [id, c] of Object.entries(state.characters) as [CharacterId, CharacterState][]) {
    // The actor gets exactly dTau, so r × (Δτ / r) rounding never shortchanges the player's own clock.
    if (id === actorId) {
      characters[id] = { ...c, tau: c.tau + dTau };
      continue;
    }
    const r = rateOf(c.location);
    if (r === undefined) return { kind: "rejected", code: "INVALID", detail: `no rate for ${c.location}` };
    characters[id] = { ...c, tau: c.tau + r * dT };
  }
  return { kind: "ok", state: { ...state, T: state.T + dT, characters }, dT };
}

/** AdvanceTime and FreeRoamTick handlers over a rate table (TIME-001). Decisions and resources come later. */
export function createClockHandlers(rates: RateTable): Pick<HandlerMap, "AdvanceTime" | "FreeRoamTick"> {
  return {
    AdvanceTime(state, command) {
      const out = advance(state, rates, command.actorId, command.dTau);
      if (out.kind === "rejected") return out;
      const T = out.state.T;
      return {
        kind: "commit",
        state: out.state,
        events: [
          { kind: "ClockAdvanced", T, dT: out.dT },
          { kind: "ActivityCompleted", T, activityId: command.activityId, progress: 1 },
        ],
      };
    },
    FreeRoamTick(state, command) {
      const out = advance(state, rates, command.actorId, command.dTau);
      if (out.kind === "rejected") return out;
      return { kind: "commit", state: out.state, events: [{ kind: "ClockAdvanced", T: out.state.T, dT: out.dT }] };
    },
  };
}
