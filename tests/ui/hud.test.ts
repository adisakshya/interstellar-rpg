// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountHud, type Hud, type HudHandlers, type HudModel } from "../../src/ui";

const row = (over: Partial<HudModel["characters"][number]>): HudModel["characters"][number] => ({
  id: "char.cooper" as never,
  name: "Cooper",
  slot: 1,
  controlled: false,
  switchable: true,
  reason: null,
  reasonText: "",
  lived: "3 h",
  livedSpoken: "3 hours",
  ...over,
});
const model = (over: Partial<HudModel> = {}): HudModel => ({
  characters: [
    row({ controlled: true }),
    row({ id: "char.romilly" as never, name: "Romilly", slot: 2, lived: "21.0 y", livedSpoken: "21.0 years" }),
  ],
  controlledName: "Cooper",
  reference: "21.0 y",
  referenceSpoken: "21.0 years",
  prompts: [],
  waiting: [],
  ...over,
});
const prompt = (over: Partial<HudModel["prompts"][number]> = {}): HudModel["prompts"][number] => ({
  id: "decision.hibernate" as never,
  title: "Hibernate",
  options: [
    { id: "hibernate", label: "Hibernate" },
    { id: "stay_awake", label: "Stay awake" },
  ],
  hard: true,
  deadline: "5.0 y",
  deadlineSpoken: "5.0 years",
  ...over,
});

let hud: Hud | null = null;
afterEach(() => {
  hud?.dispose();
  hud = null;
  document.body.replaceChildren();
});
function setup() {
  const root = document.createElement("div");
  document.body.append(root);
  const handlers = { onSwitch: vi.fn(), onResolve: vi.fn() } satisfies HudHandlers;
  hud = mountHud(root, handlers);
  return { root, handlers };
}
const buttons = (root: HTMLElement) => [...root.querySelectorAll<HTMLButtonElement>("nav button")];
const live = (root: HTMLElement) => root.querySelector('[role="status"]')!.textContent!.trim();

describe("the switcher", () => {
  it("lists characters as buttons, marks the controlled one in text and aria-current, and shows slots", () => {
    const { root } = setup();
    hud!.update(model());
    const [cooper, romilly] = buttons(root);
    expect(cooper!.textContent).toContain("(you)");
    expect(cooper!.getAttribute("aria-current")).toBe("true");
    expect(romilly!.hasAttribute("aria-current")).toBe(false);
    expect(romilly!.textContent).toContain("21.0 y lived");
    expect(romilly!.getAttribute("aria-keyshortcuts")).toBe("2");
    expect(root.querySelector("nav")!.getAttribute("aria-labelledby")).toBe("irpg-who-h");
  });

  it("says why a character is unavailable in visible text and in the accessible name, not colour alone", () => {
    const { root } = setup();
    hud!.update(
      model({
        characters: [
          row({ controlled: true }),
          row({
            id: "char.romilly" as never,
            name: "Romilly",
            slot: 2,
            switchable: false,
            reason: "HIBERNATING",
            reasonText: "Hibernating",
          }),
        ],
      }),
    );
    const romilly = buttons(root)[1]!;
    expect(romilly.getAttribute("aria-disabled")).toBe("true");
    expect(romilly.textContent).toContain("Hibernating");
    expect(romilly.getAttribute("aria-label")).toContain("unavailable: Hibernating");
    expect(romilly.getAttribute("aria-label")).toContain("3 hours lived");
  });

  it("switches on click, ignores unavailable and current characters, and explains a refusal aloud", () => {
    const { root, handlers } = setup();
    hud!.update(
      model({
        characters: [
          row({ controlled: true }),
          row({ id: "char.romilly" as never, name: "Romilly", slot: 2 }),
          row({
            id: "char.brand" as never,
            name: "Brand",
            slot: 3,
            switchable: false,
            reason: "INJURED",
            reasonText: "Injured",
          }),
        ],
      }),
    );
    const [cooper, romilly, brand] = buttons(root);
    cooper!.click();
    expect(handlers.onSwitch).not.toHaveBeenCalled();
    brand!.click();
    expect(handlers.onSwitch).not.toHaveBeenCalled();
    expect(live(root)).toBe("Brand is unavailable: Injured");
    romilly!.click();
    expect(handlers.onSwitch).toHaveBeenCalledWith("char.romilly");
  });

  it("updates in place, so keyboard focus survives a state change", () => {
    const { root } = setup();
    hud!.update(model());
    const romilly = buttons(root)[1]!;
    romilly.focus();
    hud!.update(
      model({
        characters: [
          row({ lived: "4 h" }),
          row({ id: "char.romilly" as never, name: "Romilly", slot: 2, controlled: true, lived: "22.0 y" }),
        ],
        controlledName: "Romilly",
      }),
    );
    expect(buttons(root)[1]).toBe(romilly);
    expect(document.activeElement).toBe(romilly);
    expect(romilly.getAttribute("aria-current")).toBe("true");
    expect(romilly.textContent).toContain("22.0 y lived");
  });

  it("announces a change of controlled character once, not on every update", () => {
    const { root } = setup();
    hud!.update(model());
    expect(live(root)).toBe("");
    hud!.update(model({ controlledName: "Romilly" }));
    expect(live(root)).toBe("Now controlling Romilly");
  });

  it("shows overall time with a spoken form", () => {
    const { root } = setup();
    hud!.update(model());
    expect(root.querySelector(".irpg-clock")!.textContent).toBe("Cooper · 21.0 y passed overall");
    expect(root.querySelector(".irpg-sr")!.textContent).toBe("Reference time 21.0 years");
  });
});

