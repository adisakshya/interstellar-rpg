const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const YEAR = 365.25 * DAY;

/**
 * A duration in the units a player reads: seconds, minutes, hours, days, or years (one decimal). Always two
 * adjacent units at most, so the cost of time on Miller is easy to compare against Romilly's years.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "–";
  if (seconds >= YEAR) return `${(Math.round((seconds / YEAR) * 10) / 10).toFixed(1)} y`;
  const parts = (big: number, bigUnit: string, small: number, smallUnit: string) => {
    const b = Math.floor(seconds / big);
    const s = Math.floor((seconds - b * big) / small);
    return s === 0 ? `${b} ${bigUnit}` : `${b} ${bigUnit} ${s} ${smallUnit}`;
  };
  if (seconds >= DAY) return parts(DAY, "d", HOUR, "h");
  if (seconds >= HOUR) return parts(HOUR, "h", MINUTE, "m");
  if (seconds >= MINUTE) return parts(MINUTE, "m", 1, "s");
  return `${Math.floor(seconds)} s`;
}

/** The same duration spelled out for screen readers ("3 hours 34 minutes"). */
export function spokenDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "unknown";
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (seconds >= YEAR) {
    const y = Math.round((seconds / YEAR) * 10) / 10;
    return `${y.toFixed(1)} years`;
  }
  const split = (big: number, bigUnit: string, small: number, smallUnit: string) => {
    const b = Math.floor(seconds / big);
    const s = Math.floor((seconds - b * big) / small);
    return s === 0 ? plural(b, bigUnit) : `${plural(b, bigUnit)} ${plural(s, smallUnit)}`;
  };
  if (seconds >= DAY) return split(DAY, "day", HOUR, "hour");
  if (seconds >= HOUR) return split(HOUR, "hour", MINUTE, "minute");
  if (seconds >= MINUTE) return split(MINUTE, "minute", 1, "second");
  return plural(Math.floor(seconds), "second");
}

/** "stay_awake" → "Stay awake". Option ids double as labels until authored text exists. */
export function labelFromId(id: string): string {
  const words = id
    .replace(/^[a-z]+\./, "")
    .replace(/[_.]/g, " ")
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
