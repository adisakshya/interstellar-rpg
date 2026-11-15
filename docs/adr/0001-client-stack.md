# ADR-001: Client stack — Babylon.js + TypeScript + Vite

Status: **Accepted** (creator D-04) · performance budget **provisional** until SPIKE-001 (#14) reports.

## Context
The game needs a browser 3D engine that runs on iPhone 15/16e Safari (D-06) and desktop, deploys as static files to GitHub Pages (C-13), and can be developed mainly by AI agents with creator review (C-12).

## Decision
Babylon.js (`@babylonjs/core`, ES-module imports only) on WebGL2, written in strict TypeScript, bundled by Vite. No engine bake-off.

## Consequences
- Tree-shaken imports are required to stay within the proposed ≤15 MB initial download (P-03). SPIKE-001 measures the real size and frame times on the iPhone 16e and either confirms this ADR or reopens it.
- WebGPU is optional, never required: iOS Safari support cannot be assumed.
- Babylon is confined to `src/render` (ARCHITECTURE §2), so a renderer change would not touch game rules.
