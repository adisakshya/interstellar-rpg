import fixtures from "../../docs/physics/fixtures.json";
import { asId, type RateTable } from "../domain";

const rates = fixtures.derived.game_rates_dtau_dT;

/** Location ids used by episode content (ARCHITECTURE §5). */
export const LOCATIONS = {
  endurance: asId("loc", "loc.endurance"),
  millerSurface: asId("loc", "loc.miller.surface"),
  earth: asId("loc", "loc.earth"),
} as const;

/** Game clock rates dτ/dT from the physics fixture (PHYSICS §4). Derived, not tuned (D-12). */
export const LOCATION_RATES: RateTable = Object.freeze({
  [LOCATIONS.endurance]: rates.endurance,
  [LOCATIONS.millerSurface]: rates.miller_surface,
  [LOCATIONS.earth]: rates.earth,
});
