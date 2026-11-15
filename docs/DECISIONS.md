# Decision Register

Plan version: **0.2.0** · Updated 2026-11-15 · Canonical brief: [PROJECT_BRIEF.md](PROJECT_BRIEF.md)

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
| D-06 | Reference phone: **iPhone 16e** first; iPhone 15 and newer in scope. All iOS browsers use WebKit, so mobile testing means iOS Safari/WebKit. Android is **untested** until a device is nominated, and no public Android claim is made. | Creator chat, 2026-11-14 | DOCS-005, SPIKE-001, QA-001 |
| D-07 | Real-world absence does **not** advance the simulation; game time freezes while away, hidden or paused. | Creator pop-up, 2026-11-14 | DOCS-001, PERF-001 |
| D-08 | Saves: one autosave plus up to **3 automatic checkpoints** created at major decisions; loading a checkpoint is the only way to change committed history. | Creator pop-up, 2026-11-14 | DOCS-001, SAVE-001 |
| D-09 | Death of a playable character is **permanent and the story continues**; a failure ending occurs only when no playable character can continue. | Creator pop-up, 2026-11-14 | DOCS-001, DOCS-004 |
| D-10 | Decisions are **soft** (block only dependent events) or **hard** (also stop reference time at their deadline; interruptible activities interrupt, atomic ones are rejected). Was P-05. See [TIMELINES.md §3](TIMELINES.md). | Creator chat, 2026-11-15 | TIME-002 |
| D-11 | Active free-roam advances the controlled character's proper time in real time (`timeScale` default 1.0, fixed 1 s quanta). Was P-06. See [TIMELINES.md §5](TIMELINES.md). | Creator chat, 2026-11-15 | TIME-001, SLICE-001 |

## Proposed (not approved)

| ID | Proposal | Owner | Approve before |
| --- | --- | --- | --- |
| P-01 | Episode working title "The Cost of Staying", 15–25 min, two outcomes. | Creator | M0 gate (DOCS-007) |
| P-02 | Progression staging: knowledge in M1; relationships + knowledge depth in M2; skills + equipment in M2/M4 per GDD. Staging is a scheduling proposal; all four remain in scope (D-03). | Creator | DOCS-004 |
| P-03 | Budgets: 30 FPS phone / 60 FPS desktop; ≤15 MB initial, ≤75 MB episode (compressed). | Creator | DOCS-005 |
| P-04 | Local versioned saves with export/import (checkpoint policy now confirmed as D-08). | Creator | SAVE-001 |

## Open

| Decision | Owner | Blocks |
| --- | --- | --- |
| Reference desktop and browser versions; Android device (if any) | Creator | DOCS-005, performance gates |
| Co-op time-driver rule (who advances shared time) — see [TIMELINES.md W7](TIMELINES.md) | Creator | DOCS-006, M5 |
| Co-op player count, authority/host, disconnect rules | Creator | DOCS-006, M5 |
| Hosting beyond Pages for co-op and cost ceiling | Creator | M5 |
| Audio/voiceover level, localisation scope | Creator | M2 content |

## Superseded

The earlier `interstellar-rpg-kickoff-prompt.md` draft is superseded where it conflicts with this register (see [PROJECT_BRIEF.md §3](PROJECT_BRIEF.md)).
