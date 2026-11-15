import type { CharacterId, DecisionId, FactId, RouteId } from "./ids";
import type { GameState } from "./state";

// Command, event and result vocabulary from TIMELINES §9 and ARCHITECTURE §3.

export type Command =
  | { kind: "AdvanceTime"; commandId: string; actorId: CharacterId; activityId: string; dTau: number }
  | { kind: "FreeRoamTick"; commandId: string; actorId: CharacterId; dTau: number }
  | { kind: "StartTransit"; commandId: string; actorIds: readonly CharacterId[]; routeId: RouteId }
  | { kind: "SwitchCharacter"; commandId: string; targetId: CharacterId }
  | { kind: "ResolveDecision"; commandId: string; decisionId: DecisionId; optionId: string }
  | { kind: "SendMessage"; commandId: string; fromId: CharacterId; toId: CharacterId; factIds: readonly FactId[] };

export type CommandKind = Command["kind"];

/** Event payloads as produced by handlers; the engine adds `seq` when committing. */
export type EventDraft = { readonly T: number } & (
  | { readonly kind: "ClockAdvanced"; readonly dT: number }
  | {
      readonly kind: "ActivityCompleted" | "ActivityInterrupted";
      readonly activityId: string;
      readonly progress: number;
    }
  | { readonly kind: "FactLearned"; readonly characterId: CharacterId; readonly factId: FactId }
  | { readonly kind: "MessageSent" | "MessageDelivered"; readonly messageId: string }
  | { readonly kind: "ResourceChanged" | "ResourceDepleted"; readonly resourceId: string; readonly amount: number }
  | { readonly kind: "DecisionPending" | "CheckpointCreated"; readonly decisionId: DecisionId }
  | { readonly kind: "DecisionResolved"; readonly decisionId: DecisionId; readonly optionId: string }
  | { readonly kind: "AvailabilityChanged"; readonly characterId: CharacterId; readonly reason: string | null }
  | { readonly kind: "CharacterDied"; readonly characterId: CharacterId; readonly cause: string }
);

export type DomainEvent = EventDraft & { readonly seq: number };

export type RejectCode =
  "CHARACTER_UNAVAILABLE" | "NOT_CONTROLLED" | "LOCKED_SEQUENCE" | "DECISION_ALREADY_RESOLVED" | "INVALID";

/** State captured at a CheckpointCreated, before later events in the same command (ARCHITECTURE §3). */
export interface CheckpointSnapshot {
  readonly decisionId: DecisionId;
  readonly state: GameState;
}

/** What the domain can predict about a decision without committing anything (TIMELINES §3). */
export interface DecisionForecast {
  readonly decisionId: DecisionId;
  /** Reference time at which the decision becomes pending if play continues as now. */
  readonly triggerT: number;
  /** Hard deadline on T, or null for a soft decision. */
  readonly deadlineT: number | null;
}

export type Result =
  | { kind: "Ok"; events: readonly DomainEvent[]; checkpoints: readonly CheckpointSnapshot[] }
  | {
      kind: "Interrupted";
      decisionId: DecisionId;
      events: readonly DomainEvent[];
      checkpoints: readonly CheckpointSnapshot[];
    }
  | { kind: "Blocked"; decisionId: DecisionId; deadlineT: number }
  | { kind: "Duplicate" }
  | { kind: "Rejected"; code: RejectCode; detail?: string };
