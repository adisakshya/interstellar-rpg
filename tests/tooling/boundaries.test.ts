import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Proves the ARCHITECTURE §2 boundaries are enforced, not just documented (SETUP-001 acceptance).
const eslint = new ESLint();
const lint = async (filePath: string, code: string) => (await eslint.lintText(code, { filePath }))[0]!.messages;

describe("module boundaries", () => {
  it("rejects Babylon imports in src/domain", async () => {
    const msgs = await lint(
      "src/domain/__probe__.ts",
      'import { Engine } from "@babylonjs/core/Engines/engine";\nexport { Engine };\n',
    );
    expect(msgs.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("rejects Math.random and Date in src/domain", async () => {
    const msgs = await lint(
      "src/domain/__probe__.ts",
      "export const a = Math.random();\nexport const b = Date.now();\n",
    );
    const rules = msgs.map((m) => m.ruleId);
    expect(rules).toContain("no-restricted-properties");
    expect(rules).toContain("no-restricted-globals");
  });

  it("rejects render importing ui", async () => {
    const msgs = await lint("src/render/__probe__.ts", 'import "../ui/index";\n');
    expect(msgs.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("allows Babylon imports in src/render", async () => {
    const msgs = await lint(
      "src/render/__probe__.ts",
      'import { Engine } from "@babylonjs/core/Engines/engine";\nexport { Engine };\n',
    );
    expect(msgs.filter((m) => m.ruleId === "no-restricted-imports")).toEqual([]);
  });
});
