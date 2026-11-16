/** One year, the unit the room's marks are counted in. */
export const YEAR = 365.25 * 86_400;

/** How far the room has aged, from the reference clock T (Endurance runs at the reference rate). */
export interface EnduranceAge {
  readonly years: number;
  /** Marks on the wall: one per full year, capped so the wall stays readable. */
  readonly tallies: number;
  /** 0 clean .. 1 thick with dust, reached after about 25 years. */
  readonly dust: number;
  /** 0 a cutting .. 1 a plant that has taken over its shelf, reached after about 25 years. */
  readonly plant: number;
  /** Logbooks piled on the shelf: one per two years, capped. */
  readonly logbooks: number;
}

export const MAX_TALLIES = 60;
export const MAX_LOGBOOKS = 12;
const FULL_AGE_YEARS = 25;

export function enduranceAge(T: number): EnduranceAge {
  const years = Math.max(0, T) / YEAR;
  const k = Math.min(years / FULL_AGE_YEARS, 1);
  return {
    years,
    tallies: Math.min(Math.floor(years), MAX_TALLIES),
    dust: k,
    plant: k,
    logbooks: Math.min(Math.floor(years / 2), MAX_LOGBOOKS),
  };
}

/** Rebuild the marks only when something visible changed, not on every one-second tick. */
export const ageKey = (a: EnduranceAge): string =>
  `${a.tallies}:${a.logbooks}:${Math.round(a.dust * 50)}:${Math.round(a.plant * 50)}`;
