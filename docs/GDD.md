# Game Design: Episode 1, Miller's Planet

Status: **Draft, proceeding on creator's standing go-ahead** (DOCS-004, #10). Every duration and amount below is a **placeholder** for M1 tuning. Rates come from [PHYSICS.md](PHYSICS.md) §4; rules from [TIMELINES.md](TIMELINES.md). Working title "The Cost of Staying" (P-01).

## 1. The core idea in one line

**Whose time do you spend?** One minute of Cooper's time on Miller is **42 days** for Romilly and Earth. One year of Romilly's time aboard Endurance is only **8.7 minutes** of Cooper's. The player can push work to whoever's time is cheaper, but someone always pays.

## 2. Core loop and verbs

1. **Look** at what you know, what it costs and who is waiting (HUD clocks for everyone: TIMELINES §6).
2. **Act** as the controlled character: walk, scan, search, pilot. Free-roam on Miller costs Cooper's time in real time (D-11); timed activities cost a stated amount up front.
3. **Switch** for free to the other character, whose situation has moved on by however much time you just spent.
4. **Share or hold** knowledge: a fact only crosses between characters as a message (INV-08).
5. **Decide** at decision points; hard decisions stop the clock until you choose (D-10).

Verbs: `walk`, `look`, `scan`, `search`, `talk`, `send message`, `pilot (assisted)`, `switch`, `decide`, `rest/hibernate`.

## 3. Cast and places (M1)

| Id | Who | Role in M1 |
| --- | --- | --- |
| `char.cooper` | Cooper | **Playable**: pilot, on the surface |
| `char.romilly` | Romilly | **Playable**: on Endurance, alone |
| `char.brand` | Brand | NPC (playable in M2): wants Miller's data |
| `char.doyle` | Doyle | NPC: can live or die |
| `char.murph` | Murph | M2 only, on Earth, through messages |

Places: `loc.endurance` (rate 1), `loc.ranger` (transit routes), `loc.miller_surface` and its sub-area `loc.miller_wreck` (rate 1.6546×10⁻⁵), `loc.earth_farm` (M2, rate 1.0153).

## 4. Beat sheet (M1)

> **As built (SLICE-001):** the playable slice covers B3, B4, B7, B8, B10 and B12 in simplified form (scan, search, the
> choice at the wave, lift-off, outcome). See [evidence/slice-001/README.md](evidence/slice-001/README.md) for what was
> kept, what was cut and why. The table below is the full M1 target.


