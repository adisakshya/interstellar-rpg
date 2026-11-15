# Product Requirements (Episode 1)

Status: **Draft, proceeding on creator's standing go-ahead** (DOCS-005, #12) · Plan version 0.2.0. Each requirement has one home here; the details live in the linked contract. IDs are stable: never renumber, only deprecate.

Priority: **P0** blocks the milestone, **P1** expected, **P2** nice to have.

## Functional requirements

| ID | Requirement | Pri | Release | Source | Contract | Acceptance (summary) |
| --- | --- | --- | --- | --- | --- | --- |
| FR-01 | One shared reference clock; every character's proper time advances by their location rate | P0 | M1 | C-08, C-11 | TIMELINES §1–2, PHYSICS §4 | INV-01, INV-02; W1 |
| FR-02 | Free character switching that never changes clocks, resources, knowledge or history | P0 | M1 | C-05 | TIMELINES §4 | INV-03; W2 |
| FR-03 | Availability states with reasons shown to the player | P0 | M1 | C-05 | TIMELINES §4 | Reason codes in UI; screen-reader text |
| FR-04 | Soft and hard decisions; hard deadlines stop the clock (interrupt or block) | P0 | M1 | C-06, D-10 | TIMELINES §3 | INV-05–07; W3 |
| FR-05 | Per-character knowledge; a fact reaches a character only through an in-world event: their own observation, a conversation in the same place, or a delivered message | P1 | M1 | C-05, D-03 | TIMELINES §6 | INV-08, INV-09 |
| FR-06 | Resources accrue on their owner's proper time; unattended harm needs a prior hard decision | P1 | M1 | C-07 | TIMELINES §7 | INV-10, INV-11 |
| FR-07 | Real-time free-roam advances the controlled character's proper time; nothing advances while away | P0 | M1 | D-07, D-11 | TIMELINES §5 | INV-13 |
| FR-08 | Autosave plus ≤3 automatic checkpoints; loading a checkpoint is the only rewind | P0 | M1 | D-08 | TIMELINES §8, ADR-003 | INV-14; W4 |
| FR-09 | Permanent deaths; the story continues while any playable character can | P1 | M1 | D-09 | TIMELINES §4, GDD §8 | INV-12; W5 |
| FR-10 | Save export/import; corrupt saves are quarantined, never deleted | P1 | M1 | C-13 | ADR-003 | Corruption tests (SAVE-001) |
| FR-11 | Hybrid 3D: first-person cockpit, third-person surface, Endurance interior, in the cinematic-realism style | P0 | M1 | C-09, D-14 | ARCHITECTURE §7, ART_DIRECTION §4 | SCENE-001 to SCENE-004; creator sign-off of the Miller scene |
| FR-12 | Keyboard/mouse and touch both complete every authored path | P0 | M1 | C-10 | ARCHITECTURE §8 | W6 |
| FR-13 | Episode 1 story slice: all 12 M1 beats (GDD §4) with original dialogue in the film's voice, from the cockpit above Miller to the outcome | P0 | M1 | C-08, D-01, D-02, D-19, D-20 | GDD §4 | SLICE-001 (mechanics), STORY-001 (beats and dialogue) |
| FR-14 | Scientific problem with evidence and a shown confidence level | P1 | M2 | C-07, D-03 | GDD §6 | Two evidence paths reach different confidence |
| FR-15 | Relationship (trust) values that change NPC behaviour | P1 | M2 | D-03 | GDD §7 | Brand-lingering rule (GDD §5) |
| FR-16 | Brand playable on the surface; Murph playable on Earth | P1 | M2 | D-02 | GDD §3 | — |
| FR-17 | Adaptive music and SFX, with captions for critical sounds (the time tick, FR-21, comes earlier) | P2 | M2 | brief §6.4 | — | — |
| FR-18 | In-game codex that discloses speculative physics (spin, wormhole) | P2 | M2 | C-11, D-12 | PHYSICS §1 | Every "speculative" row has a codex entry |
| FR-19 | Live co-op in one shared campaign; player count is an **open creator decision** (DECISIONS: Open) | P1 | M5 | C-04 | COOP_POLICY | — |
| FR-20 | Unofficial fan-project notice on the title screen and in the credits; no film footage, stills, score or logos | P0 | M1 | D-21 | ART_DIRECTION §2 | FAN-001 |
| FR-21 | An original tick, one per day of Romilly's time, driven by the simulation (fast run when time is skipped) | P1 | M1 | D-18 | ART_DIRECTION §6 | AUDIO-001; tick interval on Miller 1.43 s ± 1% |
| FR-22 | Heavy gravity on Miller (≈ 1.3 g, film figure) felt in movement and wading | P1 | M1 | D-18 | ART_DIRECTION §6 | MOVE-001 |
| FR-23 | The tidal wave is a visible object that arrives exactly at the recall deadline | P0 | M1 | D-18 | ART_DIRECTION §6, TIMELINES §11 W5 | WAVE-001 |
| FR-24 | Physically simulated, assisted flight for descent, ascent and docking (thrust, fuel, orbit) | P1 | M2 | D-18 | ART_DIRECTION §6 | M2 flight issue |
| FR-25 | Time passed is visible in the world: Endurance ages with years passed; a title card on every switch says how long it has been | P0 | M1 | D-18 | ART_DIRECTION §6 | SCENE-004 |

