// Stable, kind-tagged ids from content (ARCHITECTURE §5), e.g. "char.cooper". Branded so they can't be mixed up.
export type Id<K extends string> = string & { readonly __kind: K };
export type CharacterId = Id<"char">;
export type LocationId = Id<"loc">;
export type DecisionId = Id<"decision">;
export type FactId = Id<"fact">;
export type RouteId = Id<"route">;

const PREFIX = { char: "char.", loc: "loc.", decision: "decision.", fact: "fact.", route: "route." } as const;

/** Narrow a raw string to an id of the given kind, checking its prefix. */
export function asId<K extends keyof typeof PREFIX>(kind: K, raw: string): Id<K> {
  if (!raw.startsWith(PREFIX[kind]) || raw.length === PREFIX[kind].length) {
    throw new Error(`"${raw}" is not a ${kind} id (expected prefix "${PREFIX[kind]}")`);
  }
  return raw as Id<K>;
}
