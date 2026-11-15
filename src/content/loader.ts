import type {
  ActivityDef,
  CharacterId,
  DecisionDef,
  DecisionId,
  FactId,
  HazardDef,
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
  /** What Interact offers at each place, in priority order (SLICE-001). */
  readonly interactions: EpisodeFile["interactions"];
  readonly ending: EpisodeFile["ending"];
  readonly outcomeNotes: EpisodeFile["outcomeNotes"];
  /** Subtitle text, each entry shown once when its condition first holds (STORY-001). */
  readonly story: EpisodeFile["story"];
  /** Fact id → player-facing text, for the outcome screen. */
  readonly facts: Readonly<Record<string, string>>;
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
  const acts = ids(ep.activities, "activities", "activity");
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
    // Only a controlled owner can resolve a decision, so an NPC owner would leave it (and a hard deadline) stuck.
    const owner = ep.characters.find((c) => c.id === d.owner);
    if (owner && !owner.playable) err(at("owner"), `"${d.owner}" is not playable, so it cannot own a decision`);
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
  ids(ep.interactions, "interactions", "interaction");
  ep.interactions.forEach((x, i) => {
    const at = (...rest: PropertyKey[]) => ["interactions", i, ...rest];
    ref(locs, "location", x.location, at("location"));
    ref(acts, "activity", x.activityId, at("activityId"));
    x.requires?.forEach((f, j) => ref(facts, "fact", f, at("requires", j)));
    x.unless?.forEach((f, j) => ref(facts, "fact", f, at("unless", j)));
    x.after?.forEach((d, j) => ref(decs, "decision", d, at("after", j)));
    x.before?.forEach((d, j) => ref(decs, "decision", d, at("before", j)));
  });
  ids(ep.hazards, "hazards", "hazard");
  ep.hazards.forEach((h, i) => {
    const at = (...rest: PropertyKey[]) => ["hazards", i, ...rest];
    ref(decs, "decision", h.atDeadlineOf, at("atDeadlineOf"));
    const d = ep.decisions.find((x) => x.id === h.atDeadlineOf);
    if (d) {
      if (d.deadlineT === null)
        err(at("atDeadlineOf"), `"${d.id}" has no fixed deadline, so a hazard cannot be placed on it`);
      if (!Object.hasOwn(d.options, h.whenOption))
        err(at("whenOption"), `decision "${d.id}" has no option "${h.whenOption}"`);
    }
    h.effects.forEach((e, j) => ref(chars, "character", e.characterId, at("effects", j, "characterId")));
  });
  ids(ep.story, "story", "story entry");
  ep.story.forEach((x, i) => {
    const at = (...rest: PropertyKey[]) => ["story", i, ...rest];
    if (x.when.controlled !== undefined) ref(chars, "character", x.when.controlled, at("when", "controlled"));
    x.when.knows?.forEach((k, j) => {
      ref(chars, "character", k.by, at("when", "knows", j, "by"));
      ref(facts, "fact", k.fact, at("when", "knows", j, "fact"));
    });
    x.when.dead?.forEach((c, j) => ref(chars, "character", c, at("when", "dead", j)));
    x.when.decision?.forEach((d, j) => {
      ref(decs, "decision", d.id, at("when", "decision", j, "id"));
      const def = ep.decisions.find((y) => y.id === d.id);
      if (d.option !== undefined && def && !Object.hasOwn(def.options, d.option))
        err(at("when", "decision", j, "option"), `decision "${d.id}" has no option "${d.option}"`);
      if (d.option !== undefined && d.status === "pending")
        err(at("when", "decision", j, "option"), "an option only exists once the decision is resolved");
    });
    x.lines.forEach((l, j) => {
      if (l.speaker.startsWith("char.")) ref(chars, "character", l.speaker, at("lines", j, "speaker"));
      for (const m of l.text.matchAll(/\{tau:([^}]*)\}/g)) ref(chars, "character", m[1] ?? "", at("lines", j, "text"));
    });
  });
  ref(facts, "fact", ep.ending.fact, ["ending", "fact"]);
  ref(chars, "character", ep.ending.knownBy, ["ending", "knownBy"]);
  ep.outcomeNotes.forEach((n, i) => {
    ref(decs, "decision", n.decision, ["outcomeNotes", i, "decision"]);
    const d = ep.decisions.find((x) => x.id === n.decision);
    if (d && !Object.hasOwn(d.options, n.option)) {
      err(["outcomeNotes", i, "option"], `decision "${n.decision}" has no option "${n.option}"`);
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
  ep.hazards.forEach((h) =>
    h.effects.forEach((e) => {
      if (e.reason === null) wakes.add(e.characterId);
    }),
  );
  // Hazard effects obey the same availability rules as choices: NPCs cannot be made switchable, and an
  // incapacitation needs a wake fallback.
  ep.hazards.forEach((h, i) =>
    h.effects.forEach((e, j) => {
      const path = ["hazards", i, "effects", j, "reason"];
      if (!npcs.has(e.characterId) && chars.has(e.characterId)) {
        err(
          ["hazards", i, "effects", j, "characterId"],
          `"${e.characterId}" is playable: a hazard may only act on non-playable characters, because it lands in the middle of someone's action (use a decision's effects for a playable character)`,
        );
      }
      if (e.reason === null && npcs.has(e.characterId)) {
        err(path, `"${e.characterId}" is not playable and cannot be made available`);
      }
      if (e.reason !== null && INCAPACITATED.has(e.reason) && !wakes.has(e.characterId)) {
        err(path, `${e.reason} for "${e.characterId}" has no wake fallback (no effect makes them available again)`);
      }
    }),
  );
  // Some path must remain after a death, hazards included: a choice plus its hazards must not kill every playable.
  ep.hazards.forEach((h, i) => {
    const decision = ep.decisions.find((d) => d.id === h.atDeadlineOf);
    const dead = new Set<string>([
      ...h.effects.flatMap((e) => (e.reason === "DEAD" ? [e.characterId] : [])),
      ...(decision?.options[h.whenOption] ?? []).flatMap((e) =>
        e.kind === "SetAvailability" && e.reason === "DEAD" ? [e.characterId] : [],
      ),
    ]);
    const everyone = ep.characters.filter((c) => c.playable).map((c) => c.id);
    if (everyone.length > 0 && everyone.every((c) => dead.has(c))) {
      err(["hazards", i], "with its choice, kills every playable character, so no path would remain");
    }
  });
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
  // A choice's own time cost is paid by the decision's owner, the only character who can be controlled to resolve it.
  ep.decisions.forEach((d, i) =>
    Object.entries(d.options).forEach(([name, effects]) =>
      effects.forEach((e, j) => {
        if (e.kind === "SpendTime" && e.characterId !== d.owner) {
          err(
            ["decisions", i, "options", name, j, "characterId"],
            `"${e.characterId}" is not the decision owner "${d.owner}"`,
          );
        }
      }),
    ),
  );
  // INV-11: a playable character's supplies must not be able to run out unattended. Some hard decision of theirs has
  // to be tied to that resource, so the player is warned and given a choice first.
  ep.resources.forEach((r, i) => {
    if (!("character" in r.owner) || r.rate <= 0) return;
    const owner = r.owner.character;
    if (!ep.characters.some((c) => c.id === owner && c.playable)) return;
    const guarded = ep.decisions.some((d) => d.owner === owner && d.deadlineWhen?.resourceId === r.id);
    if (!guarded) {
      err(["resources", i], `"${r.id}" can run out for playable "${owner}" with no hard decision tied to it (INV-11)`);
    }
  });
  // Some path must remain after a death: no single choice may kill every playable character.
  const playable = ep.characters.filter((c) => c.playable).map((c) => c.id);
  ep.decisions.forEach((d, i) =>
    Object.entries(d.options).forEach(([name, effects]) => {
      const dead = new Set(
        effects.flatMap((e) => (e.kind === "SetAvailability" && e.reason === "DEAD" ? [e.characterId] : [])),
      );
      if (playable.length > 0 && playable.every((c) => dead.has(c))) {
        err(["decisions", i, "options", name], "kills every playable character, so no path would remain");
      }
    }),
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
    hazards: ep.hazards as unknown as HazardDef[],
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
    episode: {
      contentVersion: ep.contentVersion,
      episode: ep.episode,
      tables,
      initial,
      names,
      beats: ep.beats,
      interactions: ep.interactions,
      ending: ep.ending,
      outcomeNotes: ep.outcomeNotes,
      story: ep.story,
      facts: Object.fromEntries(ep.facts.map((f) => [f.id, f.text])),
    },
  };
}
