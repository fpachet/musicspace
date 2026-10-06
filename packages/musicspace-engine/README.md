# MusicSpace engine

An experimental JavaScript library for building your own interactive interfaces with
geometric constraints, moving controls, linked rotations and spring dynamics.

The engine owns geometry and propagation. Your application owns rendering, pointer
events, audio or other parameter meanings, and animation scheduling. It works with
SVG, Canvas, DOM elements or a UI framework, and in Node without a browser.

**Development version: 0.1.0-alpha.7 (unpublished).** Mutual gravity requires this
repository build. The current npm release is 0.1.0-alpha.6, published on 5 October 2026. The package name is
`@fpachet/musicspace-engine`, using the verified publisher's personal npm scope.
Start with [QUICKSTART.md](QUICKSTART.md) for installation and examples,
or read the [release notes](CHANGELOG.md).
There are no runtime dependencies. The MusicSpace workbench also offers
experimental Play and Edit modes using the package.

Install the alpha from npm:

```sh
npm install @fpachet/musicspace-engine@alpha
```

See [release instructions](RELEASING.md) for the tested archive and publish command.

## Try it

From the MusicSpace repository root:

```sh
npm run build --prefix packages/musicspace-engine
node packages/musicspace-engine/examples/basic.mjs
python3 -m http.server 8000
```

Open <http://localhost:8000/packages/musicspace-engine/examples/playground.html>.
The playground includes a balance constraint with a movable center, a rotating
constellation, coupled springs, and JSON save/load. Its source is a complete custom
SVG interface using only the public API.

The existing workbench can also use the package:
<http://localhost:8000/musicspace.html?engine=package&patch=musical-spring>.
This is an optional migration supporting both Play and Edit, with a visible return
link to standard mode. See [migration status](MIGRATION.md) for boundaries and remaining work.

## Install an archive in another project

Build a self-contained archive from this repository:

```sh
cd packages/musicspace-engine
npm pack
```

In the consuming project, install that archive by its actual path:

```sh
npm install /path/to/fpachet-musicspace-engine-0.1.0-alpha.6.tgz
```

Then import `createSpace` from `@fpachet/musicspace-engine`. CommonJS `require` is also
supported. TypeScript declarations are included. No consumer build step is needed
for the engine itself. The development `build`/`test` scripts run in the source
repository; the distributed archive contains the already built files.

For a plain browser page, copy `dist/index.mjs` into your application and import it
using a relative URL. Serve the page through HTTP. The module does not add globals.
Modern browsers supporting ES modules and `structuredClone` are required.

## First interface

```js
import { createSpace, CENTER } from '@fpachet/musicspace-engine';

const space = createSpace({
  center: { x: 300, y: 200 },
  points: [
    { id: 'A', x: 200, y: 200 },
    { id: 'B', x: 400, y: 200 }
  ],
  constraints: [
    { id: 'balance', type: 'sum', points: ['A', 'B'] }
  ]
});

const unsubscribe = space.onChange(({ changed, diagnostics }) => {
  // Update your own controls, including those moved indirectly by propagation.
  for (const point of changed) updateMyControl(point.id, point.x, point.y);
  showMyConstraintStatus(diagnostics);
});

space.move('A', 180, 200); // B moves closer: total distance remains 200.
space.move(CENTER, 310, 210); // Constraints are preserved while the center moves.

// When your interface is removed:
unsubscribe();
```

`updateMyControl` and `showMyConstraintStatus` belong to your application. Start with
`space.positions()` for the initial render. Data returned by the API is independent
of internal state; mutating a snapshot or an event cannot change the engine.

## Public API

See `dist/index.d.ts` for the complete typed contract.

