import { Engine } from "@babylonjs/core/Engines/engine";
import m1 from "../content/episodes/m1.json";
import { loadEpisode } from "../content";
import { createEngine, createInitialState, createRules } from "../domain";
import {
  createKeyboardAdapter,
  createMouseAdapter,
  createTouchAdapter,
  mountTouchControls,
  type InputAction,
} from "../input";
import { createRenderer, detectTier, scalingLevel, TIERS } from "../render";
import { buildHudModel, mountHud } from "../ui";
import { actionToCommand, type Interaction } from "./actions";

// Composition root (ARCHITECTURE §2): content → domain engine → renderer. Input and HUD arrive in INPUT-001/UI-001.
const canvas = document.getElementById("game");
const fade = document.getElementById("fade");
if (!(canvas instanceof HTMLCanvasElement) || !fade) throw new Error("Missing #game canvas or #fade overlay");

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(`Episode content is invalid:\n${loaded.errors.join("\n")}`);
const episode = loaded.episode;
const game = createEngine(createInitialState(episode.initial), createRules(episode.tables));

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
  if (command) game.dispatch(command);
};
createKeyboardAdapter(window, onAction);
createMouseAdapter(canvas, onAction, undefined, window);
const hud = document.getElementById("hud");
if (hud) {
  // HUD first, so the touch controls sit on top of it. Both only read state or send commands (ARCHITECTURE §8).
  const view = mountHud(hud, {
    onSwitch: (targetId) =>
      game.dispatch({ kind: "SwitchCharacter", commandId: crypto.randomUUID(), targetId: targetId as never }),
    onResolve: (decisionId, optionId) =>
      game.dispatch({ kind: "ResolveDecision", commandId: crypto.randomUUID(), decisionId, optionId }),
  });
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

engine.runRenderLoop(() => renderer.render());
window.addEventListener("resize", () => engine.resize());

// Test hook for Playwright and screenshots only (`?debug`); not a game feature.
if (new URLSearchParams(location.search).has("debug")) {
  (window as unknown as { __irpg: unknown }).__irpg = { game, renderer, tier, onAction };
}
