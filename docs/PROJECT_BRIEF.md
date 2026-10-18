# Interstellar RPG — Planning and Execution Pack

Version: 1.1 · 18 October 2026

Purpose: turn the creator's confirmed direction into a reviewable game plan, requirements, milestones, GitHub backlog, and bounded coding tasks. This is a planning brief, not an approved architecture or an implementation commitment.

## 1. How to use this pack

1. Review the proposed prototype and milestones in sections 4–5. Confirmed choices are separated from recommendations throughout.
2. Create your GitHub repository yourself. A README and default branch make the later documentation PR straightforward; repository name and visibility remain your choices.
3. Place this complete file in `docs/PROJECT_BRIEF.md`. Keep Claude's previous draft as reference material, clearly marked superseded where it conflicts with confirmed decisions here.
4. Run **Prompt A** in Claude Code to challenge and expand the plan. It produces repository files, not game code or published issues.
5. Review the resulting plan. Then run **Prompt B** using Opus in Claude Code to audit and publish the approved backlog. Select the model in your client; the prompt itself cannot guarantee which model runs.
6. Give **Prompt C** to Codex for one ready issue at a time. Review and integrate completed work before starting dependent issues.

Ownership: the creator approves product direction and releases; GPT supports discovery and review; Claude Code develops the plan and technical proposals; Opus audits and publishes the backlog; Codex implements bounded tasks. All agents use the same versioned repository documents. Model names are roles in this workflow, not substitutes for review or testing.

## 2. Confirmed decisions — do not ask these again

| ID | Confirmed requirement |
| --- | --- |
| C-01 | A browser RPG using Interstellar's characters and starting premise, with recognisable film events that may change through player decisions. |
| C-02 | Major events, character deaths, and endings can change. Fidelity to established physics takes precedence when it conflicts with the film. |
| C-03 | The intended release is public and free to play. Commercialisation, investors, and publisher pitching are not requirements. |
| C-04 | Single-player first; live cooperative multiplayer is a committed later capability. Friends will control different characters within one campaign. |
| C-05 | In single-player, the player can switch freely whenever characters are available. Availability needs an explicit rule set. |
| C-06 | Uncontrolled expeditions advance to defined decision points and then await player input. |
| C-07 | All four gameplay pillars belong in the product: dialogue/relationships/choices; piloting/docking/spacecraft operations; exploration/scientific problems; resources/survival/time trade-offs. |
| C-08 | The first playable prototype centres on a planet expedition, scientific decisions, and time lost elsewhere. |
| C-09 | Hybrid 3D presentation: first-person cockpits and third-person exploration. |
| C-10 | Desktop and mobile browser support. Mobile preserves gameplay and consequences, using simpler graphics and adapted touch controls. |
| C-11 | Established physics takes priority. Clearly identify speculative concepts and provide control assists. |
| C-12 | One creator plus AI tools; 5–10 hours per week of creator review, testing, and direction. No assumed specialist team. |
| C-13 | Free assets and GitHub Pages hosting. Existing AI subscriptions are available; do not assume a paid asset, API, or hosting budget. |
| C-14 | Ask material unresolved questions through multiple-choice pop-ups. Do not turn suggestions into approved decisions. |
| C-15 | Workflow: GPT planning/discovery → Claude Code planning → Opus backlog publication → Codex individual implementation tasks. The creator creates the repository before execution. |

## 3. What needs changing in Claude's earlier draft

The earlier draft is useful for document structure, requirement IDs, architectural decisions, measurable acceptance criteria, and repeatable issue creation. Its product assumptions and execution sequence need revision.

