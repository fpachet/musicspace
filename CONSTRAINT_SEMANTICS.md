# Constraint And Solver Semantics

This document describes the semantics implemented by the current MusicSpace prototype. It is a specification of the existing interactive engine, not a promise that this is the final solver architecture.

MusicSpace uses a deterministic local propagation engine. A user drag, keyboard nudge, or trajectory tick proposes a new position for one entity; constraints that mention that entity may move other entities; those moved entities are then propagated in turn until the queue drains to a fixed point or the bounded solver reports remaining residuals. This is not a global optimizer and it does not search all possible solutions, but it does give the interaction a stable, inspectable repair semantics.

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
