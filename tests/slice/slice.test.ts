import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { actionToCommand } from "../../src/app/actions";
import { currentInteraction, offerFor } from "../../src/app/interactions";
import {
  createEngine,
  createInitialState,
  createRules,
  type GameEngine,
  type GameState,
  type Result,
} from "../../src/domain";
import { stateHash } from "../../src/persistence";
import { buildOutcome, formatDuration, isFinished } from "../../src/ui";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const episode = loaded.episode;
const YEAR = 365.25 * 86400;

function newGame(): { game: GameEngine; act: () => Result; resolve: (d: string, o: string) => Result; log: string[] } {
  const game = createEngine(createInitialState(episode.initial), createRules(episode.tables));
  let n = 0;
  const log: string[] = [];
  const ctx = { newId: () => `c${++n}`, interactions: episode.interactions, activities: episode.tables.activities };
  return {
    game,
    log,
    act() {
      const command = actionToCommand({ kind: "Interact" }, game.getState(), ctx);
      if (!command) throw new Error("nothing to interact with");
      log.push(command.kind === "AdvanceTime" ? command.activityId : command.kind);
      return game.dispatch(command);
    },
    resolve(decisionId, optionId) {
      log.push(`${decisionId}:${optionId}`);
      return game.dispatch({
        kind: "ResolveDecision",
        commandId: `c${++n}`,
        decisionId: decisionId as never,
        optionId,
      });
    },
  };
}

/** The authored line: scan the beacon, search the surface until the wave warning, choose, lift off. */
function play(choice: "leave_now" | "stay_longer") {
  const g = newGame();
  expect(g.act().kind).toBe("Ok"); // scan
  expect(g.act().kind).toBe("Interrupted"); // search, stopped by the wave's hard deadline
  g.resolve("decision.recall", choice);
  expect(g.act().kind).toBe("Ok"); // lift off
  return { ...g, state: g.game.getState() };
}

