/**
 * Quality tiers (ARCHITECTURE §7). Tiers change visuals only, never game rules. `low` follows the SPIKE-001
 * recommendation: render below native resolution on dense phone screens and avoid full-screen alpha blending.
 */
export type Tier = "low" | "high";

export interface TierSettings {
  /** Device pixels per rendered pixel (1 = native). */
  readonly scaling: number;
  readonly antialias: boolean;
  /** Transparent water costs a full-screen blend; `low` draws it opaque. */
  readonly transparentWater: boolean;
  readonly terrainSubdivisions: number;
}

export const TIERS: Readonly<Record<Tier, TierSettings>> = {
  low: { scaling: 1.5, antialias: false, transparentWater: false, terrainSubdivisions: 48 },
  high: { scaling: 1, antialias: true, transparentWater: true, terrainSubdivisions: 128 },
};

/** Touch-first or dense screens start on `low`; a `?tier=low|high` query overrides (for testing). */
export function detectTier(env: {
  matchMedia?: (q: string) => { matches: boolean };
  devicePixelRatio?: number;
  search?: string;
}): Tier {
  const forced = new URLSearchParams(env.search ?? "").get("tier");
  if (forced === "low" || forced === "high") return forced;
  const coarse = env.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse || (env.devicePixelRatio ?? 1) > 2 ? "low" : "high";
}

/** Babylon hardware scaling level for a tier: render pixels = CSS pixels / level. */
export const scalingLevel = (tier: Tier, devicePixelRatio: number) =>
  TIERS[tier].scaling / Math.max(1, devicePixelRatio);
