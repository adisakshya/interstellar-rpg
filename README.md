# interstellar-rpg

A free browser RPG set in the *Interstellar* universe, where every minute on Miller's planet costs someone years. Plans and rules live in [`docs/`](docs/): start with [VISION](docs/VISION.md), [TIMELINES](docs/TIMELINES.md) and [ARCHITECTURE](docs/ARCHITECTURE.md). Agent rules are in [AGENTS.md](AGENTS.md).

## Requirements

Node.js 20 or newer (CI uses 22), npm, and Python 3 for the physics fixture check.

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Install exact dependencies from the lockfile |
| `npm run dev` | Start the Vite dev server (open the printed URL, which ends in `/interstellar-rpg/`) |
| `npm run build` | Typecheck, then build the static site into `dist/` |
| `npm run preview` | Serve `dist/` locally to check the production build |
| `npm run lint` | ESLint (including module-boundary rules) and a Prettier formatting check |
| `npm run format` | Apply Prettier formatting |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit and tooling tests |
| `npm run physics:check` | Recompute `docs/physics/fixtures.json` and fail on any drift |

`BASE_PATH=/ npm run build` builds for a host that serves from the root instead of the GitHub Pages subpath.

## Layout

`src/domain` holds the game rules (pure TypeScript), `src/render` the Babylon.js scenes, and `src/app` wires everything together. The full map and the import rules ESLint enforces are in [ARCHITECTURE §2](docs/ARCHITECTURE.md).