describe("decision prompts", () => {
  it("shows options as buttons, moves focus to the first, and announces it", () => {
    const { root, handlers } = setup();
    hud!.update(model({ prompts: [prompt()] }));
    const box = root.querySelector(".irpg-prompt")!;
    const options = [...box.querySelectorAll("button")];
    expect(options.map((b) => b.textContent)).toEqual(["Hibernate", "Stay awake"]);
    expect(document.activeElement).toBe(options[0]);
    expect(box.textContent).toContain("Deadline in 5.0 y");
    expect(live(root)).toContain("Decision for Cooper: Hibernate. Deadline in 5.0 years.");
    options[1]!.click();
    expect(handlers.onResolve).toHaveBeenCalledWith("decision.hibernate", "stay_awake");
  });

  it("does not rebuild an open prompt on later updates, and removes it when resolved", () => {
    const { root } = setup();
    hud!.update(model({ prompts: [prompt()] }));
    const box = root.querySelector(".irpg-prompt")!;
    hud!.update(model({ prompts: [prompt({ deadline: "4.0 y" })] }));
    expect(root.querySelector(".irpg-prompt")).toBe(box);
    hud!.update(model());
    expect(root.querySelector(".irpg-prompt")).toBeNull();
  });

  it("repaints the countdown on an open prompt in place, keeping focus and not re-announcing", () => {
    const { root } = setup();
    hud!.update(model({ prompts: [prompt()] }));
    const box = root.querySelector(".irpg-prompt")!;
    const second = box.querySelectorAll("button")[1]!;
    second.focus();
    const announced = live(root);
    hud!.update(model({ prompts: [prompt({ deadline: "4.0 y", deadlineSpoken: "4.0 years" })] }));
    expect(box.textContent).toContain("Deadline in 4.0 y");
    expect(box.textContent).not.toContain("5.0 y");
    expect(document.activeElement).toBe(second);
    expect(live(root)).toBe(announced);
    hud!.update(model({ prompts: [prompt({ deadline: null, deadlineSpoken: null })] }));
    expect(box.textContent).not.toContain("Deadline");
  });

  it("tells the player who the game is waiting on, and announces it once", () => {
    const { root } = setup();
    const waiting = [
      { id: "decision.hibernate" as never, ownerName: "Romilly", text: "Hibernate: waiting on Romilly" },
    ];
    hud!.update(model({ waiting }));
    const note = root.querySelector('section[aria-label="Waiting on others"]') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toContain("Hibernate: waiting on Romilly");
    expect(live(root)).toBe("Hibernate: waiting on Romilly. Switch to decide.");
    hud!.update(model({ waiting }));
    hud!.update(model());
    expect(note.hidden).toBe(true);
  });
});

describe("layout rules", () => {
  it("sizes every control at 44 px or more (2.75rem), keeps focus visible, and scales with text", () => {
    const { root } = setup();
    const css = root.querySelector("style")!.textContent!;
    expect(css).toContain("min-height:2.75rem");
    expect(css).toContain(":focus-visible{outline:3px");
    expect(css).not.toMatch(/font-size:\s*\d+px/); // text sizes use rem, so browser zoom scales them
  });

  it("cleans up on dispose", () => {
    const { root } = setup();
    hud!.update(model());
    hud!.dispose();
    expect(root.querySelector(".irpg-hud")).toBeNull();
    expect(root.querySelector("style")).toBeNull();
  });
});