| Operation | Purpose |
| --- | --- |
| `createSpace(options?)` | Create a scene, including an empty scene |
| `addPoint({id, x, y, trajectory?, dynamics?})` | Add a control or a moving object |
| `updatePoint(id, changes)` | Authoring edit: position, trajectory or mass/velocity |
| `removePoint(id)` | Remove a point and dependent constraints |
| `addConstraint(spec)` / `updateConstraint(id, changes)` / `removeConstraint(id)` | Author the graph |
| `updateConstraint(id, {enabled: false})` | Disable a relation while retaining its target |
| `move(id, x, y, options?)` | Propose a displacement; optional bounds or paused propagation |
| `resumePropagation()` | Resume a paused edit and retarget geometric constraints to the new layout |
| `beginDrag(id)` / `endDrag({refine?})` | Hold a dynamic body during a pointer gesture; refine XPBD on release |
| `solve(id = CENTER)` | Propagate from a chosen object without moving it first |
| `positions()` / `getPoint(id)` | Read coordinates |
| `diagnostics()` | Read unsatisfied relations by constraint ID |
| `onChange(callback)` | Subscribe to committed operations; returns unsubscribe |
| `step()` | Advance exactly 1/60 second |
| `advance(timestampMs)` / `resetClock()` | Optional fixed-step scheduling from host timestamps |
| `snapshot()` / `restore(scene)` | Save/restore JSON data including invariants and dynamic velocities |
| `configure({solver?, centerMode?, gravity?})` | Change scene behavior while retaining motion, held bodies and pause state |

Authoring operations validate before replacing the scene and throw `TypeError` on
invalid data. They preserve existing invariant targets and do not automatically
solve the new graph; call `solve` or start interacting. Interactive `move` and
`step` can return unsatisfied diagnostics: incompatible constraints do not throw
and the solver does not roll the whole gesture back.

Removing a point also freezes shuttle endpoints that referenced it at its last
position. The center cannot be removed. `CENTER`, `Listener` and
`$musicspace-empty` are reserved IDs. Point and constraint IDs are unique in their
respective collections. One scene has one radial center; multiple scenes are
independent. Arbitrary points can anchor pairwise distances, springs and links.

Notifications are synchronous and occur after the operation commits, even if no
position changes. `changed` contains moved/added positions; `removed` contains IDs.
An observer that throws propagates its exception to the caller after the edit has
committed. Do not write back to the engine unconditionally from its own observer.
Render events from `step` are position deltas; inspect `snapshot()` after authoring
operations when you need the graph or trajectory definitions.

`move` is unbounded by default. Supply `bounds: {left, top, right, bottom}` to clamp
the proposed position; these bounds do not constrain other points moved by the
solver. `skipPropagation: true` supports Shift-style editing: it moves the point
without solving and pauses dynamics. `resumePropagation()` retargets geometric
relations to the edited layout; spring rest lengths remain unchanged. A normal
`move` resumes solving against the existing targets instead. `diagnostics()` exposes
`propagationPaused`, and `endDrag()` does not refine XPBD while propagation is paused.
Use `endDrag({refine: false})` for a selection click that should not solve constraints.

## Existing MusicSpace patches

The optional `@fpachet/musicspace-engine/legacy-patch` entry imports workbench patches while
keeping their audio/MIDI bindings, mappings, display settings and unknown metadata
in a separate, JSON-compatible context. It does not start audio, load media or
fetch URLs. The default workbench uses its original model; `?engine=package` selects the
migrated interface.

```js
import { createSpace } from '@fpachet/musicspace-engine';
import { importLegacyPatch, exportLegacyPatch } from '@fpachet/musicspace-engine/legacy-patch';

const { scene, context } = importLegacyPatch(patch);
const space = createSpace(scene);
const firstName = patch.sources[0].name;
space.move(context.pointIds[firstName], 220, 300);

const savedPatch = exportLegacyPatch(space.snapshot(), context);
// Save savedPatch using the application's existing JSON persistence.
```

Keep `context` with the scene, including across undo/snapshot storage. Contexts,
scenes and exported patches are independent copies. Object names map to neutral
point IDs, including names that would otherwise conflict with package reserved
IDs. Constraint IDs map to the original array entries, preserving their metadata
even if constraints are reordered or removed. New point IDs become legacy names;
duplicate exported names are rejected.

