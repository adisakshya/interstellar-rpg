// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSubtitles, type StorySource } from "../../src/ui";

function fake() {
  const listeners = new Set<() => void>();
  let queue: string[] = [];
  let autoAdvance = true;
  const shown: string[] = [];
  const emit = () => listeners.forEach((l) => l());
  const api = {
    current: () => (queue[0] === undefined ? null : { name: "Brand", kind: "speech" as const, text: queue[0] }),
    log: () => shown.map((text) => ({ name: "Brand", kind: "speech", text })),
    pending: () => Math.max(0, queue.length - 1),
    next: vi.fn(() => {
      queue = queue.slice(1);
      emit();
    }),
    skipAll: vi.fn(() => {
      queue = [];
      emit();
    }),
    get autoAdvance() {
      return autoAdvance;
    },
    setPaused: vi.fn(),
    setAutoAdvance: vi.fn((v: boolean) => {
      autoAdvance = v;
    }),
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(lines: string[]) {
      queue = lines;
      shown.push(...lines);
      emit();
    },
  };
  return api satisfies StorySource & { set(lines: string[]): void };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("subtitle panel (STORY-001)", () => {
  it("is hidden with no line, shows speaker and text, and moves on with the button", () => {
    const story = fake();
    mountSubtitles(document.body, story);
    const panel = document.querySelector<HTMLElement>(".irpg-sub")!;
    expect(panel.hidden).toBe(true);
    story.set(["First.", "Second."]);
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain("Brand");
    expect(panel.textContent).toContain("First.");
    const buttons = [...panel.querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["Continue", "Skip all", "Log"]);
    buttons[0]!.click();
    expect(panel.textContent).toContain("Second.");
    expect(panel.querySelector("button")!.textContent).toBe("Close");
  });

  it("reads each line from a polite live region and keeps auto-advance switchable", () => {
    const story = fake();
    mountSubtitles(document.body, story);
    story.set(["Line."]);
    expect(document.querySelector(".irpg-sub-line")!.getAttribute("aria-live")).toBe("polite");
    const box = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event("change"));
    expect(story.setAutoAdvance).toHaveBeenCalledWith(false);
  });

  it("opens a log of everything said, and skip-all clears the queue", () => {
    const story = fake();
    mountSubtitles(document.body, story);
    story.set(["One.", "Two.", "Three."]);
    const [, skip, log] = [...document.querySelectorAll<HTMLButtonElement>(".irpg-sub-ctl button")];
    log!.click();
    expect(log!.getAttribute("aria-expanded")).toBe("true");
    expect([...document.querySelectorAll(".irpg-sub-log li")].map((li) => li.textContent)).toEqual([
      "Brand: One.",
      "Brand: Two.",
      "Brand: Three.",
    ]);
    skip!.click();
    expect(story.skipAll).toHaveBeenCalled();
    expect(document.querySelector<HTMLElement>(".irpg-sub-line")!.hidden).toBe(true); // only the log button remains
  });

  it("keeps a log button after the last line, so what was said can still be read between scenes", () => {
    const story = fake();
    mountSubtitles(document.body, story);
    story.set(["Only line."]);
    document.querySelector<HTMLButtonElement>(".irpg-sub-ctl button")!.click(); // Close
    const panel = document.querySelector<HTMLElement>(".irpg-sub")!;
    expect(panel.hidden).toBe(false);
    const buttons = [...panel.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.hidden);
    expect(buttons.map((b) => b.textContent)).toEqual(["Story log"]);
    buttons[0]!.click();
    expect([...document.querySelectorAll(".irpg-sub-log li")].map((li) => li.textContent)).toEqual([
      "Brand: Only line.",
    ]);
  });

  it("docks in the HUD slot on narrow screens and floats bottom centre on wide ones", () => {
    const story = fake();
    const slot = document.createElement("div");
    document.body.append(slot);
    let wide = false;
    mountSubtitles(document.body, story, { slot, wide: () => wide });
    story.set(["Hello."]);
    expect(slot.querySelector(".irpg-sub")).not.toBeNull();
    expect(slot.hidden).toBe(false);
    wide = true;
    story.set(["Again."]);
    expect(slot.querySelector(".irpg-sub")).toBeNull();
    expect(slot.hidden).toBe(true);
    expect(document.querySelector(".irpg-sub.irpg-floating")).not.toBeNull();
  });
});