| Earlier approach | Challenge | Replacement |
| --- | --- | --- |
| Commercial release treated as decided | Contradicts the confirmed free public game | Plan for a free public browser release |
| Desktop-only launch | Excludes the confirmed mobile audience | Design touch input, readable UI, memory use, and quality tiers from the first playable build |
| Black-hole or wormhole rendering as the first showcase | Proves visual spectacle before the central game experience | Prove a planet decision, switching, and a persistent cross-character consequence |
| 3–4 characters and a two-character slice treated as settled | Character roster and slice size were never approved | Propose a small first pair, then confirm before writing character-specific content |
| Build all core systems before assembling content | Integration and fun arrive too late | Build one thin end-to-end sequence, then deepen the systems it uses |
| Free switching without explicit causality rules | Can permit contradictory states, knowledge leaks, or avoidance of time costs | Define clocks, shared events, knowledge, decision barriers, availability, and persistence together |
| No committed multiplayer design | Later networking may conflict with single-player ownership and waiting rules | Define state authority and ownership contracts early; implement live networking later |
| Mandatory ray marching, floating origin, logarithmic depth, and streaming | These are technical choices, not automatically required by a bounded first scene | Benchmark simpler representations and introduce complexity only against a measured need |
| Broad physical claims copied directly into requirements | For example, the blanket statement about Schwarzschild time ratios lacks observer and orbital conditions | Require a domain-of-validity review and independent numerical references; do not treat the draft as a physics source |
| Giant waves listed as a direct tidal-force feature | A cinematic phenomenon needs its own physical justification | Classify each phenomenon as established, an approximation, speculative, or intentionally fictional |
| Every future issue detailed immediately | Locks in untested assumptions and creates stale tickets | Detail the next executable milestone; keep later milestones as epics with exit criteria |
| Generic analytics/monetisation work | Adds overhead unrelated to the confirmed first experience | Focus on accessibility, deployability, and actual playtests |
| GitHub deduplication by title/search alone | Renames and partial runs can create duplicates | Use stable issue keys, hidden markers, and a resumable GitHub mapping manifest |
| Documentation completion treated as progress | A large plan can hide an unplayable game | Every implementation milestone ends with a playable build and recorded evidence |

### Feasibility position

A small browser prototype is the appropriate first target. Do not promise a film-quality, complete, branching, cross-platform RPG on a fixed date before measuring implementation and review throughput. AI tools help produce assets and code but do not remove integration, animation, art consistency, narrative editing, device testing, or maintenance work.

GitHub Pages hosts static client files [S1]. It does not provide a game server. Keep it as the selected frontend host; evaluate separate signaling/relay/authority infrastructure for later live co-op. A reliable zero-cost multiplayer service is not established. Do not silently weaken multiplayer into asynchronous play or add a paid dependency.

Published Pages sites currently have a 1 GB size limit and a soft 100 GB/month bandwidth limit [S2]. These are hosting ceilings, not reasonable first-download targets. Recheck current limits when deploying.

## 4. Proposed first playable experience — recommendation, not confirmed scope

Working description: **The Cost of Staying**. This is a prototype label, not a final game name.

Propose a 15–25 minute episode with two playable roles: one member of the planet expedition and one aboard the orbiting spacecraft. Ask the creator to select the actual film characters and location before authoring content. An orbital counterpart demonstrates different elapsed times without requiring a whole Earth campaign immediately.

Proposed sequence:

1. In a cockpit, inspect mission objectives, resources, and estimated time consequences; perform a short assisted spacecraft operation.
2. Land through a bounded transition. On foot, inspect a small environment and gather evidence for one scientific problem.
3. Choose whether to spend additional local time improving an uncertain result, return early, or take a more resource-intensive route.
4. Switch to the available character in orbit. Observe the corresponding elapsed time, resource consequences, and a decision that affects the expedition.
5. Resolve a complication through dialogue, a scientific conclusion, and a mission decision. Preserve alternatives rather than force the film's outcome.
6. Return or reach a clearly defined failure outcome. Show what happened, who experienced how much time, and which consequences persist. Save and replay a different choice.

Suggested initial content cap: one small exploration area, one cockpit environment reused where possible, one scientific problem, one substantial relationship decision, one resource trade-off, and two meaningfully different outcomes. Treat these as proposals for approval, not hidden reductions of the larger vision.

Defer from this episode: a complete film recreation, all characters and planets, a full Earth storyline, unrestricted solar-system flight, a production black-hole renderer, full voice acting, elaborate character customisation, live networking, and accounts/cloud saves. Preserve their appropriate later roadmap position if required; do not label every idea a committed feature.

Build emotional impact through readable consequences, character reactions, dialogue, music, and visual presentation. Use placeholder content as needed to validate the first playable experience.

### Prototype acceptance proposal

