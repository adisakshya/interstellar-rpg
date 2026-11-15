import { describe, expect, it } from "vitest";
import { currentInteraction, type InteractionDef } from "../../src/app/interactions";
import { createInitialState, type GameState, type InitialSpec } from "../../src/domain";

const cooper = "char.cooper" as never;
const romilly = "char.romilly" as never;
const spec: InitialSpec = {
  contentVersion: "t",
  controlled: cooper,
  characters: [
    { id: cooper, location: "loc.miller_surface" as never, unavailable: null },
    { id: romilly, location: "loc.endurance" as never, unavailable: null },
  ],
  resources: {},
  seed: 1,
};
const base = (): GameState => createInitialState(spec);
const def = (over: Partial<InteractionDef>): InteractionDef => ({
  id: "act.x",
  location: "loc.miller_surface",
  label: "X",
  activityId: "x",
  dTau: 60,
  ...over,
});
const knows = (s: GameState, who: string, ...facts: string[]): GameState => ({
  ...s,
  knowledge: { ...s.knowledge, [who]: facts as never },
});

describe("which interaction is on offer (SLICE-001)", () => {
  it("matches the controlled character's place and takes the first whose conditions hold", () => {
    const defs = [
      def({ id: "act.a", requires: ["fact.f"] }),
      def({ id: "act.b" }),
      def({ id: "act.c", location: "loc.endurance" }),
    ];
    expect(currentInteraction(base(), defs)?.id).toBe("act.b");
    expect(currentInteraction(knows(base(), cooper, "fact.f"), defs)?.id).toBe("act.a");
    expect(currentInteraction({ ...base(), controlled: romilly }, defs)?.id).toBe("act.c");
  });

  it("checks what the controlled character knows, not what someone else knows (INV-08)", () => {
    const defs = [def({ requires: ["fact.f"] })];
    expect(currentInteraction(knows(base(), romilly, "fact.f"), defs)).toBeNull();
    expect(currentInteraction(knows(base(), cooper, "fact.f"), defs)).not.toBeNull();
    const hidden = [def({ unless: ["fact.f"] })];
    expect(currentInteraction(knows(base(), cooper, "fact.f"), hidden)).toBeNull();
    expect(currentInteraction(knows(base(), romilly, "fact.f"), hidden)).not.toBeNull();
  });

  it("`after` needs the decision resolved; `before` needs it not yet raised, so a pending prompt hides the action", () => {
    const d = "decision.d" as never;
    const after = [def({ after: ["decision.d"] })];
    const before = [def({ before: ["decision.d"] })];
    const pending: GameState = { ...base(), decisions: { [d]: { status: "pending", optionId: null } } };
    const resolved: GameState = { ...base(), decisions: { [d]: { status: "resolved", optionId: "o" } } };
    expect(currentInteraction(base(), before)).not.toBeNull();
    expect(currentInteraction(pending, before)).toBeNull();
    expect(currentInteraction(resolved, before)).toBeNull();
    expect(currentInteraction(base(), after)).toBeNull();
    expect(currentInteraction(pending, after)).toBeNull();
    expect(currentInteraction(resolved, after)).not.toBeNull();
  });

  it("offers nothing to a character who cannot act", () => {
    const s: GameState = {
      ...base(),
      characters: { ...base().characters, [cooper]: { ...base().characters[cooper]!, unavailable: "INJURED" } },
    };
    expect(currentInteraction(s, [def({})])).toBeNull();
  });
});
