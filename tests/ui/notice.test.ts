// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountNotice } from "../../src/ui";

afterEach(() => document.body.replaceChildren());

describe("notice", () => {
  it("announces its message, runs an action, and dismisses cleanly", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const run = vi.fn();
    mountNotice(root, "Your saved game could not be opened.", [{ label: "Save a copy", run }]);
    const box = root.querySelector('[role="alert"]')!;
    expect(box.textContent).toContain("could not be opened");
    const [copy, dismiss] = [...box.querySelectorAll("button")];
    copy!.click();
    expect(run).toHaveBeenCalledTimes(1);
    dismiss!.click();
    expect(root.querySelector(".irpg-notice")).toBeNull();
    expect(root.querySelector("style")).toBeNull();
  });
});
