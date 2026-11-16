import {
  isIntroduced,
  switchView,
  type ActivityDef,
  type CharacterId,
  type DecisionDef,
  type DecisionForecast,
  type DecisionId,
  type GameState,
  type UnavailableReason,
} from "../domain";
import { formatDuration, labelFromId, spokenDuration } from "./format";
import { reasonLine } from "./reasons";

export interface CharacterRow {
  readonly id: CharacterId;
  readonly name: string;
  /** 1-based keyboard slot (the number key that switches here). */
  readonly slot: number;
  readonly controlled: boolean;
  readonly switchable: boolean;
  readonly reason: UnavailableReason | null;
  /** Visible reason, e.g. "Hibernating"; empty when available. */
  readonly reasonText: string;
  /** Proper time lived so far, on screen and spoken. */
  readonly lived: string;
  readonly livedSpoken: string;
}

export interface DecisionOption {
  readonly id: string;
  readonly label: string;
}

export interface DecisionPrompt {
  readonly id: DecisionId;
  readonly title: string;
  /** A sentence on what is at stake, when the content has one. */
  readonly prompt: string | null;
  readonly options: readonly DecisionOption[];
  /** True when time cannot pass its deadline. */
  readonly hard: boolean;
  /** Reference time left before the deadline, if there is one. */
  readonly deadline: string | null;
  readonly deadlineSpoken: string | null;
}

export interface WaitingNote {
  readonly id: DecisionId;
  readonly ownerName: string;
  readonly text: string;
}

/** What the player can do right now and what it will cost, before committing (TIMELINES §1). */
export interface ActionRow {
  readonly label: string;
  /** "10 min for you · Romilly +1.2 y". */
  readonly cost: string;
  readonly costSpoken: string;
}

export interface HudModel {
  readonly characters: readonly CharacterRow[];
  readonly controlledName: string;
  readonly reference: string;
  readonly referenceSpoken: string;
  /** The interaction on offer, if any. */
  readonly action: ActionRow | null;
  /** Decisions the controlled character must make now. */
  readonly prompts: readonly DecisionPrompt[];
  /** Decisions waiting on someone else: switch to them to decide. */
  readonly waiting: readonly WaitingNote[];
}

/** The offered interaction with its time cost for the actor and for everyone else (built by `app`). */
export interface ActionOffer {
  readonly label: string;
  readonly dTau: number;
  readonly others: readonly { readonly id: string; readonly dTau: number }[];
}

export interface HudContext {
  readonly offer?: ActionOffer | null | undefined;
  readonly names: Readonly<Record<string, string>>;
  readonly decisions: Readonly<Record<DecisionId, DecisionDef>>;
  readonly activities?: Readonly<Record<string, ActivityDef>> | undefined;
  readonly forecast?: ((id: DecisionId) => DecisionForecast | null) | undefined;
  /** Authored text per decision; missing parts fall back to labels made from ids. */
  readonly text?:
    | Readonly<Record<string, { title?: string; prompt?: string; labels?: Readonly<Record<string, string>> }>>
    | undefined;
}

const nameOf = (ctx: HudContext, id: string) => ctx.names[id] ?? labelFromId(id);

/**
 * Everything the HUD shows, derived from state. Pure and complete, so the DOM layer only paints it and tests can
 * check the content without a browser (UI-001).
 */
export function buildHudModel(state: GameState, ctx: HudContext): HudModel {
  const view = switchView(state, ctx.activities);
  const characters = view.options.filter(isIntroduced).map((row, i): CharacterRow => {
    const lived = state.characters[row.characterId]?.tau ?? 0;
    return {
      id: row.characterId,
      name: nameOf(ctx, row.characterId),
      slot: i + 1,
      controlled: row.controlled,
      // The controlled row counts as available to itself; every other row follows the shared switching rule.
      switchable: row.switchable,
      reason: row.reason,
      reasonText: row.reason ? reasonLine(row.reason, row.cause) : "",
      lived: formatDuration(lived),
      livedSpoken: spokenDuration(lived),
    };
  });

  const shown = new Set<string>(characters.map((c) => c.id));
  const aged = ctx.offer?.others.filter((o) => shown.has(o.id)) ?? [];
  const action: ActionRow | null = ctx.offer
    ? {
        label: ctx.offer.label,
        cost: [
          `${formatDuration(ctx.offer.dTau)} for you`,
          ...aged.map((o) => `${nameOf(ctx, o.id)} +${formatDuration(o.dTau)}`),
        ].join(" · "),
        costSpoken: [
          `costs ${spokenDuration(ctx.offer.dTau)} of your time`,
          ...aged.map((o) => `${nameOf(ctx, o.id)} will see ${spokenDuration(o.dTau)} pass`),
        ].join(". "),
      }
    : null;

  const prompts: DecisionPrompt[] = [];
  const waiting: WaitingNote[] = [];
  for (const [id, entry] of Object.entries(state.decisions) as [DecisionId, GameState["decisions"][DecisionId]][]) {
    if (entry.status !== "pending") continue;
    const def = ctx.decisions[id];
    if (!def) continue;
    const authored = ctx.text?.[id];
    const title = authored?.title ?? labelFromId(id);
    if (def.owner === state.controlled) {
      const deadlineT = ctx.forecast?.(id)?.deadlineT ?? null;
      const left = deadlineT === null ? null : Math.max(0, deadlineT - state.T);
      prompts.push({
        id,
        title,
        prompt: authored?.prompt ?? null,
        options: Object.keys(def.options).map((o) => ({ id: o, label: authored?.labels?.[o] ?? labelFromId(o) })),
        hard: def.deadlineT !== null || def.deadlineWhen !== undefined,
        // At the deadline itself there is nothing left to count: time is simply held until the player chooses.
        deadline: left === null || left <= 0 ? null : formatDuration(left),
        deadlineSpoken: left === null || left <= 0 ? null : spokenDuration(left),
      });
    } else {
      waiting.push({ id, ownerName: nameOf(ctx, def.owner), text: `${title}: waiting on ${nameOf(ctx, def.owner)}` });
    }
  }
  prompts.sort((a, b) => (a.id < b.id ? -1 : 1));
  waiting.sort((a, b) => (a.id < b.id ? -1 : 1));

  return {
    characters,
    controlledName: nameOf(ctx, state.controlled),
    reference: formatDuration(state.T),
    referenceSpoken: spokenDuration(state.T),
    action,
    prompts,
    waiting,
  };
}
