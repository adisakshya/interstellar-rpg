# SPIKE-001: Babylon.js mobile feasibility

Status: **Emulated half done; physical iPhone 16e run pending (creator).** Issue #14 · Budgets: P-03 (proposed) · Stack: ADR-001 · Raw numbers: [SPIKE-001.raw.json](SPIKE-001.raw.json)

**Question.** Can a small terrain, a water plane, a capsule character and a cockpit interior meet the P-03 budgets: ≥30 FPS p95 on the iPhone 16e, ≥60 FPS p95 on desktop, and ≤15 MB compressed before the first frame?

## 1. What was built

- `spike/`: a measurement page built and deployed with the app, at `/interstellar-rpg/spike/`. It runs two scenes:
  - **surface** (default): a 200×200 m terrain with 128×128 subdivisions, a 400×400 m transparent water plane, a capsule character on a scripted walk, six distant "wave" blocks and a follow camera.
  - **cockpit** (`?view=cockpit`): an enclosed room, 12 emissive panels, a window and a first-person camera.
- **Input:** a touch joystick (bottom left) moves the character or turns the pilot's view.
- **Measurement window:** frame times are recorded after a 10 s warm-up for 60 s, per VALIDATION §3. At the end the page shows its results as JSON on screen.
- **Parameters:** `warmup`, `measure`, `view` and `scaling` (device pixels per rendered pixel). The default is 1.5 on screens with a device pixel ratio above 2, else 1.
- `spike/measure.mjs`:
  - **Bundles:** builds the page twice, once with deep imports (the project rule) and once importing all of `@babylonjs/core`. It then gzips and brotli-compresses every shipped file.
  - **Emulated runs:** drives headless Chromium through both scenes in a desktop and an iPhone-sized profile, with ten joystick taps per phone run.

## 2. Results

### Bundle size (measured; valid anywhere)

| Build | Raw | gzip -9 | brotli | Share of the 15 MB P-03 budget |
| --- | --- | --- | --- | --- |
| Deep ES-module imports (project rule) | 1.58 MB | **0.37 MB** | **0.30 MB** | 2.5% |
| Whole `@babylonjs/core` | 7.37 MB | 1.67 MB | 1.25 MB | 11% |

Deep imports are **4.2–4.5× smaller**. Engine code is not the risk to NFR-03; textures, meshes and audio will be.

### Frame time, input latency and memory (EMULATED: not valid for NFR-02)

All measurements ran in Chromium 1.56 (Playwright), headless, with WebGL rendered on the CPU by SwiftShader. They used a 4-core Intel Xeon at 2.1 GHz with no GPU, 10 s warm-up and 60 s of measurement.

| Profile | View | Render size | Frames | p50 ms | p95 ms | p99 ms | p95 FPS | Input → frame, median / max ms | JS heap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop 1280×800, DPR 1 | surface | 1280×800 | 635 | 93.9 | 113.3 | 124.0 | 8.8 | — | 9.5 MB |
| Desktop 1280×800, DPR 1 | cockpit | 1280×800 | 1094 | 54.1 | 67.2 | 73.7 | 14.9 | — | 9.5 MB |
| iPhone 15 viewport, DPR 3, scaling 1.5 | surface | 786×1318 | 938 | 63.3 | 77.6 | 83.0 | 12.9 | 159 / 272 | 10.1 MB |
| iPhone 15 viewport, DPR 3, scaling 1.5 | cockpit | 786×1318 | 1242 | 47.9 | 60.2 | 64.0 | 16.6 | 144 / 224 | 9.5 MB |

**What these numbers do and do not say.**
- **Not GPU performance.** SwiftShader rasterises on the CPU, so these are not the GPU's frame times and cannot pass or fail NFR-02 for a phone or for desktop. The phone profile is Chromium using an iPhone-sized viewport, not WebKit, and not an iPhone.
- **Relative costs are informative.**
  - The surface scene costs about 1.3–1.7× the cockpit, and the cost tracks pixels: the full-screen transparent water plane plus terrain overdraw.
  - First frames appeared within 16–24 ms of start-up.
  - The JS heap is about 10 MB for either scene.
- **Input latency is CPU-side only.** It is measured from the pointer event to the end of the first frame that shows the move, and it is 2–3 frames at these emulated frame times. A real display adds scan-out.

## 3. Recommendation

1. **Keep ADR-001 (Babylon.js + TS + Vite) and deep imports.** Size is confirmed with a large margin: about 0.3 MB of engine code against 15 MB.
2. **The frame-rate budget stays provisional.** NFR-02 can only be settled on the physical iPhone 16e and a desktop GPU (§4). Until then, SCENE-001 should assume the phone is fill-rate bound:
   - Ship a `low` tier with scaling 1.5 or higher on 3× screens.
   - Avoid full-screen alpha-blended water on `low`: use opaque water with a fresnel tint instead.
   - Keep terrain subdivision modest.
3. **The M0 exit gate** (ROADMAP) is met for the emulated part. The physical numbers carry into M1 as already planned, and PERF-001 owns the tier settings once they exist.

## 4. Creator: reproduce on the iPhone 16e (about 5 minutes)

1. **Open the page.** After the Pages deploy (CI-001), open `https://adisakshya.github.io/interstellar-rpg/spike/` in Safari.
   - Without Pages: run `npm run build && npx vite preview --host` on a computer, then open `http://<computer-ip>:4173/interstellar-rpg/spike/` from the phone on the same Wi-Fi.
2. **Measure.** Keep the phone still and unlocked for 70 s. Tap the joystick ring a few times after the first 10 s.
3. **Record.** Screenshot the JSON that appears. Then repeat with `?view=cockpit` and with `?scaling=1` (native resolution).
4. **Report.** Note the iOS version and whether Low Power Mode was on. Paste the numbers into a new "Physical" section here, or into an issue comment.

To re-run the emulated numbers: `node spike/measure.mjs` (needs Playwright with Chromium; about 5 minutes).
