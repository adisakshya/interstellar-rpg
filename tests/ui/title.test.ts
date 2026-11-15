// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { FAN_NOTICE, mountTitle } from "../../src/ui";

const credits = [
  { path: "public/sky/a.webp", what: "A sky", source: "Generated", author: "Project", licence: "Project licence" },
];
afterEach(() => {
  document.body.innerHTML = "";
});
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>(".irpg-title button")];
const labelled = (text: string) => buttons().find((b) => b.textContent === text)!;

describe("title screen (FAN-001, D-21)", () => {
  it("shows the name and the not-affiliated notice before anything else", () => {
    mountTitle(document.body, { hasSave: false, credits, onContinue: vi.fn(), onNewGame: vi.fn() });
    const dialog = document.querySelector(".irpg-title")!;
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.textContent).toContain("Interstellar RPG");
    expect(dialog.textContent).toContain("unofficial, non-commercial fan project");
    expect(FAN_NOTICE).toContain("not affiliated");
  });

  it("offers New game alone when there is no save, and closes when it is chosen", () => {
    const onNewGame = vi.fn();
    mountTitle(document.body, { hasSave: false, credits, onContinue: vi.fn(), onNewGame });
    expect(buttons().map((b) => b.textContent)).toEqual(["New game", "Credits"]);
    labelled("New game").click();
    expect(onNewGame).toHaveBeenCalledOnce();
    expect(document.querySelector(".irpg-title")).toBeNull();
  });

  it("with a save, Continue resumes and New game asks once before replacing it", () => {
    const onContinue = vi.fn();
    const onNewGame = vi.fn();
    mountTitle(document.body, { hasSave: true, credits, onContinue, onNewGame });
    labelled("New game").click();
    expect(onNewGame).not.toHaveBeenCalled();
    labelled("Replace my saved game?").click();
    expect(onNewGame).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("Continue closes the screen and hands the game back", () => {
    const onContinue = vi.fn();
    mountTitle(document.body, { hasSave: true, credits, onContinue, onNewGame: vi.fn() });
    labelled("Continue").click();
    expect(onContinue).toHaveBeenCalledOnce();
    expect(document.querySelector(".irpg-title")).toBeNull();
  });

  it("lists the credits on request, with the notice repeated, and keeps the page behind inert while open", () => {
    const behind = document.createElement("div");
    document.body.append(behind);
    mountTitle(document.body, { hasSave: false, credits, onContinue: vi.fn(), onNewGame: vi.fn(), behind: [behind] });
    expect(behind.hasAttribute("inert")).toBe(true);
    expect(behind.style.visibility).toBe("hidden"); // the HUD cannot show through the title
    const section = document.querySelector<HTMLElement>(".irpg-credits")!;
    expect(section.hidden).toBe(true);
    labelled("Credits").click();
    expect(section.hidden).toBe(false);
    expect(section.textContent).toContain("public/sky/a.webp");
    expect(section.textContent).toContain("unofficial, non-commercial fan project");
    labelled("New game").click();
    expect(behind.hasAttribute("inert")).toBe(false);
    expect(behind.style.visibility).toBe("");
  });
});
