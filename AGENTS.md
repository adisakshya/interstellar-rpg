# Agent Instructions (Codex, Claude Code)

Canonical sources — read before any task: [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md), [docs/DECISIONS.md](docs/DECISIONS.md), the issue and its linked dependencies, and any contract doc it references (docs/TIMELINES.md, docs/ARCHITECTURE.md, docs/PHYSICS.md once they exist).

## Workflow
- One GitHub issue = one focused PR. Work only on issues labelled `status:ready` whose dependencies are merged.
- Issue keys (e.g. `TIME-001`) are stable; reference them in branch names and PR titles.
- Do not invent gameplay rules. If a product decision is missing, stop and ask the creator with a multiple-choice question.
- No paid services, runtime AI/LLM calls, analytics, accounts, or multiplayer backend unless the issue says so.

## Invariants
1. Desktop and mobile share identical game-domain rules; only presentation/input may differ.
2. Character switching never advances clocks, refunds costs, or rewrites committed history.
3. Per-character knowledge, availability, and shared history follow docs/TIMELINES.md.
4. Saves are versioned and preserve pending decisions without duplicating effects.
5. Domain state (pure TS, no Babylon imports) is mutated only via commands; renderer/UI/audio read state.
6. Synthetic fixtures and scientific approximations are labelled; no unsupported accuracy claims.

## Validation
- Run typecheck, lint, unit tests, and build before opening a PR.
- Domain tests assert behavioural invariants, not copies of the implementation formula.
- For visible/touch changes include screenshots or a recording; state emulator vs physical-device results. Never claim a device gate passed without the device.
- Handoff: map each acceptance criterion to evidence, list tests run with actual results, and name remaining gates.
