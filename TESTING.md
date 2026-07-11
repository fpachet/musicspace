# MusicSpace Testing

For a manual browser check, start the local server from the repository root and keep it running:

```sh
npm run serve
```

Then open <http://localhost:8000/musicspace.html>. Do not open the HTML file through a `file://` URL: browsers block the JSON fetches used to populate the built-in patch menu.

Run the constraint-engine regression battery with:

```sh
npm test
```

The tests load `musicspace.js` in a mocked DOM/canvas sandbox, then drive patches directly through the engine. They assert propagation reports and residual measurements rather than relying on screenshots.

Run the browser smoke test with:

```sh
npx playwright install chromium
npm run smoke
```

The smoke test starts a local HTTP server, loads `musicspace.html` in Chromium, checks for console/page errors, verifies that built-in patches populate, loads Cycloid Percussion, and exercises mover, sound, and reset controls.

Refresh the README screenshots with:

```sh
npm run capture:screenshot
```

Refresh the README demo videos with:

```sh
npm run capture:video
```

The video capture script records canvas motion in Chromium and uses the app's explicit Web Audio capture bus plus `ffmpeg` muxing for demos that generate sound.

Export LinkedIn-friendly MP4 copies of the audio demo clips with:

```sh
npm run export:linkedin
```

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
- Patch validation for object references, backend declarations, source bindings, parameter mappings, MIDI bindings, and every built-in patch listed in `patches/index.json`.
- Source Inspector and source-audio coverage for output-mode-specific fields, source binding serialization, MIDI-file track binding edits/removal, source renaming across patch references, per-source mute state, keyboard mute/playback shortcuts, and the no-default-sound rule when a patch has no `sourceBindings`, `sourceGenerators`, `midiFile`, or `parameterMappings`.
- Patch Inspector coverage for editing generic `parameterMappings` through the mapping editor and serializing the result back into patch JSON.
- UI interaction regression coverage for canvas focus without page scrolling, the passive undo indicator, solver selector state, toolbar-independent keyboard workflows, and a real-browser smoke test for page loading and core controls.

Optional diagnostic output:

```sh
MUSICSPACE_PRINT_SOLVER_COMPARISON=1 node --test --test-name-pattern "solver series" tests/constraint-engine.test.js
MUSICSPACE_PRINT_XPBD_SWEEP=1 node --test --test-name-pattern "xpbd iteration sweep" tests/constraint-engine.test.js
```

Keep the engine tests focused on model behavior. Browser/UI rendering checks should stay in Playwright smoke or visual-regression tests.
