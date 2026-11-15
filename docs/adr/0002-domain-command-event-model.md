# ADR-002: Domain as a pure command → event reducer

Status: **Accepted** for M1.

## Context
TIMELINES requires atomic commands (INV-05), idempotency (INV-04), exact save/reload (INV-14), identical results across devices (INV-15), and a later co-op authority that must not rewrite gameplay.

## Decision
- `apply(state, command, content) → { state, result }` is a pure function in `src/domain`. `GameEngine` wraps it with `dispatch`, `getState`, `subscribe` and `forecast` (ARCHITECTURE §3).
- Commands carry a client-generated UUID `commandId`. The state keeps the most recent **1 024** processed ids. Older ids cannot reappear, because the input layer generates a fresh id per player action and never retries an old one beyond a session.
- State is immutable: every reducer returns a new object, and the engine deep-freezes it in development builds.
- Time and randomness enter only as command data (`dTau`) or through a seeded PRNG (mulberry32) stored in state. No `Date`, `Math.random` or transcendental `Math.*` in timeline math (TIMELINES §1).
- No event-sourcing framework: state snapshots are the source of truth, and a bounded event tail exists for debugging and UI feedback.

## Consequences
- Tests drive the reducer directly, without Babylon or a DOM.
- Co-op (ADR-004) serialises the same `Command` and `DomainEvent` JSON over a transport; the reducer is unchanged.
- The 1 024-id window is a documented limit: replaying a command older than that would be re-applied. That is acceptable because ids are never replayed by design. Revisit if co-op retries need a longer window.
