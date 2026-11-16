# PLAY-001 evidence: the world matters

Before: you could walk, but nothing depended on where you stood; Scan worked from anywhere, so the world was scenery.

Now an interaction can name a landmark ("near": "beacon" | "wreck" | "ranger"). The scene knows where each landmark is
(`src/render/landmarks.ts`); an action tied to one is only offered, and the Act key only works, within reach of it.
Until then the HUD says where to go and how far ("Walk to the beacon · 32 m"), a pale beam marks the place, and when you
arrive the goal goes and the E prompt appears.

- `desktop-goal.png`, `phone-goal.png`: at the start, 32 m from the beacon.
- `desktop-arrived.png`, `phone-arrived.png`: at the beacon; the action is offered.

Walking costs the game's real currency: every second of wading is a second of Cooper's time, about 0.7 days for Romilly, and
the tick counts it. The three Miller actions now send you across the plain: the beacon (scan), the wreck (search), the
Ranger (lift off). Scenes without a position (Endurance, the cockpit) offer everything, as before.

Tests: gating rules, landmark distances (reachable, not already there at the start), an e2e on desktop and phone that
pressing E at the start does nothing, the goal is shown, and arriving makes the action work. The scripted e2e runs use a
test-hook step that walks to the objective in one go.

Creator review pending (D-24): distances, reach and the beam's look are tuning choices.
