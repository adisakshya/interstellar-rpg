/** The parts of a page the lifecycle listens to; `document` and a canvas satisfy these. */
export interface VisibilitySource {
  readonly visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}
export interface ContextSource {
  addEventListener(type: "webglcontextlost" | "webglcontextrestored", listener: (e: Event) => void): void;
  removeEventListener(type: "webglcontextlost" | "webglcontextrestored", listener: (e: Event) => void): void;
}

export interface LifecycleOptions {
  readonly document: VisibilitySource;
  readonly canvas: ContextSource;
  /** Stop or restart real-time free-roam. This is a UI pause, never a statement about physical time (TIMELINES §5). */
  setPaused(paused: boolean): void;
  /** Persist the current state. Called when the tab is hidden. Failures must not break the page. */
  autosave(): Promise<void> | void;
  /** Rebuild the visible scene from the current state after the graphics context came back. */
  rebuildScene(): Promise<void> | void;
  onError?(error: unknown): void;
}

/**
 * Tab visibility and WebGL context loss (TIMELINES §5, ARCHITECTURE §4). Hidden tab or lost context pauses real-time
 * free-roam, so backgrounding never advances the simulation (INV-13). The domain state is never touched here: a
 * restored context rebuilds the scene from state and play resumes where it stopped.
 */
export function attachLifecycle(options: LifecycleOptions): () => void {
  const report = (error: unknown) => (options.onError ?? console.error)(error);
  let hidden = options.document.visibilityState === "hidden";
  let contextLost = false;
  const sync = () => options.setPaused(hidden || contextLost);
  const guard = (run: () => Promise<void> | void) => {
    try {
      Promise.resolve(run()).catch(report);
    } catch (error) {
      report(error);
    }
  };

  const onVisibility = () => {
    hidden = options.document.visibilityState === "hidden";
    sync();
    if (hidden) guard(options.autosave);
  };
  const onLost = (e: Event) => {
    // Without this the browser never fires "restored".
    e.preventDefault();
    contextLost = true;
    sync();
  };
  const onRestored = () => {
    // Stay paused until the scene is back, so nothing runs against a half-built view.
    guard(async () => {
      try {
        await options.rebuildScene();
      } finally {
        contextLost = false;
        sync();
      }
    });
  };

  options.document.addEventListener("visibilitychange", onVisibility);
  options.canvas.addEventListener("webglcontextlost", onLost);
  options.canvas.addEventListener("webglcontextrestored", onRestored);
  sync();
  return () => {
    options.document.removeEventListener("visibilitychange", onVisibility);
    options.canvas.removeEventListener("webglcontextlost", onLost);
    options.canvas.removeEventListener("webglcontextrestored", onRestored);
  };
}