- At least one decision made through each playable role changes a shared outcome.
- Spending more local expedition time produces a consistent, explainable consequence elsewhere.
- Switching alone neither advances time nor resets costs; repeated switches cannot duplicate or evade consequences.
- Available characters are switchable through keyboard/mouse and touch. Unavailable characters have a clear reason shown in the interface.
- Save/load preserves choices, pending decisions, clocks, character status, and resources.
- Both device classes can complete the same paths. Visual quality and control layout may differ; game rules do not.
- The creator completes two different outcomes and can explain the time/resource trade-off without reading a design document.
- Performance is measured on named physical reference devices; no unsupported claim of universal phone compatibility.

## 5. Proposed milestones and dependency order

Do not assign calendar dates yet. Estimate creator review hours separately from implementation effort, record uncertainty, and recalibrate after the first completed implementation milestone. Size work to fit review sessions within the 5–10 hour weekly capacity.

| Milestone | Outcome | Exit evidence | Depends on |
| --- | --- | --- | --- |
| M0 — Design and feasibility decisions | Approve the episode boundary, timeline rules, device targets, asset approach, and build/deploy approach | Compact approved brief; provisional ADRs; open-decision register; executable M1 backlog | Creator review |
| M1 — End-to-end prototype | Two placeholder roles, one small 3D scene/cockpit transition, one shared time consequence, switching, touch input, save/load | Playable build; timeline invariant tests; desktop/mobile measurements; one recorded playthrough | M0 |
| M2 — Planet episode | Add the scientific problem, mission trade-offs, dialogue consequences, alternative outcome, and basic adaptive audio | Complete proposed episode; two outcome playtests; asset inventory; understandable time feedback | M1 experience validated |
| M3 — Single-player public release candidate | Make the episode reliable, accessible, and ready for public play | Device/browser results, performance evidence, save compatibility, Pages deployment check, content completeness | M2 |
| M4 — Campaign expansion | Add further characters, scenes, spacecraft operations, and outcomes in bounded episodes | Each episode preserves established history and passes regression/playtest gates | M3; prioritisation review |
| M5 — Live co-op | Friends own different characters in one authoritative shared campaign | Agreed player count; infrastructure decision; ownership/waiting policy; measured two-client consistency, reconnect, and failure recovery | M3 and a focused networking feasibility spike; M4 completion not required |

M5 is committed but not yet scheduled or funded. Its design constraints enter M0; its implementation does not block proving single-player. If zero-cost infrastructure cannot meet the agreed co-op target, present the concrete trade-off for a creator decision. Do not mark the capability delivered based only on an architecture diagram.

## 6. Core design contracts the plan must settle

### 6.1 Time, switching, and causality

Define these separately: real elapsed player time; simulation/reference time in the selected model; each character's proper time; and narrative event order. A reference clock is a computational convention, not a claim of absolute simultaneity in relativity.

Recommended design: one committed event history, bounded automatic actions for uncontrolled characters, and decision barriers. When an unresolved decision could change downstream events, prevent committing dependent future events until it is resolved. Decide whether to block all simulation or only affected events; explain the experience using a worked example. A UI pause must not be misrepresented as a physical stopping of time.

Specify availability for dead, incapacitated, unreachable, occupied, and future-event-blocked characters. Define whether safety-critical piloting can be handed to an assist when switching; do not silently disable the confirmed switching feature. Define what a character knows separately from what the player has seen through another character. Avoid instantaneous in-world information transfer unless the fiction explicitly supports it.

Address pending decisions, message delivery, resource consumption during unattended intervals, scientific task duration, death, failure recovery, checkpoints, browser suspension, and save/reload. Recommend explicit checkpoint loading for alternate outcomes; ordinary switching must not rewrite committed history. Confirm whether real-world absence advances simulation rather than assuming it.

### 6.2 Physics and presentation

Use established physics within documented validity ranges. Distinguish:

- Physical model: equations, units, reference frames, constants, initial conditions, valid domains, and expected numerical errors.
- Gameplay assistance: stabilisation, autopilot, targeting, accelerated travel, and explanatory UI.
- Rendering approximation: what the player sees and how its accuracy was assessed.
- Speculative premise: wormholes or other unestablished phenomena, explicitly identified.

