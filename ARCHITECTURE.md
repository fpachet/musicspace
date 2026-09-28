# MusicSpace architecture

MusicSpace runs as static JavaScript. The model modules also expose CommonJS exports for Node tests and examples. No bundler or runtime package installation is required in the browser.

## Model and presentation

| Module | Responsibility |
| --- | --- |
| `musicspace-model.js` | Scene state, entities, constraint invariants, edits, transactional loading and snapshots |
| `musicspace-solvers.js` | Bounded propagation and iterative geometric projection; residual reports |
| `musicspace-graph.js` | Entity-to-constraint adjacency, invalidated when topology changes |
| `musicspace-trajectories.js` | Trajectory normalization and one simulation step of movement |
| `musicspace-clock.js` | Elapsed-time accumulator with fixed simulation steps and bounded catch-up |
| `musicspace-patch.js` | Input validation and deep JSON snapshots; optional backend metadata injection |
| `musicspace-constants.js` | Shared geometry units and solver budgets |
| `musicspace.js` | Canvas rendering, selection, inspectors, undo commands and output coordination |
| `musicspace-mapping.js` | Shared linear/exponential mapping and quantization for clients and inspector previews |

The model does not access the DOM, canvas, Web Audio or MIDI. The UI attaches drawing methods to its scene's entity classes. An optional `onStatus` callback carries model diagnostics to the interface. Backend validation takes an optional `targetApi` metadata provider; it does not instantiate audio runtimes.

```js
const { createSceneModel } = require("./musicspace-model");
const model = createSceneModel();
if (!model.loadPatch(patch)) {
  console.error(model.validation());
} else {
  model.moveEntity(model.getObjectByName("A"), 220, 300);
  console.log(model.getLastPropagationReport());
  const independentSnapshot = model.serializePatch();
}
```

`moveEntity` accepts optional `bounds: { left, top, right, bottom }` in world coordinates. The browser uses these to allow dragging throughout the larger fullscreen view; the default remains the 800 × 600 patch area. Fullscreen changes the view transform, preserving patch coordinates and constraint distances.

Run the complete example with `npm run example`. The primary operations are `loadPatch`, `serializePatch`, `getObjectByName`, `moveEntity`, `step`, `setSolverMode`, `measureConstraintResiduals`, and `getLastPropagationReport`.

`loadPatch` validates before construction, constructs without asynchronous work, and restores prior state if construction fails. It returns a boolean. Snapshots deep-copy nested trajectories and retain aggregate constraint targets, so saving an unsatisfied scene does not silently redefine its constraints.

The authoring UI currently uses exposed `state` and `classes` for object creation and inspectors. Constraint-array replacement, push, splice and deletion automatically invalidate adjacency. Code that rebinds an existing constraint's entity references must call `model.graph.invalidate()`. This mutable authoring interface is intentionally documented as an internal API.

## Standalone engine package

`packages/musicspace-engine` adds a public facade over the shared model for custom
interfaces. Its `createSpace` API exposes points with stable IDs, constraints,
motion, drag lifecycle, diagnostics, independent snapshots and change events.
The reference center is exposed as `CENTER`; internal model classes and mutable
state are not part of the package API.

The build reads the existing root model, solver, graph, trajectory, clock,
validation and constants modules and bundles them in private module scopes. It
produces standalone ESM and CommonJS entries plus TypeScript declarations, with
no runtime dependencies or browser globals. Generated bundles are ignored by Git;
the source repository is needed to build them, but not to use an installed archive.

Authoring edits validate a candidate model before committing the replacement.
Interactive moves and simulation steps operate directly on the current model.
Events contain independent position data and residual diagnostics, including IDs
of unsatisfied constraints. The host owns rendering and animation scheduling.

The package has a scene format separate from the workbench's audio/MIDI patch
format. The optional `./legacy-patch` entry converts between them and retains
non-geometric data in a serializable context. Stable package IDs map back to
workbench names and constraint entries. Export validates retained bindings and
rejects disabled constraints, which the legacy format cannot represent. Stored
constraint-node positions are retained; automatic display layout remains the
host's responsibility.

The workbench uses its original model by default. With `?engine=package`,
`musicspace-package-scene.js` dynamically loads the public package and legacy adapter.
It runs the simulation through the package and copies results into stable legacy
objects used for drawing, output feature lookup and editor drafts. It also maps diagnostic
IDs to display constraints. Detailed propagation counts are not exposed by the
public API. The UI still owns trace flags, manual constraint-node positions,
output metadata and undo snapshots. Runtime solver/center/gravity changes preserve
trajectory deltas, held bodies and paused propagation without rebuilding the scene.