## Non-functional requirements

| ID | Requirement | Pri | Release | Measurement |
| --- | --- | --- | --- | --- |
| NFR-01 | Determinism: the same command log gives an identical state hash on every device and engine | P0 | M1 | INV-15 replay in Node, Chromium and WebKit |
| NFR-02 | Frame rate: ≥30 FPS p95 on the iPhone 16e (`low` tier); ≥60 FPS p95 on the reference desktop (`high` tier) **(P-03, proposed)** | P0 | M1 measure / M3 gate | VALIDATION §3 |
| NFR-03 | Download: ≤15 MB compressed before the first frame; ≤75 MB for the whole episode **(P-03)** | P1 | M1 measure / M3 gate | VALIDATION §3 |
| NFR-04 | Accessibility: no information by colour alone or hover alone; touch targets ≥44 CSS px; critical UI readable by screen readers; captions for critical sounds | P0 | M1 (UI) / M2 (audio) | VALIDATION §4 |
| NFR-05 | Lifecycle: tab hide, phone lock or WebGL context loss never loses or advances state | P0 | M1 | PERF-001 steps |
| NFR-06 | Hosting: static GitHub Pages under `/interstellar-rpg/`; no server, no secrets, no paid services | P0 | M1 | CI-001 |
| NFR-07 | Physics fixtures reproduce within a relative 10⁻⁹ in CI | P0 | M1 | `kerr_fixtures.py --check` |
| NFR-08 | Privacy: no analytics, tracking or accounts | P0 | All | Code review |

## Explicit exclusions (this episode)

Full film recreation, other planets, the tesseract, voiceover, character customisation, accounts or cloud saves, analytics, monetisation, Android support claims (D-06), and networking before M5.

## Issue mapping (M1)

| Issue | Requirements |
| --- | --- |
| SETUP-001 #11 | NFR-06, NFR-07 |
| CI-001 #15 | NFR-06 |
| DOM-001 #16 | FR-02, NFR-01 |
| TIME-001 #17 | FR-01, FR-07 |
| TIME-002 #21 | FR-04 |
| TIME-003 #22 | FR-02, FR-03 |
| TIME-004 #23 | FR-05 |
| RES-001 #24 | FR-06 |
| SAVE-001 #27 | FR-08, FR-10 |
| CONT-001 #18 | FR-09, FR-13 |
| SCENE-001 #19 | FR-11 |
| INPUT-001 #25 | FR-12 |
| UI-001 #28 | FR-03, NFR-04 |
| PERF-001 #26 | NFR-02, NFR-05 |
| SLICE-001 #29 | FR-13 |
| QA-001 #30 | NFR-01, NFR-02, NFR-03 |
