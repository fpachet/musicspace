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
- Plain presentation records provide drawing data, output feature lookup and editor
  drafts. Their identities stay stable during gestures. The experimental UI creates
  no legacy model or simulation objects outside the package.
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
  direct incremental authoring operations remain a possible follow-up.

### Plain presentation records and renderer functions

- `musicspace-presentation.js` creates plain points, constraint handles and
  constraint records with explicit `kind` tags. A schema describes references,
  editable scalar fields, display layout and measurements used by recapture.
  It contains no model, graph, solver or trajectory stepping operations.
- Rendering uses ordinary functions; the UI no longer attaches drawing methods to
  model prototypes or uses legacy constructors and `instanceof` in its editors.
  The standard engine is supported through a small presentation compatibility adapter.
- The package path retains only the package simulation and plain display records.
  Browser coverage renders all 23 patches and edits with the legacy model, graph
  and solver globals unavailable. Display fixtures compare labels, glyphs, colors,
  hit areas, node positions and recaptured invariants with the original model.
- Shared constants, patch validation and trajectory normalization remain reusable
  helpers. The package still bundles the existing solver internally; this stage
  removes the UI dependency on its classes, not the solver implementation.

### Large scenes and performance (alpha.5)

- All 23 presets and four larger scenes run through movement, stepping, drawing,
  saving and renaming with both solvers. The largest has 1,000 points and 500 links;
  others cover a connected 225-point grid and 100 spring pairs.
- Browser comparisons check exact final geometry against the previous milestone.
  Node regressions compare large-scene motion, editing and restored motion with
  the original model. Intentional conflicts and existing solver residuals remain visible.
- Indexed point/constraint lookup removes repeated array searches. Saving uses
  synchronized display records; import and snapshots avoid redundant model
  construction and copying. Edits retain candidate validation and rollback.
- See the repository's `benchmarks/package-performance.md` for measurements,
  methodology and reproduction commands. Full-scene restoration is still used
  for authoring; these improvements do not change solver algorithms or budgets.

## Remaining work

1. Try the experimental mode during actual musical sessions, including external
   MIDI hardware and user patches. Automated browser audio checks verify startup,
   mappings and shutdown; they do not establish listening quality or device parity.
2. Measure actual large user projects with audio enabled. If editing costs still
   matter, move suitable operations from full-scene restoration to incremental
   public package operations, preserving validation, reference updates and undo.
   Dense connected graphs may also need separate solver convergence work.
3. Switch the default only after parity. Keep the standard path until the migrated
   interface and saved user patches are validated in real use.
4. Collect external integration feedback using the archive and `QUICKSTART.md`.
   Archive installation, JavaScript use and strict TypeScript consumers are tested.
   Confirm the npm publisher and scope before registry publication; `RELEASING.md`
   records the remaining prerequisites. Each host decides the meaning of its
   controls and how to draw them.

The alpha API can still change. The experimental workbench exercises it in a real
consumer without making the existing application depend on its build artifacts.
