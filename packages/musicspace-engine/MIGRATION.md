# Gradual migration to the package

## Current boundary

The standard workbench still uses the original engine. An explicit
`musicspace.html?engine=package` URL enables experimental Play and Edit modes. Build first:

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

- `musicspace-package-scene.js` owns the package scene and uses its public API for
  movement, solving, held bodies, stepping, release and resumed propagation.
- Existing model objects remain as a presentation mirror and editor drafts because drawing,
  inspectors and output feature lookup still depend on their classes. Their identities stay
  stable during gestures. Their solvers and trajectory ticks are never called.
- The mirror copies positions, velocities, trajectories, constraint invariants
  and diagnostics. Constraint handles and trace flags remain display metadata.
  Output clients retain their existing mappings and lifecycle.
- Mouse and touch gestures, fullscreen bounds, Shift dragging, center modes,
  runtime solver changes, traces, undo, trajectories and springs use the bridge.
  Configuration changes preserve transient simulation state.
- The return link reloads standard mode at the selected built-in patch. Live
  gestures and trace changes are not transferred across that reload.

### Workbench editing through public scene restoration

- Both Play and Edit are enabled under the same experimental URL. Geometry edits
  are synchronous transactions: snapshot the display objects, apply the draft,
  validate/import it and commit through public `restore`. Failed edits restore
  fields and topology without changing simulation or adding an undo entry.
- Creation/deletion, all constraint inspectors and recapture, trajectory tools,
  rotator/shuttle inspectors, source names and masses use these transactions.
  Display object identities remain stable across successful edits.
- Output clients remain responsible for audio/MIDI data. They update references
  after renames/deletions; geometry serialization never reintroduces stale bindings.
- Deleting objects removes their constraints and mappings and freezes referenced
  shuttle endpoints. The last source can be deleted; empty patches reload normally.
- JSON edits validate before loading and are undoable. Undo restores geometry,
  trajectories and output bindings from a complete patch snapshot.
- Authoring restores the complete scene, retaining positions, phases and velocities
  but resetting transient drag/rotation deltas. This is a compatibility step;
  direct incremental authoring operations and frame-cost profiling remain ahead.

## Remaining work

1. Try the experimental mode during actual musical sessions, including external
   MIDI hardware and user patches. Automated browser audio checks verify startup,
   mappings and shutdown; they do not establish listening quality or device parity.
2. Replace the presentation model and mutable editor drafts with plain view data,
   renderer helpers and direct public authoring operations. Preserve transaction
   validation, reference updates and undo. Profile editing and frame costs on large
   user scenes before switching the default.
3. Switch the default only after parity. Keep the standard path until the migrated
   interface and saved user patches are validated in real use.
4. Settle the public contract through standalone consumers, then publish a versioned
   package with installation instructions. The package remains general-purpose;
   each host decides the meaning of its controls and how to draw them.

The alpha API can still change. The experimental workbench exercises it in a real
consumer without making the existing application depend on its build artifacts.
