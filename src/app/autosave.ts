export interface AutosaverOptions {
  /** Write the current state. Called with no arguments; it reads the latest state itself. */
  save(): Promise<void> | void;
  /** Longest an unsaved commit may wait (TIMELINES §8: ~2 s). */
  delayMs?: number;
  onError?(error: unknown): void;
  setTimer?(run: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
}

export interface Autosaver {
  /** Note a committed change. Saves within `delayMs`. */
  changed(): void;
  /** Save now if anything is unsaved (hidden tab, page leaving), and cancel the pending timer. */
  flush(): Promise<void>;
}

/**
 * Autosave after committed commands (TIMELINES §8). The timer starts on the first unsaved change and is not pushed
 * back by later ones: free-roam commits every second, so a debounce that restarts on each commit would never save.
 */
export function createAutosaver(options: AutosaverOptions): Autosaver {
  const delay = options.delayMs ?? 2000;
  const setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const report = (error: unknown) => (options.onError ?? console.error)(error);
  let timer: unknown = null;
  let dirty = false;

  // Writes run one after another: a flush that arrives while a timed write is still in flight must not race it, or the
  // older state could land last and replace the newer one.
  let chain: Promise<void> = Promise.resolve();
  const write = (): Promise<void> => {
    timer = null;
    chain = chain.then(async () => {
      if (!dirty) return;
      dirty = false;
      try {
        await options.save();
      } catch (error) {
        dirty = true; // keep it owed, so the next change or flush tries again
        report(error);
      }
    });
    return chain;
  };

  return {
    changed() {
      dirty = true;
      timer ??= setTimer(() => void write(), delay);
    },
    async flush() {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      await write();
    },
  };
}
