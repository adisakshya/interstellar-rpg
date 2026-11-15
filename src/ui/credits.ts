/** One shipped file that was not written as source code (docs/ASSETS.md). */
export interface CreditRow {
  readonly path: string;
  readonly what: string;
  readonly source: string;
  readonly author: string;
  readonly licence: string;
}

/**
 * The credits are generated from the asset ledger (FAN-001): every row of the first table whose path is under
 * `public/` ships in the game. Later tables (reference images, documentation only) are not credited here because they
 * are not in the build. A row with too few cells is ignored rather than guessed at.
 */
export function parseCredits(markdown: string): CreditRow[] {
  const rows: CreditRow[] = [];
  const stop = markdown.search(/^##\s/m);
  const body = stop === -1 ? markdown : markdown.slice(0, stop);
  for (const line of body.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((c) => c.trim());
    const path = cells[0]?.replace(/^`|`$/g, "");
    if (!path?.startsWith("public/") || cells.length < 5) continue;
    rows.push({ path, what: cells[1]!, source: cells[2]!, author: cells[3]!, licence: cells[4]! });
  }
  return rows;
}
