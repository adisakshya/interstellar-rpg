import type { RejectCode } from "./commands";
import type { CharacterId } from "./ids";
import type { ActivityDef } from "./rules";
import type { GameState, UnavailableReason } from "./state";

/** What happens to the controlled character if the player switches away now. */
export type Handoff = "NONE" | "ASSIST";

/**
 * Characters the player has met. Not-yet-introduced ones stay hidden, so the switcher never spoils the cast. This
 * reads the character's own state, not `reason`, which a locked current sequence can mask (LOCKED_SEQUENCE).
 */
export const isIntroduced = (row: SwitchOption): boolean => row.introduced;

/** One row of the character switcher (TIMELINES §4). UI-001 turns the codes into text. */
export interface SwitchOption {
  readonly characterId: CharacterId;
  readonly controlled: boolean;
  /** False only while the character's own availability is NOT_INTRODUCED, whatever else blocks switching. */
  readonly introduced: boolean;
  /** Whether a SwitchCharacter to this character would be accepted now. */
  readonly switchable: boolean;
  /** Why not, when `switchable` is false: the target's own state, or LOCKED_SEQUENCE when the current one is locked. */
  readonly reason: UnavailableReason | null;
  /** Cause of death, for DEAD. */
  readonly cause?: string;
}

export interface SwitchView {
  readonly options: readonly SwitchOption[];
  readonly handoff: Handoff;
}

type Activities = Readonly<Record<string, ActivityDef>> | undefined;

/** Is the controlled character flying an activity that has no assist? Then switching away is locked. */
function pilotingLock(state: GameState, activities: Activities): { locked: boolean; handoff: Handoff } {
  const act = state.activities[state.controlled];
  if (!act) return { locked: false, handoff: "NONE" };
  const def = activities?.[act.activityId];
  if (!def?.piloting) return { locked: false, handoff: "NONE" };
  return def.assist ? { locked: false, handoff: "ASSIST" } : { locked: true, handoff: "NONE" };
}

/**
 * The single switching rule, shared by the command handler and the switcher view so they never disagree.
 * Returns null when the switch is allowed.
 */
export function switchRejection(
  state: GameState,
  targetId: CharacterId,
  activities?: Activities,
): { code: RejectCode; reason: UnavailableReason | null; detail?: string } | null {
  const target = state.characters[targetId];
  if (!target) return { code: "INVALID", reason: null, detail: `unknown character ${targetId}` };
  // Switching to the character already controlled is a no-op and always allowed.
  if (targetId === state.controlled) return null;
  const current = state.characters[state.controlled];
  if (current?.unavailable === "LOCKED_SEQUENCE" || pilotingLock(state, activities).locked) {
    return { code: "LOCKED_SEQUENCE", reason: "LOCKED_SEQUENCE" };
  }
  if (target.unavailable !== null) {
    return { code: "CHARACTER_UNAVAILABLE", reason: target.unavailable, detail: target.unavailable };
  }
  return null;
}

/** Switcher rows in id order, plus the hand-off that switching away would trigger. Pure query. */
export function switchView(state: GameState, activities?: Activities): SwitchView {
  const ids = (Object.keys(state.characters) as CharacterId[]).sort();
  const options = ids.map((id): SwitchOption => {
    const c = state.characters[id]!;
    const rejection = switchRejection(state, id, activities);
    const row: SwitchOption = {
      characterId: id,
      controlled: id === state.controlled,
      introduced: c.unavailable !== "NOT_INTRODUCED",
      switchable: rejection === null,
      reason: rejection?.reason ?? null,
    };
    return c.unavailable === "DEAD" && c.cause !== undefined ? { ...row, cause: c.cause } : row;
  });
  return { options, handoff: pilotingLock(state, activities).handoff };
}