describe("vertical slice: Cooper on Miller, Romilly on Endurance (SLICE-001)", () => {
  it("offers one sensible action at each point of the line", () => {
    const g = newGame();
    const offered = () => currentInteraction(g.game.getState(), episode.interactions)?.id ?? null;
    expect(offered()).toBe("act.scan");
    g.act();
    expect(offered()).toBe("act.search");
    g.act(); // interrupted by the wave: the prompt must be answered, so nothing else is offered
    expect(g.game.getState().decisions["decision.recall" as never]?.status).toBe("pending");
    expect(offered()).toBeNull();
    g.resolve("decision.recall", "leave_now");
    expect(offered()).toBe("act.ascend");
  });

  it("shows the cost for others before the player commits", () => {
    const g = newGame();
    const offer = offerFor(g.game.getState(), episode.interactions, episode.tables.rates)!;
    expect(offer.label).toBe("Scan the beacon");
    const romilly = offer.others.find((o) => o.id === "char.romilly")!;
    expect(romilly.dTau / YEAR).toBeCloseTo(1.15, 2); // GDD B4
  });

  it("gives Romilly his own action, which costs Cooper almost nothing", () => {
    const g = newGame();
    g.game.dispatch({ kind: "SwitchCharacter", commandId: "s", targetId: "char.romilly" as never });
    const offer = offerFor(g.game.getState(), episode.interactions, episode.tables.rates)!;
    expect(offer.label).toBe("Wait a month");
    const cooper = offer.others.find((o) => o.id === "char.cooper")!;
    expect(cooper.dTau).toBeLessThan(60); // a month on Endurance is under a minute on Miller
  });

  describe("the choice at the wave", () => {
    const leave = play("leave_now");
    const stay = play("stay_longer");

    it("leaving now keeps Doyle alive and the recorder behind", () => {
      expect(leave.state.characters["char.doyle" as never]!.unavailable).toBe("NOT_INTRODUCED");
      expect(leave.state.knowledge["char.cooper" as never]).not.toContain("fact.miller_died_on_landing");
    });

    it("staying longer kills Doyle, recovers the recorder, and costs Romilly years", () => {
      expect(stay.state.characters["char.doyle" as never]).toMatchObject({ unavailable: "DEAD", cause: "wave" });
      expect(stay.state.knowledge["char.cooper" as never]).toContain("fact.miller_died_on_landing");
      const extraYears = (stay.state.T - leave.state.T) / YEAR;
      // 65 minutes more of Cooper's time on Miller: about 7.5 years for Romilly.
      expect(extraYears).toBeGreaterThan(7);
      expect(extraYears).toBeLessThan(8);
    });

    it("the dead stop living: Doyle's clock stops at the wave, not at the end of the episode", () => {
      const doyle = stay.state.characters["char.doyle" as never]!;
      const rate = episode.tables.rates["loc.miller_surface" as never]!;
      expect(doyle.tau).toBeCloseTo(75_000_000 * rate, 3); // the wave's deadline, T = 75 000 000 s
      expect(doyle.tau).toBeLessThan(stay.state.characters["char.cooper" as never]!.tau);
    });

    it("the cost preview leaves out the dead, who no longer age", () => {
      const before = offerFor(stay.state, episode.interactions, episode.tables.rates);
      // After lift-off nothing is on offer; check the preview on the state just before it.
      expect(before).toBeNull();
      const g = newGame();
      g.act();
      g.act();
      g.resolve("decision.recall", "stay_longer");
      const offer = offerFor(g.game.getState(), episode.interactions, episode.tables.rates)!;
      expect(offer.label).toBe("Lift off and dock");
      const ids = offer.others.map((o) => o.id);
      expect(ids).toContain("char.romilly");
      expect(ids).not.toContain("char.doyle");
    });

    it("the same extra hour is almost nothing for Cooper, and a lot for Romilly's supplies", () => {
      const cooperExtra =
        stay.state.characters["char.cooper" as never]!.tau - leave.state.characters["char.cooper" as never]!.tau;
      expect(cooperExtra).toBeCloseTo(3900, 0);
      const supplies = (s: GameState) => s.resources["res.endurance_supplies"]!.amount;
      expect(supplies(leave.state) - supplies(stay.state)).toBeGreaterThan(7);
    });

    it("both lines end the episode when Cooper lifts off, and not before", () => {
      expect(isFinished(leave.state, episode.ending)).toBe(true);
      expect(isFinished(stay.state, episode.ending)).toBe(true);
      expect(isFinished(createInitialState(episode.initial), episode.ending)).toBe(false);
    });

    it("the outcome screen explains who lived how long and why", () => {
      const ctx = { names: episode.names, facts: episode.facts, notes: episode.outcomeNotes, ending: episode.ending };
      const a = buildOutcome(leave.state, ctx);
      const b = buildOutcome(stay.state, ctx);
      expect(a.rows.map((r) => r.name)).toEqual(["Cooper", "Romilly"]);
      expect(b.rows.map((r) => r.name)).toEqual(["Cooper", "Doyle", "Romilly"]);
      expect(b.rows.find((r) => r.name === "Doyle")!.status).toBe("Dead: wave");
      expect(a.notes).toEqual([expect.stringContaining("You ran from the wave")]);
      expect(b.notes).toEqual([expect.stringContaining("You stayed for the recorder")]);
      const romilly = (o: typeof a) => o.rows.find((r) => r.name === "Romilly")!.lived;
      expect(romilly(a)).not.toBe(romilly(b));
      expect(b.known.some((k) => k.includes("flight recorder") && k.includes("Cooper"))).toBe(true);
      expect(a.known.some((k) => k.includes("flight recorder"))).toBe(false);
      expect(formatDuration(0)).toBeTruthy();
    });

    it("replaying the same commands gives the same state, and the other choice gives a different one", async () => {
      const again = play("stay_longer");
      expect(await stateHash(again.state)).toBe(await stateHash(stay.state));
      expect(await stateHash(leave.state)).not.toBe(await stateHash(stay.state));
    });
  });
});
