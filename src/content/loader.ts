import type {
  ActivityDef,
  CharacterId,
  DecisionDef,
  DecisionId,
  FactId,
  InitialSpec,
  LinkDef,
  LocationId,
  RateTable,
  ResourceDef,
  TimeTables,
} from "../domain";
import { FIXTURE_RATES } from "./rates";
import { episodeSchema, type EpisodeFile } from "./schema";

export interface LoadedEpisode {
  readonly contentVersion: string;
  readonly episode: string;
  /** Everything the domain handlers read (rules.ts). */
  readonly tables: TimeTables;
  /** Pass to `createInitialState` for a new game. */
  readonly initial: InitialSpec;
  readonly names: Readonly<Record<string, string>>;
  readonly beats: EpisodeFile["beats"];
}

export type LoadResult =
  { readonly ok: true; readonly episode: LoadedEpisode } | { readonly ok: false; readonly errors: readonly string[] };

/** `["beats", 3, "requires", 0]` → `beats[3].requires[0]` (ARCHITECTURE §5 error format). */
export function formatPath(path: readonly PropertyKey[]): string {
  return path.map((p, i) => (typeof p === "number" ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`)).join("");
}

/**
 * Validate an episode and build the domain tables. Fails loudly with every problem, each with a path such as
 * `beats[3].requires[0]: unknown character "char.brand"`, instead of loading partly valid content.
 */
export function loadEpisode(json: unknown): LoadResult {
  const parsed = episodeSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${formatPath(i.path)}: ${i.message}`) };
  }
  const ep = parsed.data;
  const errors: string[] = [];
  const err = (path: PropertyKey[], message: string) => errors.push(`${formatPath(path)}: ${message}`);

  const ids = <T extends { id: string }>(list: readonly T[], key: string, kind: string): Set<string> => {
    const seen = new Set<string>();
    list.forEach((x, i) => {
      if (seen.has(x.id)) err([key, i, "id"], `duplicate ${kind} "${x.id}"`);
      seen.add(x.id);
    });
    return seen;
  };
  const chars = ids(ep.characters, "characters", "character");
  const locs = ids(ep.locations, "locations", "location");
  const facts = ids(ep.facts, "facts", "fact");
  ids(ep.activities, "activities", "activity");
  const res = ids(ep.resources, "resources", "resource");
  const decs = ids(ep.decisions, "decisions", "decision");
  ids(ep.beats, "beats", "beat");

  const ref = (set: Set<string>, kind: string, value: string, path: PropertyKey[]) => {
    if (!set.has(value)) err(path, `unknown ${kind} "${value}"`);
  };
  const rated = new Set(ep.locations.filter((l) => l.rate !== null).map((l) => l.id));

  ep.locations.forEach((l, i) => {
    if (l.rate !== null && !Object.hasOwn(FIXTURE_RATES, l.rate)) {
      err(
        ["locations", i, "rate"],
        `unknown physics rate "${l.rate}" (fixtures: ${Object.keys(FIXTURE_RATES).join(", ")})`,
      );
    }
  });
  ep.characters.forEach((c, i) => {
    ref(locs, "location", c.location, ["characters", i, "location"]);
    if (locs.has(c.location) && !rated.has(c.location)) {
      err(["characters", i, "location"], `"${c.location}" has no clock rate; characters cannot start there`);
    }
  });
  const controlled = ep.characters.find((c) => c.id === ep.controlled);
  if (!controlled) err(["controlled"], `unknown character "${ep.controlled}"`);
  else if (!controlled.playable || controlled.availability !== null) {
    err(["controlled"], `"${ep.controlled}" must be playable and available at the start`);
  }
  ep.activities.forEach((a, i) => a.learns?.forEach((f, j) => ref(facts, "fact", f, ["activities", i, "learns", j])));
  ep.links.forEach((l, i) => {
    ref(locs, "location", l.a, ["links", i, "a"]);
    ref(locs, "location", l.b, ["links", i, "b"]);
  });
  ep.resources.forEach((r, i) => {
    if ("character" in r.owner) ref(chars, "character", r.owner.character, ["resources", i, "owner", "character"]);
    else ref(locs, "location", r.owner.location, ["resources", i, "owner", "location"]);
  });
  ep.decisions.forEach((d, i) => {
    const at = (...rest: PropertyKey[]) => ["decisions", i, ...rest];
    ref(chars, "character", d.owner, at("owner"));
    if (d.triggerT === undefined && d.triggerWhen === undefined) err(at(), "needs triggerT or triggerWhen");
    if (d.triggerT !== undefined && d.deadlineT !== null && d.deadlineT < d.triggerT) {
      err(at("deadlineT"), `deadline ${d.deadlineT} is before trigger ${d.triggerT}`);
    }
    if (d.triggerWhen) ref(res, "resource", d.triggerWhen.resourceId, at("triggerWhen", "resourceId"));
    if (d.deadlineWhen) ref(res, "resource", d.deadlineWhen.resourceId, at("deadlineWhen", "resourceId"));
    if (Object.keys(d.options).length === 0) err(at("options"), "a decision needs at least one option");
    for (const [name, effects] of Object.entries(d.options)) {
      effects.forEach((e, j) => {
        ref(chars, "character", e.characterId, at("options", name, j, "characterId"));
        if (e.kind === "LearnFact") ref(facts, "fact", e.factId, at("options", name, j, "factId"));
      });
    }
  });
  ep.beats.forEach((b, i) => {
    if (b.controlling !== null) ref(chars, "character", b.controlling, ["beats", i, "controlling"]);
    if (b.decision !== undefined) ref(decs, "decision", b.decision, ["beats", i, "decision"]);
    b.requires.forEach((c, j) => ref(chars, "character", c, ["beats", i, "requires", j]));
  });
  // Non-playable characters (NPCs in this episode) must never become switchable: they start unavailable and no
  // effect may clear their availability.
  const npcs = new Set(ep.characters.filter((c) => !c.playable).map((c) => c.id));
  ep.characters.forEach((c, i) => {
    if (!c.playable && c.availability === null) {
      err(
        ["characters", i, "availability"],
        `"${c.id}" is not playable, so it must start unavailable (e.g. NOT_INTRODUCED)`,
      );
    }
  });
  // TIMELINES §4: every incapacitation needs a wake fallback, i.e. some effect that makes that character available
  // again. Otherwise one choice can leave a playable character locked out for good.
  const INCAPACITATED = new Set(["HIBERNATING", "INJURED", "UNCONSCIOUS"]);
  const wakes = new Set<string>();
  ep.decisions.forEach((d) =>
    Object.values(d.options).forEach((effects) =>
      effects.forEach((e) => {
        if (e.kind === "SetAvailability" && e.reason === null) wakes.add(e.characterId);
      }),
    ),
  );
  ep.decisions.forEach((d, i) =>
    Object.entries(d.options).forEach(([name, effects]) =>
      effects.forEach((e, j) => {
        if (e.kind !== "SetAvailability") return;
        const path = ["decisions", i, "options", name, j, "reason"];
        if (e.reason === null && npcs.has(e.characterId)) {
          err(path, `"${e.characterId}" is not playable and cannot be made available`);
        }
        if (e.reason !== null && INCAPACITATED.has(e.reason) && !wakes.has(e.characterId)) {
          err(path, `${e.reason} for "${e.characterId}" has no wake fallback (no effect makes them available again)`);
        }
      }),
    ),
  );
  if (errors.length > 0) return { ok: false, errors };

  const rates: Record<LocationId, number> = {};
  for (const l of ep.locations) if (l.rate !== null) rates[l.id as LocationId] = FIXTURE_RATES[l.rate]!;
  const decisions: Record<DecisionId, DecisionDef> = {};
  for (const d of ep.decisions) {
    const def: Record<string, unknown> = { ...d };
    delete def["note"];
    decisions[d.id as DecisionId] = def as unknown as DecisionDef;
  }
  const tables: TimeTables = {
    rates: rates as RateTable,
    decisions,
    activities: Object.fromEntries(ep.activities.map(({ id, ...a }) => [id, a as unknown as ActivityDef])),
    links: ep.links as unknown as LinkDef[],
    facts: ep.facts.map((f) => f.id as FactId),
    resources: Object.fromEntries(
      ep.resources.map((r) => [
        r.id,
        {
          id: r.id,
          owner: r.owner,
          rate: r.rate,
          ...(r.rateWhen ? { rateWhen: r.rateWhen } : {}),
        } as unknown as ResourceDef,
      ]),
    ),
  };
  const initial: InitialSpec = {
    contentVersion: ep.contentVersion,
    controlled: ep.controlled as CharacterId,
    characters: ep.characters.map((c) => ({
      id: c.id as CharacterId,
      location: c.location as LocationId,
      unavailable: c.availability,
    })),
    resources: Object.fromEntries(ep.resources.map((r) => [r.id, r.initial])),
    seed: ep.seed,
  };
  const names = Object.fromEntries([...ep.characters, ...ep.locations].map((x) => [x.id, x.name]));
  return {
    ok: true,
    episode: { contentVersion: ep.contentVersion, episode: ep.episode, tables, initial, names, beats: ep.beats },
  };
}
