# MusicSpace Testing

Run the constraint-engine regression battery with:

```sh
node --test tests/constraint-engine.test.js
```

The tests load `musicspace.js` in a mocked DOM/canvas sandbox, then drive patches directly through the engine. They assert propagation reports and residual measurements rather than relying on screenshots.

Current coverage:

- Sum redistribution.
- Sum/Product arity through patch validation and tool creation.
- Shared Sum + Angle propagation through a common source.
- Shift-style paused movement and resume retargeting.
- Product + radial-limit backoff.
- Radial-limit clamping.
- Distance-ratio preservation.
- Solid-link propagation.
- Over-constrained residual diagnostics.
- XPBD mode smoke tests for radial limits, fixed distance, product + limit, pin/limit conflict, rotator trajectories, and shuttle endpoint preservation.
- Tool workflow tests for adding constraints in propagation and XPBD modes.
- Solver comparison metrics across representative built-in patches.
- XPBD repeated-trajectory stability checks over built-in trajectory patches.
- XPBD iteration sweep and release-refinement regression tests.
- Patch validation for object references, backend declarations, parameter mappings, MIDI bindings, and every built-in patch listed in `patches/index.json`.

Optional diagnostic output:

```sh
MUSICSPACE_PRINT_SOLVER_COMPARISON=1 node --test --test-name-pattern "solver series" tests/constraint-engine.test.js
MUSICSPACE_PRINT_XPBD_SWEEP=1 node --test --test-name-pattern "xpbd iteration sweep" tests/constraint-engine.test.js
```

Keep these tests focused on engine behavior. Browser/UI rendering checks should stay separate.