Do not apply a stationary-observer time-dilation formula to an orbiting character without justification. Do not combine gravitational and velocity factors blindly. Validate scenario parameters and any claimed extreme ratio before tying them to a real or film planet. The earlier draft's Schwarzschild/Kerr claim must be checked with its missing observer/orbit conditions restored.

Prefer validated precomputed tables or bounded numerical models where they preserve required accuracy and reduce runtime cost. Never present an arbitrary cinematic multiplier as a derived physical result. For lensing, use the original research as a reference [S4], not a mandate to reproduce its cinema renderer in real time.

Define what must be simulated continuously and what can be resolved analytically between decision points. Use local scene coordinates unless a measured requirement justifies astronomical-scale rendering. Do not mandate every advanced rendering technique before benchmarking.

### 6.3 Architecture and multiplayer evolution

Recommended boundary: authored content and presentation submit commands to a game-domain layer; that layer validates actions and produces authoritative state changes/events. Rendering, audio, touch controls, and dialogue presentation consume state instead of independently mutating it.

Persist stable character/entity IDs, content/schema versions, selected role, clocks, shared facts, per-character knowledge, resources, pending decisions, and any random seed needed for reproducibility. For saves, propose snapshots with a bounded event history; do not require an enterprise event-sourcing framework.

For future co-op, define session authority, character ownership, simultaneous inputs, shared choices, waiting at decision barriers, join/leave, reconnect, and campaign save ownership. Single-player decision pauses cannot automatically become fair multiplayer pauses. Produce a separate co-op policy for approval.

Do not assume deterministic cross-device rigid-body physics. Evaluate authoritative state snapshots and reconciliation rather than relying on identical GPU/frame timing or floating-point execution. Keep networking as a later adapter; do not build a distributed simulation framework in M1.

### 6.4 Mobile, saves, audio, and hosting

Choose reference devices before promising performance. Proposed initial budgets for evaluation: 30 FPS on the nominated phone at reduced quality and 60 FPS on the nominated desktop at its agreed quality; at most 15 MB compressed initial transfer and 75 MB for the first complete episode. These numbers are targets to challenge and confirm, not measured results. Define resolution, percentile frame time, cold-cache conditions, and network profile for testing.

Plan large touch targets, readable subtitles, safe areas, orientation behaviour, input alternatives, adaptive resolution, texture budgets, loading feedback, context-loss recovery, and lifecycle pause/resume. Do not make critical information depend on hover, colour alone, or precise multi-finger control.

Recommend local versioned saves with export/import for the static first release. Local storage can be lost; do not promise cross-device sync. Ask about save slots and checkpoint/death policy before implementing them. Handle corrupt and incompatible saves without silently discarding progress.

Audio begins after a user gesture. Include music/SFX, volume controls, captions for critical sounds, and a small adaptive state model. Full dialogue voiceover is a proposal to defer, not an assumed requirement.

Build for the repository subpath on GitHub Pages, including asset URLs and refresh behaviour. Do not expose secrets in client bundles. Avoid runtime paid AI calls; recommend authored dialogue and NPC rules for predictable cost, testing, and narrative continuity. An offline/service-worker mode, analytics, and accounts are open choices, not default scope.

## 7. Open decisions — ask only when they block the next work

| Decision | Needed before |
| --- | --- |
| Actual playable character pair, planet, and narrative starting point | Episode beat sheet and film-specific content |
| Definition of RPG progression: relationships/knowledge/skills/equipment and persistence | Progression implementation; do not assume combat, XP, levels, or classes |
| Specific reference phones, desktop hardware, browser versions, and access to devices | Performance acceptance and public compatibility claim |
| Approval or revision of proposed episode size and performance/download budgets | M1 backlog baseline |
| Exact waiting, knowledge, switching, background-time, and checkpoint rules | Timeline implementation |
| Repository name/visibility and development workflow | Repository setup and GitHub changes |
| Co-op player count, authority/host behaviour, ownership, pause and disconnect rules | Networking feasibility spike |
| Hosting support beyond Pages for live co-op and any acceptable cost ceiling | Multiplayer implementation |
| Audio/voiceover level, localisation scope, and content authoring process | Relevant content milestone |

