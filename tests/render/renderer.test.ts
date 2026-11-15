import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it, vi } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { createEngine, createInitialState, createRules, type GameState } from "../../src/domain";
import { stateHash } from "../../src/persistence";
import { createRenderer, detectTier, scalingLevel, sceneFor, TIERS, type Renderer } from "../../src/render";
import type { SceneFactory } from "../../src/render/scenes/common";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;
const newGame = () => createEngine(createInitialState(episode.initial), createRules(episode.tables));
const at = (s: GameState, location: string): GameState => ({
  ...s,
  characters: { ...s.characters, [s.controlled]: { ...s.characters[s.controlled]!, location: location as never } },
});

let engine: NullEngine;
let renderer: Renderer | null = null;
afterEach(() => {
  renderer?.dispose();
  engine?.dispose();
});

describe("scene choice follows the controlled character (SCENE-001)", () => {
  it("maps places to scenes", () => {
    const s = createInitialState(episode.initial);
    expect(sceneFor(s)).toBe("surface");
    expect(sceneFor(at(s, "loc.ranger"))).toBe("cockpit");
    expect(sceneFor(at(s, "loc.endurance"))).toBe("endurance");
    expect(sceneFor(at(s, "loc.earth_farm"))).toBeNull();
  });

  it("switches scenes when the player switches character, without touching game state", async () => {
    engine = new NullEngine();
    const fades: number[] = [];
    renderer = createRenderer(engine, { tier: "high", fade: { set: (o) => fades.push(o) }, fadeMs: 0 });
    const game = newGame();
    renderer.attach(game);
    await renderer.show(game.getState());
    expect(renderer.current).toBe("surface");
    expect(fades).toEqual([0]); // first scene: no fade-out needed

    const before = await stateHash(game.getState());
    game.dispatch({ kind: "SwitchCharacter", commandId: "s1", targetId: "char.romilly" as never });
    await renderer.show(game.getState());
    expect(renderer.current).toBe("endurance");
    expect(fades).toEqual([0, 1, 0]);
    // Switching changes only `controlled`; rendering added nothing on top.
    expect(await stateHash({ ...game.getState(), controlled: "char.cooper" })).toBe(before);
    expect(engine.scenes).toHaveLength(1); // the previous scene was disposed
  });

  it("shows the cockpit for the Ranger and keeps the last scene for places without one", async () => {
    engine = new NullEngine();
    renderer = createRenderer(engine, { tier: "low", fadeMs: 0 });
    const s = createInitialState(episode.initial);
    await renderer.show(at(s, "loc.ranger"));
    expect(renderer.current).toBe("cockpit");
    await renderer.show(at(s, "loc.earth_farm"));
    expect(renderer.current).toBe("cockpit");
  });

  it("lands on the newest state when changes arrive faster than scenes load", async () => {
    engine = new NullEngine();
    renderer = createRenderer(engine, { tier: "high", fadeMs: 0 });
    const s = createInitialState(episode.initial);
    void renderer.show(at(s, "loc.ranger"));
    void renderer.show(at(s, "loc.endurance"));
    await renderer.show(s);
    expect(renderer.current).toBe("surface");
    expect(engine.scenes).toHaveLength(1);
  });

  it("renders frames from frozen state without throwing", async () => {
    engine = new NullEngine();
    renderer = createRenderer(engine, { tier: "high", fadeMs: 0 });
    const game = newGame();
    renderer.attach(game);
    await renderer.show(game.getState());
    renderer.setMove(1, 0);
    for (let i = 0; i < 5; i++) renderer.render();
    expect(Object.isFrozen(game.getState())).toBe(true);
  });
});

describe("the crew is on Miller's surface (CHAR-001)", () => {
  it("builds Cooper, Brand and Doyle as suited figures, and disposes them with the scene", async () => {
    engine = new NullEngine();
    renderer = createRenderer(engine, { tier: "high", fadeMs: 0 });
    await renderer.show(createInitialState(episode.initial));
    const names = renderer.handle!.scene.meshes.map((m) => m.name);
    for (const who of ["cooper", "brand", "doyle"]) expect(names).toContain(`${who}.helmet`);
    expect(names).not.toContain("romilly.helmet"); // Romilly is on Endurance
    for (let i = 0; i < 3; i++) renderer.render();
    const scene = renderer.handle!.scene;
    renderer.dispose();
    expect(scene.isDisposed).toBe(true);
    renderer = null;
  });
});

