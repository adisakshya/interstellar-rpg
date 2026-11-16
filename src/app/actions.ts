import { isIntroduced, switchView, type ActivityDef, type Command, type GameState } from "../domain";
import type { InputAction } from "../input";
import { currentInteraction, type InteractionDef } from "./interactions";

export interface TranslateContext {
  /** A fresh id per player action (a UUID in the app; counters in tests), so a retry is never mistaken for a new act. */
  readonly newId: () => string;
  /** What Interact can do at each place, with its conditions (from content). */
  readonly interactions: readonly InteractionDef[];
  readonly activities?: Readonly<Record<string, ActivityDef>> | undefined;
  /** Is the player near this landmark? Omitted: nothing is gated. */
  readonly isNear?: ((landmark: string) => boolean) | undefined;
}

/**
 * Turn an action into the domain command it means, or null when it is presentation only (movement) or has nothing to
 * do here. Pure: the same state and action always give the same command, so every device yields one command log.
 */
export function actionToCommand(action: InputAction, state: GameState, ctx: TranslateContext): Command | null {
  switch (action.kind) {
    case "Move":
      return null;
    case "Interact": {
      const actor = state.characters[state.controlled];
      const what = currentInteraction(state, ctx.interactions, ctx.isNear);
      if (!actor || !what) return null;
      return {
        kind: "AdvanceTime",
        commandId: ctx.newId(),
        actorId: actor.id,
        activityId: what.activityId,
        dTau: what.dTau,
      };
    }
    case "SwitchNext": {
      const rows = switchView(state, ctx.activities).options;
      const at = rows.findIndex((r) => r.controlled);
      for (let step = 1; step < rows.length; step++) {
        const row = rows[(at + step) % rows.length]!;
        if (row.switchable) return { kind: "SwitchCharacter", commandId: ctx.newId(), targetId: row.characterId };
      }
      return null;
    }
    case "SwitchTo": {
      // Slots number the characters the player can see, in the same order the HUD lists them.
      const row = switchView(state, ctx.activities).options.filter(isIntroduced)[action.index - 1];
      return row ? { kind: "SwitchCharacter", commandId: ctx.newId(), targetId: row.characterId } : null;
    }
  }
}
