import type { CharacterId, DecisionId, FactId, GameState } from "../domain";
import { formatDuration, labelFromId, spokenDuration } from "./format";
import { reasonLine } from "./reasons";

export interface OutcomeRow {
  readonly name: string;
  readonly lived: string;
  readonly livedSpoken: string;
  /** "Alive", "Hibernating", "Dead: wave". */
  readonly status: string;
}

/** Everything the end-of-episode screen shows, derived from state (SLICE-001). */
export interface OutcomeModel {
  readonly title: string;
  readonly reference: string;
  readonly referenceSpoken: string;
  /** Who experienced how much time. */
  readonly rows: readonly OutcomeRow[];
  readonly resources: readonly string[];
  /** What is known, and by whom. */
  readonly known: readonly string[];
  /** Why it turned out this way: one line per consequential choice that was taken. */
  readonly notes: readonly string[];
}

export interface OutcomeContext {
  readonly names: Readonly<Record<string, string>>;
  readonly facts: Readonly<Record<string, string>>;
  readonly notes: readonly { readonly decision: string; readonly option: string; readonly text: string }[];
  readonly ending: { readonly fact: string; readonly knownBy: string };
}

/** The episode is over once the ending character has learned the ending fact. */
export const isFinished = (state: GameState, ending: { readonly fact: string; readonly knownBy: string }): boolean =>
  state.knowledge[ending.knownBy as CharacterId]?.includes(ending.fact as FactId) ?? false;

const nameOf = (ctx: OutcomeContext, id: string) => ctx.names[id] ?? labelFromId(id);

export function buildOutcome(state: GameState, ctx: OutcomeContext): OutcomeModel {
  const rows = Object.values(state.characters)
    // Characters the player never met stay out, unless something happened to them (Doyle dying in the wave).
    .filter((c) => c.unavailable !== "NOT_INTRODUCED")
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((c): OutcomeRow => ({
      name: nameOf(ctx, c.id),
      lived: formatDuration(c.tau),
      livedSpoken: spokenDuration(c.tau),
      status: c.unavailable === null ? "Alive" : reasonLine(c.unavailable, c.cause),
    }));

  const known: string[] = [];
  for (const [factId, text] of Object.entries(ctx.facts)) {
    const who = Object.entries(state.knowledge)
      .filter(([, facts]) => facts.includes(factId as never))
      .map(([id]) => nameOf(ctx, id))
      .sort();
    if (who.length > 0) known.push(`${text} (known by ${who.join(", ")})`);
  }

  const resources = Object.entries(state.resources)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, r]) => `${labelFromId(id)}: ${r.amount.toFixed(1)} left`);

  const notes = ctx.notes
    .filter((n) => state.decisions[n.decision as DecisionId]?.optionId === n.option)
    .map((n) => n.text);

  return {
    title: "Episode complete",
    reference: formatDuration(state.T),
    referenceSpoken: spokenDuration(state.T),
    rows,
    resources,
    known,
    notes,
  };
}
