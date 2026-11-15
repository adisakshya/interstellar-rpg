import { z } from "zod";

// Structural check of a decoded GameState (SAVE-001). Strict objects, so stray or missing fields are caught.
const id = (prefix: string) => z.string().startsWith(prefix);
const time = z.number().finite().nonnegative();
const reason = z.enum([
  "NOT_INTRODUCED",
  "HIBERNATING",
  "INJURED",
  "UNCONSCIOUS",
  "LOCKED_SEQUENCE",
  "DEAD",
  "CONTROLLED_BY_OTHER",
]);

export const gameStateSchema = z
  .strictObject({
    schemaVersion: z.number().int().positive(),
    contentVersion: z.string(),
    T: time,
    seq: z.number().int().nonnegative(),
    controlled: id("char."),
    characters: z.record(
      id("char."),
      z.strictObject({
        id: id("char."),
        tau: time,
        location: id("loc."),
        unavailable: reason.nullable(),
        cause: z.string().optional(),
      }),
    ),
    resources: z.record(z.string(), z.strictObject({ amount: z.number().finite().nonnegative() })),
    decisions: z.record(
      id("decision."),
      z.strictObject({ status: z.enum(["pending", "resolved"]), optionId: z.string().nullable() }),
    ),
    knowledge: z.record(id("char."), z.array(id("fact."))),
    playerSeen: z.array(id("fact.")),
    messages: z.array(
      z.strictObject({
        id: z.string(),
        from: id("char."),
        to: id("char."),
        factIds: z.array(id("fact.")),
        sentT: time,
        deliverT: time,
        delivered: z.boolean(),
      }),
    ),
    activities: z.record(
      id("char."),
      z.strictObject({ activityId: z.string(), actorId: id("char."), progress: z.number().min(0).max(1) }),
    ),
    processedCommandIds: z.array(z.string()).max(1024),
    rng: z.strictObject({ seed: z.number().int(), state: z.number().int() }),
  })
  .refine((s) => s.controlled in s.characters, { message: "controlled character is missing" })
  .refine((s) => Object.entries(s.characters).every(([k, c]) => c.id === k), { message: "character id mismatch" });

export const saveEnvelopeSchema = z.strictObject({
  format: z.literal("irpg-save"),
  schemaVersion: z.number().int().positive(),
  contentVersion: z.string(),
  savedAt: z.string(),
  state: z.unknown(),
  eventTail: z.array(z.unknown()).max(200),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
});
