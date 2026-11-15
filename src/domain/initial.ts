import type { CharacterId, LocationId } from "./ids";
import type { CharacterState, GameState, UnavailableReason } from "./state";

/** Version of the domain state schema; bump with a migration (ADR-003). */
export const SCHEMA_VERSION = 1;

export interface InitialSpec {
  readonly contentVersion: string;
  readonly controlled: CharacterId;
  readonly characters: readonly {
    readonly id: CharacterId;
    readonly location: LocationId;
    readonly unavailable: UnavailableReason | null;
  }[];
  readonly resources: Readonly<Record<string, number>>;
  readonly seed: number;
}

/** The state at T = 0 for a loaded episode: every clock at zero, nothing known, nothing decided. */
export function createInitialState(spec: InitialSpec): GameState {
  const characters: Record<CharacterId, CharacterState> = {};
  for (const c of spec.characters)
    characters[c.id] = { id: c.id, tau: 0, location: c.location, unavailable: c.unavailable };
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: spec.contentVersion,
    T: 0,
    seq: 0,
    controlled: spec.controlled,
    characters,
    resources: Object.fromEntries(Object.entries(spec.resources).map(([id, amount]) => [id, { amount }])),
    decisions: {},
    knowledge: {},
    playerSeen: [],
    messages: [],
    activities: {},
    processedCommandIds: [],
    rng: { seed: spec.seed, state: spec.seed },
  };
}
