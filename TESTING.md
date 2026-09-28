# MusicSpace testing

## Setup

The browser application needs only a static HTTP server. Development checks need Node.js 22.13 or later (or a newer supported LTS release), npm, Python 3, and Chromium:

```sh
npm ci
npx playwright install chromium
npm run serve
```

Open <http://localhost:8000/musicspace.html>. JSON and audio fetches require HTTP; opening the HTML directly through `file://` is unsupported.

## Required checks

```sh
npm run check
npm run format:check
npm test
npm run smoke
npm test --prefix packages/musicspace-engine
```

`check` runs ESLint, including syntax, undefined-name, unused-variable and recommended correctness rules. `format:check` checks JavaScript formatting; `npm run format` applies it. The browser suite starts its own loopback HTTP server when one is not already running.

The GitHub workflow runs checks for pull requests and before publishing the main branch. Benchmarks are diagnostic artifacts, not timing-based pass/fail gates.

## Test boundaries

- `tests/model.test.js` drives the actual headless model: constraint propagation, conflicts, solver comparisons, release refinement and repeated trajectories.
- `tests/model-roundtrip.test.js` verifies all built-in patch round trips, preserved aggregate targets, independent nested snapshots, graph invalidation, invalid-input rollback, and identical constrained scenes across display rates.
- `tests/clock.test.js` tests elapsed-time accumulation, bounded catch-up and pause/reset behavior.
- `tests/constraint-engine.test.js` retains inspector and interaction regressions using a mocked DOM and output clients. It is UI integration coverage, not evidence of actual audio playback.
- `tests/reliability.test.js` covers undo, invalid patch imports and delayed audio cancellation.
- `tests/output-lifecycle.test.js` uses the real output clients with deterministic audio/timer doubles to test concurrent decoding, shared starts, caching, retries, cancellation and resource cleanup.
- `tests/sequence-parser.test.js` tests actual MIDI parsing, running status, tempo changes and malformed data.
- `tests/browser-smoke.spec.js` covers real Chromium controls, invalid JSON edits, MusicXML chord and voice timing, stable parameter-monitor DOM rows all bundled audio backends, and delayed Faust startup cancellation.

`examples/chord.musicxml` and `tests/fixtures/voices.musicxml` provide small inspectable notation fixtures. External MIDI hardware and subjective sound quality still require manual checks.

## Standalone package checks

`npm test --prefix packages/musicspace-engine` builds the package from the shared
sources, then runs its Node and Chromium tests. Use the root development setup
above; the package has no runtime dependencies, while its browser test uses the
repository's Playwright installation. The test server binds an ephemeral loopback
port, so environments that prohibit local servers need permission to run it.

- `test/space.test.cjs` covers authoring, propagation, center motion, invalid-edit
  rollback, independent notifications, constraint activation, diagnostics,
  rotators, springs, restoration, fixed-step timing and parity with the original
  product/limit fixture.
- `test/install.test.cjs` packs the distribution, installs it offline into a
  temporary independent project and exercises both ESM and CommonJS imports,
  including the legacy-patch entry.
- `test/legacy-patch.test.cjs` imports and exports all 23 library patches, preserving
  output and display metadata. It compares both solvers against the original model
  through dragging, center motion, simulation, residuals, velocities and continued
  motion after save/load. Focused cases cover bounds, paused propagation, spring
  rest lengths, name collisions, independent context data and invalid exports.
- `test/workbench-play.test.cjs` compares the workbench bridge with the original model
  across all 23 patches and both solvers. It rejects any use of presentation
  simulation operations and verifies stable view objects, settings, traces, handles and
  failed-load preservation. Authoring checks exercise stable inspector references,
  failed-edit rollback and package-owned motion after creation or parameter edits.
- `test/browser.test.cjs` uses the standalone SVG playground to verify dragging,
  indirect movement, JSON save/load, rotation, spring release and the absence of
  global MusicSpace objects or browser exceptions.

The root `format:check` script targets the workbench files. Check package formatting
separately when changing its sources:

```sh
npx prettier --check 'packages/musicspace-engine/src/*' 'packages/musicspace-engine/scripts/*.cjs' 'packages/musicspace-engine/test/*.cjs' 'packages/musicspace-engine/examples/*' 'packages/musicspace-engine/package.json'
```

