import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCredits } from "../../src/ui";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

describe("asset ledger (D-17, D-21, D-25)", () => {
  const credited = parseCredits(readFileSync("docs/ASSETS.md", "utf8")).map((r) => r.path);

  it("lists every file that ships in public/, and nothing that does not exist", () => {
    const shipped = walk("public").map((f) => relative(".", f).split("\\").join("/"));
    expect([...shipped].sort()).toEqual([...credited].sort());
  });

  it("gives every shipped file a source, an author and a licence", () => {
    const rows = parseCredits(readFileSync("docs/ASSETS.md", "utf8"));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.source.length, r.path).toBeGreaterThan(0);
      expect(r.author.length, r.path).toBeGreaterThan(0);
      expect(r.licence.length, r.path).toBeGreaterThan(0);
    }
  });
});