describe("the wave in Miller's scene (WAVE-001)", () => {
  const schedule = { warnT: 1000, arriveT: 2000 };
  const at = (T: number, extra: Partial<GameState> = {}): GameState => ({
    ...createInitialState(episode.initial),
    T,
    ...extra,
  });
  const wave = () => renderer!.handle!.scene.getMeshByName("wave")!;
  const frames = () => {
    for (let i = 0; i < 4; i++) renderer!.render();
  };

  it("is hidden before the warning, on the horizon at the warning, and upon the crew exactly at the arrival", async () => {
    engine = new NullEngine();
    renderer = createRenderer(engine, { tier: "high", fadeMs: 0, content: { wave: schedule } });
    await renderer.show(at(500));
    frames();
    expect(wave().isEnabled()).toBe(false);
    await renderer.show(at(1000));
    frames();
    expect(wave().isEnabled()).toBe(true);
    expect(wave().position.z).toBeGreaterThan(160);
    await renderer.show(at(2000)); // a jump of more than half the way snaps instead of gliding
    frames();
    expect(wave().position.z).toBeLessThan(20);
    expect(wave().scaling.y).toBeGreaterThan(35);
    await renderer.show(at(5000)); // long past: it has gone by
    frames();
    expect(wave().isEnabled()).toBe(false);
  });

  it("is never shown in a story with no wave", async () => {
    engine = new NullEngine();
    renderer = createRenderer(engine, { tier: "high", fadeMs: 0 });
    await renderer.show(at(1500));
    frames();
    expect(wave().isEnabled()).toBe(false);
  });
});

describe("the dead leave the scene (CHAR-001)", () => {
  it("hides a follower who has died, and shows him again if the scene is rebuilt from a state where he lives", async () => {
    engine = new NullEngine();
    renderer = createRenderer(engine, { tier: "high", fadeMs: 0 });
    const base = createInitialState(episode.initial);
    const doyle = base.characters["char.doyle" as never]!;
    const node = (name: string) => renderer!.handle!.scene.transformNodes.find((n) => n.name === name)!;
    await renderer.show({
      ...base,
      characters: { ...base.characters, ["char.doyle" as never]: { ...doyle, unavailable: "DEAD" } },
    });
    expect(node("doyle.figure").isEnabled()).toBe(false);
    expect(node("brand.figure").isEnabled()).toBe(true);
    await renderer.show(base); // a checkpoint restore: he is not dead in this state
    expect(node("doyle.figure").isEnabled()).toBe(true);
    await renderer.rebuild();
    expect(node("doyle.figure").isEnabled()).toBe(true);
  });
});

describe("held movement", () => {
  it("carries over into a replacement scene, including a press made during the swap", async () => {
    engine = new NullEngine();
    const { createSurfaceScene } = await import("../../src/render/scenes/surface");
    const { createEnduranceScene } = await import("../../src/render/scenes/endurance");
    const { createCockpitScene } = await import("../../src/render/scenes/cockpit");
    const received: Array<[string, number, number]> = [];
    const recording =
      (name: string, factory: SceneFactory): (() => Promise<SceneFactory>) =>
      async () =>
      (eng, tier) => {
        const h = factory(eng, tier);
        return {
          ...h,
          setMove: (x, y) => {
            received.push([name, x, y]);
            h.setMove(x, y);
          },
        };
      };
    renderer = createRenderer(engine, {
      tier: "high",
      fade: { set: () => undefined },
      fadeMs: 20,
      loaders: {
        surface: recording("surface", createSurfaceScene),
        endurance: recording("endurance", createEnduranceScene),
        cockpit: recording("cockpit", createCockpitScene),
      },
    });
    const s = createInitialState(episode.initial);
    await renderer.show(s);
    renderer.setMove(1, 0); // stick held on the surface
    const swap = renderer.show(at(s, "loc.endurance"));
    renderer.setMove(0, -1); // changed again during the fade
    await swap;
    expect(renderer.current).toBe("endurance");
    expect(received.filter(([n]) => n === "endurance")).toEqual([["endurance", 0, -1]]);
  });
});

