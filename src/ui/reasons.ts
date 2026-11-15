import type { UnavailableReason } from "../domain";

/** Why a character cannot be switched to, in words (TIMELINES §4, FR-03). Never colour-only. */
export const REASON_TEXT: Readonly<Record<UnavailableReason, string>> = {
  NOT_INTRODUCED: "Not met yet",
  HIBERNATING: "Hibernating",
  INJURED: "Injured",
  UNCONSCIOUS: "Unconscious",
  LOCKED_SEQUENCE: "Busy: finish the current sequence first",
  DEAD: "Dead",
  CONTROLLED_BY_OTHER: "Controlled by another player",
};

/** Text shown with a reason: a death names its cause ("Dead: WAVE"). */
export function reasonLine(reason: UnavailableReason, cause?: string): string {
  const base = REASON_TEXT[reason];
  return reason === "DEAD" && cause ? `${base}: ${cause.toLowerCase()}` : base;
}
