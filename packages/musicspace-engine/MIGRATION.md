# Gradual migration to the package

## Current boundary

The standard workbench still uses the original engine. An explicit
`musicspace.html?engine=package` URL enables experimental Play mode. Build first:

```sh
npm run build --prefix packages/musicspace-engine
python3 -m http.server 8000
```

The default interface requires no build. The experimental mode loads the package's
ES modules dynamically; a failed import displays build instructions and leaves the
scene unavailable. It does not silently fall back. GitHub Pages builds the modules
before deployment. No npm publication or Orbit-specific integration is included.

## Completed

### Standalone engine and legacy patch adapter

- `createSpace` provides geometry, constraints, trajectories, spring dynamics and
  diagnostics without a renderer or output clients.
- `importLegacyPatch` and `exportLegacyPatch` bridge the workbench JSON format.
  Their serializable context retains output bindings and display metadata.
- All 23 built-in patches round-trip and run against the original model with both
  solvers, including continued motion after save/load.

### Experimental workbench Play mode

- `musicspace-play-engine.js` owns the package scene and uses its public API for
  movement, solving, held bodies, stepping, release and resumed propagation.
- Existing model objects remain as a presentation mirror because drawing and
  output feature lookup still depend on their classes. Their identities stay
  stable during gestures. Their solvers and trajectory ticks are never called.
- The mirror copies positions, velocities, trajectories, constraint invariants
  and diagnostics. Constraint handles and trace flags remain display metadata.
  Output clients retain their existing mappings and lifecycle.
- Mouse and touch gestures, fullscreen bounds, Shift dragging, center modes,
  runtime solver changes, traces, undo, trajectories and springs use the bridge.
  Configuration changes preserve transient simulation state.
- Source, trajectory, constraint and JSON inspectors, object creation and deletion
  are disabled. The listener inspector remains usable for position and traces.
- The return link reloads standard mode at the selected built-in patch. Live
  gestures and trace changes are not transferred across that reload.

## Remaining work

1. Try the experimental mode during actual musical sessions, including external
   MIDI hardware and user patches. Automated browser audio checks verify startup,
   mappings and shutdown; they do not establish listening quality or device parity.
2. Migrate authoring through public operations: source/constraint creation and
   removal, trajectory editing, inspectors, naming, output bindings and JSON edits.
   Preserve undo and invalid-edit rollback at each stage.
3. Replace the presentation model with plain view data and renderer helpers. This
   removes duplicated model objects and the legacy class dependency from the UI.
   Profile frame costs on large user scenes before switching the default.
4. Switch the default only after parity. Keep the standard path until the migrated
   interface and saved user patches are validated in real use.
5. Settle the public contract through standalone consumers, then publish a versioned
   package with installation instructions. The package remains general-purpose;
   each host decides the meaning of its controls and how to draw them.

The alpha API can still change. Experimental Play mode exercises it in a real
consumer without making the existing application depend on its build artifacts.