Ask the smallest batch needed for the current phase. Record the rest as open, with an owner and the milestone they block. Do not restart the discovery interview or infer consent from an unanswered question.

---

## 8. Prompt A — Claude Code: challenge and produce the plan

Copy the following prompt after placing this pack in `docs/PROJECT_BRIEF.md`:

```text
Act as a game designer, technical architect, and critical planning partner. This session is for planning only. Read docs/PROJECT_BRIEF.md completely, including the confirmed decisions, critique, proposed scope, design contracts, open decisions, and sources. Inspect existing repository instructions and relevant files before proposing changes. Treat any older kickoff draft as a reference to challenge, not an authority.

Your objective is an executable plan for the confirmed Interstellar browser RPG. Preserve the creator's ambition and distinguish it from the first episode. Preserve mobile support, freely switchable characters, and future live co-op; do not assume a paid budget.

OPERATING RULES
1. Use planning mode if available. Do not write game code, deploy a site, or create GitHub objects in this session. Planning files are authorised.
2. Use AskUserQuestion or the client's available multiple-choice pop-up tool for material unresolved product decisions. Ask at most three focused questions per batch, with a recommendation and trade-off where useful. Never claim a pop-up was shown if unavailable; explain the limitation and ask concisely in text.
3. Do not re-ask C-01 through C-15. Distinguish Confirmed, Proposed, Open, and Validated. The proposed episode, technical choices, budgets, and milestone order are not yet approved.
4. Challenge contradictions explicitly. Give the smallest viable alternative and its impact rather than quietly changing requirements. Resolve ordinary implementation details yourself once architecture is approved.
5. Verify current tooling/hosting facts against official documentation and scientific claims against primary references. Record sources, applicability, and date checked. Do not fabricate benchmarks, API support, device results, estimates, or physics validation.
6. Prioritise proving connected character consequences and mobile usability. Evaluate graphics and networking only to the depth needed for the next milestone. No obligatory engine bake-off or catalogue of every possible framework.
7. No specialist, paid service, runtime LLM API, analytics, accounts, or multiplayer backend is implicitly authorised by this brief.
8. Read repository instructions. Do not overwrite unrelated work. No git push, public release, issue publication, or PR creation until the relevant action has been authorised. Reuse existing authorisation rather than repeatedly asking.

FIRST RESPONSE
Summarise the confirmed direction in no more than ten bullets. Identify at most five highest-impact conflicts or missing decisions, distinguishing actual blockers from later choices. Ask only the next blocking questions through pop-ups, then continue planning with the answers.

DELIVERABLES
Produce compact, linked files with one authoritative home per requirement:
- docs/DECISIONS.md: confirmed/proposed/open/validated decisions, rationale, owner, approval evidence, blocking milestone, and superseded decisions.
- docs/VISION.md: target player, emotional objective, four gameplay pillars, full-product boundary, first-episode boundary, and how to judge the experience.
- docs/PRD.md: stable FR/NFR IDs, priority, release, acceptance criteria, C-ID traceability, explicit exclusions, device/performance targets, accessibility, persistence, and failure behaviour.
- docs/GDD.md: proposed character pair and scene beats, player verbs, core loop, relationships/progression, authored decisions, reconverging branches, meaningful alternative outcomes, death/checkpoints, and a content-volume estimate.
- docs/TIMELINES.md: clocks, causal event rules, switching/availability, inactive actions, decision barriers, message/knowledge rules, worked examples, invariants, save behaviour, and separate single-player/co-op policies.
- docs/PHYSICS.md: source-backed model inventory, equations and units where selected, domain of validity, numeric reference fixtures, tolerances, rendering approximations, control assists, and speculative elements. Flag the old draft's unsupported claims for verification.
- docs/ARCHITECTURE.md and docs/adr/: component boundaries, content schemas, state/command/event interfaces, persistence, input adapters, physics/presentation boundary, build/deployment, performance strategy, and future authority/ownership. Compare only plausible engine/content-tool candidates and keep untested choices provisional.
- docs/CONTENT_AND_ASSETS.md: narrative/audio/visual requirements, asset inventory, consistent art direction, animation needs, and the minimum practical adaptive audio design.
- docs/VALIDATION.md: test strategy, browser/device matrix, manual playtest protocol, physical-model validation, cross-character invariants, touch controls, performance measurement, and required release evidence.
- docs/ROADMAP.md: milestone goals, dependencies, exit gates, deliverables, explicit uncertainty, and creator review effort separated from implementation estimates. No invented release dates.
- docs/TRACEABILITY.md: C IDs -> FR/NFR IDs -> milestone -> issue keys -> validation evidence. Avoid duplicating requirement text.
- planning/issues.yaml: detailed issues for the next executable milestone only, with later milestones represented as epics/proposed features. Include plan_version and stable keys.
- AGENTS.md and CLAUDE.md: concise shared implementation/review rules with links to canonical docs; do not maintain conflicting instruction copies. Preserve existing instructions where present.

Keep these files proportionate. A document earns its place by resolving a decision or enabling implementation; avoid repeated prose and fake completeness.

BACKLOG SCHEMA
Each implementation issue must have: stable key, title, type, area, priority, milestone key, epic key, requirement IDs, rationale, bounded scope, explicit exclusions, dependency keys, proposed interfaces/contracts, acceptance criteria, validation approach, required devices/evidence where relevant, size, creator review effort, decision blockers, and readiness status.
Use ready only when dependencies and product decisions are resolved. Define statuses draft/blocked/ready/in-progress/review/done consistently. Do not encode implementation readiness by title alone.
Tasks should yield one coherent reviewable PR. Prefer a half-day to two days of human-equivalent implementation as a planning heuristic, never a prediction of AI runtime. Split oversized work by a demonstrable behaviour or interface. Spike tasks need a time budget, question, evidence, and decision output.
For later milestones use epics with boundaries and exit criteria; do not fabricate hundreds of speculative child tickets.

REQUIRED WALKTHROUGHS
1. Additional time spent on the planet changes an orbiting character's state.
2. Repeated switching cannot evade cost or reveal facts to a character without an in-world cause.
3. An unattended decision blocks dependent history without contradicting time already committed elsewhere.
4. Save/reload at a pending decision reproduces state without duplicate effects.
5. A major death changes available characters and future outcomes consistently.
6. Mobile and desktop complete the same authored choice sequence with equivalent game-domain outcomes.
7. Two future co-op players issue conflicting actions or one disconnects; define authority and expected behaviour without implementing networking now.

WORKFLOW
A. Inspect repository and brief; resolve only immediate blockers.
B. Draft vision, first episode, timeline rules, and decision register. Obtain creative review before expanding major narrative details.
C. Draft requirements, architecture, physics validation approach, content plan, validation, and roadmap. Keep unvalidated feasibility claims explicit.
D. Produce the next-milestone backlog and verify requirement coverage, missing dependencies, cycles, duplicate scope, conflicting interfaces, and mobile/co-op constraints.
E. Present the proposed approval baseline: exact file list, plan version, open blockers, milestone gates, detailed issue count, earliest playable outcome, and critical trade-offs. Do not publish issues or start implementation.

Begin by inspecting the repository and reading the brief. If the brief is missing, request it instead of reconstructing decisions from memory.
```

