# PERF-001 evidence

Headless Chromium (software GL), production build, `perfrun.mjs` (run: `node perfrun.cjs dist <out-dir>`); output in `run.json`.

| Acceptance | Result |
| --- | --- |
| Free-roam advances in real time | T grew from 60 436 s to 241 746 s over 3.6 s: one 1 s tick per second, ~17 h of T each on Miller |
| Time waits for an open prompt | `decision.descent` opens on the first tick; T did not move for 2.5 s while it was open, then play resumed once answered |
| Backgrounding does not advance the simulation | With `visibilitychange: hidden`, T was identical 3.5 s apart; the HUD showed "Paused"; resuming advanced T again |
| Autosave on hidden | An `autosave` slot appeared with the same T as the state at the moment of hiding |
| Context loss recovers without losing state | `WEBGL_lose_context.loseContext()` froze T and showed "Paused"; `restoreContext()` rebuilt the surface scene (new scene object), T did not move during the loss, and play resumed. `after-restore.png` shows the rebuilt scene |
| Foreground autosave | About 2 s after the last commit the autosave held the current T, with no hidden tab involved |
| Reload resumes | Reloading restored that T exactly (`?fresh` ignores the autosave) |

Manual steps for a phone: open the game, lock the screen for 30 s, unlock. Time passed overall must be unchanged and
"Paused" should clear. Then switch apps and return.

Caveat: the adaptive-resolution thresholds (22 ms down, 14 ms up) and `low`/`high` tiers are desktop-derived. They
should be retuned when the physical iPhone 16e results for SPIKE-001 arrive.
