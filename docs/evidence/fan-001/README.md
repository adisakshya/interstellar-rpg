# FAN-001 evidence: title screen, fan-project notice, credits

- `desktop-title.png`, `phone-title.png`: the first screen. The notice is visible before play starts (D-21). The world stays
  visible behind it; the HUD and subtitles are hidden so they cannot show through the text.
- `desktop-credits.png`, `phone-credits.png`: the credits, generated from `docs/ASSETS.md` (first table, files under
  `public/`), with the notice repeated.
- `desktop-after.png`, `phone-after.png`: after New game.

Behaviour: Continue / New game (New game asks once before replacing a saved game); skipped for an explicit new game
(`?fresh`) and for the test hook (`?debug`). The story and free-roam wait while the title is open. A test checks that every
file in `public/` has a ledger row, so nothing ships uncredited.

Creator review pending (D-24): the name line, tagline and notice wording are creative and legal-tone choices.
