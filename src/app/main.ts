import { Engine } from "@babylonjs/core/Engines/engine";
import m1 from "../content/episodes/m1.json";
import { loadEpisode } from "../content";
import { createEngine, createInitialState, createRules } from "../domain";
import { createRenderer, detectTier, scalingLevel, TIERS } from "../render";

// Composition root (ARCHITECTURE §2): content → domain engine → renderer. Input and HUD arrive in INPUT-001/UI-001.
const canvas = document.getElementById("game");
const fade = document.getElementById("fade");
if (!(canvas instanceof HTMLCanvasElement) || !fade) throw new Error("Missing #game canvas or #fade overlay");

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(`Episode content is invalid:\n${loaded.errors.join("\n")}`);
const episode = loaded.episode;
const game = createEngine(createInitialState(episode.initial), createRules(episode.tables));

const tier = detectTier({ matchMedia: (q) => window.matchMedia(q), devicePixelRatio, search: location.search });
const engine = new Engine(canvas, TIERS[tier].antialias, { preserveDrawingBuffer: false, stencil: false });
engine.setHardwareScalingLevel(scalingLevel(tier, devicePixelRatio));
const renderer = createRenderer(engine, { tier, fade: { set: (o) => (fade.style.opacity = String(o)) } });
renderer.attach(game);

engine.runRenderLoop(() => renderer.render());
window.addEventListener("resize", () => engine.resize());

// Test hook for Playwright and screenshots only (`?debug`); not a game feature.
if (new URLSearchParams(location.search).has("debug")) {
  (window as unknown as { __irpg: unknown }).__irpg = { game, renderer, tier };
}