The adapter captures computed invariant targets before movement. It preserves
trace flags, stored constraint-node coordinates and custom fields; it does not
recompute automatic node layout. The workbench adapter owns that layout and the
editing of display metadata. Normalized defaults may be added on export, so
round trips preserve meaning rather than JSON formatting or omitted defaults.
Transient rotator `rotationDelta` is recomputed by the engine after loading.
Version 1 legacy patches now accept an empty `sources` array, so deleting the last
source does not prevent saving, undo or reloading. The array itself remains required.

`importLegacyPatch(patch, {solver?, centerMode?})` defaults to `propagation` and
`retarget`, matching the workbench. The general `createSpace` API defaults to
`preserve`. Solver choice, center mode, clock and current gesture state are not
fields in legacy patch files and must be managed by the host.

Export validates the complete patch. Removing a point while retained output
bindings still reference it raises an error; bindings are never silently removed.
Disabled constraints also raise an error because the legacy reader would silently
activate them. Enable or remove them before exporting. The alpha does not yet
offer a public API to edit output metadata or constraint-node handles.

## Constraints

All references below are point IDs; use `CENTER` to refer to the scene center.
Radial constraints use the scene center implicitly. Angles are in radians.

| Type | Fields beyond `id`, `type`, optional `enabled` |
| --- | --- |
| `angle` | `points: [a,b]`, optional `angle` |
| `sum` | `points: [a,b,...]`, optional `totalDistance` |
| `product` | `points: [a,b,...]`, optional `product` |
| `radialLimit` | `point`, `minDistance`, `maxDistance` |
| `fixedDistance` | `anchor`, `target`, `distance` |
| `distanceRatio` | `points: [a,b]`, `ratio` (distance of a / distance of b) |
| `pin` | `target`, `x`, `y` |
| `solid` | `carrier`, `attached`, optional `offsetX`, `offsetY` |
| `separation` | `points: [a,b]`, `minDistance` |
| `angleSector` | `point`, `centerAngle`, `width` |
| `gravitational` | `anchor`, `target`, optional `strength` (G, default 1,000,000), `softening` (default 10) |
| `spring` | `anchor`, `target`, optional `restLength`, `stiffness`, `damping` |

Where an invariant is optional, it is captured from geometry at creation. Disabling
and enabling a constraint retains it. Springs default to rest length from geometry,
with the stiffness and damping defaults of the existing engine.

## Motion and dynamics

Use a point with `trajectory` to create a mover. Available types are `free`,
`translation`, `rotation`, `rotator`, `shuttle` and `bounce`. A `rotation` moves the
point around an explicit center. A `rotator` spins its attached objects around its
own position. Link rotators together with `solid` constraints for compound motion.