## 9. Prompt B — Opus in Claude Code: audit and publish GitHub work

Use after reviewing the planning files. If you have not authorised publication yet, run this prompt for a dry run and approve its concrete proposed changes.

```text
Act as backlog auditor and GitHub delivery coordinator. Read repository instructions, docs/PROJECT_BRIEF.md, docs/DECISIONS.md, docs/PRD.md, docs/ROADMAP.md, docs/TRACEABILITY.md, relevant contracts, and planning/issues.yaml. Do not redesign the game, invent scope, or implement game code.

1. Confirm repository identity from the actual remote and current branch. Verify GitHub authentication/access without printing credentials. Verify supported CLI/API operations against current official documentation; do not assume a particular token scope or subscription tier is universally required.
2. Identify the exact approved plan version. If no approval baseline exists, audit and prepare the dry run, then request approval of that baseline before publishing. If publication for this baseline and repository is already authorised, proceed without asking again.
3. Audit issue keys, schema, FR/NFR references, milestone/epic mappings, decision blockers, dependency existence/cycles, task sizes, testable criteria, interface consistency, and next-milestone readiness. Detailed issues must not quietly turn proposed product choices into decisions. Fix clerical problems; send material product conflicts back to the creator.
4. Propose a minimal label taxonomy by type, area, priority, and readiness. Reuse compatible existing labels. Do not introduce redundant label systems or a paid GitHub feature dependency.
5. Produce a reviewable dry-run manifest listing creates, updates, unchanged objects, conflicts, and total counts. Include documentation commits/PRs only when those writes are within the authorised scope. No deletion, closure of existing work, reassignment of people, or overwrite of human-authored descriptions by default.

IDEMPOTENT PUBLICATION
- Use stable local keys such as EPIC-TIMELINE and TIME-001. Embed an invisible marker in created bodies, for example <!-- project-issue-key: TIME-001 -->.
- Discover existing objects across all states with pagination. Use markers and the mapping manifest, not just fuzzy title search. Closed duplicates require review; do not silently reopen them.
- Create/update labels and milestones, then epics, then detailed issues. Resolve number references only after actual creation.
- Use native sub-issue and blocking relationships where the available API supports them. Otherwise write explicit linked parent/dependency sections and report the fallback; task-list text alone is not a verified native relationship.
- Persist planning/github-map.json after each successful mutation: repository identity, plan version, stable key, actual number/URL, and managed-content hash. This is a publication record, not a second requirements source.
- On partial failure, keep the successful mappings, report failed operations, and resume without creating duplicates. Pace requests and respect rate-limit responses.
- Update only explicitly managed content. Preserve human comments, descriptions, assignments, and unrelated metadata. Surface drift instead of silently overwriting it.
- Use structured body arguments or exact UTF-8 body files to preserve Markdown/newlines. Never interpolate untrusted issue prose into shell commands.

PUBLISHING ORDER AND VERIFICATION
Publish the approved milestone structure and epics, then the detailed next-milestone tasks. Verify returned IDs, counts, milestone membership, labels, parent/dependency relationships, and rendered acceptance criteria. Do not mark tasks ready until their actual prerequisites are satisfied.
If documentation publication is authorised, commit on an appropriate branch and open a documentation PR. Handle an empty repository explicitly; do not assume a default branch already exists. No automatic merge or public game deployment.

Finish with links to actual created/updated objects, counts, unresolved failures/blockers, plan version, and the next ready Codex task. Never report a dry run as published work.
```

