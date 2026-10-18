# Decision Register

Plan version: **0.1.0** · Updated 2026-10-18 · Canonical brief: [PROJECT_BRIEF.md](PROJECT_BRIEF.md)

Statuses: **Confirmed** (creator-approved) · **Proposed** (awaiting approval) · **Open** (undecided) · **Validated** (confirmed and evidenced).

## Confirmed

C-01 – C-15 are confirmed in [PROJECT_BRIEF.md §2](PROJECT_BRIEF.md). Do not re-ask them.

| ID | Decision | Evidence | Blocks |
| --- | --- | --- | --- |
| D-01 | Episode 1 location is **Miller's planet** (planet only; Dr. Laura Miller appears solely as wreck/beacon evidence, not as a living character). | Creator pop-up, 2026-10-18 | GDD, content |
| D-02 | Playable roster is **staged**: M1 = Cooper (surface) + Romilly (Endurance, orbit). M2 adds Brand (surface) and Murph (Earth, one bounded scene). | Creator pop-up, 2026-10-18 | M1/M2 scope |
| D-03 | RPG progression comprises **relationships/trust, knowledge/evidence, skills, and equipment/resources**. No combat, XP, levels, or classes implied. | Creator pop-up, 2026-10-18 | GDD, progression issues |
| D-04 | Client stack: **Babylon.js + TypeScript + Vite**, static build on GitHub Pages. | Creator pop-up, 2026-10-18 | Architecture, all M1 code |
| D-05 | Backlog is published to `adisakshya/interstellar-rpg` with planning files committed. | Creator pop-up, 2026-10-18 | — |

## Proposed (not approved)

| ID | Proposal | Owner | Approve before |
| --- | --- | --- | --- |
| P-01 | Episode working title "The Cost of Staying", 15–25 min, two outcomes. | Creator | M0 gate (DOCS-007) |
| P-02 | Progression staging: knowledge in M1; relationships + knowledge depth in M2; skills + equipment in M2/M4 per GDD. Staging is a scheduling proposal; all four remain in scope (D-03). | Creator | DOCS-004 |
| P-03 | Budgets: 30 FPS phone / 60 FPS desktop; ≤15 MB initial, ≤75 MB episode (compressed). | Creator | DOCS-005 |
| P-04 | Local versioned saves with export/import; explicit checkpoint loading for alternate outcomes. | Creator | DOCS-001 |
| P-05 | Decision barriers block only dependent events, not the whole simulation. | Creator | DOCS-001 |

## Open

| Decision | Owner | Blocks |
| --- | --- | --- |
| Reference phone(s), desktop, browser versions; physical device access | Creator | DOCS-005, performance gates |
| Save slots and death/checkpoint policy | Creator | DOCS-001, SAVE-001 |
| Does real-world absence advance simulation? (Recommended: no) | Creator | DOCS-001 |
| Co-op player count, authority/host, disconnect rules | Creator | DOCS-006, M5 |
| Hosting beyond Pages for co-op and cost ceiling | Creator | M5 |
| Audio/voiceover level, localisation scope | Creator | M2 content |

## Superseded

The earlier `interstellar-rpg-kickoff-prompt.md` draft is superseded where it conflicts with this register (see [PROJECT_BRIEF.md §3](PROJECT_BRIEF.md)).
