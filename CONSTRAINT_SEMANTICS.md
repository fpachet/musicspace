# Constraint And Solver Semantics

This document describes the semantics implemented by the current MusicSpace prototype. It is a specification of the existing interactive engine, not a promise that this is the final solver architecture.

MusicSpace uses a deterministic local propagation engine. A user drag, keyboard nudge, or trajectory tick proposes a new position for one entity; constraints that mention that entity may move other entities; those moved entities are then propagated in turn until the queue drains to a fixed point or the bounded solver reports remaining residuals. This is not a global optimizer and it does not search all possible solutions, but it does give the interaction a stable, inspectable repair semantics.

An experimental XPBD-style solver is also available with `?solver=xpbd`. The propagation solver remains the default. XPBD solves only the affected connected component, projects constraints in deterministic phases, uses 10 iterations during drag/animation, and runs a 40-iteration refinement when an unpaused drag is released. The visible solver badge reports the selected mode. Components containing springs or explicit dynamic bodies always use mass-weighted XPBD substeps; see [spring dynamics](#springs-and-dynamic-networks).

## Core Concepts

### Entities

- `listener`: the spatial reference point for listener-relative constraints and parameter features.
- `source`: a sound/control source shown as a red point.
- `movingObject`: a trajectory object that can also participate in constraints.
- `constraint node`: a draggable visual handle for a constraint. Moving a constraint node changes only its display position, not the invariant.

### Stored Constraint State

Most constraints store an invariant when they are created or refreshed. Examples:

- `angle` stores the angular difference between two entities around the listener.
- `sum` stores the total distance from the listener to its sources.
- `fixedDistance` stores the distance between two entities.
- `solid` stores the offset from carrier to attached object.

When a patch is loaded, these stored values come either from serialized fields or from the initial geometry implied by the patch.

### Refresh Versus Enforce

`refreshConstraints()` retargets constraints to the current geometry. It updates stored values without moving dependent objects.

`enforceConstraints(moved)` preserves stored constraint values. It starts from the moved entity and propagates repairs through constraints.

Holding Shift during a drag pauses propagation. The dragged entity moves, residuals are reported, and dependent objects are left in place. When the drag ends, constraints are refreshed against the paused layout so the next unpaused edit continues from the tuned geometry instead of snapping back to the previous invariant state.

The listener has two drag modes:

- **Re-anchor:** moving the listener refreshes constraints to the new listener geometry.
- **Preserve:** moving the listener enforces existing constraints and moves dependent objects.

## Solver Loop

The current solver is a bounded breadth-first propagation loop:

1. Enqueue the entity that just moved.
2. Dequeue one moved entity.
3. Ask every constraint whether that entity affects it.
4. A relevant constraint may move one entity or several entities.
5. Newly moved entities are enqueued.
6. Stop when the queue is empty, the global step cap is reached, or one entity reaches its per-entity pass cap.
7. Measure residual error for every constraint and report the first remaining violation.

Current bounds:

- `MAX_PROPAGATION_STEPS = 96`
- `MAX_ENTITY_PROPAGATION_COUNT = 8`

When the queue drains without residuals, the scene has reached the fixed point induced by the edit and the active local repair rules. The solver does not roll back a whole edit when a later constraint remains unsatisfied. Instead, it reports residuals and caps in the status line. Some individual constraints perform local backoff or clamping; for example, product propagation can drop a limited source from its active correction set once a radial limit clamps it, then continue propagating over the remaining sources.

## Experimental XPBD Mode

XPBD mode is selected by opening `musicspace.html?solver=xpbd`. It is currently intended for comparison and tuning, not as the default behavior.

The XPBD solver:

- builds the connected component affected by the moved entity;
- falls back to propagation if the component exceeds the configured XPBD size limits;
- applies rotator solid-link frame deltas before projection;
- projects constraints in phase order: hard (`pin`, `radialLimit`, `angleSector`), structural (`solid`, `fixedDistance`, `separation`), then aggregate (`sum`, `product`, `distanceRatio`, `angle`);
- runs a final hard-constraint projection pass;
- preserves authored trajectory frames during animation ticks;
- reports best-fit residuals without entity-pass caps.

Current XPBD bounds:

- drag/animation iterations: `XPBD_ITERATIONS_DRAG = 10`
- release refinement iterations: `XPBD_ITERATIONS_RELEASE = 40`
- component entity cap: `MAX_XPBD_COMPONENT_ENTITIES = 48`
- component constraint cap: `MAX_XPBD_COMPONENT_CONSTRAINTS = 96`

## Numeric Tolerances

- Position/distance tolerance: `CONSTRAINT_EPSILON = 0.5 px`
- Angle tolerance: `ANGLE_EPSILON = 0.01 rad`
- Ratio tolerance: `RATIO_EPSILON = 0.01`
- Product tolerance: `RELATIVE_PRODUCT_EPSILON = 0.001` for reporting, `PRODUCT_EPSILON = 0.01` for enforcement
- Minimum usable distance: `MIN_DISTANCE = 2 px`

## Constraint Types

### `angle`

JSON shape:

```json
{ "type": "angle", "sources": ["A", "B"] }
```

Invariant:

```text
angle(listener -> B) - angle(listener -> A) = stored angle
```

Propagation:

- If `B` moves, `A` is rotated around the listener to preserve the stored angular difference.
- If `A` or the listener moves, `B` is rotated around the listener.
- The adjusted entity keeps its current distance to the listener.

Residual:

```text
abs(normalized(current angle difference - stored angle))
```

### `sum`

JSON shape:

```json
{ "type": "sum", "sources": ["A", "B", "C"] }
```

`sources` may contain two or more entities.

Invariant:

```text
sum(distance(listener, source_i)) = stored total distance
```

Propagation:

- If one source moves, all other listed sources share the radial correction.
- If the listener moves, all listed sources share the radial correction.
- Corrections preserve each adjusted source's current angle around the listener.

Backoff:

- Adjusted sources are clamped to `MIN_DISTANCE`.
- If clamping prevents exact satisfaction, the moved source may be backed off radially.
- Remaining error is reported as a residual.

### `product`

JSON shape:

```json
{ "type": "product", "sources": ["A", "B", "C"] }
```

`sources` may contain two or more entities.

Invariant:

```text
product(distance(listener, source_i)) = stored product
```

Propagation:

- If one source moves, all other listed sources are scaled radially by a shared multiplicative factor.
- If the listener moves, all listed sources are scaled.
- Adjusted sources keep their current angle around the listener.

Backoff:

- If an adjusted source has a `radialLimit`, the product propagator clamps that source and removes it from the active adjustment set.
- The remaining product error is redistributed across the remaining active sources.
- If no active set can satisfy the product, the constraint reports failure and leaves a residual.

### `radialLimit`

JSON shape:

```json
{
  "type": "radialLimit",
  "source": "A",
  "minDistance": 60,
  "maxDistance": 130
}
```

Invariant:

```text
minDistance <= distance(listener, source) <= maxDistance
```

Propagation:

- If the source or listener moves outside the allowed annulus, the source is clamped to the nearest valid radius.
- The source keeps its current angle around the listener.

Residual:

```text
max(0, minDistance - distance, distance - maxDistance)
```

### `fixedDistance`

JSON shape:

```json
{
  "type": "fixedDistance",
  "anchor": "A",
  "target": "B",
  "distance": 190
}
```

Invariant:

```text
distance(anchor, target) = stored distance
```

Propagation:

- If either endpoint moves, `target` is placed at the stored distance from `anchor`.
- The target keeps its current direction from `anchor`.

Current limitation:

- The current implementation always repairs by moving `target`, even when `target` was the moved endpoint. This makes the constraint directional in practice.

### `distanceRatio`

JSON shape:

```json
{
  "type": "distanceRatio",
  "sources": ["A", "B"],
  "ratio": 1.35
}
```

Invariant:

```text
distance(listener, A) / distance(listener, B) = stored ratio
```

Propagation:

- If `B` moves, `A` is adjusted radially.
- If `A` or the listener moves, `B` is adjusted radially.
- Adjusted entities keep their current angle around the listener.

### `pin`

JSON shape:

```json
{
  "type": "pin",
  "target": "A",
  "x": 320,
  "y": 240
}
```

Invariant:

```text
target.position = (x, y)
```

Propagation:

- If the target moves, it is translated back to the fixed point.
- Any trajectory frame attached to a moving object is translated with it.

### `solid`

JSON shape:

```json
{
  "type": "solid",
  "carrier": "Spin",
  "attached": "A",
  "offsetX": 80,
  "offsetY": 0
}
```

Invariant:

```text
attached.position = carrier.position + stored offset
```

Propagation:

- If the carrier moves, the attached entity moves to `carrier + offset`.
- If the attached entity moves, the carrier moves to `attached - offset`.
- If the carrier is a rotative moving object, its displacement-induced rotation may rotate the stored offset before applying it.

Current interpretation:

- This is a bidirectional solid link, but it is still local and deterministic. It does not solve rigid-body groups globally.

### `separation`

JSON shape:

```json
{
  "type": "separation",
  "sources": ["A", "B"],
  "minDistance": 50
}
```

Invariant:

```text
distance(A, B) >= minDistance
```

Propagation:

- If the pair is too close, the object that did not initiate the current propagation step is pushed away.
- The pushed object is placed exactly at `minDistance` from the current anchor.

Refresh behavior:

- Refreshing never decreases `minDistance`; it raises it to at least the current pair distance.

### `angleSector`

JSON shape:

```json
{
  "type": "angleSector",
  "source": "A",
  "centerAngle": -1.55,
  "width": 1.75
}
```

Invariant:

```text
abs(normalized(angle(listener -> source) - centerAngle)) <= width / 2
```

Propagation:

- If the source or listener moves outside the sector, the source is clamped to the nearest boundary angle.
- The source keeps its current distance to the listener.

## Trajectories And Constraints

Moving objects tick before constraints propagate. After each mover tick, `enforceConstraints(mover)` is called.

Trajectory frame behavior:

- Translating a moving object also translates relevant trajectory frame data.
- Translating a rotator can induce a rotation delta when `displacementInducesRotation` is enabled.
- Solid links attached to a rotator consume that rotation delta by rotating their stored offsets.

This means trajectories are motion proposals. Constraints decide how the rest of the scene follows each proposal.

## Failure And Reporting

Constraint `enforce()` methods return local repair results, but the engine determines global success by measuring all residuals after propagation.

The status line may report:

- a constraint-specific clamp/backoff message;
- a global propagation step cap;
- an entity pass cap;
- the first residual error above tolerance.

This makes current behavior interactive and inspectable, but not formally complete. Future solver work should decide whether failed edits should be rejected, rolled back, softened, animated into place, or left as residuals.

## Springs and dynamic networks

`SpringConstraint(anchor, target, restLength, stiffness, damping)` joins two existing
sources, free movers, or the listener. It uses the same constraint graph, node,
selection, inspector, deletion, and patch serialization as geometric constraints.
Use the **Spring** tool in Edit mode and click two endpoints. Use **Pin** to make
an endpoint a fixed anchor. Double-click the spring node to edit its parameters.

- **Rest length** is the distance with no elastic force (pixels). It defaults to
  the endpoint distance at creation. Zero is allowed.
- **Stiffness** defaults to 40. Larger values resist extension more strongly;
  very large values approach a rigid distance. Internally compliance is `1 / stiffness`.
  Zero stiffness disables elasticity while retaining any damping.
- **Damping** defaults to 2. It opposes relative velocity along the spring and
  removes energy. Small values allow many oscillations; large values settle more slowly
  without much overshoot. It does not damp unconstrained sideways or collective motion.
- **Mass** defaults to 1. More mass means less acceleration for the same force.
  Movable spring-connected objects automatically receive `dynamics: { mass, vx, vy }`.
  Mass must be positive; velocities are pixels/second. Edit a source's mass in its
  inspector, or set dynamics in patch JSON for sources and free movers.
- **Anchors** use existing `pin` constraints and have zero mobility in the solve.
  The listener and movers with authored non-free trajectories are kinematic supports:
  the dynamics solver does not accelerate them. Their normal edit/trajectory controls
  still set their positions. Do not give a trajectory-driven mover a competing physical motion.
- **Gravity** is an optional patch-level vector in pixels/second², for example
  `"gravity": { "x": 0, "y": 180 }`. Positive Y points down. Omit it or set both
  components to zero to disable gravity. It acts only on dynamic objects.

A hard geometric constraint projects positions toward an exact relationship.
A spring allows deformation, storing energy that drives later motion. Its extension
is therefore not reported as a failed geometric constraint. Ordinary constraint
residuals and conflict diagnostics still apply to the rest of the network.

### Interaction and composition

Spring patches start the simulation automatically. Without gravity or an initial
velocity/displacement, a spring at its rest length remains still. **Stop Motion /
Start Motion** pauses and resumes the simulation. The pink node with a coil glyph is a visual
label/inspector handle; dragging it only changes its display position. Drag a red
mass endpoint (**Mass**, **A**, **B**, or **Bob** in the examples) to excite the system.
Dragging an unpinned mass holds it at the pointer while connected objects
react. Releasing it restores its mobility; deformation supplies the initial energy.
The release does not estimate a mouse throw velocity. Pins retain their exact positions.
Shift-drag pauses the solve; on release ordinary constraints recapture as before,
while springs keep their rest lengths. Use **Recapture** in the spring inspector
when you intentionally want a new rest length.

The canvas renderer uses eight shaded coil turns, terminal rods, and endpoint collars.
Coil spacing follows the current endpoint distance; glow intensity follows absolute
deformation relative to rest length. These are display cues only and do not affect
forces, solver parameters, hit targets, or saved patch data.

Connect springs through shared objects and ordinary fixed-distance or solid links to
make coupled oscillators. A component containing a spring (or explicit dynamics) uses
the mass-weighted XPBD path in both toolbar solver modes. Components without dynamics
retain the selected static solver. Existing projectors are reused, so incompatible
hard constraints still produce a bounded best fit and residual diagnostics.

A pendulum needs only a fixed anchor, `fixedDistance` link, explicit dynamics on the
bob, and gravity. No separate pendulum type is needed. Removing a spring leaves its
objects' mass and velocity intact; remove their `dynamics` fields in JSON to return
an otherwise disconnected component to static editing.

### Integration and musical output

The existing 60 Hz clock calls `scene.step(dt)`. Dynamic prediction, compliant spring
projection, ordinary geometric projection, and velocity reconstruction run in substeps
of at most 1/240 second. Each spring's multiplier accumulates across solver iterations
and resets each substep. The damped XPBD update uses compliance `alpha = 1/k`,
`alphaTilde = alpha/h²`, and `gamma = c/(k*h)`, with algebra arranged to support `k=0`.
There is no separate force engine or physics dependency. Implicit integration introduces
some numerical damping even when spring damping is zero, especially for very stiff springs.

Headless code can call `scene.stepDynamics(1 / 60)` without ticking authored trajectories,
or `scene.step()` for the normal fixed tick. `stepDynamics` accepts finite positive steps
up to 0.25 seconds and subdivides them. `scene.beginDrag(entity)` / `scene.endDrag()` expose
the same hold/release behavior for deterministic tests. There are no simulated canvas
walls; unconstrained bodies can leave the visible area.

Motion updates the actual entity positions. The existing distance, angle, X/Y mappings,
spatial audio clients, trace drawing, and render loop observe those positions normally.
Saving includes mass, velocity, spring parameters, gravity, and node layout, allowing
motion to continue after reload. Existing version-1 files remain valid and acquire no
dynamic state unless their objects join a dynamic network.

## Mutual gravitational attraction

A `gravitational` link is a force between `anchor` and `target`, with finite
nonnegative `strength` (default 1,000,000) and finite positive `softening`
(default 10). Endpoint mass is `dynamics.mass` (default 1). Acceleration of A is
`strength * massB * (B - A) / (distance² + softening²)^(3/2)`, with the symmetric
reaction on B. The endpoints are interchangeable. Link every pair to build an
n-body system; each link contributes independently. The existing scene-level
`gravity` vector adds uniform acceleration to all mobile bodies.

Gravity has no target position and reports zero constraint error. Recapture and
center retargeting preserve strength and softening. Pins, the listener, dragged
bodies and prescribed trajectories act as fixed or kinematic attractors.
Mobile bodies receive mass and zero initial velocity when these are omitted.
Snapshots preserve masses, velocities and force parameters.

Components with gravitational links use velocity Verlet with substeps no longer
than 1/240 second. Springs and geometric projectors act between the drift and
second kick. Free gravitational systems approximately conserve energy; imposed
motion, damping and geometric projections can exchange energy. Softening removes
the point-mass singularity, but does not implement collisions or guarantee
accuracy for arbitrary masses/strengths at this fixed timestep. Scale large
forces down or increase softening if close encounters become poorly resolved.

The **Three-Body Gravity** preset is a rotating equilateral solution using equal
masses and all three pairwise links. Its angular speed is
`sqrt(3 * G * mass / (3 * radius² + softening²)^(3/2))`. Perturbations can grow;
this preset illustrates an initial solution, not a generally stable orbit.
