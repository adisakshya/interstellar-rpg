# Roadmap

Status: plan version 0.4.0 (M1 scope revised, D-19) · M0 gate passed 2026-11-15 (see DECISIONS) · No calendar dates until M1 has been completed and measured (brief §5). Issues: [planning/issues.yaml](../planning/issues.yaml). Decisions: [DECISIONS.md](DECISIONS.md).

## Milestones

| Milestone | Goal | Exit gate (evidence) | Depends on | State |
| --- | --- | --- | --- | --- |
| **M0** Design and feasibility | Approved contracts and a ready M1 backlog | TIMELINES, PHYSICS, ARCHITECTURE + ADRs, VISION + GDD, PRD + VALIDATION, COOP_POLICY merged; SPIKE-001 report; M1 issues ready or explicitly blocked | — | **Gate passed** for docs; SPIKE-001 (#14) still open and carried into M1 |
| **M1** End-to-end story slice | Cooper (surface) and Romilly (orbit) play all 12 M1 beats with dialogue, in the cinematic look ([ART_DIRECTION](ART_DIRECTION.md)): cockpit and assisted landing, Brand and Doyle, Gargantua in the sky, the visible wave, heavy gravity, the time tick, switching, saves, touch | Playable Pages build; INV tests green; walkthroughs 1, 2, 4, 6 automated; art direction and the Miller scene signed off by the creator; desktop + iPhone 16e measurements; one creator playthrough recording | M0 | **Reopened with revised scope (D-19)**. Done: mechanics, saves, input, HUD, tests, Pages. To do: the work below |
| **M2** Miller's planet episode | Full GDD beat sheet, Brand and Murph playable, Earth farmhouse, physically simulated assisted flight, music and SFX with captions, codex, art polish pass | Two outcome playtests; asset inventory; creator can explain the time cost unaided | M1 validated | Epic only |
| **M3** Public release candidate | Reliable, accessible, public | VALIDATION §7 evidence | M2 | Epic only |
| **M4** Campaign expansion | More episodes | Each episode passes regression + playtest | M3 | Epic only |
| **M5** Live co-op | Two players, one shared campaign | COOP_POLICY rules measured with two clients | M3 + networking spike | Epic only |

## M1 remaining work (revised scope, D-19)

The mechanics path (SETUP-001 to QA-001) is done. What remains, in order:

```
ART-001 mood board + Miller lighting test ── creator sign-off ──┐
FAN-001 title screen + fan notice                               │
GARG-001 offline Gargantua render ──────────────────────────────┤
CHAR-001 suited figures ────────────────────────────────────────┤
MOVE-001 heavy gravity ─────────────────────────────────────────┼─ SCENE-002 Miller dressed ── creator sign-off ──┬─ SCENE-003 cockpit + assisted landing/ascent
STORY-001 12 beats + dialogue (creator review) ─────────────────┤                                                 ├─ SCENE-004 Endurance + time passed
WAVE-001 the wave as a real event ──────────────────────────────┘                                                 └─ AUDIO-001 the tick
                                                                                                    all ── QA-002 evidence refresh + creator playthrough
```

Open gates that need the creator: SPIKE-001 (iPhone 16e numbers), the two art sign-offs, the dialogue review, the
playthrough.

## Effort (planning heuristic, not a forecast)

| Bucket | M1 estimate | Basis |
| --- | --- | --- |
| Revised M1 work (D-19) | 12 issues: 4 S, 5 M, 3 L of human-equivalent effort, about 8 h of creator review (two art sign-offs, the dialogue review, the playthrough) | issues.yaml `size` |
| Implementation (original M1) | 16 issues: 1 S (≤ ½ day), 11 M (≤ 1 day), 4 L (≤ 2 days) of human-equivalent effort | issues.yaml `size` |
| Creator review (original M1 backlog) | ≈ 14 h, **historical**: those issues are done (per-issue `review_effort`) | issues.yaml |
| Creator review (revised M1 work, D-19) | ≈ 8.25 h of `review_effort` across the 12 new issues | issues.yaml |
| Creator review (whole of M1) | ≈ 22.25 h | sum of the two rows above |
| At 5–10 h/week of creator time | The **remaining** M1 review is about 1–2 weeks of creator time; the whole of M1 would have been about 2–4.5 weeks | C-12 |

Uncertainty is high: there is no throughput data yet. These numbers get re-estimated after M1 (brief §11).
