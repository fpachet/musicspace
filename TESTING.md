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

## Benchmarks

```sh
npm run benchmark
npm run benchmark:browser
node scripts/browser-benchmark.js --baseline=32c1a5fa
```

The Node benchmark warms up before reporting median, p95 and maximum movement times. It includes the mocked UI path for continuity with the initial review baseline, so it is not an isolated solver benchmark.

The browser benchmark serves either the working tree or a supplied Git revision on an ephemeral loopback port. It uses the same Chromium runtime for both revisions, separates solver and drawing measurements, counts DOM allocations and propagation constraint visits, and checks final residual counts. Fixtures include Product + Limit, Granular Cloud, Rotating Partials and 100 independent fixed-distance links. The `--baseline` flag without a revision uses HEAD. It does not change the checkout.

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
