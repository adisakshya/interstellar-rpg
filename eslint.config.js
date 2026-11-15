import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Module boundaries from docs/ARCHITECTURE.md §2. Keep this table in sync with that section.
const babylon = { group: ["@babylonjs/*"], message: "Babylon is confined to src/render (ARCHITECTURE §2)." };
const layer = (names) => ({
  group: names.flatMap((n) => [`**/${n}`, `**/${n}/**`]),
  message: "Cross-module import not allowed here (ARCHITECTURE §2).",
});

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**", ".spike-out/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [babylon, layer(["content", "persistence", "render", "input", "ui", "audio", "app"])] },
      ],
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "Time enters the domain only as command data (ADR-002)." },
        { name: "performance", message: "Time enters the domain only as command data (ADR-002)." },
        { name: "window", message: "The domain has no DOM (ARCHITECTURE §2)." },
        { name: "document", message: "The domain has no DOM (ARCHITECTURE §2)." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded RNG in state (ADR-002)." },
        { object: "Math", property: "pow", message: "Timeline math uses + - * / only (TIMELINES §1)." },
        { object: "Math", property: "exp", message: "Timeline math uses + - * / only (TIMELINES §1)." },
        { object: "Math", property: "log", message: "Timeline math uses + - * / only (TIMELINES §1)." },
        { object: "Math", property: "sin", message: "Timeline math uses + - * / only (TIMELINES §1)." },
        { object: "Math", property: "cos", message: "Timeline math uses + - * / only (TIMELINES §1)." },
      ],
    },
  },
  {
    files: ["src/content/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [babylon, layer(["persistence", "render", "input", "ui", "audio", "app"])] },
      ],
    },
  },
  {
    files: ["src/persistence/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [babylon, layer(["content", "render", "input", "ui", "audio", "app"])] },
      ],
    },
  },
  {
    files: ["src/render/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            layer(["persistence", "input", "ui", "audio", "app"]),
            {
              // The renderer reads state only; anything that can change it lives in app (SCENE-001).
              group: ["**/domain", "**/domain/**"],
              importNames: [
                "apply",
                "createEngine",
                "createHandlers",
                "createRules",
                "createClockHandlers",
                "createKnowledgeHandlers",
                "defaultHandlers",
                "createInitialState",
              ],
              message: "render reads domain state only; it must not run commands (ARCHITECTURE §1).",
            },
          ],
        },
      ],
    },
  },
  ...["input", "ui", "audio"].map((self) => ({
    files: [`src/${self}/**/*.ts`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            babylon,
            layer(["persistence", "render", "input", "ui", "audio", "app"].filter((n) => n !== self)),
          ],
        },
      ],
    },
  })),
);
