import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../../src/domain";

describe("domain", () => {
  it("exposes a positive integer schema version", () => {
    expect(Number.isInteger(SCHEMA_VERSION) && SCHEMA_VERSION > 0).toBe(true);
  });
});
