import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { createEngine, createInitialState, createRules, type GameState } from "../../src/domain";
import { stateHash } from "../../src/persistence";
import { createRenderer, detectTier, scalingLevel, sceneFor, TIERS, type Renderer } from "../../src/render";

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
    expect(await waterAlpha("high")).toBe(0.75);
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
