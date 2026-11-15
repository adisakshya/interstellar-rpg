# Architecture

Status: **Draft for creator review** (DOCS-003, #9) · Plan version 0.2.0 · Decisions: [DECISIONS.md](DECISIONS.md) · ADRs: [adr/](adr/)

How the browser client is built: which code may talk to which, the interfaces the domain exposes, and how state is saved, rendered, controlled and shipped. Game rules live in [TIMELINES.md](TIMELINES.md), and the physics numbers in [PHYSICS.md](PHYSICS.md). This doc never repeats them.

## 1. Shape of the system

```
 content (JSON) ──load+validate──▶ ┌──────────────────────────┐
                                   │ domain (pure TypeScript)  │◀── commands ── input adapters (keyboard/mouse, touch)
 persistence ◀── snapshots ───────▶│  dispatch → validate →    │◀── commands ── ui (HUD, dialogs)
 (IndexedDB, export/import)        │  events → new state       │
                                   └────────────┬─────────────┘
                                   read-only state + events
                         ┌───────────────┬──────┴───────┬──────────────┐
                       render          ui            audio      (M5) network adapter
                    (Babylon.js)   (DOM overlay)  (Web Audio)   (same commands/events)
```

There is one rule: **only the domain changes game state, and only through `dispatch(command)`**. Everything else reads state or sends commands. That keeps desktop and mobile identical (INV-15), makes saves exact (INV-14), and means co-op later replaces *who calls `dispatch`*, not the gameplay code (ADR-004).

## 2. Directory layout and dependency rules

```
src/
  domain/       rules, state, commands, events, clocks, decisions, knowledge, resources, rng
  content/      schemas (zod), loader, episode data (episodes/*.json)
  persistence/  save slots, IndexedDB, export/import, migrations
  render/       Babylon scenes, cameras, quality tiers
  input/        action map, keyboard/mouse adapter, touch adapter
  ui/           HUD and dialogs as DOM overlay (HTML/CSS)
  audio/        music/SFX state model (M2)
  app/          composition root: wires the modules, owns the frame loop and lifecycle
tests/
  domain/       Vitest unit and property tests
  e2e/          Playwright (desktop + mobile emulation)
docs/physics/   fixtures.json (read by tests and by content build)
```

| Module | May import | Must not import |
| --- | --- | --- |
| `domain` | nothing outside `domain` | Babylon, DOM APIs, `Math.random`, `Date.now`, `content`, anything else in `src/` |
| `content` | `domain` (types and ids only) | Babylon, DOM |
| `persistence` | `domain` | Babylon, `render`, `ui` |
| `render`, `input`, `ui`, `audio` | `domain` (read-only API and types), `content` | each other (they talk only through `app` and the domain) |
| `app` | everything | — |

These rules are enforced with ESLint `no-restricted-imports` per folder (set up in SETUP-001). The domain also gets `no-restricted-globals` for `Math.random`, `Date`, `performance`, `window` and `document`. Time and randomness enter the domain only as command data or as the seeded RNG held in state.

## 3. Domain interface

Sketch for DOM-001 and TIME-001..004. Names follow TIMELINES §9, and the exact fields are settled in code review.

```ts
type Id<K extends string> = string & { readonly __kind: K };   // stable ids from content, e.g. "char.cooper"
type CharacterId = Id<"char">; type DecisionId = Id<"decision">; type FactId = Id<"fact">;

interface GameState {
  readonly schemaVersion: number;
  readonly contentVersion: string;
  readonly T: number;                        // reference time, seconds (Endurance proper time)
  readonly seq: number;                      // last committed event sequence number
  readonly controlled: CharacterId;          // session state; not part of history (INV-03)
  readonly characters: Readonly<Record<CharacterId, CharacterState>>;  // tau, location, availability
  readonly resources: Readonly<Record<string, ResourceState>>;
  readonly decisions: Readonly<Record<DecisionId, DecisionState>>;     // pending | resolved | forecast
  readonly knowledge: Readonly<Record<CharacterId, readonly FactId[]>>;
  readonly playerSeen: readonly FactId[];
  readonly messages: readonly MessageState[];
  readonly activity: ActivityProgress | null;
  readonly processedCommandIds: readonly string[];   // bounded window, see ADR-002
  readonly rng: { readonly seed: number; readonly state: number };
}

type Command =
  | { kind: "AdvanceTime"; commandId: string; actorId: CharacterId; activityId: string; dTau: number }
  | { kind: "FreeRoamTick"; commandId: string; actorId: CharacterId; dTau: number }
  | { kind: "StartTransit"; commandId: string; actorIds: CharacterId[]; routeId: string }
  | { kind: "SwitchCharacter"; commandId: string; targetId: CharacterId }
  | { kind: "ResolveDecision"; commandId: string; decisionId: DecisionId; optionId: string }
  | { kind: "SendMessage"; commandId: string; fromId: CharacterId; toId: CharacterId; factIds: FactId[] };

type DomainEvent = { seq: number; T: number } & (
  | { kind: "ClockAdvanced"; dT: number }
  | { kind: "ActivityCompleted" | "ActivityInterrupted"; activityId: string; progress: number }
  | { kind: "DecisionPending" | "DecisionResolved"; decisionId: DecisionId; optionId?: string }
  | { kind: "CharacterDied"; characterId: CharacterId; cause: string }
  | { kind: "CheckpointCreated"; decisionId: DecisionId }
  /* …FactLearned, MessageSent, MessageDelivered, ResourceChanged, ResourceDepleted, AvailabilityChanged */ );

type Result =
  | { kind: "Ok"; events: DomainEvent[] }
  | { kind: "Interrupted"; decisionId: DecisionId; events: DomainEvent[] }
  | { kind: "Blocked"; decisionId: DecisionId; deadlineT: number }        // nothing committed
  | { kind: "Duplicate" }
  | { kind: "Rejected"; code: RejectCode };

interface GameEngine {
  dispatch(cmd: Command): Result;                 // the only way state changes
  getState(): GameState;                          // deeply frozen
  subscribe(fn: (state: GameState, events: readonly DomainEvent[]) => void): () => void;
  forecast(decisionId: DecisionId): DecisionForecast | null;   // pure query for UI and early resolution
}
```

The domain is a **pure reducer** underneath: `apply(state, command, content) → { state, result }`. `GameEngine` is a thin stateful wrapper around it. Tests call the reducer directly; the app uses the engine.

`LoadCheckpoint` is not a domain command. `persistence` loads a snapshot and the app swaps in a new engine (TIMELINES §8).

## 4. Frame loop and free-roam

- Babylon's render loop runs at the display's frame rate and only *reads* state.
- `app` keeps a real-time accumulator. While free-roam is active (TIMELINES §5: tab visible, no modal, not paused), every 1 s × `timeScale` of accumulated time it dispatches one `FreeRoamTick`. Frame rate therefore never changes outcomes.
- The result of an `Interrupted` or `Blocked` tick pauses free-roam and opens the decision prompt.
- On `visibilitychange: hidden`, free-roam pauses and persistence autosaves. On `webglcontextlost`, `render` rebuilds the scene from the current state and the domain is untouched.

## 5. Content

- Episode data is JSON under `src/content/episodes/`, validated at load by **zod** schemas (CONT-001). Any problem fails loudly with a path such as `beats[3].requires[0]: unknown character "char.brand"`.
- Ids are stable strings with a kind prefix (`char.`, `loc.`, `decision.`, `fact.`, `route.`). Renaming an id is a content migration, never a silent change.
- Location rates come from `docs/physics/fixtures.json` (`game_rates_dtau_dT`). The content build copies them in; nothing hand-types them.
- Content validation rules taken from TIMELINES: every unattended harm needs a prior hard decision (INV-11); every incapacitation needs a wake fallback; some path or a failure ending must always remain after a death.

## 6. Persistence (ADR-003)

- Storage: **IndexedDB** (one database, stores `autosave`, `checkpoints` (≤3), `quarantine`). The `localStorage` quota is too small and too blocking for snapshots.
- Save file: `{ format: "irpg-save", schemaVersion, contentVersion, savedAt, state: GameState, eventTail: DomainEvent[≤200], hash }`. `hash` is SHA-256 of canonical JSON of `state` (keys sorted), via Web Crypto.
- Load: verify the hash and schema, then run `migrations[from→to]` in order. If any step fails, the blob moves to `quarantine`, the player sees "This save can't be loaded", and **Export raw save** stays available. Nothing is ever deleted silently.
- Export/import: a `.json` download and upload of the same save file.
- Private browsing and storage loss: the game works without persistence and warns once that progress won't be kept.

## 7. Rendering (ADR-001)

- `@babylonjs/core` with ES-module imports only, so tree-shaking keeps the bundle small (measured in SPIKE-001). WebGL2 is the baseline; WebGPU is not required.
- Three scenes for M1: Ranger cockpit (first person), Miller surface (third person), Endurance interior. They load lazily with dynamic `import()`.
- **Quality tiers:** `low` (iPhone default: hardware scaling 1.5–2, no post-processing, baked lighting), `high` (desktop: scaling 1, light post-processing). Tiers change visuals only and never game rules.
- No black-hole lensing renderer, floating origin or logarithmic depth in M1: the scenes are local and small (PHYSICS §1). Revisit only against a measured need.

## 8. Input and UI (ADR-005)

- `input` maps devices to **actions** (`move`, `look`, `interact`, `switchCharacter`, `confirm`…). `app` turns actions into commands. Keyboard/mouse and touch therefore emit identical command logs for the same intent (INV-15, walkthrough 6).
- Touch: a virtual joystick and buttons in the DOM overlay, at least 44 CSS px, inside `env(safe-area-inset-*)`. No hover-only or precise multi-finger controls.
- **HUD and dialogs are HTML/CSS over the canvas**, not Babylon GUI. That gives screen-reader access, text scaling, native focus handling and simpler Playwright tests.

## 9. Build and deploy

- Vite with `base: "/interstellar-rpg/"` for GitHub Pages (CI-001). All asset URLs go through `import.meta.env.BASE_URL`. The game is a single page with no client routing, so refreshes cannot 404.
- CI on every PR: lint, typecheck, Vitest, `python3 docs/physics/kerr_fixtures.py --check`, build. Playwright e2e joins in QA-001.
- No service worker, analytics, accounts or secrets in M1.

## 10. Testing hooks

- Domain: Vitest unit tests per invariant (`INV-xx` in each test name), plus property tests with **fast-check** for switch sequences (INV-03) and save round-trips (INV-14).
- Determinism (INV-15): a golden command log is replayed in Node and in Playwright WebKit/Chromium, and the state hashes are compared.
- Fixtures: the physics values are imported from `docs/physics/fixtures.json` in tests, never copied.

## 11. Dependencies (runtime)

`@babylonjs/core`, `zod`. Everything else (Vite, TypeScript, Vitest, ESLint, Prettier, fast-check, Playwright) is dev-only. A new runtime dependency needs a line in this doc and a reason.