Package tests rebuild ignored `dist/` files and the license copy. Keep generated
bundles, `.tgz` archives and test screenshots out of commits. The default UI and experimental package mode both remain
covered. `npm run smoke` builds the package before running the original browser
suite plus `tests/browser-package.spec.js`: default-mode independence, import
failure, all-patch parity, traces/undo, sound backends, mappings and fullscreen
touch drag/release. These checks do not cover external MIDI hardware or subjective
audio quality.

`tests/browser-edit.spec.js` exercises both engines through source creation,
spring and mass editing, trajectory editors, source renames, deletion, empty-scene
save/load, JSON validation and undo. It compares all 11 constraint tools and all
five trajectory tools with both solvers. Additional package checks cover rollback
and audio/generator/MIDI reference updates across rename, delete and undo.

`tests/presentation.test.js` compares the plain display records with the original
model for all 23 patches: serialized constraints, references, labels, glyphs,
colors, node layout, recapture and hit areas. The package browser suite also runs
with the legacy model, graph and solver scripts replaced by empty responses,
checking rendering, motion and editing without those globals.


## Benchmarks

```sh
npm run benchmark
npm run benchmark:browser
npm run benchmark:package
node scripts/browser-benchmark.js --baseline=32c1a5fa
```

The Node benchmark warms up before reporting median, p95 and maximum movement times. It includes the mocked UI path for continuity with the initial review baseline, so it is not an isolated solver benchmark.

The browser benchmark serves either the working tree or a supplied Git revision on an ephemeral loopback port. It uses the same Chromium runtime for both revisions, separates solver and drawing measurements, counts DOM allocations and propagation constraint visits, and checks final residual counts. Fixtures include Product + Limit, Granular Cloud, Rotating Partials and 100 independent fixed-distance links. The `--baseline` flag without a revision uses HEAD. It does not change the checkout.

The package benchmark loads **every preset** and four synthetic scenes (up to
1,000 points, plus a connected grid and spring systems), with both solvers. It
measures movement, stepping/drawing, saving and renaming. Invalid saves, failed
edits, nonfinite coordinates and browser exceptions fail the run. A saved runtime
baseline additionally checks exact final geometry. See
[package performance](benchmarks/package-performance.md) for commands and results.
The package test suite reuses these large fixtures for numerical parity after
movement, editing and restoration, and checks snapshot isolation and save behavior.

Recorded results live in `benchmarks/`. Browser timer precision and machine load limit comparisons for tiny solver steps. Prefer repeated measurements and work/allocation counts over a single elapsed-time threshold. The original Node baseline includes a VM-loaded engine; extraction changed that execution boundary, so do not interpret its timing reduction as browser speedup.

Optional solver diagnostics:

```sh
MUSICSPACE_PRINT_SOLVER_COMPARISON=1 node --test --test-name-pattern "solver series" tests/model.test.js
MUSICSPACE_PRINT_XPBD_SWEEP=1 node --test --test-name-pattern "xpbd iteration sweep" tests/model.test.js
```

## Examples and media

```sh
npm run example
npm run capture:screenshot
npm run capture:video
npm run export:linkedin
```

The headless example needs no browser or audio device. Capture scripts use Playwright; video muxing/export also needs `ffmpeg`. See `EXAMPLES.md` for guided manual exercises and `ARCHITECTURE.md` for model and output lifecycle contracts.

## Spring dynamics checks

Run `node --test tests/spring-dynamics.test.js` for deterministic equilibrium,
stretch/compression, damping, anchors, unequal masses, coupling, rigid links,
gravity/pendulum, long-run stability, coincident endpoints, serialization, clock-rate,
input validation, Shift-drag, and musical mapping coverage. These tests use explicit
simulation steps rather than wall-clock timing. Inspector coverage is in
`tests/constraint-engine.test.js`; Chromium coverage in `tests/browser-smoke.spec.js`
checks the four patches, pointer hold/release, parameter editing, mass editing, and sound enablement.

Phone regressions in `tests/browser-smoke.spec.js` use Chromium mobile emulation at
320px/390px portrait widths and 844px landscape width. They check horizontal overflow,
control sizing, selection-help placement, fullscreen proportions, touch dragging beyond the original patch area in portrait and landscape (native fullscreen and CSS fallback), and touch exit,
inspector bounds, touch dragging near small objects, second-finger handling, and
release into spring dynamics. These checks complement testing on physical iOS/Android
devices; they do not verify device-specific browser chrome or audio policies.
