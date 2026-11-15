import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { actionToCommand, type TranslateContext } from "../../src/app/actions";
import { createEngine, createInitialState, createRules, type Command } from "../../src/domain";
import {
  createKeyboardAdapter,
  createTouchAdapter,
  PAD_SIZE,
  type InputAction,
  type TouchControls,
} from "../../src/input";
import { stateHash } from "../../src/persistence";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;
const newGame = () => createEngine(createInitialState(episode.initial), createRules(episode.tables));
const interactions = { "loc.miller_surface": { activityId: "scan.beacon", dTau: 600 } };
const counterContext = (): TranslateContext => {
  let n = 0;
  return { newId: () => `cmd-${++n}`, interactions, activities: episode.tables.activities };
};

describe("actionToCommand", () => {
  const state = createInitialState(episode.initial);

  it("turns Interact into the place's activity for the controlled character", () => {
    expect(actionToCommand({ kind: "Interact" }, state, counterContext())).toEqual({
      kind: "AdvanceTime",
      commandId: "cmd-1",
      actorId: "char.cooper",
      activityId: "scan.beacon",
      dTau: 600,
    });
  });

  it("does nothing for movement, or where there is nothing to interact with", () => {
    expect(actionToCommand({ kind: "Move", x: 1, y: 0 }, state, counterContext())).toBeNull();
    const aboard = { ...state, controlled: "char.romilly" as never };
    expect(actionToCommand({ kind: "Interact" }, aboard, counterContext())).toBeNull();
  });

  it("switches to the next switchable character, skipping unavailable ones, and by roster slot", () => {
    const next = actionToCommand({ kind: "SwitchNext" }, state, counterContext());
    expect(next).toMatchObject({ kind: "SwitchCharacter", targetId: "char.romilly" });
    const wrapped = actionToCommand(
      { kind: "SwitchNext" },
      { ...state, controlled: "char.romilly" as never },
      counterContext(),
    );
    expect(wrapped).toMatchObject({ targetId: "char.cooper" });
    // Slots follow switcher order: brand, cooper, doyle, murph, romilly.
    expect(actionToCommand({ kind: "SwitchTo", index: 5 }, state, counterContext())).toMatchObject({
      targetId: "char.romilly",
    });
    expect(actionToCommand({ kind: "SwitchTo", index: 99 }, state, counterContext())).toBeNull();
  });
});

describe("W6: keyboard and touch reach the same outcome (INV-15)", () => {
  const key = (type: string, code: string) =>
    Object.assign(new Event(type, { cancelable: true }), { code, repeat: false });
  const pointer = (type: string, x: number, y: number) =>
    Object.assign(new Event(type), { pointerId: 1, clientX: x, clientY: y });

  /** The authored intent: walk a little, scan the beacon, switch to Romilly, then back to Cooper. */
  function playKeyboard(emit: (a: InputAction) => void) {
    const target = new EventTarget();
    createKeyboardAdapter(target, emit);
    target.dispatchEvent(key("keydown", "KeyD"));
    target.dispatchEvent(key("keyup", "KeyD"));
    target.dispatchEvent(key("keydown", "KeyE"));
    target.dispatchEvent(key("keydown", "KeyQ"));
    target.dispatchEvent(key("keydown", "KeyQ"));
  }
  function playTouch(emit: (a: InputAction) => void) {
    const pad = Object.assign(new EventTarget(), {
      rect: () => ({ left: 0, top: 0, width: PAD_SIZE, height: PAD_SIZE }),
    });
    const controls: TouchControls = { pad, interact: new EventTarget(), switchNext: new EventTarget() };
    createTouchAdapter(controls, emit);
    pad.dispatchEvent(pointer("pointerdown", PAD_SIZE, PAD_SIZE / 2)); // full right
    pad.dispatchEvent(pointer("pointerup", PAD_SIZE, PAD_SIZE / 2));
    controls.interact.dispatchEvent(new Event("click"));
    controls.switchNext.dispatchEvent(new Event("click"));
    controls.switchNext.dispatchEvent(new Event("click"));
  }

  async function run(play: (emit: (a: InputAction) => void) => void) {
    const game = newGame();
    const ctx = counterContext();
    const actions: InputAction[] = [];
    const commands: Command[] = [];
    play((action) => {
      actions.push(action);
      const command = actionToCommand(action, game.getState(), ctx);
      if (command) {
        commands.push(command);
        game.dispatch(command);
      }
    });
    return { actions, commands, hash: await stateHash(game.getState()), state: game.getState() };
  }

  it("emits the same action log, the same command log and the same final state hash", async () => {
    const keyboard = await run(playKeyboard);
    const touch = await run(playTouch);
    expect(touch.actions).toEqual(keyboard.actions);
    expect(touch.commands).toEqual(keyboard.commands);
    expect(touch.hash).toBe(keyboard.hash);
    // And the intent really happened: the scan cost Romilly years, and control is back with Cooper.
    expect(keyboard.commands.map((c) => c.kind)).toEqual(["AdvanceTime", "SwitchCharacter", "SwitchCharacter"]);
    expect(keyboard.state.controlled).toBe("char.cooper");
    expect(keyboard.state.characters["char.romilly" as never]!.tau / (365.25 * 86400)).toBeCloseTo(1.15, 2);
  });
});
