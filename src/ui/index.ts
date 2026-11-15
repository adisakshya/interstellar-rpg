// DOM-overlay HUD and dialogs (UI-001, ADR-005). Reads domain state; dispatches nothing itself.
export { formatDuration, labelFromId, spokenDuration } from "./format";
export { mountHud } from "./hud";
export type { Hud, HudHandlers } from "./hud";
export { buildHudModel } from "./model";
export type { CharacterRow, DecisionPrompt, HudContext, HudModel, WaitingNote } from "./model";
export { REASON_TEXT, reasonLine } from "./reasons";
