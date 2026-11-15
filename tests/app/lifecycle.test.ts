import { describe, expect, it, vi } from "vitest";
import { attachLifecycle } from "../../src/app/lifecycle";

function setup(rebuild: () => Promise<void> | void = () => undefined) {
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const canvas = new EventTarget();
  const paused: boolean[] = [];
  const autosave = vi.fn();
  const rebuildScene = vi.fn(rebuild);
  const onError = vi.fn();
  const detach = attachLifecycle({
    document: doc,
    canvas,
    setPaused: (p) => paused.push(p),
    autosave,
    rebuildScene,
    onError,
  });
  const hide = (state: "hidden" | "visible") => {
    doc.visibilityState = state;
    doc.dispatchEvent(new Event("visibilitychange"));
  };
  return { doc, canvas, paused, autosave, rebuildScene, onError, detach, hide };
}

describe("tab visibility (TIMELINES §5, INV-13)", () => {
  it("pauses and autosaves when hidden, resumes when visible, and does not save on return", () => {
    const t = setup();
    expect(t.paused.at(-1)).toBe(false);
    t.hide("hidden");
    expect(t.paused.at(-1)).toBe(true);
    expect(t.autosave).toHaveBeenCalledTimes(1);
    t.hide("visible");
    expect(t.paused.at(-1)).toBe(false);
    expect(t.autosave).toHaveBeenCalledTimes(1);
  });

  it("a failing autosave never throws into the page and is reported", async () => {
    const t = setup();
    t.autosave.mockRejectedValueOnce(new Error("quota"));
    t.hide("hidden");
    await Promise.resolve();
    await Promise.resolve();
    expect(t.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "quota" }));
    expect(t.paused.at(-1)).toBe(true);
  });

  it("stops listening after detach", () => {
    const t = setup();
    t.detach();
    t.hide("hidden");
    expect(t.autosave).not.toHaveBeenCalled();
  });
});

describe("WebGL context loss", () => {
  it("allows restoration, pauses, rebuilds the scene, then resumes", async () => {
    let finish: () => void = () => undefined;
    const t = setup(() => new Promise<void>((resolve) => (finish = resolve)));
    const lost = new Event("webglcontextlost", { cancelable: true });
    t.canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(t.paused.at(-1)).toBe(true);
    t.canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(t.rebuildScene).toHaveBeenCalledTimes(1);
    expect(t.paused.at(-1)).toBe(true); // still paused until the scene is back
    finish();
    await new Promise((r) => setTimeout(r));
    expect(t.paused.at(-1)).toBe(false);
  });

  it("resumes even if the rebuild fails, and reports it", async () => {
    const t = setup(() => Promise.reject(new Error("no gl")));
    t.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    t.canvas.dispatchEvent(new Event("webglcontextrestored"));
    await new Promise((r) => setTimeout(r));
    expect(t.onError).toHaveBeenCalled();
    expect(t.paused.at(-1)).toBe(false);
  });

  it("stays paused while hidden even after the context returns", async () => {
    const t = setup();
    t.hide("hidden");
    t.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    t.canvas.dispatchEvent(new Event("webglcontextrestored"));
    await new Promise((r) => setTimeout(r));
    expect(t.paused.at(-1)).toBe(true);
  });
});
