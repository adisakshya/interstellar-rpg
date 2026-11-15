# ADR-005: HUD and dialogs as a DOM overlay, not Babylon GUI

Status: **Accepted** for M1.

## Context
The HUD must show reasons for unavailable characters to screen readers, respect safe areas and text scaling on iPhone, be fully keyboard- and touch-operable, and be testable (UI-001).

## Decision
HTML/CSS elements layered over the Babylon canvas render the switcher, clocks, decision prompts, dialogs and touch controls. They read engine state through `subscribe` and send commands through `app`.

## Consequences
- Accessibility, focus handling and responsive layout come from the browser for free, and Playwright can assert on real elements.
- In-world 3D labels (if any) stay in Babylon. Anything the player must read to make a decision lives in the DOM.
