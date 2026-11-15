import type { GameState } from "../domain";
import type { LoadResult, SaveErrorCode, SaveSlots } from "../persistence";

/** What happened when the game looked for a saved game (ARCHITECTURE §6). */
export type StartupLoad =
  | { readonly kind: "fresh"; readonly why: "empty" | "skipped" }
  | { readonly kind: "resumed"; readonly state: GameState }
  /** The save could not be opened. It was moved to quarantine, never deleted, and can still be exported. */
  | { readonly kind: "unreadable"; readonly code: SaveErrorCode; readonly quarantinedAs: string }
  /** Storage itself failed, so nothing is known about the save. Never start over it: do not write. */
  | { readonly kind: "storage-failed"; readonly error: unknown };

export async function loadStartup(slots: Pick<SaveSlots, "loadAutosave">, skip: boolean): Promise<StartupLoad> {
  if (skip) return { kind: "fresh", why: "skipped" };
  let result: LoadResult;
  try {
    result = await slots.loadAutosave();
  } catch (error) {
    return { kind: "storage-failed", error };
  }
  if (result.ok) return { kind: "resumed", state: result.save.state };
  if (result.code === "EMPTY") return { kind: "fresh", why: "empty" };
  return { kind: "unreadable", code: result.code, quarantinedAs: result.quarantinedAs };
}

const WHY: Readonly<Record<SaveErrorCode, string>> = {
  PARSE: "the file is not readable",
  FORMAT: "it is not a game save",
  HASH_MISMATCH: "it appears damaged or was edited",
  SCHEMA_TOO_NEW: "it was made by a newer version of the game",
  MIGRATION_MISSING: "it was made by an older version that this one cannot convert",
  MIGRATION_FAILED: "converting it from an older version failed",
  CONTENT_VERSION: "it was made with a different version of the episode",
  INVALID_STATE: "its contents are not valid",
};

export interface StartupNotice {
  readonly message: string;
  /** Quarantine key whose original text the player can save as a file. */
  readonly exportKey?: string;
  /** True when this session must not write saves, to avoid replacing progress we could not read. */
  readonly disableSaving: boolean;
}

/** What to tell the player, or null when there is nothing to say. */
export function startupNotice(load: StartupLoad, persistent: boolean): StartupNotice | null {
  switch (load.kind) {
    case "unreadable":
      return {
        message: `Your saved game could not be opened, because ${WHY[load.code]}. The original is kept safe and a new game has started.`,
        exportKey: load.quarantinedAs,
        disableSaving: false,
      };
    case "storage-failed":
      return {
        message:
          "This browser would not let the game read its saved data, so a new game has started. Progress will not be saved this time, so nothing you already saved is replaced.",
        disableSaving: true,
      };
    default:
      return persistent
        ? null
        : {
            message:
              "This browser is not keeping saved games (private browsing?). You can play, but progress will be lost when you close the page.",
            disableSaving: false,
          };
  }
}
