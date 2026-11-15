import { describe, expect, it } from "vitest";
import { LOCATIONS } from "../../src/content";
import {
  apply,
  asId,
  createHandlers,
  playerOnlyFacts,
  SCHEMA_VERSION,
  type Command,
  type GameState,
  type Result,
  type TimeTables,
} from "../../src/domain";

const cooper = asId("char", "char.cooper");
const romilly = asId("char", "char.romilly");
const brand = asId("char", "char.brand");
const beaconAge = asId("fact", "fact.beacon_age");
const secret = asId("fact", "fact.secret");
const dWait = asId("decision", "decision.wait");

// TEST-ONLY: Endurance and the surface both at rate 1 so seconds of τ and T line up; link latency 60 s of T.
const TABLES: TimeTables = {
  rates: { [LOCATIONS.millerSurface]: 1, [LOCATIONS.endurance]: 1 },
  activities: { "scan.beacon": { atomic: false, learns: [beaconAge] } },
  links: [{ a: LOCATIONS.millerSurface, b: LOCATIONS.endurance, latency: 60, up: true }],
  facts: [beaconAge, secret],
};
const h = createHandlers(TABLES);

function start(): GameState {
  const ch = (id: typeof cooper, location: typeof LOCATIONS.endurance) => ({ id, tau: 0, location, unavailable: null });
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: "test",
    T: 0,
    seq: 0,
    controlled: cooper,
    characters: {
      [cooper]: ch(cooper, LOCATIONS.millerSurface),
      [brand]: ch(brand, LOCATIONS.millerSurface),
      [romilly]: ch(romilly, LOCATIONS.endurance),
    },
    resources: {},
    decisions: {},
    knowledge: {},
    playerSeen: [],
    messages: [],
    activities: {},
    processedCommandIds: [],
    rng: { seed: 1, state: 1 },
  };
}

const scan: Command = { kind: "AdvanceTime", commandId: "scan", actorId: cooper, activityId: "scan.beacon", dTau: 10 };
const wait = (commandId: string, dTau: number): Command => ({ kind: "FreeRoamTick", commandId, actorId: cooper, dTau });
const send = (commandId: string, toId = romilly, factIds = [beaconAge]): Command => ({
  kind: "SendMessage",
  commandId,
  fromId: cooper,
  toId,
  factIds,
});
const kinds = (r: Result) => (r.kind === "Ok" || r.kind === "Interrupted" ? r.events.map((e) => e.kind) : r.kind);

describe("W2: a fact seen through Cooper stays with Cooper (INV-08)", () => {
  it("observation teaches the actor and the player, not Romilly", () => {
    const out = apply(start(), scan, h);
    expect(kinds(out.result)).toEqual(["ClockAdvanced", "ActivityCompleted", "FactLearned"]);
    expect(out.state.knowledge[cooper]).toEqual([beaconAge]);
    expect(out.state.playerSeen).toEqual([beaconAge]);
    expect(out.state.knowledge[romilly]).toBeUndefined();
    expect(playerOnlyFacts(out.state, romilly)).toEqual([beaconAge]);
    expect(playerOnlyFacts(out.state, cooper)).toEqual([]);
  });
});

describe("player visibility follows observation, not knowledge", () => {
  it("records a fact the controlled character already knew when they observe it again", () => {
    const base = start();
    // Cooper learned the fact while uncontrolled (e.g. a decision effect): the player has not seen it.
    const s: GameState = { ...base, controlled: brand, knowledge: { [cooper]: [beaconAge] } };
    const switched = apply(s, { kind: "SwitchCharacter", commandId: "s1", targetId: cooper }, h).state;
    expect(switched.playerSeen).toEqual([]);
    const out = apply(switched, scan, h);
    expect(out.state.playerSeen).toEqual([beaconAge]);
    expect(out.state.knowledge[cooper]).toEqual([beaconAge]);
    expect(kinds(out.result)).toEqual(["ClockAdvanced", "ActivityCompleted"]);
  });
});

