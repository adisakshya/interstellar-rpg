// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountOutcome, type OutcomeModel } from "../../src/ui";

const model: OutcomeModel = {
  title: "Episode complete",
  reference: "13.3 y",
  referenceSpoken: "13.3 years",
  rows: [
    { name: "Cooper", lived: "1 h 55 m", livedSpoken: "1 hour 55 minutes", status: "Alive" },
    { name: "Doyle", lived: "20 m", livedSpoken: "20 minutes", status: "Dead: wave" },
  ],
  resources: ["Endurance supplies: 16.7 left"],
  known: ["The flight recorder shows Miller died on landing. (known by Cooper)"],
  notes: ["You stayed for the recorder."],
};
afterEach(() => document.body.replaceChildren());

describe("outcome dialog", () => {
  it("shows who experienced how much time as a labelled table, why, and what is known", () => {
    const root = document.createElement("div");
    document.body.append(root);
    mountOutcome(root, model, [{ label: "Start a new game", run: () => undefined }]);
    const dialog = root.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("irpg-outcome-h");
    expect(root.querySelector("h1")!.textContent).toBe("Episode complete");
    const cells = [...root.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent));
    expect(cells).toEqual([
      ["Who", "Time lived", "State"],
      ["Cooper", "1 h 55 m", "Alive"],
      ["Doyle", "20 m", "Dead: wave"],
    ]);
    expect(root.querySelector("tr:nth-child(2) td")!.getAttribute("aria-label")).toBe("1 hour 55 minutes");
    expect(dialog.textContent).toContain("You stayed for the recorder.");
    expect(dialog.textContent).toContain("known by Cooper");
    expect(dialog.textContent).toContain("Endurance supplies: 16.7 left");
  });

  it("moves focus to the title, runs actions, and makes the page behind inert until it closes", () => {
    const root = document.createElement("div");
    const behind = document.createElement("div");
    const already = document.createElement("div");
    already.setAttribute("inert", "");
    document.body.append(behind, already, root);
    const run = vi.fn();
    const view = mountOutcome(
      root,
      model,
      [
        { label: "Go back", run },
        { label: "New", run: () => undefined },
      ],
      [behind, already],
    );
    const [first] = root.querySelectorAll("button");
    expect(document.activeElement).toBe(root.querySelector("h1"));
    first!.click();
    expect(run).toHaveBeenCalledTimes(1);
    expect(behind.hasAttribute("inert")).toBe(true);
    view.dispose();
    expect(behind.hasAttribute("inert")).toBe(false);
    expect(already.hasAttribute("inert")).toBe(true); // it was inert before; we leave it as we found it
    expect(root.querySelector(".irpg-outcome")).toBeNull();
    expect(root.querySelector("style")).toBeNull();
  });

  it("leaves out sections that have nothing to say", () => {
    const root = document.createElement("div");
    document.body.append(root);
    mountOutcome(root, { ...model, notes: [], known: [], resources: [] }, []);
    const headings = [...root.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toEqual(["Who experienced how much time"]);
  });
});