| # | Controlling | What happens | Decision | Clock impact (placeholder) | What persists |
| --- | --- | --- | --- | --- | --- |
| B1 | Cooper | Ranger cockpit above Miller; brief on fuel, Romilly's supplies, wave risk | **`decision.descent`**: *direct* (12 min, heavy fuel) or *efficient* (25 min, light fuel) | Transit table, tuned | `res.ranger_fuel` |
| B2 | Cooper | Assisted landing in knee-deep water (locked sequence) | — | Part of the route | — |
| B3 | Cooper | Walk to Miller's beacon; Brand and Doyle follow | — | Free-roam, about 6 min Cooper ≈ 8.3 months Romilly | — |
| B4 | Cooper | Scan the beacon (10 min) | — | ≈ 1.15 yr Romilly | `fact.beacon_active`, `fact.beacon_local_age` (its signal is only hours old locally) |
| B5 | Cooper | Brand finds the wreck and urges searching it for the flight recorder | **`decision.recorder`** (checkpoint): *search* (20 min, interruptible; Brand trust +1) or *leave now* (Brand trust −1) | Search ≈ 2.3 yr Romilly | `trust.cooper_brand`, recorder progress |
| B6 | Cooper (optional) | Send the beacon readings to Romilly | **`decision.share_data`**: send or not | Message only | Romilly can start the analysis (B8) |
| B7 | Cooper | Mountains on the horizon are waves; 10 min warning | **`decision.recall`** (hard, checkpoint): *run now* or *finish the search* (see §5) | Stops time until chosen | Doyle alive or dead; flood delay |
| B8 | Romilly | Endurance: years have passed. If the data arrived, run the tidal analysis (3 months of Romilly ≈ 2.2 min of Cooper) | Start the analysis or not | Romilly's time, Endurance supplies | `fact.romilly_tidal_analysis` |
| B9 | Romilly | Supplies run low on long paths | **`decision.hibernate`** (hard, checkpoint): *hibernate* (stops aging and almost all use; he can't be switched to until docking) or *stay awake* (can act; supplies keep falling) | — | Romilly's state and age |
| B10 | Cooper | Ascent and docking (assisted) | — | Transit table | Fuel left |
| B11 | Both | Reunion: Romilly says how long he waited; Earth messages are queued (M2: Murph) | — | — | `fact.elapsed_years_on_return` |
| B12 | — | Outcome screen: who lived how long, what is known and how confidently, fuel and supplies left | — | — | Episode result |

**If the Ranger is lost** (Cooper dies and Brand can't return): Romilly gets **`decision.wait_or_leave`**: wait (supplies keep falling) or take Endurance on alone. The story continues (D-09).

## 5. How the outcomes come about (all deterministic)

`decision.recall` resolves from your choice plus how far the search got (`p`):

| Choice | Search progress `p` | Result |
| --- | --- | --- |
| Run now | any | Back in the Ranger before the wave. Recorder recovered only if `p = 100%`. |
| Finish the search | `p ≥ 75%` | Recorder recovered; caught by the edge of the wave. **Doyle dies** reaching the Ranger, and flooded engines add **60 min** of Cooper time (≈ 6.9 yr). |
| Finish the search | `p < 75%` | Recorder not reached. Same wave result as above. |
| Any, with `trust.cooper_brand ≤ −1` | — | Brand lingers 2 more minutes before obeying. That can turn *run now* into a wave hit. |

If Cooper himself is outside the Ranger when the wave arrives, he dies (TIMELINES W5) and Brand flies the Ranger back (NPC autopilot). Romilly becomes the only playable character.

**Outcome states differ in game state, not just text:**

| Outcome | `T` on return (approx.) | Doyle | Miller viability known as | Romilly | Ranger fuel |
| --- | --- | --- | --- | --- | --- |
| Quick in, quick out | ≈ 6–7 yr | Alive | "Uncertain", or "likely not viable" if Romilly ran the analysis | Awake | High |
| The recorder | ≈ 8–10 yr | Alive | **"Not viable" (confirmed)** | Awake | Medium |
| Caught by the wave | ≈ 15–23 yr | **Dead** | Confirmed, or uncertain if the recorder wasn't reached | Hibernating, or awake and low on supplies | Low |
| Ranger lost | — | Per the path | Per the path | Waits or leaves alone | — |

## 6. The scientific problem

**Question:** is Miller's planet viable? Evidence raises a confidence value shown to the player as words, never a number to optimise.

| Evidence | Gained by | Confidence it adds | Cost |
| --- | --- | --- | --- |
| `fact.beacon_active` | Beacon scan (B4) | Low; it *looks* promising | 10 min Cooper |
| `fact.beacon_local_age` | Same scan; the player must notice the signal is only hours old locally | Medium; Miller landed "just now" in local time | — |
| `fact.romilly_tidal_analysis` | B6 + B8 | Medium; "tidally locked, shallow ocean, periodic waves" | Romilly's months and supplies |
| `fact.miller_died_on_landing` | Flight recorder (B5) | High; confirms the planet is not viable | 20 min Cooper |

The twist is the film's own: the beacon looks good *because* almost no time has passed on Miller. The player can work that out from `fact.beacon_local_age` alone, which is cheap, or buy certainty with time.

## 7. Progression (D-03) and staging (**Proposed P-02**)

| Type | What it is | M1 | Later |
| --- | --- | --- | --- |
| Knowledge/evidence | Facts per character plus a confidence level per open question; carried across episodes | **Yes** (§6) | Feeds which planet to choose (M4) |
| Resources | Ranger fuel, Endurance supplies; carried across episodes | **Yes** | Equipment upgrades (M4) |
| Relationships/trust | Per pair, −2 to +2; changes how NPCs act (e.g. Brand lingering) and which dialogue options appear | **Minimal**: `trust.cooper_brand`, `trust.cooper_romilly` | Deeper in M2 (Brand playable, Murph's messages) |
| Skills | Per-character tiers (piloting, analysis) that shorten activities or unlock assists; earned at episode end | No | **M2** |
| Equipment | Modules for the Ranger and Endurance (better sensors mean shorter scans) | No | **M4** |

## 8. Death, checkpoints and saves

- Checkpoints at `decision.recorder`, `decision.recall` and `decision.hibernate`: exactly the three D-08 allows.
- Deaths are permanent (D-09): Doyle on the wave path, and Cooper if he is caught outside. Only loading a checkpoint undoes them.
- The failure ending happens only if no playable character can continue. In M1 Romilly can always continue unless content adds a way for him to die. Any such way needs a prior hard decision (INV-11).

## 9. Content ids for CONT-001

```
characters: char.cooper char.romilly char.brand char.doyle (char.murph M2)
locations:  loc.endurance loc.ranger loc.miller_surface loc.miller_wreck (loc.earth_farm M2)
routes:     route.descent_direct route.descent_efficient route.ascent
resources:  res.ranger_fuel res.endurance_supplies
decisions:  decision.descent decision.recorder decision.share_data decision.recall decision.hibernate decision.wait_or_leave
facts:      fact.beacon_active fact.beacon_local_age fact.romilly_tidal_analysis fact.miller_died_on_landing fact.elapsed_years_on_return
hazards:    hazard.wave_1
trust:      trust.cooper_brand trust.cooper_romilly
```

## 10. Content volume estimate

| | M1 (cinematic look, simple geometry: ART_DIRECTION) | M2 additions |
| --- | --- | --- |
| Beats | 12 | ~8 (Brand's surface beats, Murph's Earth scene) |
| Decisions | 6 | ~3 |
| Facts | 5 | ~4 |
| Dialogue lines | ~120–180, original wording in the film's voice (D-20) | ~200–250 |
| Scenes | 3 (cockpit, surface, Endurance) | +1 (Earth farmhouse) |
| Audio | the time tick only (FR-21) | music states, SFX, captions |

M1's vertical slice (SLICE-001) uses B1, B3–B8 and B12 with the "run now" and "finish the search" branches. B6 (sending the beacon readings) is in the slice because Romilly's analysis in B8 needs those readings delivered in-world first (INV-08). The rest of the table lands in M2.
