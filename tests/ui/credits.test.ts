import { describe, expect, it } from "vitest";
import { parseCredits } from "../../src/ui";

describe("credits from the asset ledger (FAN-001)", () => {
  it("reads the shipped table, ignores the header and later documentation-only tables", () => {
    const md = [
      "# Asset ledger",
      "| Path | What | Source | Author | Licence | Changes |",
      "| --- | --- | --- | --- | --- | --- |",
      "| `public/sky/a.webp` | A sky | Generated | Project | Project licence | None |",
      "| `public/audio/b.opus` | A tick | freesound | Someone | CC0 | Trimmed |",
      "",
      "## Reference images (documentation only)",
      "| Path | Asset | Author | Licence |",
      "| `docs/art/thumbs/x.jpg` | x | y | CC0 |",
    ].join("\n");
    expect(parseCredits(md)).toEqual([
      { path: "public/sky/a.webp", what: "A sky", source: "Generated", author: "Project", licence: "Project licence" },
      { path: "public/audio/b.opus", what: "A tick", source: "freesound", author: "Someone", licence: "CC0" },
    ]);
  });

  it("skips a row with too few cells rather than guessing", () => {
    expect(parseCredits("| `public/x.png` | only two |")).toEqual([]);
  });
});
