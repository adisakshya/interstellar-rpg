import type { CharacterId, DecisionId, FactId, LocationId } from "./ids";

/** Availability reasons from TIMELINES §4. `null` means available. */
export type UnavailableReason =
  "NOT_INTRODUCED" | "HIBERNATING" | "INJURED" | "UNCONSCIOUS" | "LOCKED_SEQUENCE" | "DEAD" | "CONTROLLED_BY_OTHER";

export interface CharacterState {
  readonly id: CharacterId;
  /** Proper time lived, in seconds (TIMELINES §1). */
  readonly tau: number;
  readonly location: LocationId;
  readonly unavailable: UnavailableReason | null;
  /** Why the character died; set together with `DEAD` (TIMELINES §4, shown in the switcher). */
  readonly cause?: string;
}

export interface ResourceState {
  readonly amount: number;
}

export interface DecisionState {
  readonly status: "pending" | "resolved";
  readonly optionId: string | null;
}

export interface MessageState {
  readonly id: string;
  readonly from: CharacterId;
  readonly to: CharacterId;
  readonly factIds: readonly FactId[];
  readonly sentT: number;
  readonly deliverT: number;
}

export interface ActivityProgress {
  readonly activityId: string;
  readonly actorId: CharacterId;
  readonly progress: number;
}

/** The whole game-domain state (ARCHITECTURE §3). Immutable: every change produces a new object. */
export interface GameState {
  readonly schemaVersion: number;
  readonly contentVersion: string;
  /** Reference time in seconds: Endurance proper time (TIMELINES §1). */
  readonly T: number;
  /** Sequence number of the last committed event (INV-01). */
  readonly seq: number;
  /** Session state, not history: switching changes only this (INV-03). */
  readonly controlled: CharacterId;
  readonly characters: Readonly<Record<CharacterId, CharacterState>>;
  readonly resources: Readonly<Record<string, ResourceState>>;
  readonly decisions: Readonly<Record<DecisionId, DecisionState>>;
  readonly knowledge: Readonly<Record<CharacterId, readonly FactId[]>>;
  readonly playerSeen: readonly FactId[];
  readonly messages: readonly MessageState[];
  /** In-progress (interrupted) activity per character, at most one each (TIMELINES §3). */
  readonly activities: Readonly<Record<CharacterId, ActivityProgress>>;
  /** Most recent processed command ids, oldest first, at most PROCESSED_ID_WINDOW (ADR-002). */
  readonly processedCommandIds: readonly string[];
  readonly rng: { readonly seed: number; readonly state: number };
}
