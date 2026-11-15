# Co-op Policy (draft)

Status: **Draft, proceeding on creator's standing go-ahead** (DOCS-006, #13). Every choice here is **Proposed** (P-08 to P-11) until approved. This is a design for M5; **no networking is built before then.** Constraints that M1 code must already respect are in [ADR-004](adr/0004-future-authority-model.md).

## 1. The problem co-op has to solve

The game has one shared clock (TIMELINES §2), and characters at different places age at very different rates (PHYSICS §4). If Cooper on Miller walks for one real second, about 17 hours pass for Romilly. Two players cannot both explore freely in real time when their characters live on different clocks (TIMELINES W7). Every rule below follows from that.

## 2. Proposed rules

| ID | Rule | Why |
| --- | --- | --- |
| P-08 | **2 players** for the first co-op release, each owning one playable character. Up to 4 later if it plays well. | Two is the episode's natural pair (Cooper/Romilly, later Brand/Murph), and it halves the testing. |
| P-09 | **Host authority**: one player's browser runs the `GameEngine`. The other connects peer-to-peer (WebRTC) through a signalling relay. The host owns the save. | Pages can't run a server (C-13). Peer-to-peer needs only a small relay; which relay, and its cost, is an open decision for M5. |
| P-10 | **Time-driver turns**: at any moment one player is the *driver*, and only the driver's actions move the shared clock. The other player sees a live summary of what that time does to their character, and can still talk, read and plan. The driver changes when the driver *yields*, when they reach a decision owned by the other player, or after a set amount of real time. Neither player can be fast-forwarded through a decision of their own. | It is the only rule that is fair to both players and still honours one clock. |
| P-11 | **Disconnect**: the absent player's character becomes uncontrolled (routine, then hold, exactly as in single-player) and **nothing is decided on their behalf**. A hard decision they own pauses the shared clock for **5 minutes** of real time. After that, the host may take it over or end the session at the last autosave. On reconnect, the player gets their character back. | It reuses TIMELINES rules and never makes a choice the player didn't make. |

## 3. Conflicting actions (walkthrough 7)

1. Both players send commands that move time in the same instant. The host queues them in the order they arrive. Only the driver's command is valid; the other is `Rejected{NOT_DRIVER}`, and the client shows "Waiting for Cooper's turn".
2. The driver's command changes state, for example by raising a decision for the other player. Any queued command is re-checked against the new state and can come back `Blocked` or `Interrupted`, the same as in single-player.
3. Shared choices (a decision both characters care about) belong to one owner. The other player can only *propose* an option, as a message. There is no voting in v1.

## 4. Saves and joining

- Only the host's saves are authoritative. The guest receives a copy of each checkpoint so they can host next time.
- A guest joins at a checkpoint the host chooses. They never join mid-command.
- Single-player and co-op saves use the same format (ADR-003), with an added `owners` map.

## 5. Open for the creator (M5)

The relay service and any cost ceiling; the length of a driver turn; whether to allow more than 2 players; whether asynchronous "play-by-message" co-op is ever wanted. That last one is **not** a substitute for live co-op (brief §3).