describe("messages over a link arrive at T_send + latency, never earlier (INV-09)", () => {
  const sent = () => apply(apply(start(), scan, h).state, send("m1"), h);

  it("sending commits only MessageSent", () => {
    const out = sent();
    expect(kinds(out.result)).toEqual(["MessageSent"]);
    expect(out.state.messages).toEqual([
      { id: "msg.m1", from: cooper, to: romilly, factIds: [beaconAge], sentT: 10, deliverT: 70, delivered: false },
    ]);
    expect(out.state.knowledge[romilly]).toBeUndefined();
  });

  it("is not delivered one second early", () => {
    const early = apply(sent().state, wait("w1", 59), h);
    expect(kinds(early.result)).toEqual(["ClockAdvanced"]);
    expect(early.state.knowledge[romilly]).toBeUndefined();
  });

  it("is delivered at deliverT inside a longer advance, with Romilly's clock at that moment", () => {
    const out = apply(sent().state, wait("w1", 100), h);
    const r = out.result;
    if (r.kind !== "Ok") throw new Error(r.kind);
    expect(r.events.map((e) => [e.kind, e.T])).toEqual([
      ["ClockAdvanced", 70],
      ["MessageDelivered", 70],
      ["FactLearned", 70],
      ["ClockAdvanced", 110],
    ]);
    expect(out.state.knowledge[romilly]).toEqual([beaconAge]);
    expect(out.state.messages[0]!.delivered).toBe(true);
    // Delivery happened when Romilly had lived 70 s (rate 1 aboard Endurance).
    expect(r.events[2]!.T * TABLES.rates[LOCATIONS.endurance]!).toBe(70);
    // Delivered once: a later advance delivers nothing again.
    expect(kinds(apply(out.state, wait("w2", 100), h).result)).toEqual(["ClockAdvanced"]);
  });

  it("delivers before a decision that triggers at the same moment", () => {
    const tables: TimeTables = {
      ...TABLES,
      decisions: {
        [dWait]: { id: dWait, owner: romilly, triggerT: 70, deadlineT: null, checkpoint: false, options: { ok: [] } },
      },
    };
    const hh = createHandlers(tables);
    const s = apply(apply(start(), scan, hh).state, send("m1"), hh).state;
    expect(kinds(apply(s, wait("w1", 100), hh).result)).toEqual([
      "ClockAdvanced",
      "MessageDelivered",
      "FactLearned",
      "DecisionPending",
      "ClockAdvanced",
    ]);
  });
});

describe("same-place conversation and rejections", () => {
  const knowing = () => apply(start(), scan, h).state;

  it("a conversation on the surface delivers at once", () => {
    const out = apply(knowing(), send("m1", brand), h);
    expect(kinds(out.result)).toEqual(["MessageSent", "MessageDelivered", "FactLearned"]);
    expect(out.state.knowledge[brand]).toEqual([beaconAge]);
  });

  it.each<[string, (s: GameState) => GameState, Command, string]>([
    ["a fact the sender does not know", (s) => s, send("x1", romilly, [secret]), "INVALID"],
    ["a fact outside the registry", (s) => s, send("x2", romilly, [asId("fact", "fact.made_up")]), "INVALID"],
    ["no facts", (s) => s, send("x3", romilly, []), "INVALID"],
    ["a message to oneself", (s) => s, send("x4", cooper), "INVALID"],
    ["a sender who is not controlled", (s) => ({ ...s, controlled: brand }), send("x5"), "NOT_CONTROLLED"],
    [
      "a dead receiver",
      (s) => ({ ...s, characters: { ...s.characters, [romilly]: { ...s.characters[romilly]!, unavailable: "DEAD" } } }),
      send("x6"),
      "CHARACTER_UNAVAILABLE",
    ],
  ])("rejects %s", (_name, prep, command, code) => {
    const s = prep(knowing());
    const out = apply(s, command, h);
    expect(out.result).toMatchObject({ kind: "Rejected", code });
    expect(out.state).toBe(s);
  });

  it("rejects when the link is down or missing", () => {
    const down = createHandlers({ ...TABLES, links: [{ ...TABLES.links![0]!, up: false }] });
    const none = createHandlers({ ...TABLES, links: [] });
    const s = knowing();
    expect(apply(s, send("x7"), down).result).toMatchObject({ kind: "Rejected", code: "INVALID" });
    expect(apply(s, send("x8"), none).result).toMatchObject({ kind: "Rejected", code: "INVALID" });
  });

  it("a receiver who dies before delivery learns nothing, and the message still closes", () => {
    let s = apply(knowing(), send("m1"), h).state;
    s = { ...s, characters: { ...s.characters, [romilly]: { ...s.characters[romilly]!, unavailable: "DEAD" } } };
    const out = apply(s, wait("w1", 100), h);
    expect(kinds(out.result)).toEqual(["ClockAdvanced", "MessageDelivered", "ClockAdvanced"]);
    expect(out.state.knowledge[romilly]).toBeUndefined();
    expect(out.state.messages[0]!.delivered).toBe(true);
  });
});
