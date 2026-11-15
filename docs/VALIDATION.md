# Validation Plan

Status: **Draft, proceeding on creator's standing go-ahead** (DOCS-005, #12). Requirements: [PRD.md](PRD.md). Results go in `docs/evidence/` per milestone.

## 1. Device and browser matrix

| Tier | Device | Browser | Status |
| --- | --- | --- | --- |
| Phone (reference) | **iPhone 16e** | Safari on the current iOS release | Confirmed (D-06) |
| Phone (in scope) | iPhone 15 or newer | Safari on the current iOS release and the previous major one | Confirmed (D-06) |
| Desktop (reference) | Apple-silicon Mac (M1 or newer) **or** a Windows laptop with integrated graphics from 2021 or later | Latest stable Chrome and Safari (Mac) / Chrome and Edge (Windows) | **Proposed P-12** |
| Desktop (smoke) | Same | Latest stable Firefox | **Proposed P-12** |
| Android | — | — | **Untested; no claim** (D-06) |

Emulated results (Playwright mobile emulation, WebKit) are always labelled *emulated*. Only physical-device runs count for NFR-02 and NFR-03 at M3.

## 2. Automated checks (CI, every PR)

| Check | Covers | From |
| --- | --- | --- |
| ESLint (including import boundaries), Prettier, `tsc --noEmit` | ARCHITECTURE §2 | SETUP-001 |
| Vitest unit tests, named by `INV-xx` | INV-01 to INV-16 | DOM-001, TIME-*, RES-001, SAVE-001 |
| fast-check property tests | INV-03 (switching), INV-14 (save round-trip) | TIME-003, SAVE-001 |
| `python3 docs/physics/kerr_fixtures.py --check` | NFR-07 | SETUP-001 |
| Golden command-log replay → state hash in Node | NFR-01 | QA-001 |
| Playwright: both slice paths in desktop Chromium and emulated iPhone WebKit, with equal final hashes | W6, NFR-01 | QA-001 |
| `vite build` bundle-size report | NFR-03 (tracking only until M3) | SETUP-001 |

## 3. Performance measurement (NFR-02, NFR-03)

- **Frame time:** a 60-second scripted fly-through of each scene, after a 10-second warm-up. Report p50/p95/p99 frame time from `performance.now()` deltas, at the device's native resolution with the tier's hardware scaling.
- **Download:** cold cache, Chrome DevTools "Fast 4G" profile. Report bytes transferred, compressed, until the first rendered frame and until the episode is fully loaded.
- **Memory:** Safari Web Inspector timeline on the iPhone; no tab reload during a full run.
- Record the device, OS, browser version, tier and build hash with every number.

## 4. Accessibility checks (NFR-04)

Keyboard-only full run; VoiceOver on iPhone reads the switcher, unavailable reasons and decision prompts; a grayscale screenshot pass for colour-only information; touch-target audit at 44 CSS px; text at 200% browser zoom without loss of controls.

## 5. Manual playtest protocol (each milestone)

1. Creator plays both slice paths on the iPhone 16e and on desktop, recording the screen.
2. Afterwards, without looking at docs, they answer: "What did your time on the surface cost Romilly?" and "Why couldn't you avoid it by switching?" (VISION success criteria 1 and 3).
3. Log defects as issues with steps to reproduce; mark each run *physical* or *emulated*.

## 6. Physics validation

Covered by `kerr_fixtures.py` (two methods, 60-digit arithmetic, `--check`) and PHYSICS §3 reference points. Spot-checking the two unfetched citations (P1, P2) is a creator or reviewer task before M3.

## 7. Release evidence (M3 gate)

`docs/evidence/M3.md` with: device matrix results (physical), NFR-02/03 numbers against the approved budgets, the accessibility checklist, a save-compatibility test from the M2 to the M3 schema, a Pages deployment check (subpath, refresh, size limits re-checked against current GitHub docs), and the creator's playtest answers.
