# ADR-004: Future co-op uses a single host authority

Status: **Provisional** (constraints for M1; implementation is M5 and depends on DOCS-006 and creator decisions).

## Context
Co-op (C-04) must keep one committed history, and characters at different time rates cannot both free-roam in real time (TIMELINES W7).

## Decision (constraints M1 code must respect)
- One authority (a host, which may be a player's browser or a relay) runs the same `GameEngine`. Clients send `Command` JSON and receive committed `DomainEvent`s and snapshots.
- Every command and event is plain, serialisable JSON with no functions, classes or Babylon objects.
- `controlled` becomes per-player ownership. The availability reason `CONTROLLED_BY_OTHER` already exists.
- Nothing in `render`, `ui` or `input` assumes it is the only client.

## Consequences
- M1 builds no networking, but the domain's API is already the co-op wire protocol.
- Open for M5: the time-driver turn rule, player count, disconnect policy, and hosting beyond Pages (DECISIONS: Open).
