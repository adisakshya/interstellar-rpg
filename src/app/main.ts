import { Engine } from "@babylonjs/core/Engines/engine";
import m1 from "../content/episodes/m1.json";
import assetLedger from "../../docs/ASSETS.md?raw";
import { loadEpisode } from "../content";
import { createEngine, createInitialState, createRules, type Command, type DomainEvent, type Result } from "../domain";
import {
  createKeyboardAdapter,
  createMouseAdapter,
  createTouchAdapter,
  mountTouchControls,
  type InputAction,
} from "../input";
import { IndexedDbBackend, MemoryBackend, SaveSlots, stateHash } from "../persistence";
import { createAdaptiveScaler, createRenderer, detectTier, scalingLevel, TIERS, waveScheduleOf } from "../render";
import {
  buildHudModel,
  isFinished,
  livedPhrase,
  mountHud,
  mountNotice,
  mountSubtitles,
  mountTitle,
  parseCredits,
} from "../ui";
import { actionToCommand } from "./actions";
import { watchEnding } from "./ending";
import { offerFor } from "./interactions";
import { createAutosaver } from "./autosave";
import { loadStartup, startupNotice } from "./startup";
import { createFreeRoam } from "./freeroam";
import { createStory } from "./story";
import { createAudio } from "../audio";
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
const persistent = typeof indexedDB !== "undefined";
const slots = new SaveSlots(persistent ? new IndexedDbBackend() : new MemoryBackend(), {
  contentVersion: episode.contentVersion,
});
const params = new URLSearchParams(location.search);
// `?fresh` starts a new game, ignoring the autosave (it stays on disk until the next autosave replaces it). The flag
// is removed from the address at once, so a later reload resumes this game instead of starting over again.
const fresh = params.has("fresh");
if (fresh) {
  params.delete("fresh");
  history.replaceState(null, "", `${location.pathname}${params.size > 0 ? `?${params}` : ""}${location.hash}`);
}
const startup = await loadStartup(slots, fresh);
const notice = startupNotice(startup, persistent);
// If storage failed we do not know what is saved, so this session writes nothing rather than replace it.
let savingEnabled = !notice?.disableSaving;
const game = createEngine(
  startup.kind === "resumed" ? startup.state : createInitialState(episode.initial),
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
  save: async () => {
    if (savingEnabled) await slots.writeAutosave(game.getState(), eventTail.slice(-200), nowIso());
  },
});
game.subscribe(() => autosaver.changed());
/** Every command goes through here, so checkpoints the domain captures are always stored (TIMELINES §8). */
const dispatch = (command: Command): Result => {
  const result = game.dispatch(command);
  if (savingEnabled && (result.kind === "Ok" || result.kind === "Interrupted")) {
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
const renderer = createRenderer(engine, {
  tier,
  assets: { baseUrl: import.meta.env.BASE_URL },
  content: { wave: waveScheduleOf(episode.tables) },
  fade: { set: (o) => (fade.style.opacity = String(o)) },
});
renderer.attach(game);

// Input → actions → commands. Movement is presentation only (free-roam ticks come with the frame loop, PERF-001);
// everything else is a domain command with a fresh id per player action.
const interactions = episode.interactions;
const onAction = (action: InputAction) => {
  // While the title screen is up, and once the episode is over (the outcome dialog), keys pressed behind them do nothing.
  if (titleOpen || isFinished(game.getState(), episode.ending)) return;
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
// Story subtitles (STORY-001): presentation only, derived from state, never saved.
const AUTO_KEY = "irpg.story.auto";
const STORY_SEEN_KEY = "irpg.story.seen";
const story = createStory({
  entries: episode.story,
  memory: {
    load: () => {
      try {
        const raw = localStorage.getItem(STORY_SEEN_KEY);
        const value = raw === null ? null : (JSON.parse(raw) as { ids?: unknown; seq?: unknown });
        return value && Array.isArray(value.ids) && typeof value.seq === "number"
          ? { ids: value.ids.filter((x): x is string => typeof x === "string"), seq: value.seq }
          : null;
      } catch {
        return null;
      }
    },
    save: (value) => {
      try {
        localStorage.setItem(STORY_SEEN_KEY, JSON.stringify(value));
      } catch {
        /* a blocked store only means a reload may replay a scene */
      }
    },
  },
  getState: game.getState,
  names: episode.names,
  spell: livedPhrase,
  preference: {
    get: () => {
      try {
        return localStorage.getItem(AUTO_KEY) !== "off";
      } catch {
        return true;
      }
    },
    set: (value) => {
      try {
        localStorage.setItem(AUTO_KEY, value ? "on" : "off");
      } catch {
        /* a blocked store only means the choice is not remembered */
      }
    },
  },
});
game.subscribe(() => story.observe());
// The title screen (FAN-001) holds the story and free-roam until the player chooses.
let titleOpen = false;
let lifecyclePaused = false;
const syncStoryPause = () => story.setPaused(lifecyclePaused || titleOpen);
const hud = document.getElementById("hud");
let hudView: ReturnType<typeof mountHud> | null = null;
if (hud) {
  // HUD first, so the touch controls sit on top of it. Both only read state or send commands (ARCHITECTURE §8).
  const view = mountHud(hud, {
    onSwitch: (targetId) =>
      dispatch({ kind: "SwitchCharacter", commandId: crypto.randomUUID(), targetId: targetId as never }),
    onResolve: (decisionId, optionId) =>
      dispatch({ kind: "ResolveDecision", commandId: crypto.randomUUID(), decisionId, optionId }),
    onAct: () => onAction({ kind: "Interact" }),
    onToggleSound: () => {
      audio.setEnabled(!audio.enabled);
      view.setSound(audio.enabled);
    },
  });
  hudView = view;
  const paint = (state: ReturnType<typeof game.getState>) =>
    view.update(
      buildHudModel(state, {
        names: episode.names,
        decisions: episode.tables.decisions ?? {},
        activities: episode.tables.activities,
        forecast: (id) => game.forecast(id),
        offer: offerFor(state, interactions, episode.tables.rates),
      }),
    );
  paint(game.getState());
  game.subscribe(paint);
  createTouchAdapter(mountTouchControls(hud).controls, onAction);
  const wide = window.matchMedia("(min-width: 48rem) and (pointer: fine)");
  mountSubtitles(hud, story, { slot: view.slot, wide: () => wide.matches });
}

// Real-time free-roam (D-11): fixed 1 s quanta from accumulated real time, never from frame rate.
const freeRoam = createFreeRoam({
  getState: game.getState,
  dispatch,
  newId: () => crypto.randomUUID(),
  ownerOf: (id) => episode.tables.decisions?.[id]?.owner,
  halted: () => isFinished(game.getState(), episode.ending),
  holding: () => titleOpen || (hud !== null && story.current() !== null),
});
// The time tick (AUDIO-001, D-18): one tick per day of Romilly's time, silent while he is controlled. Browsers only
// allow sound after a gesture, so the context is made on the first one; before that the beat and its visual cue run.
const AUDIO_KEY = "irpg.audio";
const audio = createAudio({
  getState: game.getState,
  rates: episode.tables.rates,
  watcher: "char.romilly" as never,
  active: () => freeRoam.active,
  onTick: () => hudView?.pulse(),
  onSkip: (days) => hudView?.announce(`${days} ${days === 1 ? "day" : "days"} passed for Romilly`),
  preference: {
    get: () => {
      try {
        return localStorage.getItem(AUDIO_KEY) !== "off";
      } catch {
        return true;
      }
    },
    set: (value) => {
      try {
        localStorage.setItem(AUDIO_KEY, value ? "on" : "off");
      } catch {
        /* the choice is only not remembered */
      }
    },
  },
});
hudView?.setSound(audio.enabled);
game.subscribe((state) => audio.observe(state));
for (const type of ["pointerdown", "keydown"] as const) window.addEventListener(type, () => audio.unlock());
const baseLevel = scalingLevel(tier, devicePixelRatio);
const scaler = createAdaptiveScaler(baseLevel, { min: baseLevel, max: baseLevel + 1 });
// `?debug&fixedres` keeps the resolution fixed, so a measurement is taken at one known pixel count (QA-001).
const adaptive = !(params.has("debug") && params.has("fixedres"));
if (notice) {
  const host = hud ?? document.body;
  const exportKey = notice.exportKey;
  mountNotice(
    host,
    notice.message,
    exportKey === undefined
      ? []
      : [
          {
            label: "Save a copy of the old save",
            run: () => {
              void slots.exportSlot(exportKey).then((text) => {
                if (text === undefined) return;
                const link = document.createElement("a");
                link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
                link.download = "interstellar-rpg-old-save.json";
                link.click();
                setTimeout(() => URL.revokeObjectURL(link.href), 1000);
              });
            },
          },
        ],
  );
}

watchEnding({
  game,
  episode,
  slots: {
    listCheckpoints: () => slots.listCheckpoints(),
    // While a checkpoint replaces the autosave, a pending autosave of the finished game must not win the race.
    restoreCheckpoint: async (key) => {
      const was = savingEnabled;
      savingEnabled = false;
      const out = await slots.restoreCheckpoint(key).catch((error: unknown) => {
        savingEnabled = was;
        throw error;
      });
      if (!out.ok) savingEnabled = was;
      return out;
    },
  },
  root: document.body,
  behind: [canvas, ...(hud ? [hud] : [])],
  reload: () => location.reload(),
  newGame: () => location.assign(`${location.pathname}?fresh`),
});

engine.runRenderLoop(() => {
  freeRoam.frame(engine.getDeltaTime());
  const level = adaptive ? scaler.frame(engine.getDeltaTime()) : null;
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
    lifecyclePaused = paused;
    syncStoryPause();
    hudView?.setPaused(paused);
  },
  autosave: () => autosaver.flush(),
  rebuildScene: () => renderer.rebuild(),
});

// The title screen (FAN-001, D-21): the fan-project notice is seen before play starts. It is skipped for an explicit
// new game (`?fresh`, from the outcome screen) and for the test hook (`?debug`, unless it also asks for `&title`).
if ((!fresh && !params.has("debug")) || params.has("title")) {
  titleOpen = true;
  syncStoryPause();
  const close = () => {
    titleOpen = false;
    syncStoryPause();
  };
  mountTitle(document.body, {
    hasSave: startup.kind === "resumed",
    credits: parseCredits(assetLedger),
    behind: [canvas, ...(hud ? [hud] : [])],
    onContinue: close,
    onNewGame: () => (startup.kind === "resumed" ? location.assign(`${location.pathname}?fresh`) : close()),
  });
}

// Test hook for Playwright and screenshots only (`?debug`); not a game feature. `?debug&frozen` also stops real-time
// free-roam from the start, so a scripted run issues exactly the commands it sends and nothing else (QA-001).
if (new URLSearchParams(location.search).has("debug")) {
  if (new URLSearchParams(location.search).has("frozen")) freeRoam.setPaused(true);
  (window as unknown as { __irpg: unknown }).__irpg = {
    game,
    renderer,
    tier,
    onAction,
    freeRoam,
    slots,
    /** Writes any owed autosave now, so a test does not have to guess how long the debounce takes. */
    flushSave: () => autosaver.flush(),
    story,
    /** What the renderer is actually drawing at, for performance reports. */
    resolution: () => ({
      scalingLevel: engine.getHardwareScalingLevel(),
      renderWidth: engine.getRenderWidth(),
      renderHeight: engine.getRenderHeight(),
    }),
    /** Hash of the game state without the random command ids, so runs on any device can be compared (QA-001). */
    hash: () => stateHash({ ...game.getState(), processedCommandIds: [] }),
  };
}