Experimental mode supports Play and Edit. The UI's `editGeometry` helper records
undo only after a successful edit. The adapter snapshots the presentation objects,
lets the synchronous editor mutation build a draft, imports its geometry, then
commits through the package's public `restore` operation. Rejected edits restore
object fields and topology while leaving the package simulation untouched. Existing
presentation identities are retained, so inspector references stay valid.

Authoring replaces the package scene; positions, velocities and trajectory phases
are preserved, while transient gesture/rotation deltas reset as on restore. It is
not used for continuous dragging or frame stepping. Output clients apply renames
and removals after geometry commits. The adapter serializes geometry/display data;
the UI merges current audio/MIDI blocks, avoiding stale references from old patches.
Deleting an endpoint freezes dependent shuttles at its last position and removes
associated mappings. Empty source arrays are valid. JSON edits validate before
loading, and successful JSON edits can be undone.

Default startup never requests package artifacts, and failed experimental imports
display an error. The adapter remains transitional: removal of the presentation
classes and authoring performance measurements are still needed. See the
[package contract and limitations](packages/musicspace-engine/README.md) and
[migration stages](packages/musicspace-engine/MIGRATION.md).

## Simulation time

`model.step()` advances exactly 1/60 second. The browser clock uses animation timestamps and accumulates fixed steps, giving equivalent geometry at 30, 60 and 120 Hz. At most eight steps run per animation frame. Longer gaps discard excess time instead of blocking the UI with catch-up work. Hidden pages reset the clock; returning to the page or restarting movers preserves their current positions without advancing through paused wall time.

Version 1 patch fields `vx`, `vy`, `angularSpeed`, and shuttle `speed` retain their original per-step units. A step now always represents 1/60 second. `periodSeconds` remains a duration in seconds. This preserves existing patches' intended 60 Hz behavior.

## Output lifecycle

The parameter, source-audio, generator and MIDI clients expose `loadPatch`, `serialize`, `setEnabled`, `isEnabled`, `stop`, and `dispose`. Spatial clients expose `updateSpatial`; the parameter client exposes `update`. MIDI loading and enabling are asynchronous. `setEnabled` resolves to whether that request enabled playback; a superseded request resolves false.

Stop, patch replacement and disposal invalidate pending startup. Clients check operation generations after asynchronous work before installing players, starting timers or connecting outputs. Disposal releases owned contexts, timers and capture registrations. Muting or removing a generator releases its active voices. The app also rejects stale transport completions, and sequence completion updates the sound button.

Source audio caches decoded buffers by URL/data URL for the current patch. Decodes run concurrently; players receive their initial mute/gain/pan values and share a scheduled start time. Failed decodes are evicted so a subsequent play can retry. Replacing the patch prunes unused cache entries; disposal clears the cache.

The parameter monitor retains DOM rows, updates only changed text, and refreshes at most every 100 ms during continuous updates. Audio parameter application still runs on every update. Selection-summary DOM is rebuilt only when its contents change.

External sequence playback clears queued messages on its selected MIDI output before sending channel panic messages. This follows the [Web MIDI output API](https://www.w3.org/TR/webmidi/#dom-midioutput-clear). Output selection should be treated as ownership of that port's queue during sequence playback.

## Performance and limits

Propagation visits adjacent constraints in original constraint order. Component discovery uses the same index. Both traversals use queue cursors, and XPBD constraint ordering is computed once per solve. Residual reporting still scans the entire scene, preserving visibility of unrelated conflicts.

`benchmarks/` records diagnostic measurements; see `TESTING.md` for commands. The projection solver remains experimental: bounded execution and finite positions are not proofs of feasibility or optimality. Dense graphs and large imported scores need separate profiling before changing solver budgets.

### Spring dynamics

`SpringConstraint` lives beside the geometric constraints in `musicspace-model.js`.
`musicspace-solvers.js` discovers dynamic components through the existing adjacency
graph, adds body state only to participating objects, and reuses the XPBD geometric
projectors during deterministic substeps. Spring compliance and damping share those
iterations. Pins, the listener, dragged objects, and authored trajectories have zero
mobility; other participating objects use inverse mass. Optional explicit dynamics
also supports rigid pendulums without springs. `scene.step()` is still the browser
clock's single entry point. See [the detailed semantics](CONSTRAINT_SEMANTICS.md#springs-and-dynamic-networks).
