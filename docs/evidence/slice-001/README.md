# SLICE-001 evidence

`playthrough.mjs` plays the slice twice in headless Chromium against the production build: with the keyboard on a
desktop viewport, and by touch on an iPhone 13 viewport. Results are in `playthrough.json`, screenshots beside it.
`saverun.mjs` checks the corrupt-save path (a bad autosave is quarantined, the player is told, and the original can be
saved as a file).

## The slice as built

| Step | What the player does | Time cost |
| --- | --- | --- |
| 1 | Scan the beacon (Interact) | 10 min for Cooper, about 1.1 years for Romilly |
| 2 | Search the surface (Interact); the wave warning stops it at the hard deadline | 20 min planned, cut short at the deadline |
| 3 | **Choose at the wave:** *Leave now* or *Stay longer* | Leave: nothing. Stay: 65 min more for Cooper, about 7.5 years more for Romilly |
| 4 | Lift off and dock (Interact) | 30 min for Cooper, about 3.4 years for Romilly |
| 5 | Outcome screen, with a way back to the wave to choose again | |

Romilly can be switched to at any time. His own action is "Wait a month": a month on Endurance is under a minute on Miller.
Every action shows its cost for you and for each character you have met before you commit.

| | Leave now | Stay longer |
| --- | --- | --- |
| Cooper lived | 50 min | 1 h 51 min to 1 h 55 min |
| Romilly lived | 5.8 years | 12.8 to 13.3 years |
| Doyle | alive (not yet met) | dead in the wave, clock stopped at 20 min |
| Flight recorder | left behind | recovered (Cooper knows Miller died on landing) |
| Endurance supplies left | 24.2 | 16.7 to 17.2 |

The range comes from real-time free-roam ticks between key presses. The unit test plays the same commands without any
free-roam and gets exactly the same state both times.

## Where this differs from `issues.yaml` and GDD §4

- **Starts on Miller after landing.** Cockpit inspection and landing are not in the slice: there is no location-change
  effect yet, and the Ranger has no clock rate, so no character can start there. Both scenes exist and render.
- **No `decision.descent`, `decision.recorder` or `decision.share_data`.** The recorder is recovered by the choice at the
  wave (*Stay longer*). Sending data to Romilly needs the message UI and is left for later. `decision.docking` is kept
  only as the wake fallback for a hibernating Romilly (content rule, TIMELINES §4): the episode ends when Cooper lifts
  off, before it triggers.
- **Ending by fact.** The episode ends when Cooper learns `fact.lifted_off`; the outcome notes are content.
- **New domain pieces:** a `SpendTime` choice effect (a choice can cost its owner time through the ordinary clock
  rules), a `cause` for deaths, and the dead no longer age.
- **New content rules:** INV-11 (a playable character's supplies need a hard decision tied to them), and no single
  choice may kill every playable character.
- **Replay is the checkpoint ring.** "Go back to Recall and choose differently" restores the automatic checkpoint taken
  when the wave warning became pending, the only rewind the rules allow.
