# ADR-003: Versioned snapshot saves in IndexedDB

Status: **Accepted** for M1 (slot policy is creator decision D-08).

## Context
Saves must preserve pending decisions and clocks without duplicate effects (INV-14). They must survive schema changes, never be silently discarded, and work offline on a static site with no accounts.

## Decision
- Format `irpg-save`: `{ format, schemaVersion, contentVersion, savedAt, state, eventTail (≤200), hash }`. `hash` is SHA-256 over canonical JSON (sorted keys) of `state`.
- Stored in IndexedDB: 1 autosave, ≤3 checkpoints (ring buffer, D-08), and a `quarantine` store.
- Migrations are an ordered map `schemaVersion n → n+1` of pure functions, each with a fixture test.
- A failed hash, schema or migration moves the save to `quarantine`, and the player can still export it raw.
- Export/import is the same JSON as a file. There is no cloud sync (C-13).

## Consequences
- Storage loss (private mode, cleared site data) loses progress. The UI says so once, and export is the backup.
- `contentVersion` lets a save from older episode content be detected and migrated or refused explicitly.