### Example of a bounded implementation issue

This is an illustration of issue quality, not an approved ticket or a physical model for any film planet.

**Key:** TIME-EXAMPLE-001  
**Title:** Advance character clocks once per committed simulation step  
**Status:** Draft; depends on approval of the timeline contract and a domain-state test harness  
**Scope:** Pure clock/state logic with a synthetic fixed-ratio fixture. No rendering, general-relativity solver, dialogue content, or multiplayer transport.

**Acceptance criteria:**

- Given a synthetic fixture where the reference/orbiter elapsed time is ten times the planet character's elapsed time, advancing the planet character by 60 simulated seconds advances reference/orbiter time by 600 seconds.
- This ratio is explicitly labelled test-only and has no claimed astrophysical validity.
- Applying the same command ID again does not apply its clock/resource changes twice.
- A switch command changes the controlled character but not elapsed clocks or resources.
- Persisting/restoring the state preserves clock values, processed-command semantics, and a pending decision.
- Attempts to advance past a blocking decision return the documented blocked result without partially committing dependent changes.

**Validation:** independent expected-value fixture, duplicate-command case, switch-invariance case, and save/restore case; tolerances and time representation follow the approved contract. Tests must check behavioural invariants, not copy the implementation formula into assertions.

## 10. Prompt C — Codex: implement one ready issue

Supply the actual issue URL when starting a task.

