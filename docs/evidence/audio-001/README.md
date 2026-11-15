# AUDIO-001 evidence: the time tick

One tick per day of Romilly's time (D-18), made in code (no sound files, so nothing to credit or download).

- **Interval from the simulation:** `86 400 s x r(here) / r(Romilly)`; on Miller about 1.43 s of Cooper's time. A unit test
  checks it is within 1% of `86 400 s x r(Miller)`. Measured in a real browser run (`?debug`, free-roam running): 6 pulses with
  gaps 1.34 to 1.58 s, mean about 1.45 s.
- **Silent while Romilly is controlled** (a day passes in a day), and whenever the game is held (prompt, subtitle, title,
  hidden tab).
- **Skipped time:** a scan (10 min, about 420 days for Romilly) plays a fast, rising run of up to 24 ticks and announces
  "420 days passed for Romilly" through the live region.
- **Without sound:** a small dot in the Time panel pulses with every tick (`phone-hud.png`, `desktop-hud.png`); the Sound
  switch (on/off, remembered) sits beside it. Browsers only allow sound after a gesture, so sound starts at the first click
  or key press (the title screen's button); the beat and the dot run before that.

Creator review pending (D-24): the click's timbre, pitch and loudness are creative choices; please listen on real speakers.
