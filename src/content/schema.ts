import { z } from "zod";

// Episode file structure (CONT-001, ARCHITECTURE §5). Ids carry a kind prefix; references are checked in loader.ts.
const charId = z.string().startsWith("char.");
const locId = z.string().startsWith("loc.");
const factId = z.string().startsWith("fact.");
const decisionId = z.string().startsWith("decision.");
const resId = z.string().startsWith("res.");
const seconds = z.number().finite().nonnegative();
const reason = z.enum([
  "NOT_INTRODUCED",
  "HIBERNATING",
  "INJURED",
  "UNCONSCIOUS",
  "LOCKED_SEQUENCE",
  "DEAD",
  "CONTROLLED_BY_OTHER",
]);
const effect = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("SetAvailability"),
    characterId: charId,
    reason: reason.nullable(),
    cause: z.string().min(1).optional(),
  }),
  z.strictObject({ kind: z.literal("SpendTime"), characterId: charId, dTau: z.number().finite().positive() }),
  z.strictObject({ kind: z.literal("LearnFact"), characterId: charId, factId }),
]);
const level = z.strictObject({ resourceId: resId, atOrBelow: z.number().finite().nonnegative() });

export const episodeSchema = z.strictObject({
  contentVersion: z.string().min(1),
  episode: z.string().min(1),
  seed: z.number().int(),
  controlled: charId,
  characters: z.array(
    z.strictObject({
      id: charId,
      name: z.string().min(1),
      playable: z.boolean(),
      location: locId,
      availability: reason.nullable(),
    }),
  ),
  locations: z.array(
    z.strictObject({
      id: locId,
      name: z.string().min(1),
      /** Key into docs/physics/fixtures.json game rates, or null for a place reached only by transit routes. */
      rate: z.string().nullable(),
    }),
  ),
  facts: z.array(z.strictObject({ id: factId, text: z.string().min(1) })),
  activities: z.array(
    z.strictObject({
      id: z.string().min(1),
      atomic: z.boolean(),
      piloting: z.boolean().optional(),
      assist: z.boolean().optional(),
      learns: z.array(factId).optional(),
    }),
  ),
  links: z.array(z.strictObject({ a: locId, b: locId, latency: seconds, up: z.boolean() })),
  resources: z.array(
    z.strictObject({
      id: resId,
      owner: z.union([z.strictObject({ character: charId }), z.strictObject({ location: locId })]),
      rate: z.number().finite().nonnegative(),
      rateWhen: z.partialRecord(reason, z.number().finite().nonnegative()).optional(),
      initial: z.number().finite().nonnegative(),
    }),
  ),
  decisions: z.array(
    z.strictObject({
      id: decisionId,
      owner: charId,
      triggerT: seconds.optional(),
      triggerWhen: level.optional(),
      deadlineT: seconds.nullable(),
      deadlineWhen: level.optional(),
      checkpoint: z.boolean(),
      options: z.record(z.string().min(1), z.array(effect)),
      note: z.string().optional(),
    }),
  ),
  /**
   * What Interact does at a place (SLICE-001). The first entry whose place matches and whose conditions hold for the
   * controlled character is offered: `requires`/`unless` are facts that character knows, `after` lists decisions
   * that must be resolved and `before` decisions that must not have been raised yet.
   */
  interactions: z.array(
    z.strictObject({
      id: z.string().startsWith("act."),
      location: locId,
      label: z.string().min(1),
      activityId: z.string().min(1),
      dTau: z.number().finite().positive(),
      requires: z.array(factId).optional(),
      unless: z.array(factId).optional(),
      after: z.array(decisionId).optional(),
      before: z.array(decisionId).optional(),
    }),
  ),
  /** The episode ends when this character learns this fact; the outcome screen opens (SLICE-001). */
  ending: z.strictObject({ fact: factId, knownBy: charId }),
  /** One plain-language line per consequential choice, shown on the outcome screen when that option was taken. */
  outcomeNotes: z.array(z.strictObject({ decision: decisionId, option: z.string().min(1), text: z.string().min(1) })),
  beats: z.array(
    z.strictObject({
      id: z.string().startsWith("beat."),
      title: z.string().min(1),
      controlling: charId.nullable(),
      decision: decisionId.optional(),
      requires: z.array(charId),
    }),
  ),
});

export type EpisodeFile = z.infer<typeof episodeSchema>;
