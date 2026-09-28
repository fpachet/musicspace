# Introducing the package without changing the workbench

## Current boundary

- The existing root application, HTML script order, model sources and dependencies
  remain unchanged. All package work lives under `packages/musicspace-engine`.
- The package builds from the same model sources. Browser and Node artifacts are
  self-contained; their model state and module scopes are independent.
- Public facade edits are validated in a candidate model before replacing state.
- No npm publication, application migration, or Orbit integration is included.

## Before migrating the current interface

### Completed: patch adapter and engine equivalence

- `importLegacyPatch` and `exportLegacyPatch`, exported through `./legacy-patch`,
  bridge the workbench JSON format and the public scene API. A serializable
  context retains output bindings, mappings, display settings and unknown data.
- All 23 built-in patches round-trip through the package. Automated comparisons
  exercise both solvers, gestures, animation, diagnostics, velocities and resumed
  motion after save/load against the original model.
- Optional move bounds and paused propagation now support the workbench's drag
  behavior. XPBD refinement respects pauses; resuming can retarget constraints.
- The application, root model sources and existing patch files remain unchanged.

### Remaining migration work

1. Exercise the alpha in standalone interfaces: balance, moving center, linked
   rotators, springs, save/restore and conflict diagnostics.
2. Resolve configurable bounds and world units, authoring performance, batched
   movement policies and any missing capabilities exposed by real consumers.
3. Map current UI dependencies on `state` and `classes` to public APIs. Pay special
   attention to constraint-node handles, inspectors, trajectories, undo, traces,
   audio/MIDI metadata and legacy patch round trips. Build on the adapter above and
   retain its context with undo snapshots. Editing output metadata and constraint
   handles, including automatic node layout, still needs a public contract.
4. Migrate one UI flow at a time, with a reversible adapter and tests against both
   implementations. Run the existing unit and browser suites at each stage.
5. Switch the default only after parity. Remove old entry points only when no
   caller relies on them. Keep saved user patches compatible.

The first alpha is intentionally evidence for the API design, not a commitment to
stable naming. Publish a versioned package only after settling that contract.
