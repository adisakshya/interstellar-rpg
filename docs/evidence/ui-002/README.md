# UI-002 evidence: compact HUD on phones

Screens narrower than 40 rem, and short touch screens (landscape phones), get a compact HUD: panel headings stay for screen
readers but are not drawn, the character roster becomes a row of chips, and padding and type shrink. The decision prompt keeps
its visible heading and full-size options. Wider screens are unchanged. Before this change the HUD covered about 60% of an
iPhone 13 portrait view; now about 35%.

- `phone-hud.png`: the opening view.
- `phone-wave-prompt.png`: the wave decision with a story line docked above it.

Noted for a later pass: the decision title and option labels are derived from ids ("Recall", "Leave now"); authored labels
belong in content (STORY-001b).

Creator review pending (D-24).
