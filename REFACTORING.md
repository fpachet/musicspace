# Reliability and performance implementation

This tracks the implementation following the September 2026 code review.

| Stage | Status | Acceptance |
| --- | --- | --- |
| Regression fixtures and baseline | Complete | Reproduce reported failures; record repeatable solver measurements |
| Playback, import and undo fixes | Complete | Stale playback cannot start; failed loads preserve state; snapshots are independent |
| Simulation clock | Complete | Equivalent elapsed time produces equivalent trajectories across refresh rates |
| Model extraction and shared mappings | Complete | Headless model tests; browser UI uses the same model |
| Measured optimizations | Complete | Compare solver work, DOM allocation and audio decode/start behavior |
| Output lifecycle audit | Complete | Repeated enable/stop/load/dispose transitions release owned resources |
| Examples, documentation and CI | Complete | Guided examples, parser fixtures, lint and benchmark commands documented |

Changes are validated incrementally with the regression suite and browser tests.
Performance observations are machine-specific; correctness tests do not use wall-clock thresholds.


## Implemented changes

- Regression reproductions now cover the original review failures. Patch loading is transactional, undo snapshots own their nested data, and aggregate targets survive save/reload even when constraints are unsatisfied.
- Mover timing uses an elapsed-time accumulator and fixed 1/60-second steps with bounded catch-up. Existing version 1 trajectory units are preserved.
- Scene state, solvers, validation, trajectories, constants and adjacency are separate headless modules. The existing numerical tests now exercise the same model that the UI uses.
- Generic mappings, generator mappings and inspector previews share one evaluator. Parameter and selection monitors reuse their DOM instead of recreating unchanged rows.
- Audio decoding is concurrent and cached; players share a scheduled start with spatial gain/mute already applied. Startup generations prevent stale audio, generator, MIDI and Faust work from reviving stopped playback.
- Generator mute/removal releases voices, and capture registrations are released when contexts are disposed. MIDI completion updates transport state. External sequence stop clears queued messages before panic.
- MusicXML chords use the previous note onset; multi-voice measures retain their longest cursor extent. MIDI parser tests cover running status, tempo changes and malformed timing data.
- ESLint and Prettier are configured; CI checks pull requests and gates deployment. Performance thresholds have been removed from correctness tests; diagnostic benchmark commands report measurements separately.
- The library now has 19 patches, including Chord Import Check and Conflict Diagnostics. `EXAMPLES.md` provides exercises and `examples/headless.js` demonstrates the model API.

## Validation

- `npm run check`: passed.
- `npm run format:check`: passed.
- `npm test`: 101 tests passed.
- `npm run smoke`: 8 Chromium tests passed, including all bundled sound backends and delayed Faust stop/disposal.
- `npm run example`: completed with a satisfied Product + Limit report.
- `git diff --check`: passed.

## Measured results

The browser comparison served original commit `32c1a5fa` and the working tree in Chromium 149.0.7827.55, with 40 warm-up iterations and 500 measured iterations per scenario. Full reports are in `benchmarks/browser-before.json` and `benchmarks/browser-after.json`.

| Scenario | Propagation constraint visits, before → after | DOM elements created, before → after | Render p95, before → after |
| --- | --- | --- | --- |
| Product + Limit | 1,118 → 559 | 7,500 → 0 | 0.1 → 0.1 ms |
| Granular Cloud Study | 110,808 → 24,312 | 12,000 → 0 | 0.3 → 0.2 ms |
| Rotating Partials | 2,112,000 → 97,500 | 7,500 → 0 | 0.4 → 0.3 ms |
| 100 independent links | 100,000 → 1,000 | 7,500 → 0 | 1.0 → 0.8 ms |

These sequences move a source while keeping the selection fixed. The standalone parameter-monitor test also verifies zero new elements for 60 unchanged updates, versus 720 in the original review probe. All final residual counts match the original revision in both solver modes. Most solver timings are at or near browser timer resolution; reduced constraint visits are established, but these measurements do not justify a broad solver speedup claim.

The initial Node baseline is retained in `benchmarks/baseline.json`, with the current equivalent harness in `benchmarks/after.json`. Moving the engine out of a VM sandbox changes that benchmark's execution boundary, so the browser comparison is the meaningful before/after assessment.

## Remaining boundaries

This completes the seven-stage plan. The model's authoring state remains an internal mutable API; future packaging should first stabilize explicit editing commands. XPBD remains experimental and does not prove optimality. External MIDI hardware, subjective audio quality and full MusicXML notation semantics remain outside the automated verification described here. No solver-budget increase or framework migration was needed.