```js
space.addPoint({
  id: 'rotor', x: 300, y: 200,
  trajectory: { type: 'rotator', periodSeconds: 8, direction: 1 }
});
space.addConstraint({ id: 'carry-A', type: 'solid', carrier: 'rotor', attached: 'A' });

function frame(timestampMs) {
  space.advance(timestampMs);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

The host starts and stops animation. `advance` primes on its first timestamp,
advances fixed 1/60-second steps and caps catch-up at eight steps per call. Call
`resetClock()` on pause/resume or visibility changes. Do not drive the same scene
with both `step` and `advance` concurrently. Restore resets the clock and drag state.

Add springs and optional `dynamics: {mass, vx, vy}` to points for mass-weighted
motion. `configure({gravity: {x: 0, y: 150}})` adds uniform acceleration. Call `beginDrag`, `move`
and `endDrag` for drag/release interaction. Springs use the engine's dynamic solver
even when geometric propagation is selected.

### Mutual gravity and three-body scenes (alpha.7)

```js
space.addConstraint({
  id: 'attraction', type: 'gravitational', anchor: 'A', target: 'B',
  strength: 1_000_000, softening: 10
});
```

This link attracts both endpoints using their `dynamics.mass` (default 1).
Add A–B, B–C and C–A for a three-body system; any number of bodies can be linked.
Pinned bodies and bodies held during a drag still attract their partners.
Prescribed trajectories act as moving attractors. The center remains kinematic.
Use `dynamics: {mass, vx, vy}` to set initial velocities in scene units per second.

Acceleration of A is `G * massB * (B - A) / (distance² + softening²)^(3/2)`.
`strength` is finite and nonnegative, in distance³ / (mass × second²);
`softening` is a finite positive distance. Softening removes the singularity at
coincidence and approximates Newtonian gravity outside that length scale.
It does not model collisions or merge bodies. Each pair is evaluated once per
force evaluation; avoid duplicate links unless you want their forces to add.

Gravity uses velocity Verlet with substeps of at most 1/240 second. Geometric
constraints and springs are projected between drift and the final velocity kick;
these interactions, dragging and damping can change energy. Large strengths or
masses with very small softening may require rescaling the scene for accuracy.

Run `node packages/musicspace-engine/examples/three-body.mjs` after building for
a complete headless example. In the workbench select **Three-Body Gravity**:
three equal masses start in a rotating equilateral configuration. This orbit is
unstable to perturbations; drag a body to explore other paths. Select **Draw
Selected** to trace a body, and **Reset** to restore the initial conditions.

## Alpha limits

- The default solver uses bounded deterministic propagation. XPBD is available via
  `solver: 'xpbd'`, remains experimental, and does not guarantee a feasible solution.
- Coordinates use the existing engine's pixel-like units: distance tolerance is
  0.5 units, angle tolerance 0.01 rad, minimum internal distance 2 units. Use a world
  spanning hundreds of units rather than normalized 0–1 geometry.
- Interactive moves are unbounded. Legacy `bounce` and bouncing `translation`
  trajectories still reflect inside an 800 × 600 world with an 11-unit margin.
  Set `bounce: false` for an unbounded translation. Configurable bounce bounds and
  solver tolerances are migration work, not exposed by this alpha.
- Legacy `vx`, `vy`, `angularSpeed` and shuttle `speed` are per simulation step;
  `periodSeconds` is in seconds. The simulation step is fixed.
- Only one pointer drag per scene is modeled. Batch proposals from multiple moving
  controls and priority policies need further API work.
- Topology/authoring edits validate and rebuild the model from a snapshot. Use
  `move` or `step` for continuous interaction; those do not rebuild the graph.
- The scene JSON is a package-specific format. Use the optional legacy-patch
  adapter above to preserve workbench audio/MIDI patches. Constraint IDs, state
  isolation and neutral point names are public; internal classes are not exported.

## Development and migration safety

```sh
npm test --prefix packages/musicspace-engine
npm test
npm run check
```

The build reads the shared engine sources at the repository root and wraps them in
private module scopes. Generated files live in `dist` and are not committed. There
is no fork of the solver code to maintain and no change to how the current app runs.
The archive is standalone once built. Tests compare the packaged API with the
existing engine and install the archive into a temporary independent project.

The compatibility suite covers all 27 library patches: normalized round trips,
both solvers, dragging/release, center movement, fixed-step animation, residuals,
dynamic velocities and continued motion after saving/loading. Focused tests cover
paused edits, bounds, metadata, reserved names and explicit export failures. These
tests establish engine compatibility for the exercised scenarios. The workbench
browser suite additionally covers inspectors, undo, traces and audio lifecycle in
experimental package mode. Large-scene regressions cover up to 1,000 controls.

The distribution test installs the archive in a separate project, compiles strict
TypeScript consumers with NodeNext (ESM and CommonJS) and Bundler resolution,
and executes both Node outputs. It also checks that invalid API calls produce
type errors. See `MIGRATION.md` for completed stages and remaining work.
