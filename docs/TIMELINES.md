# Timeline, Switching and Causality Contract

Status: **Approved** (DOCS-001, #7) · Plan version 0.2.0 · Decisions: [DECISIONS.md](DECISIONS.md)

This is the rulebook the game-domain code implements (DOM-001, TIME-001..004, RES-001, SAVE-001). Each rule is numbered `INV-xx` and can be tested on its own. The physical time ratios come from [PHYSICS.md](PHYSICS.md) (DOCS-002). Numbers below marked **placeholder** only illustrate the rules; they are not physics claims.

## 1. Clocks

| Clock | Symbol | What it is | Drives the simulation? |
| --- | --- | --- | --- |
| Real time | — | Wall-clock time the player spends | Only during active free-roam (§5). Never while away (D-07). |
| Reference time | `T` | One shared simulation coordinate: Endurance's proper time. It is a bookkeeping convention, not a claim that "now" is absolute in relativity. | Yes. All committed events are placed on `T`. |
| Proper time | `τ[c]` | The time character `c` has actually lived through | Derived: each advance of `T` advances every `τ[c]` by that character's location rate |
| Narrative order | `seq` | Order in which events were committed | Yes. A total order; ties on `T` are broken by `seq` |

**Location rate** `r(loc) = dτ/dT`. Endurance is `1` by definition. Miller's surface is `1.6546×10⁻⁵` (1 h there ≈ 6.89 years of Endurance time; derived in [PHYSICS.md](PHYSICS.md) §4, D-12). The worked examples below keep the round placeholder `1/61 362` for readability. Transit routes (e.g. Ranger descent) use precomputed `(ΔT, Δτ)` pairs from PHYSICS.md instead of a single rate.

**Arithmetic rule.** Domain time math uses only `+ − × ÷` on float64 seconds plus table lookups. No `Math.pow/exp/log/sin` in timeline code: JavaScript allows those to differ between engines, and identical results across devices (walkthrough 6) and in future co-op depend on it. Tolerance for equality: absolute 1e-6 s, relative 1e-12.

## 2. How time advances

There is one committed history and one `T`. Time moves forward only when the **controlled** character spends proper time:

1. A command gives the actor's proper-time duration `Δτ` (a timed activity, or a free-roam tick).
2. `ΔT = Δτ / r(loc_actor)`, or the transit table value.
3. Every other character's `τ` advances by `r(loc_c) × ΔT`. Their routines, resource use, message deliveries and decision triggers in `(T, T+ΔT]` are processed in `T` order.
4. All resulting events commit together, or none do.

So 1 hour of Cooper's time on Miller is ~7 years for Romilly, and 1 hour of Romilly's time aboard Endurance is ~0.06 s for Cooper. There is no per-character timeline, so no character is ever "ahead of" or "behind" another. That is why a "future-blocked" availability state is not needed.

**Uncontrolled characters** follow bounded routines authored in content (e.g. "run analyses", "hold position at Ranger"). They never make authored choices. When a routine reaches a decision point, the character switches to that decision's **hold** behaviour and waits. Waiting still costs resources, because time keeps passing for them.

## 3. Decisions and barriers

A decision has an owner character, options, a trigger time `T_trig`, a deadline `T_dead ≥ T_trig` (possibly ∞), and an optional `checkpoint` flag.

| Kind | Deadline | Effect while unresolved |
| --- | --- | --- |
| **Soft** | ∞ | The owner holds; events that depend on the outcome are not committed; `T` keeps moving |
| **Hard** | Finite | As soft, plus `T` cannot pass `T_dead` until it is resolved |

When an advance would pass an unresolved hard deadline:

- **Interruptible activity** (the default): it commits up to `T_dead` as `ActivityInterrupted` (progress kept), and the result is `Interrupted{decisionId}`. This is a complete, defined outcome, not a partial commit.
- **Atomic activity** (flagged in content, e.g. a docking burn): nothing commits, and the result is `Blocked{decisionId, T_dead}`. The blocking decision may then be resolved early, even if its trigger has not been reached yet, because the domain is deterministic and the decision can be forecast. An early `ResolveDecision` commits, in order, `DecisionPending`, then `CheckpointCreated` if the decision is flagged (the snapshot is taken before the choice), then `DecisionResolved`. So early resolution still gets its checkpoint (D-08), and the `Blocked` command itself still commits nothing.

*Confirmed as D-10. The alternative, stopping all time at every pending decision, would have made the cost of waiting invisible.*

## 4. Availability and switching

`SwitchCharacter` changes only who is controlled. It never costs time, never refunds anything and never reveals anything.

| State | Reason code shown in UI | Switchable | Ends when |
| --- | --- | --- | --- |
| Available | — | Yes | — |
| Not introduced | `NOT_INTRODUCED` | No | Story beat introduces them |
| Incapacitated | `HIBERNATING`, `INJURED`, `UNCONSCIOUS` | No | A content event (e.g. woken on docking) |
| Locked sequence | `LOCKED_SEQUENCE` | No (switching *away* is denied) | The scripted sequence ends |
| Dead | `DEAD` + cause | Never (D-09) | Only a checkpoint load |
| Controlled by another player | `CONTROLLED_BY_OTHER` | Co-op only | That player releases control |

**Piloting hand-off.** Switching away from a character who is flying hands control to the autopilot assist when the segment allows it. Segments that allow no assist are `LOCKED_SEQUENCE`, and are kept short.

**After a death**, control moves to the next available character after the death sequence. If none is available or recoverable, the failure ending plays.

**No one left to act.** If every surviving character is incapacitated, the earliest wake condition fires at once (e.g. the hibernation alarm wakes Romilly), so time is never stuck with no one in control. Content must give every incapacitation such a fallback (a CONT-001 validation rule).

## 5. Real time, pause and suspension (D-07)

- Real time advances the simulation **only** while the controlled character is in active free-roam: tab visible, no menu or modal, not paused.
- Free-roam is committed as `FreeRoamTick` commands in fixed quanta of 1 s of the actor's proper time × `timeScale` (content parameter, default 1.0, confirmed as D-11). The quanta do not depend on frame rate. On Miller one tick is ~17 hours of `T`, so wandering around costs Romilly days.
- Hidden tab, closed browser or phone lock: nothing advances, and an autosave is written on `visibilitychange: hidden`. The UI shows "Paused", never something like "time has stopped".
- WebGL context loss and renderer restarts never touch domain state.

## 6. Knowledge and messages

- Each fact has an id. `knownBy[c]` is what character `c` knows; `playerSeen` is what the player has seen through anyone.
- A fact enters `knownBy[c]` only through a committed in-world event: an observation, a conversation in the same place, or a delivered message.
- A character's dialogue options and decision options can only use facts in their own `knownBy`. The UI may mark facts the player knows but the controlled character does not ("You know this. Romilly doesn't."). Never offer such a fact as an action.
- A message is delivered at `T_deliver = T_send + latency(link)`. Links, their latency and whether they are currently up are content data. Light-time inside Gargantua's system is negligible; the Earth relay is a **speculative** element (flagged in PHYSICS.md).
- Each character knows their own elapsed time. They learn anyone else's only through messages or by meeting them. The HUD shows the player every clock; that is meta-knowledge, not character knowledge.

## 7. Resources

- Each resource has an owner (a ship, a suit or a person) and rates per unit of that owner's proper time: Romilly's life support follows Romilly's `τ`, the Ranger's systems follow the Ranger's `τ`.
- Rates are piecewise constant, so depletion times are computed analytically per advance, with no per-frame integration.
- **Unattended harm rule (INV-11):** if an unattended routine would kill or incapacitate a playable character (depletion, hazard), content must raise a hard decision for the player first. Nobody dies off-screen without the player being warned and given a choice.

## 8. Saves and checkpoints (D-08)

| Slot | Written when | Holds |
| --- | --- | --- |
| Autosave (1) | After each committed command (debounced ~2 s) and on `visibilitychange: hidden` | Full snapshot |
| Checkpoints (≤3) | Automatically, at the commit that makes a `checkpoint: true` decision pending, including the early-resolution path in §3. The oldest is dropped when a fourth arrives | Full snapshot |

- A snapshot contains: schema version, content version, `T`, every `τ[c]`, location, availability, resources, knowledge, pending decisions, the active-activity progress, processed command ids, the RNG seed, the controlled character, and a bounded tail of the event history (debugging only, not required to rebuild state).
- **Loading a checkpoint** is the only way to undo committed history. It asks for confirmation and replaces the autosave. Switching characters and reloading the page never rewind anything.
- Command ids are generated fresh per player action (UUID), so ids from a timeline abandoned by a checkpoint load never collide with new ones.
- Export and import of saves, and handling of corrupt or incompatible saves, are covered in SAVE-001. A bad save is never silently discarded.

## 9. Commands, events, results

| Command | Purpose |
| --- | --- |
| `AdvanceTime{commandId, actorId, activityId, Δτ}` | Controlled actor spends proper time on an activity |
| `FreeRoamTick{commandId, actorId, Δτ}` | Real-time free-roam quantum (§5) |
| `StartTransit{commandId, actorIds, routeId}` | Travel along a precomputed route |
| `SwitchCharacter{commandId, targetId}` | Change control (session state only, not history) |
| `ResolveDecision{commandId, decisionId, optionId}` | Choose an option |
| `SendMessage{commandId, fromId, toId, factIds}` | In-world message |
| `LoadCheckpoint{checkpointId}` | Meta command: replaces state, not part of history |

Events: `ClockAdvanced`, `ActivityCompleted`, `ActivityInterrupted`, `FactLearned`, `MessageSent`, `MessageDelivered`, `ResourceChanged`, `ResourceDepleted`, `DecisionPending`, `DecisionResolved`, `AvailabilityChanged`, `CharacterDied`, `CheckpointCreated`.

Results: `Ok`, `Interrupted{decisionId}`, `Blocked{decisionId, T_dead}`, `Duplicate` (no-op), and `Rejected{code}` with code `CHARACTER_UNAVAILABLE{reason}`, `NOT_CONTROLLED`, `LOCKED_SEQUENCE`, `DECISION_ALREADY_RESOLVED` or `INVALID`.

## 10. Invariants

| ID | Rule |
| --- | --- |
| INV-01 | One committed history: `seq` strictly increases, and `T` never decreases along `seq` |
| INV-02 | Every `τ[c]` never decreases. Per event, `Δτ[c] = r(loc_c) × ΔT` (or the transit table value) within tolerance |
| INV-03 | `SwitchCharacter` changes only the controlled character: no clock, resource, knowledge, availability or history change, for any sequence of switches |
| INV-04 | A command whose id is among the last 1 024 processed ids ([ADR-002](adr/0002-domain-command-event-model.md)) produces no events and returns `Duplicate` |
| INV-05 | A `Blocked` or `Rejected` command commits nothing |
| INV-06 | `T` never passes the deadline of an unresolved hard decision |
| INV-07 | An event that depends on a pending decision is not committed until that decision resolves |
| INV-08 | A fact enters `knownBy[c]` only via a committed in-world event; options shown for `c` use only `knownBy[c]` |
| INV-09 | A message is learned by the receiver at `T_deliver ≥ T_send + latency`, never earlier |
| INV-10 | Resources accrue on their owner's proper time and are never refunded by switching or reloading |
| INV-11 | Before an unattended event kills or incapacitates a playable character, a hard decision is raised |
| INV-12 | A death is permanent in committed history; only a checkpoint load removes it |
| INV-13 | Real time advances the simulation only during active free-roam (§5) |
| INV-14 | Save → load gives a state with an identical hash, and any command sequence after the reload gives the same result as without it |
| INV-15 | The same command log gives an identical state hash on every device and engine |
| INV-16 | A decision is resolved at most once; a later resolve with a new id returns `DECISION_ALREADY_RESOLVED` |

## 11. Worked examples

Shared **placeholder** fixture (synthetic; replace with DOCS-002 values): `r(Miller) = 1/61 362` (1 h ⇒ 7.00 yr), `r(Endurance) = 1`. Endurance supplies start at 30 units; awake Romilly uses 1 unit per year of his `τ`. Decision **D_hib** "Romilly: hibernate?" is hard, `checkpoint: true`, triggers when supplies reach 10 and has its deadline at 5. Transit is omitted: Cooper is already on the surface at `T = 0`.

### W1. Extra time on the planet changes Romilly's state

| Step | Command | Cooper `τ` | `T` = Romilly `τ` | Supplies | Notes |
| --- | --- | --- | --- | --- | --- |
| 0 | — | 0 | 0 | 30 | Landed |
| A1 | `AdvanceTime(scan beacon, 1 h)` | 1 h | 7.0 yr | 23 | Path A: leave now |
| B1 | `AdvanceTime(scan + refine, 3 h)` | 3 h | 21.0 yr | 9 | Path B: D_hib triggered at T = 20 yr, now pending; checkpoint created |

Same choice, different cost: 2 more hours of Cooper's time cost Romilly 14 years and put him one step from a hibernation decision.

### W2. Switching cannot dodge costs or leak facts

At A1 Cooper learns fact `F_beacon_age` ("the beacon has only been active for hours of local time"). Run `SwitchCharacter(Romilly)` and then `SwitchCharacter(Cooper)` 100 times. The state hash, apart from `controlled`, is identical (INV-03). `F_beacon_age ∈ playerSeen` but `∉ knownBy[Romilly]`. Romilly's options never include it until Cooper sends it, the message is delivered and `MessageDelivered` commits (INV-08, INV-09).

### W3. An unattended decision blocks dependent history without contradiction

From step 0 the player orders a 4 h interruptible survey:

| Step | Event | `T` | Cooper `τ` | Supplies |
| --- | --- | --- | --- | --- |
| C1 | `DecisionPending(D_hib)` | 20.0 yr | 2 h 51 m 26 s | 10 |
| C2 | Deadline reached → `ActivityInterrupted(survey, 89.3%)` | 25.0 yr | 3 h 34 m 17 s | 5 |

The result is `Interrupted{D_hib}`, and `T` is held at 25 yr (INV-06). Everything already committed stands: Romilly really did wait 25 years. The player switches (free), and Romilly resolves "hibernate". Romilly becomes `HIBERNATING` and unswitchable, and his consumption drops. Only now can the survey continue. If the survey had been `atomic`, the command would have returned `Blocked` with nothing committed (INV-05), and the player could resolve D_hib early. That resolve commits `DecisionPending` and the D_hib checkpoint before `DecisionResolved`.

### W4. Save and reload at a pending decision

At B1 (D_hib pending) the autosave holds the snapshot. The player reloads the page: state hash equal (INV-14), D_hib still pending. `ResolveDecision(cmd-77, stay awake)` commits once. Resending `cmd-77` returns `Duplicate`. A new `ResolveDecision(cmd-78, hibernate)` returns `DECISION_ALREADY_RESOLVED` (INV-04, INV-16). Loading the B1 checkpoint, after confirmation, brings D_hib back as pending so a different choice can be tried.

### W5. A major death changes availability and outcomes

On Miller, wave arrivals are content data placed on Cooper's `τ` (**placeholder**), each announced 10 min of his time in advance. If the controlled Cooper is still in a wave's path when it arrives, the wave commits `CharacterDied(Cooper, wave)`. This is a hazard to the controlled character, so INV-11 does not apply, but the warning is mandatory content. Cooper becomes `DEAD` and the switcher shows "Dead: killed by a tidal wave on Miller's planet". Control moves to Romilly. Story beats that require Cooper alive drop out of the eligible set. Content must always leave at least one path or a failure ending (a CONT-001 validation rule). An autosave cannot undo this; only a checkpoint can (INV-12).

### W6. Mobile and desktop reach the same outcome

Keyboard/mouse and touch adapters each emit the same command log for the authored sequence `land → scan 1 h → switch → send F_beacon_age → depart`. Replaying that log in Playwright on desktop Chromium and on iOS-class WebKit emulation gives identical final state hashes (INV-15). Free-roam ticks are fixed quanta, so frame rate cannot change outcomes.

### W7. Co-op conflict and disconnect (draft constraints for DOCS-006)

- **One authority** (a host) orders every command and owns `T` and the save. Clients send commands and receive committed events.
- **The core co-op problem:** characters at different rates cannot both free-roam in real time. One real second for Cooper on Miller is ~17 hours for Romilly. Co-op therefore needs a *time-driver* rule: one player's actions drive `T` at a time, and the others see a time-skip summary, then take their turn. Which rule to use is open (M5).
- **Conflicts:** two commands that both advance `T` are serialised by the host in arrival order. The second is re-validated against the new state and may come back `Blocked` or `Interrupted`.
- **Disconnect:** the character becomes uncontrolled (routine, then hold), and nothing is ever auto-decided. A hard deadline owned by the absent player stops `T` for everyone. Whether to wait, time out or hand the decision to another player is a creator decision for M5.

## 12. Out of scope here

The ratio values and validity ranges (PHYSICS.md), TypeScript interfaces and save format details (ARCHITECTURE.md / ADR-003), which decisions exist and what they lead to (GDD.md), and the HUD design (UI-001).
