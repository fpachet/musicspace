# Package workbench performance

Measured on 28 September 2026 against commit `924c9297`, after the plain
presentation-record milestone. The candidate is the alpha.5 working tree.
[Raw measurements](package-performance.json) include all cases, medians, p95,
load times, residual counts and final geometry hashes. The raw `commit` field
records HEAD at measurement time; candidate changes were uncommitted.

## Results

All **23 predefined scenes**, plus **four larger scenes**, passed with both solvers:
54 cases per version. Each ran movement, simulation steps, drawing, saves and eight
rename transactions. Final exported geometry was exactly equal to the baseline
in every case, after sorting object keys. All saves validated, all point coordinates
were finite, and no browser exceptions occurred.

Median milliseconds, baseline → alpha.5:

| Scene | Solver | Move | Step + draw | Save | Edit (rename) |
| --- | --- | --- | --- | --- | --- |
| rotating-partials | propagation | 0.4 → 0.3 | 0.5 → 0.5 | 1.4 → 0.2 | 3.4 → 1.5 |
| rotating-partials | xpbd | 0.3 → 0.3 | 0.5 → 0.5 | 1.4 → 0.1 | 3.4 → 1.7 |
| links-500 | propagation | 4.1 → 1.4 | 8.4 → 5.4 | 13.6 → 0.7 | 32 → 12.7 |
| links-500 | xpbd | 4.2 → 1.3 | 8.3 → 5.4 | 15.6 → 0.7 | 31.2 → 12.3 |
| springs-100 | propagation | 0.8 → 0.5 | 3.6 → 3.2 | 6.2 → 0.3 | 13.2 → 5 |
| springs-100 | xpbd | 0.7 → 0.5 | 3.4 → 3.2 | 5.6 → 0.3 | 11.9 → 5.5 |
| grid-225 | propagation | 1.6 → 1 | 2.8 → 2.3 | 8.9 → 0.5 | 18 → 7.4 |
| grid-225 | xpbd | 1.7 → 1 | 3 → 2.3 | 9.1 → 0.5 | 19.9 → 7 |

- `links-100`: 200 points and 100 independent fixed-distance links.
- `links-500`: 1,000 points and 500 independent links.
- `springs-100`: 200 points, 100 pins and 100 springs.
- `grid-225`: 225 points in a connected 15 × 15 grid, with 420 links.
- Rotating Partials is a predefined patch with 45 points and 44 constraints.

The connected grid retained **27 residuals** with both solvers, exactly as in the
baseline. Passing means equivalent geometry and diagnostics, successful editing
and valid saves; it does not mean every constraint converges. The predefined
Conflict Diagnostics patch also deliberately contains incompatible constraints.

## Changes

- Point lookup, changed/removed point detection and diagnostic lookup use maps
  instead of repeated array searches. Display indexes rebuild after successful edits.
- Public snapshots return detached serialized data without an additional complete
  clone. Nested trajectory, dynamics and disabled-constraint data remain isolated.
- Legacy import translates an already validated and normalized model once.
  It keeps the public endpoint and configuration checks.
- Workbench saving copies the synchronized presentation directly. It preserves
  display metadata and normalizes trajectory endpoints without constructing
  solver models. Drag start synchronizes reset velocities before undo/save.
- Editing still validates a draft and restores the complete package scene. Failed
  edits roll back; this milestone does not implement incremental authoring.

The generic public `exportLegacyPatch` still validates external scene/context
inputs. Solver algorithms, iteration budgets and tolerances were unchanged.

## Method and limits

Apple M1 Pro, macOS arm64, Node v24.3.0, Chromium 149.0.7827.55;
headless Chromium at 1280 × 960, both versions in the same browser process.
20 warm-up iterations precede 50 measured movement and step/draw samples.
Saving and editing each have two warm-ups and six measured samples.
The benchmark stops background animation and advances deterministic steps.

Times measure synchronous JavaScript, including Canvas draw submission. They are
not end-to-end display latency or a guaranteed frame rate. Audio output and external
MIDI hardware are disabled. Rename cost includes the UI undo snapshot and reference
updates, but does not measure human interaction with every inspector. Browser timer
precision, JIT warm-up, execution order and machine load affect these results;
small differences below a millisecond should not be overinterpreted. Timing values
are diagnostic, not CI thresholds.

The normal tests compare every preset and the large fixtures with the original
model in both solvers. Additional regressions cover edits/restores, nested snapshot
isolation, disabled-constraint IDs, rejected edits and drag-start save behavior.

## Reproduce

From the repository root, with dependencies and Playwright Chromium installed:

```sh
npm run benchmark:package -- --output=/tmp/musicspace-current.json
```

Before changing the runtime, preserve the version to compare against:

```sh
npm run benchmark:package -- --save-baseline=/tmp/musicspace-runtime-before --output=/tmp/musicspace-before.json
```

After changes, compare both runtimes in one run:

```sh
npm run benchmark:package -- --baseline=/tmp/musicspace-runtime-before --output=/tmp/musicspace-comparison.json
```

The saved baseline contains workbench JavaScript/HTML and built package ES modules.
Other static assets and the fixture list come from the current checkout, so keep
those unchanged during a comparison. The runner uses an ephemeral loopback HTTP
port, leaves the checkout untouched, and fails if final geometry hashes differ.
`npm test --prefix packages/musicspace-engine` runs the numerical large-scene
regressions without timing thresholds.
