// DOM-overlay HUD and dialogs (UI-001, ADR-005). Reads domain state; dispatches nothing itself.
export { formatDuration, labelFromId, livedPhrase, spokenDuration } from "./format";
export { mountHud } from "./hud";
export type { Hud, HudHandlers } from "./hud";
export { buildHudModel } from "./model";
export type { ActionOffer, ActionRow, CharacterRow, DecisionPrompt, HudContext, HudModel, WaitingNote } from "./model";
export { REASON_TEXT, reasonLine } from "./reasons";
export { mountNotice } from "./notice";
export type { Notice, NoticeAction } from "./notice";
export { buildOutcome, isFinished } from "./outcome";
export type { OutcomeContext, OutcomeModel, OutcomeRow } from "./outcome";
export { mountOutcome } from "./outcomeView";
export type { OutcomeAction, OutcomeView } from "./outcomeView";
export { mountSubtitles } from "./subtitles";
export type { StorySource, SubtitleOptions, Subtitles } from "./subtitles";
