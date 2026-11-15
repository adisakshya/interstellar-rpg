import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { GameEngine, GameState } from "../domain";
import { TIERS, type Tier } from "./quality";
import type { SceneFactory, SceneHandle } from "./scenes/common";

export type SceneKind = "cockpit" | "surface" | "endurance";

/** Which scene shows a character at a location (GDD §3 places). Unlisted places keep the current scene. */
export const SCENE_BY_LOCATION: Readonly<Record<string, SceneKind>> = {
  "loc.ranger": "cockpit",
  "loc.miller_surface": "surface",
  "loc.miller_wreck": "surface",
  "loc.endurance": "endurance",
};

/** The scene for the controlled character, or null if their place has none (e.g. Earth before M2). */
export function sceneFor(state: GameState): SceneKind | null {
  const c = state.characters[state.controlled];
  return c ? (SCENE_BY_LOCATION[c.location] ?? null) : null;
}

/** Scenes load lazily, so a phone only downloads the one it shows first (ARCHITECTURE §7). */
const DEFAULT_LOADERS: Readonly<Record<SceneKind, () => Promise<SceneFactory>>> = {
  cockpit: async () => (await import("./scenes/cockpit")).createCockpitScene,
  surface: async () => (await import("./scenes/surface")).createSurfaceScene,
  endurance: async () => (await import("./scenes/endurance")).createEnduranceScene,
};

export interface RendererOptions {
  readonly tier: Tier;
  /** A full-screen fade used to hide scene swaps (landing, switching); omitted in tests. */
  readonly fade?: { set(opacity: number): void };
  readonly fadeMs?: number;
  readonly loaders?: Readonly<Record<SceneKind, () => Promise<SceneFactory>>>;
  /** Where scene-load failures go when following an engine (default: console.error). */
  readonly onError?: (error: unknown) => void;
}

export interface Renderer {
  /** Follow an engine: show the right scene now and after every committed change. Returns a detach function. */
  attach(game: Pick<GameEngine, "getState" | "subscribe">): () => void;
  /** Show the scene for `state`. Resolves once any scene swap has finished. */
  show(state: GameState): Promise<void>;
  /** The scene on screen, if any. */
  readonly current: SceneKind | null;
  readonly handle: SceneHandle | null;
  /** Presentation-only movement for the visible character. */
  setMove(x: number, y: number): void;
  /** Draw one frame; call from `engine.runRenderLoop`. */
  render(): void;
  dispose(): void;
}

/**
 * The renderer only reads game state: it is handed frozen states and never calls `dispatch` (ARCHITECTURE §1-2).
 * Scene swaps are serialised and bounded by a short fade; a newer state always wins over one still loading.
 */
export function createRenderer(engine: AbstractEngine, options: RendererOptions): Renderer {
  const loaders = options.loaders ?? DEFAULT_LOADERS;
  const fadeMs = options.fadeMs ?? 250;
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  let current: SceneKind | null = null;
  let handle: SceneHandle | null = null;
  let wanted: SceneKind | null = null;
  let latest: GameState | null = null;
  let swapping: Promise<void> = Promise.resolve();
  let disposed = false;
  // The latest movement vector, so a held direction carries over into a replacement scene (and a press made during
  // the fade is not lost).
  let move = { x: 0, y: 0 };

  async function swapTo(kind: SceneKind): Promise<void> {
    const factory = await loaders[kind]();
    if (disposed) return;
    try {
      if (options.fade && handle) {
        options.fade.set(1);
        await wait(fadeMs);
        // dispose() may have run during the fade: build nothing on a disposed renderer.
        if (disposed) return;
      }
      handle?.dispose();
      handle = null;
      current = null;
      handle = factory(engine, TIERS[options.tier]);
      handle.setMove(move.x, move.y);
      current = kind;
      if (latest) handle.update({ characterId: latest.controlled });
    } finally {
      options.fade?.set(0);
    }
  }

  function show(state: GameState): Promise<void> {
    latest = state;
    const kind = sceneFor(state) ?? current;
    if (kind === null) return swapping;
    wanted = kind;
    const run = swapping.then(async () => {
      if (disposed || wanted === current || wanted === null) {
        if (latest && handle) handle.update({ characterId: latest.controlled });
        return;
      }
      await swapTo(wanted);
    });
    // One failed load (e.g. a dropped connection) must not jam later swaps: the queue always moves on, and the
    // failure is reported to the caller of this show().
    swapping = run.catch(() => undefined);
    return run;
  }

  return {
    attach(game) {
      const report = (error: unknown) => (options.onError ?? console.error)(error);
      show(game.getState()).catch(report);
      return game.subscribe((state: GameState) => {
        show(state).catch(report);
      });
    },
    show,
    get current() {
      return current;
    },
    get handle() {
      return handle;
    },
    setMove(x, y) {
      move = { x, y };
      handle?.setMove(x, y);
    },
    render: () => handle?.scene.render(),
    dispose() {
      disposed = true;
      handle?.dispose();
      handle = null;
      current = null;
    },
  };
}
