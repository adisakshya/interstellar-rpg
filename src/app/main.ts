import { Engine } from "@babylonjs/core/Engines/engine";
import m1 from "../content/episodes/m1.json";
import { loadEpisode } from "../content";
import { createEngine, createInitialState, createRules, type Command, type DomainEvent, type Result } from "../domain";
import {
  createKeyboardAdapter,
  createMouseAdapter,
  createTouchAdapter,
  mountTouchControls,
  type InputAction,
} from "../input";
import { IndexedDbBackend, MemoryBackend, SaveSlots } from "../persistence";
import { createAdaptiveScaler, createRenderer, detectTier, scalingLevel, TIERS } from "../render";
import { buildHudModel, mountHud } from "../ui";
import { actionToCommand, type Interaction } from "./actions";
import { createAutosaver } from "./autosave";
import { createFreeRoam } from "./freeroam";
import { attachLifecycle } from "./lifecycle";

// Composition root (ARCHITECTURE §2): content → domain engine → renderer. Input and HUD arrive in INPUT-001/UI-001.
const canvas = document.getElementById("game");
const fade = document.getElementById("fade");
if (!(canvas instanceof HTMLCanvasElement) || !fade) throw new Error("Missing #game canvas or #fade overlay");

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(`Episode content is invalid:\n${loaded.errors.join("\n")}`);
const episode = loaded.episode;

// Saves (SAVE-001): autosave when the tab is hidden, checkpoints as decisions open. A browser without IndexedDB
// (some private modes) falls back to memory, so the game still runs but will not survive a reload.
const slots = new SaveSlots(typeof indexedDB === "undefined" ? new MemoryBackend() : new IndexedDbBackend(), {
  contentVersion: episode.contentVersion,
});
const params = new URLSearchParams(location.search);
// `?fresh` ignores the autosave (it stays on disk until the next autosave overwrites it).
const resumed = params.has("fresh") ? null : await slots.loadAutosave().catch(() => null);
const game = createEngine(
  resumed?.ok ? resumed.save.state : createInitialState(episode.initial),
  createRules(episode.tables),
);
const eventTail: DomainEvent[] = [];
game.subscribe((_state, events) => {
  eventTail.push(...events);
  if (eventTail.length > 400) eventTail.splice(0, eventTail.length - 200);
});
const nowIso = () => new Date().toISOString();
// Autosave within ~2 s of any committed change, and at once when the tab is hidden (TIMELINES §8).
const autosaver = createAutosaver({
  save: () => slots.writeAutosave(game.getState(), eventTail.slice(-200), nowIso()),
});
game.subscribe(() => autosaver.changed());
/** Every command goes through here, so checkpoints the domain captures are always stored (TIMELINES §8). */
const dispatch = (command: Command): Result => {
  const result = game.dispatch(command);
  if (result.kind === "Ok" || result.kind === "Interrupted") {
    for (const snapshot of result.checkpoints) void slots.addCheckpoint(snapshot, nowIso()).catch(console.error);
  }
  return result;
};

const tier = detectTier({ matchMedia: (q) => window.matchMedia(q), devicePixelRatio, search: location.search });
const engine = new Engine(canvas, TIERS[tier].antialias, {
  preserveDrawingBuffer: false,
  stencil: false,
  // Babylon defaults the canvas to tabindex 1, making it the first Tab stop. It has nothing to operate, so keep it out
  // of the Tab order and let keyboard focus start at the HUD (NFR-04).
  canvasTabIndex: -1,
});
engine.setHardwareScalingLevel(scalingLevel(tier, devicePixelRatio));
const renderer = createRenderer(engine, { tier, fade: { set: (o) => (fade.style.opacity = String(o)) } });
renderer.attach(game);

// Input → actions → commands. Movement is presentation only (free-roam ticks come with the frame loop, PERF-001);
// everything else is a domain command with a fresh id per player action.
const interactions: Record<string, Interaction> = {
  // M1 placeholder: one beacon scan. SLICE-001 replaces this table with the authored beats.
  "loc.miller_surface": { activityId: "scan.beacon", dTau: 600 },
};
const onAction = (action: InputAction) => {
  if (action.kind === "Move") {
    renderer.setMove(action.x, action.y);
    return;
  }
  const command = actionToCommand(action, game.getState(), {
    newId: () => crypto.randomUUID(),
    interactions,
    activities: episode.tables.activities,
  });
  if (command) dispatch(command);
};
createKeyboardAdapter(window, onAction);
createMouseAdapter(canvas, onAction, undefined, window);
const hud = document.getElementById("hud");
let hudView: ReturnType<typeof mountHud> | null = null;
if (hud) {
  // HUD first, so the touch controls sit on top of it. Both only read state or send commands (ARCHITECTURE §8).
  const view = mountHud(hud, {
    onSwitch: (targetId) =>
      dispatch({ kind: "SwitchCharacter", commandId: crypto.randomUUID(), targetId: targetId as never }),
    onResolve: (decisionId, optionId) =>
      dispatch({ kind: "ResolveDecision", commandId: crypto.randomUUID(), decisionId, optionId }),
  });
  hudView = view;
  const paint = (state: ReturnType<typeof game.getState>) =>
    view.update(
      buildHudModel(state, {
        names: episode.names,
        decisions: episode.tables.decisions ?? {},
        activities: episode.tables.activities,
        forecast: (id) => game.forecast(id),
      }),
    );
  paint(game.getState());
  game.subscribe(paint);
  createTouchAdapter(mountTouchControls(hud).controls, onAction);
}

// Real-time free-roam (D-11): fixed 1 s quanta from accumulated real time, never from frame rate.
const freeRoam = createFreeRoam({
  getState: game.getState,
  dispatch,
  newId: () => crypto.randomUUID(),
  ownerOf: (id) => episode.tables.decisions?.[id]?.owner,
});
const baseLevel = scalingLevel(tier, devicePixelRatio);
const scaler = createAdaptiveScaler(baseLevel, { min: baseLevel, max: baseLevel + 1 });
engine.runRenderLoop(() => {
  freeRoam.frame(engine.getDeltaTime());
  const level = scaler.frame(engine.getDeltaTime());
  if (level !== null) {
    engine.setHardwareScalingLevel(level);
    engine.resize();
  }
  renderer.render();
});
window.addEventListener("resize", () => engine.resize());
attachLifecycle({
  document,
  canvas,
  setPaused: (paused) => {
    freeRoam.setPaused(paused);
    hudView?.setPaused(paused);
  },
  autosave: () => autosaver.flush(),
  rebuildScene: () => renderer.rebuild(),
});

// Test hook for Playwright and screenshots only (`?debug`); not a game feature.
if (new URLSearchParams(location.search).has("debug")) {
  (window as unknown as { __irpg: unknown }).__irpg = { game, renderer, tier, onAction, freeRoam, slots };
}
