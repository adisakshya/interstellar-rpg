# M1 evidence

Files in this folder: `frame-time-desktop.json`, `frame-time-iphone-emulated.json` (from `scripts/frame-time.mjs`).
Slice evidence is in [../slice-001/](../slice-001/README.md), and the earlier spike in [../../spikes/SPIKE-001.md](../../spikes/SPIKE-001.md).

## M1 exit criteria (ROADMAP)

| Criterion | Status | Where |
| --- | --- | --- |
| Playable Pages build | **Not yet.** The build is green and the deploy job exists, but GitHub Pages is not enabled for the repository, so the deploy fails. Needs the creator (Settings → Pages → Source: GitHub Actions). CI-001 (#15) stays open until the live URL loads. | `.github/workflows/deploy.yml` |
| Invariant tests green | **Done.** Every INV-01 to INV-16 has at least one test that names it, including INV-12 (death is permanent; only a checkpoint removes it), added here. | `tests/**` |
| Walkthroughs 1, 2, 4, 6 automated | **Done.** Run in CI as the `e2e` job, in desktop Chromium by keyboard and in emulated iPhone Chromium by touch. | `tests/e2e/slice.spec.ts`, `tests/golden/` |
| Desktop and iPhone 16e measurements | **Tool done; physical numbers outstanding.** Emulated results are below. The iPhone 16e run from SPIKE-001 is the remaining gate. | `scripts/frame-time.mjs` |
| One creator playthrough recording | **Outstanding** (creator). Protocol: VALIDATION §5. | — |

### Walkthroughs

| | What the automated run proves |
| --- | --- |
| W1 | The same lift-off after *Stay longer* costs Romilly 7 to 8 more years and over 7 more units of supplies than after *Leave now*. |
| W2 | Switching to Romilly and back 100 times leaves the state identical apart from who is controlled; Cooper's beacon fact is in `playerSeen` and Cooper's knowledge but never in Romilly's. |
| W4 | After a reload at the pending wave warning the state hash is equal and the decision is still pending. Resolving it commits once, resending the same id returns `Duplicate`, a new id returns `DECISION_ALREADY_RESOLVED`, and loading the checkpoint brings it back as pending. |
| W6 | Both input methods reach the recorded final state hash for each path. The same hash is also produced in Node by replaying the recorded command log (`tests/golden/slice.json`), so browser and Node agree (INV-15, NFR-01). |

The hash is taken over the state without the random command ids. Real-time free-roam is frozen (`?debug&frozen`) so
that a scripted run issues exactly the commands it sends and nothing else. Free-roam itself is covered by unit tests.

### Frame time (emulated, 60 s after a 10 s warm-up, holding a movement key)

Headless Chromium with software GL (SwiftShader) on a Linux container. **Emulated: this is not a device measurement
and says nothing about an iPhone.** It shows the capture tool works and that the scenes hold a steady refresh on a
machine with no GPU.

| Run | Tier | Viewport (DPR) | Scene | Frames | p50 | p95 | p99 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop | high | 1280×720 (1) | Surface | 2443 | 16.7 ms | 33.4 ms | 50.0 ms |
| Desktop | high | 1280×720 (1) | Endurance | 3564 | 16.7 ms | 16.8 ms | 16.8 ms |
| iPhone 13 viewport | low | 390×664 (3) | Surface | 3587 | 16.7 ms | 16.8 ms | 16.8 ms |
| iPhone 13 viewport | low | 390×664 (3) | Endurance | 3600 | 16.7 ms | 16.7 ms | 16.8 ms |

The `high` surface scene has the only tail above one frame (transparent water at full resolution on software GL); the
`low` tier, which is what a phone starts on, does not.

## Remaining before M1 can close

1. Enable GitHub Pages, then confirm the live URL loads (CI-001, #15).
2. Run `/interstellar-rpg/spike/` and `scripts/frame-time.mjs` on the iPhone 16e and record the numbers (SPIKE-001, #14); retune the quality tiers and adaptive thresholds if they disagree with the desktop-derived values.
3. One creator playthrough of both paths on the phone and on desktop, with the two questions in VALIDATION §5.
4. WebKit itself has not been run: the mobile project is Chromium with an iPhone viewport. Add a WebKit project when the CI runner can install it.
