# Traceability

Confirmed requirement → product requirement → milestone → issues → evidence. Requirement text lives in [PROJECT_BRIEF §2](PROJECT_BRIEF.md), [DECISIONS](DECISIONS.md) and [PRD](PRD.md), not here.

| Confirmed | PRD | Milestone | Issues | Evidence |
| --- | --- | --- | --- | --- |
| C-01 Interstellar characters and premise | FR-13, FR-16 | M1, M2 | CONT-001 #18, SLICE-001 #29 | Playthrough recording |
| C-02 Changeable events; physics first | FR-09, FR-18 | M1, M2 | CONT-001 #18 | PHYSICS.md; outcome table (GDD §5) |
| C-03 Free public release | NFR-06, NFR-08 | M3 | CI-001 #15 | Pages URL |
| C-04 Co-op later | FR-19 | M5 | EPIC-M5 #6 | COOP_POLICY; ADR-004 |
| C-05 Free switching with availability rules | FR-02, FR-03, FR-05 | M1 | DOM-001 #16, TIME-003 #22, TIME-004 #23, UI-001 #28 | INV-03, INV-08 tests; W2 |
| C-06 Unattended expeditions wait at decisions | FR-04 | M1 | TIME-002 #21 | INV-05–07 tests; W3 |
| C-07 Four pillars | FR-06, FR-13, FR-14, FR-15 | M1, M2 | RES-001 #24, SLICE-001 #29 | GDD; playtests |
| C-08 Planet expedition and lost time | FR-01, FR-07, FR-13 | M1 | TIME-001 #17, SLICE-001 #29 | W1 test; creator answer (VALIDATION §5) |
| C-09 Hybrid 3D | FR-11 | M1 | SCENE-001 #19 | Screenshots |
| C-10 Desktop and mobile | FR-12, NFR-02–NFR-05 | M1, M3 | INPUT-001 #25, PERF-001 #26, QA-001 #30 | W6 replay; iPhone 16e numbers |
| C-11 Physics priority, speculative flagged | FR-01, FR-18, NFR-07 | M0, M2 | DOCS-002 #8 | `kerr_fixtures.py --check` |
| C-12 One creator, 5–10 h/week | — | All | DOCS-007 #20 | ROADMAP effort table |
| C-13 Free assets, Pages hosting | NFR-06, FR-10 | M1 | SETUP-001 #11, CI-001 #15, SAVE-001 #27 | CI, Pages URL |
| C-14 Questions via pop-ups | — | All | — | DECISIONS evidence column |
| C-15 Agent workflow | — | All | AGENTS.md, CLAUDE.md | This repo's PR history |

| Decision | Where it binds |
| --- | --- |
| D-01 Miller's planet | GDD §3–4 |
| D-02 Staged roster | GDD §3, FR-16 |
| D-03 Four progression types | GDD §7, FR-14, FR-15 |
| D-04 Babylon.js + TS + Vite | ADR-001, SETUP-001 |
| D-06 iPhone 16e reference | VALIDATION §1, NFR-02 |
| D-07 No time while away | TIMELINES §5, FR-07, INV-13 |
| D-08 Autosave + 3 checkpoints | TIMELINES §8, ADR-003, FR-08 |
| D-09 Permanent death | TIMELINES §4, GDD §8, FR-09 |
| D-10 Soft/hard decisions | TIMELINES §3, FR-04 |
| D-11 Real-time free-roam | TIMELINES §5, ARCHITECTURE §4, FR-07 |
| D-12 Film ratio via extreme spin | PHYSICS §3–4, FR-18 |
