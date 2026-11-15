import type { CharacterId, DecisionId, FactId, LocationId } from "./ids";
import type { UnavailableReason } from "./state";

/** Location rate r(loc) = dτ/dT, where T is Endurance proper time (TIMELINES §1, PHYSICS §4). */
export type RateTable = Readonly<Record<LocationId, number>>;

/** A consequence of choosing an option. Committed only when the decision resolves (INV-07). */
export type DecisionEffect =
  | {
      readonly kind: "SetAvailability";
      readonly characterId: CharacterId;
      readonly reason: UnavailableReason | null;
      /** Why, shown for DEAD ("wave"). */
      readonly cause?: string;
    }
  /**
   * The choice itself costs the decision owner this much of their own proper time (e.g. flooded engines need an hour
   * of Cooper's time), passing through the normal clock rules: resources, other characters' clocks, later decisions.
   */
  | { readonly kind: "SpendTime"; readonly characterId: CharacterId; readonly dTau: number }
  | { readonly kind: "LearnFact"; readonly characterId: CharacterId; readonly factId: FactId };

/** "When resource X is at or below this amount". */
export interface ResourceLevel {
  readonly resourceId: string;
  readonly atOrBelow: number;
}

/**
 * A resource and its owner (TIMELINES §7). Consumption is per second of the owner's proper time: a character's
 * τ, or the proper time at a location (a ship parked there). Rates are piecewise constant, so depletion is exact.
 */
export interface ResourceDef {
  readonly id: string;
  readonly owner: { readonly character: CharacterId } | { readonly location: LocationId };
  /** Units used per second of the owner's proper time. */
  readonly rate: number;
  /** Rate while a character owner is unavailable for a given reason (e.g. HIBERNATING); DEAD defaults to 0. */
  readonly rateWhen?: Partial<Record<UnavailableReason, number>>;
}

/** A decision as content defines it (TIMELINES §3). */
export interface DecisionDef {
  readonly id: DecisionId;
  /** The character who must be controlled to resolve it. */
  readonly owner: CharacterId;
  /** Reference time at which it becomes pending. */
  readonly triggerT?: number;
  /** Or: becomes pending when a resource falls to this level, whichever comes first (TIMELINES §11 D_hib). */
  readonly triggerWhen?: ResourceLevel;
  /** Hard deadline on T (≥ trigger), or null for a soft decision. */
  readonly deadlineT: number | null;
  /** Or: a hard deadline when a resource falls to this level, whichever comes first. */
  readonly deadlineWhen?: ResourceLevel;
  /** Take an automatic checkpoint when it becomes pending (D-08). */
  readonly checkpoint: boolean;
  readonly options: Readonly<Record<string, readonly DecisionEffect[]>>;
}

/**
 * A consequence that lands at a point on the timeline, not at the choice that causes it (WAVE-001). It applies when
 * reference time reaches the deadline of `atDeadlineOf`, provided that decision was resolved with `whenOption`.
 * So an early choice (TIMELINES §3) changes nothing until the moment arrives: nobody dies while the wave is still
 * on the horizon. If the decision is resolved at or after its deadline, the effects apply at once.
 */
export interface HazardDef {
  readonly id: string;
  readonly atDeadlineOf: DecisionId;
  readonly whenOption: string;
  readonly effects: readonly Extract<DecisionEffect, { readonly kind: "SetAvailability" }>[];
}

/** Activity flags from content. Activities not listed are interruptible (TIMELINES §3 default). */
export interface ActivityDef {
  readonly atomic: boolean;
  /** The actor is flying (TIMELINES §4 piloting hand-off). */
  readonly piloting?: boolean;
  /** While piloting, an autopilot assist may take over if the player switches away. */
  readonly assist?: boolean;
  /** Facts the actor observes when the activity completes (TIMELINES §6 observation). */
  readonly learns?: readonly FactId[];
}

/** A communication link between two locations; latency is in seconds of T (TIMELINES §6). */
export interface LinkDef {
  readonly a: LocationId;
  readonly b: LocationId;
  readonly latency: number;
  readonly up: boolean;
}

/** Content-derived tables the time handlers read. */
export interface TimeTables {
  readonly rates: RateTable;
  readonly decisions?: Readonly<Record<DecisionId, DecisionDef>>;
  readonly activities?: Readonly<Record<string, ActivityDef>>;
  readonly links?: readonly LinkDef[];
  readonly resources?: Readonly<Record<string, ResourceDef>>;
  readonly hazards?: readonly HazardDef[];
  /** Fact registry; when given, messages may only carry these facts. */
  readonly facts?: readonly FactId[];
}
