import fixtures from "../../docs/physics/fixtures.json";
import { asId, type RateTable } from "../domain";

/** Game clock rates dτ/dT by fixture key (PHYSICS §4). Derived, never hand-typed (ARCHITECTURE §5, D-12). */
export const FIXTURE_RATES: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(Object.entries(fixtures.derived.game_rates_dtau_dT).filter(([k]) => !k.startsWith("_"))) as Record<
    string,
    number
  >,
);

/** Location ids from GDD §9. */
export const LOCATIONS = {
  endurance: asId("loc", "loc.endurance"),
  ranger: asId("loc", "loc.ranger"),
  millerSurface: asId("loc", "loc.miller_surface"),
  millerWreck: asId("loc", "loc.miller_wreck"),
  earthFarm: asId("loc", "loc.earth_farm"),
} as const;

/** Rates for the fixed M1 places; the Ranger moves on transit routes instead (TIMELINES §1). */
export const LOCATION_RATES: RateTable = Object.freeze({
  [LOCATIONS.endurance]: FIXTURE_RATES["endurance"]!,
  [LOCATIONS.millerSurface]: FIXTURE_RATES["miller_surface"]!,
  [LOCATIONS.millerWreck]: FIXTURE_RATES["miller_surface"]!,
  [LOCATIONS.earthFarm]: FIXTURE_RATES["earth"]!,
});
