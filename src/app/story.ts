import type { GameState } from "../domain";

/** One subtitle line as the UI shows it. */
export interface StoryLine {
  /** Display name, or null for narration, the ship and title cards. */
  readonly name: string | null;
  readonly kind: "speech" | "narrator" | "ship" | "card";
  readonly text: string;
}

export interface StoryEntry {
  readonly id: string;
  readonly when: {
    readonly start?: true | undefined;
    readonly controlled?: string | undefined;
    readonly minT?: number | undefined;
    readonly knows?: readonly { readonly by: string; readonly fact: string }[] | undefined;
    readonly decision?:
      | readonly {
          readonly id: string;
          readonly status: "pending" | "resolved";
          readonly option?: string | undefined;
        }[]
      | undefined;
    readonly dead?: readonly string[] | undefined;
  };
  readonly lines: readonly { readonly speaker: string; readonly text: string }[];
}

/** Does this state satisfy a story entry's condition? Pure; every listed condition must hold. */
export function storyHolds(state: GameState, when: StoryEntry["when"]): boolean {
  if (when.start === true && state.seq !== 0) return false;
  if (when.controlled !== undefined && state.controlled !== when.controlled) return false;
  if (when.minT !== undefined && state.T < when.minT) return false;
  for (const k of when.knows ?? []) if (!(state.knowledge[k.by as never] ?? []).includes(k.fact as never)) return false;
  for (const d of when.decision ?? []) {
    const entry = state.decisions[d.id as never];
    if (entry?.status !== d.status) return false;
    if (d.option !== undefined && entry.optionId !== d.option) return false;
  }
  for (const c of when.dead ?? []) if (state.characters[c as never]?.unavailable !== "DEAD") return false;
  return true;
}

export interface StoryOptions {
  readonly entries: readonly StoryEntry[];
  readonly getState: () => GameState;
  readonly names: Readonly<Record<string, string>>;
  /** Spells a span of a character's lived seconds for `{tau:…}` tokens. */
  readonly spell: (seconds: number) => string;
  readonly setTimer?: (run: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  /**
   * Remembers which entries were shown, with the event count they were shown at. A condition like "Romilly is
   * controlled" can be false again after a reload, so the state alone cannot say it was already seen. The record is
   * trusted only if the loaded game is at or past that point; restoring an earlier checkpoint discards it.
   */
  readonly memory?: {
    load(): { ids: readonly string[]; seq: number } | null;
    save(value: { ids: string[]; seq: number }): void;
  };
  /** Reads and stores the "advance by itself" preference. */
  readonly preference?: { get(): boolean; set(value: boolean): void };
}

export interface Story {
  /** The line on screen, or null when nothing is showing. */
  current(): StoryLine | null;
  /** Everything shown so far, oldest first (the accessible log). */
  log(): readonly StoryLine[];
  /** Lines still waiting after the current one. */
  pending(): number;
  /** Move to the next line (or clear the last one). */
  next(): void;
  /** Clear the current line and everything queued; the lines go to the log. */
  skipAll(): void;
  readonly autoAdvance: boolean;
  setAutoAdvance(value: boolean): void;
  /** Hold the reading timer while the page is hidden or its graphics are lost; the current line waits. */
  setPaused(value: boolean): void;
  /** Look at the state and queue any entries that now hold. Called after every commit. */
  observe(): void;
  subscribe(listener: () => void): () => void;
}

/** How long a line stays up on its own: a floor for short lines, and about 55 ms a character after that. */
export const readMs = (text: string): number => Math.min(9000, Math.max(2500, 1800 + 55 * text.length));

/**
 * Subtitles for the story (STORY-001). Nothing here is game state: an entry is shown once, the first time its
 * condition holds, and entries that already hold when this is created (a loaded save) are marked seen without
 * being shown, so a reload never replays a scene.
 */
export function createStory(options: StoryOptions): Story {
  const setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const seen = new Set<string>();
  const queue: StoryLine[] = [];
  const shown: StoryLine[] = [];
  const listeners = new Set<() => void>();
  let now: StoryLine | null = null;
  let timer: unknown = null;
  let auto = options.preference?.get() ?? true;
  let paused = false;

  const render = (speaker: string, raw: string, state: GameState): StoryLine => {
    const text = raw.replace(/\{tau:([^}]*)\}/g, (_m, id: string) =>
      options.spell(state.characters[id as never]?.tau ?? 0),
    );
    if (speaker === "narrator" || speaker === "ship" || speaker === "card") {
      return { name: speaker === "ship" ? "Ranger" : null, kind: speaker, text };
    }
    return { name: options.names[speaker] ?? speaker, kind: "speech", text };
  };

  const emit = () => listeners.forEach((l) => l());
  const stopTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const show = (line: StoryLine | null) => {
    stopTimer();
    now = line;
    if (line) {
      shown.push(line);
      if (auto && !paused) timer = setTimer(() => api.next(), readMs(line.text));
    }
  };

  const scan = (queueLines: boolean) => {
    const state = options.getState();
    let changed = false;
    for (const entry of options.entries) {
      if (seen.has(entry.id) || !storyHolds(state, entry.when)) continue;
      seen.add(entry.id);
      changed = true;
      if (queueLines) for (const l of entry.lines) queue.push(render(l.speaker, l.text, state));
    }
    if (changed) options.memory?.save({ ids: [...seen], seq: state.seq });
  };

  const api: Story = {
    current: () => now,
    log: () => shown,
    pending: () => queue.length,
    next() {
      show(queue.shift() ?? null);
      emit();
    },
    skipAll() {
      for (const l of queue) shown.push(l);
      queue.length = 0;
      show(null);
      emit();
    },
    get autoAdvance() {
      return auto;
    },
    setAutoAdvance(value) {
      auto = value;
      options.preference?.set(value);
      stopTimer();
      if (auto && !paused && now) timer = setTimer(() => api.next(), readMs(now.text));
      emit();
    },
    setPaused(value) {
      if (paused === value) return;
      paused = value;
      stopTimer();
      if (!paused && auto && now) timer = setTimer(() => api.next(), readMs(now.text));
    },
    observe() {
      const before = queue.length;
      scan(true);
      if (now === null && queue.length > 0) api.next();
      else if (queue.length !== before) emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  // A loaded game is not a new scene: what already holds is history. A new game's `start` entry still shows.
  const start = options.getState();
  const remembered = options.memory?.load();
  if (start.seq > 0 && remembered && remembered.seq <= start.seq) for (const id of remembered.ids) seen.add(id);
  scan(start.seq === 0);
  if (queue.length > 0) show(queue.shift() ?? null);
  return api;
}