```text
Implement GitHub issue: <ISSUE_URL>

Read AGENTS.md, relevant repository instructions, the issue and its comments, its parent/dependencies, docs/DECISIONS.md, the approved FR/NFR entries, and the referenced architecture/timeline contracts. Use the current repository and issue state, not an old chat summary.

Before editing:
- Verify the issue is ready, dependencies are actually integrated, and no existing branch/PR already implements the same work.
- Identify the approved plan version and acceptance criteria. If a material product decision is missing or contradictory, do useful inspection first and ask the smallest blocking question using pop-ups if available. Do not invent a gameplay rule.
- Summarise the implementation boundary, affected contracts, and validation approach briefly.

Implement the smallest complete change satisfying the issue. Use an isolated branch/worktree where appropriate and preserve unrelated work. No unrelated refactoring, new paid service, runtime AI dependency, analytics, or architecture replacement. Treat product scope changes as explicit proposals.

Preserve these project invariants:
1. Same game-domain rules and consequences on desktop/mobile; only presentation/input quality may differ.
2. Character switching cannot evade elapsed-time/resource costs or rewrite committed outcomes.
3. Per-character knowledge, authority, availability, and shared history follow the approved contracts.
4. Saves preserve pending decisions and versioned state without duplicate side effects.
5. Domain state is independent of UI/renderer mutations and remains adaptable to later co-op authority.
6. Scientific approximations and synthetic fixtures are labelled; no unsupported accuracy claims.

Validate according to the issue and repository gates. Use meaningful domain tests for clock/causality/save behaviour; run appropriate build, type/lint, integration, and interaction checks. For visible/touch changes, inspect the actual interface and provide reproducible steps plus screenshots or a short recording where supported. Distinguish emulator results from physical-device results. If a required device is unavailable, report the remaining gate instead of claiming it passed.

Do not broaden tests or scope without a concrete reason. Do not change expected results merely to silence a failure. Update the canonical documentation only where behaviour or contracts actually changed.

If PR publication is authorised, open a focused draft PR linking the issue; otherwise leave the completed local change and review summary. Do not merge, close the issue, release publicly, or deploy outside the authorised workflow.

Handoff: explain what changed and why; map each acceptance criterion to evidence; list tests run and their actual results; identify limitations; give review/playtest steps; state any follow-up issue needed. Do not label the task complete if a required acceptance gate remains unmet.
```

## 11. Integration and review rules

- Start with one active implementation issue. Increase concurrent work only when tasks have stable interfaces and independent dependencies, and the creator explicitly chooses parallel execution.
- A PR is not accepted because it compiles. It must satisfy its acceptance criteria, integrate with the current branch, and pass relevant playtesting.
- The creator approves major narrative, scientific, visual, multiplayer, and release trade-offs. An AI review can check code and requirement coverage but cannot substitute for the creator experiencing the game.
- Run a complete episode after changes to shared clocks, choices, save formats, or resource rules. Re-run the affected mobile path after input/rendering changes.
- Merge before starting dependent tickets. Update the issue/requirement evidence and roadmap status after integration, not when a code agent merely finishes its turn.
- Re-estimate after M1 using actual review effort, defects, device results, and usable gameplay delivered. Protect the 5–10 hour weekly review capacity rather than maximising generated code.
- Keep milestone demonstrations available through the chosen workflow, distinguishing local/review builds from publicly released content.

## 12. Source notes

Checked 18 October 2026. These sources support specific constraints; they do not validate the proposed game's performance or physical scenario. Verify tool/library capabilities again during architecture selection.

- **[S1]** GitHub Docs, [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) — static hosting and plan availability.
- **[S2]** GitHub Docs, [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) — published site size, bandwidth, and deployment constraints.
- **[S3]** GitHub Docs, [Creating issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies) and [Quickstart for GitHub Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/quickstart) — dependency and sub-issue concepts; confirm available automation endpoints at execution time.
- **[S4]** James, von Tunzelmann, Franklin, and Thorne, [Gravitational Lensing by Spinning Black Holes in Astrophysics, and in the Movie Interstellar](https://arxiv.org/abs/1502.03808), Classical and Quantum Gravity 32 (2015) — primary reference for Kerr lensing and the film renderer; not evidence that its cinema method meets mobile browser performance budgets.
- **Original material reviewed:** `interstellar-rpg-kickoff-prompt.md`, supplied by the creator. Its useful structure is retained, while its unsupported product decisions are superseded by section 2.

No repository, GitHub issue, milestone, PR, game build, or public deployment has been created by preparing this pack.
