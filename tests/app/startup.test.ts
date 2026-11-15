import { describe, expect, it } from "vitest";
import m1 from "../../src/content/episodes/m1.json";
import { loadEpisode } from "../../src/content";
import { createInitialState } from "../../src/domain";
import { MemoryBackend, SaveSlots, type SaveBackend } from "../../src/persistence";
import { loadStartup, startupNotice } from "../../src/app/startup";

const loaded = loadEpisode(m1);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const initial = createInitialState(loaded.episode.initial);
const slotsFor = (backend: SaveBackend = new MemoryBackend()) =>
  new SaveSlots(backend, { contentVersion: loaded.episode.contentVersion });

describe("loading at startup (ARCHITECTURE §6)", () => {
  it("starts fresh on an empty slot, and when told to skip", async () => {
    expect(await loadStartup(slotsFor(), false)).toEqual({ kind: "fresh", why: "empty" });
    const slots = slotsFor();
    await slots.writeAutosave(initial, [], "2026-01-01T00:00:00Z");
    expect(await loadStartup(slots, true)).toEqual({ kind: "fresh", why: "skipped" });
  });

  it("resumes a good save", async () => {
    const slots = slotsFor();
    await slots.writeAutosave(initial, [], "2026-01-01T00:00:00Z");
    const out = await loadStartup(slots, false);
    expect(out.kind).toBe("resumed");
  });

  it("reports an unreadable save, keeps the original in quarantine, and offers to export it", async () => {
    const backend = new MemoryBackend();
    await backend.put("autosave", "{ not a save");
    const slots = slotsFor(backend);
    const out = await loadStartup(slots, false);
    expect(out).toMatchObject({ kind: "unreadable", code: "PARSE" });
    const notice = startupNotice(out, true)!;
    expect(notice.message).toContain("could not be opened");
    expect(notice.exportKey).toBeDefined();
    expect(await slots.exportSlot(notice.exportKey!)).toBe("{ not a save");
    expect(notice.disableSaving).toBe(false);
  });

  it("tells a save from another episode version apart from damage", async () => {
    const other = slotsFor();
    await other.writeAutosave({ ...initial, contentVersion: "other" }, [], "2026-01-01T00:00:00Z");
    const backend = new MemoryBackend();
    await backend.put("autosave", (await other.exportSlot("autosave"))!);
    const out = await loadStartup(slotsFor(backend), false);
    expect(out).toMatchObject({ kind: "unreadable", code: "CONTENT_VERSION" });
    expect(startupNotice(out, true)!.message).toContain("different version of the episode");
  });

  it("does not treat a storage failure as an empty slot, and never lets this session overwrite what it could not read", async () => {
    const broken: SaveBackend = {
      get: () => Promise.reject(new Error("IDB closed")),
      put: () => Promise.reject(new Error("IDB closed")),
      delete: () => Promise.reject(new Error("IDB closed")),
      keys: () => Promise.resolve([]),
    };
    const out = await loadStartup(slotsFor(broken), false);
    expect(out.kind).toBe("storage-failed");
    expect(startupNotice(out, true)).toMatchObject({ disableSaving: true });
  });

  it("warns once when the browser keeps nothing, and says nothing when saving works", () => {
    expect(startupNotice({ kind: "fresh", why: "empty" }, false)!.message).toContain("not keeping saved games");
    expect(startupNotice({ kind: "fresh", why: "empty" }, true)).toBeNull();
    expect(startupNotice({ kind: "resumed", state: initial }, true)).toBeNull();
  });
});
