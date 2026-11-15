# Roadmap

Status: plan version 0.3.0 · M0 gate passed 2026-11-15 (see DECISIONS) · No calendar dates until M1 has been completed and measured (brief §5). Issues: [planning/issues.yaml](../planning/issues.yaml). Decisions: [DECISIONS.md](DECISIONS.md).

## Milestones

| Milestone | Goal | Exit gate (evidence) | Depends on | State |
| --- | --- | --- | --- | --- |
| **M0** Design and feasibility | Approved contracts and a ready M1 backlog | TIMELINES, PHYSICS, ARCHITECTURE + ADRs, VISION + GDD, PRD + VALIDATION, COOP_POLICY merged; SPIKE-001 report; M1 issues ready or explicitly blocked | — | **Gate passed** for docs; SPIKE-001 (#14) still open and carried into M1 |
| **M1** End-to-end prototype | Cooper (surface) and Romilly (orbit) slice with switching, saves, touch | Playable Pages build; INV tests green; walkthroughs 1, 2, 4, 6 automated; desktop + iPhone 16e measurements; one creator playthrough recording | M0 | **In progress**: SETUP-001 done (#38); CI-001, DOM-001, SPIKE-001 ready |
| **M2** Miller's planet episode | Full GDD beat sheet, Brand and Murph playable, audio, codex | Two outcome playtests; asset inventory; creator can explain the time cost unaided | M1 validated | Epic only |
| **M3** Public release candidate | Reliable, accessible, public | VALIDATION §7 evidence | M2 | Epic only |
| **M4** Campaign expansion | More episodes | Each episode passes regression + playtest | M3 | Epic only |
| **M5** Live co-op | Two players, one shared campaign | COOP_POLICY rules measured with two clients | M3 + networking spike | Epic only |

## M1 critical path

```
SETUP-001 #11 ─┬─ CI-001 #15 ─────────────────────────────────────────┐
               ├─ SPIKE-001 #14 ─┬─ SCENE-001 #19 ─ INPUT-001 #25 ─┐   │
               │                 └─ PERF-001 #26 ──────────────────┤   │
               └─ DOM-001 #16 ─ TIME-001 #17 ─┬─ TIME-002 #21 ─────┤   │
                                              ├─ TIME-003 #22 ─ UI-001 #28
                                              ├─ TIME-004 #23 ─────┤   │
                                              └─ RES-001 #24 ── SAVE-001 #27
                 CONT-001 #18 (needs DOM-001) ──────────────────── SLICE-001 #29 ─ QA-001 #30
```

SETUP-001 is done. **Ready now:** CI-001 (#15), DOM-001 (#16), SPIKE-001 (#14). The longest chain runs DOM-001 → TIME-001 → TIME-002/003 → UI-001 → SLICE-001 → QA-001.

**Next ready implementation task:** DOM-001 (#16), the domain core everything else depends on.

## Effort (planning heuristic, not a forecast)

| Bucket | M1 estimate | Basis |
| --- | --- | --- |
| Implementation | 16 issues: 1 S (≤ ½ day), 11 M (≤ 1 day), 4 L (≤ 2 days) of human-equivalent effort | issues.yaml `size` |
| Creator review | ≈ 14 h total across M1 (per-issue `review_effort`) | issues.yaml |
| At 5–10 h/week of creator time | M1 review spans **roughly 2–3 weeks of creator time** | C-12 |

Uncertainty is high: there is no throughput data yet. These numbers get re-estimated after M1 (brief §11).