describe("failures and disposal", () => {
  it("recovers after a scene fails to load, and reports the failure", async () => {
    engine = new NullEngine();
    const real = await import("../../src/render/scenes/endurance");
    const surface = await import("../../src/render/scenes/surface");
    const cockpit = await import("../../src/render/scenes/cockpit");
    let failNext = true;
    const errors: unknown[] = [];
    renderer = createRenderer(engine, {
      tier: "high",
      fadeMs: 0,
      onError: (e) => errors.push(e),
      loaders: {
        surface: async () => surface.createSurfaceScene,
        cockpit: async () => cockpit.createCockpitScene,
        endurance: async () => {
          if (failNext) {
            failNext = false;
            throw new Error("offline");
          }
          return real.createEnduranceScene;
        },
      },
    });
    const game = newGame();
    renderer.attach(game);
    await renderer.show(game.getState());
    // The switch triggers a load through attach(); it fails, is reported, and the surface stays up.
    game.dispatch({ kind: "SwitchCharacter", commandId: "s1", targetId: "char.romilly" as never });
    await new Promise((r) => setTimeout(r, 0));
    expect(renderer.current).toBe("surface");
    // The queue is not jammed: the next show retries and succeeds.
    await renderer.show(game.getState());
    expect(renderer.current).toBe("endurance");
    expect(errors.map(String)).toContain("Error: offline");
  });

  it("builds nothing when disposed during the fade", async () => {
    engine = new NullEngine();
    renderer = createRenderer(engine, { tier: "high", fade: { set: () => undefined }, fadeMs: 30 });
    const s = createInitialState(episode.initial);
    await renderer.show(s);
    const pending = renderer.show(at(s, "loc.endurance"));
    await new Promise((r) => setTimeout(r, 5)); // inside the fade
    renderer.dispose();
    await pending;
    expect(renderer.current).toBeNull();
    expect(renderer.handle).toBeNull();
    expect(engine.scenes).toHaveLength(0);
  });
});

describe("quality tiers change visuals only", () => {
  it("draws water opaque on low and transparent on high", async () => {
    const waterAlpha = async (tier: "low" | "high") => {
      engine = new NullEngine();
      renderer = createRenderer(engine, { tier, fadeMs: 0 });
      await renderer.show(createInitialState(episode.initial));
      const alpha = renderer.handle!.scene.getMeshByName("water")!.material!.alpha;
      renderer.dispose();
      engine.dispose();
      renderer = null;
      return alpha;
    };
    expect(await waterAlpha("low")).toBe(1);
    const high = await waterAlpha("high");
    expect(high).toBeLessThan(1); // the exact value is an art choice; only "transparent on high" is a rule
    expect(high).toBeGreaterThan(0.5);
  });

  it("picks low for touch or dense screens, honours ?tier, and scales below native on low", () => {
    const media = (coarse: boolean) => () => ({ matches: coarse });
    expect(detectTier({ matchMedia: media(true), devicePixelRatio: 2 })).toBe("low");
    expect(detectTier({ matchMedia: media(false), devicePixelRatio: 3 })).toBe("low");
    expect(detectTier({ matchMedia: media(false), devicePixelRatio: 1 })).toBe("high");
    expect(detectTier({ matchMedia: media(true), search: "?tier=high" })).toBe("high");
    expect(scalingLevel("low", 3)).toBeCloseTo(0.5, 12); // 2 rendered pixels per CSS pixel on a 3x phone
    expect(scalingLevel("high", 1)).toBe(1);
    expect(TIERS.low.antialias).toBe(false);
  });
});

describe("context-loss recovery (PERF-001, TIMELINES §5)", () => {
  it("rebuilds the visible scene from the latest state and leaves game state untouched", async () => {
    engine = new NullEngine();
    renderer = createRenderer(engine, { tier: "high", fadeMs: 0 });
    const game = newGame();
    renderer.attach(game);
    await renderer.show(game.getState());
    renderer.setMove(0, 1);
    const before = await stateHash(game.getState());
    const stateObject = game.getState();
    const oldScene = renderer.handle!.scene;

    await renderer.rebuild();

    expect(renderer.current).toBe("surface");
    expect(renderer.handle!.scene).not.toBe(oldScene);
    expect(oldScene.isDisposed).toBe(true);
    expect(engine.scenes).toHaveLength(1);
    expect(game.getState()).toBe(stateObject);
    expect(await stateHash(game.getState())).toBe(before);
    for (let i = 0; i < 3; i++) renderer.render(); // the new scene draws, with the held movement carried over
  });

  it("follows a scene change made while the context was down, and survives a scene that fails to dispose", async () => {
    engine = new NullEngine();
    renderer = createRenderer(engine, { tier: "low", fadeMs: 0 });
    const game = newGame();
    await renderer.show(game.getState());
    vi.spyOn(renderer.handle!, "dispose").mockImplementation(() => {
      throw new Error("context lost");
    });
    await renderer.show(at(game.getState(), "loc.ranger")).catch(() => undefined);
    await renderer.rebuild();
    expect(renderer.current).toBe("cockpit");
  });
});
