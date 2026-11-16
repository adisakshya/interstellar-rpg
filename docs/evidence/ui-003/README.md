# UI-003 evidence: a HUD that gets out of the way

Before: three heavy boxed panels with drawn all-caps headings, a chunky Action box, an empty "Story log" bar, and the
on-screen thumb pad drawn on desktop. It read as a debug overlay and, on a phone, hid Gargantua.

After (`hud-desktop.png`, `hud-phone.png`):
- Glass panels (blur, 1 px edge), headings kept for screen readers but not drawn.
- Wide screens: the roster is a row of chips; the offered action is a prompt at the bottom of the view with the E key drawn
  on it. Touch controls appear only on touch devices.
- Phones: only a slim time and roster strip at the top, so the sky and the horizon show; the action prompt sits just above
  the thumbs.
- Between story scenes the log is a small chip, not an empty bar.
- Also: the Ranger now faces the crew, so its lit window is seen.

All 365 unit tests and all 14 e2e tests (desktop keyboard and emulated iPhone touch) pass. Creator review pending (D-24).
