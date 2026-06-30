# Optimal Solver Plan

This document describes the XPBD/optimization roadmap for MusicSpace. It started as a design plan; part of it is now implemented behind the experimental `?solver=xpbd` mode. The default propagation semantics remain documented in `CONSTRAINT_SEMANTICS.md`.

## Current Prototype Status

Implemented:

- XPBD mode selected with `musicspace.html?solver=xpbd`.
- Visible solver badge.
- Affected-component builder with entity/constraint guardrails.
- XPBD projections for `pin`, `radialLimit`, `angleSector`, `fixedDistance`, `solid`, `separation`, `sum`, `product`, `distanceRatio`, and `angle`.
- Deterministic phase ordering: hard, structural, aggregate, then a final hard pass.
- Rotator-aware solid-link handling and trajectory-frame preservation during animation ticks.
- Drag/animation budget of 10 XPBD iterations.
- Mouse-release refinement budget of 40 XPBD iterations after unpaused drags.
- Propagation fallback when the affected component exceeds XPBD limits.
- Regression tests, solver comparison metrics, trajectory stability tests, and an XPBD iteration sweep.

Still open:

- richer mobility weights;
- better status/detail reporting for multiple residuals;
- optional least-squares refinement;
- broader manual comparison before making XPBD a user-facing default option.

## Motivation

The current engine propagates a move through the constraint graph one local repair at a time. This is deterministic and fast, but cyclic or over-constrained scenes can oscillate until a propagation cap is reached. In those cases the displayed residual means "the bounded local propagation stopped here", not necessarily "this is the best reachable configuration".

The proposed solver should instead answer this question:

```text
Given the user's intended edit or the trajectory tick, find the nearby scene geometry
that best satisfies all active constraints and report any unavoidable residuals.
```

For the product-plus-radial-limit case, this means source `Q` should be held on its allowed radial boundary when necessary, other movable entities should be adjusted coherently, and any remaining residual should be the best-fit residual under the declared priorities.

## Design Goal

The interactive solver should be real-time, continuous, and inspectable:

- **Real-time:** solve affected scenes during dragging and animation at interactive frame rates.
- **Local in scope:** solve only the connected constraint component affected by the edit, not the whole patch unless necessary.
- **Continuous:** warm-start from the previous frame so objects do not jump between unrelated mathematical solutions.
- **Priority-aware:** distinguish hard constraints, strong user intent, and soft musical/geometric preferences.
- **Diagnostic:** report exact residuals after solving, including which constraints are unsatisfied and by how much.
- **Compatible:** keep the existing JSON patch format and current constraint classes while introducing a solver adapter layer.

## Recommended Approach

Use a hybrid interactive solver:

1. **XPBD-style position projection** for the real-time interaction loop.
2. **Optional nonlinear least-squares refinement** for diagnostics or idle-time improvement.
3. **Interval CSP only as a later diagnostic/proof tool**, not as the primary interactive solver.

XPBD means Extended Position-Based Dynamics. It repeatedly projects positions toward constraint satisfaction with stiffness, compliance, and priorities. This fits MusicSpace because most constraints are geometric, scenes are small, and a good approximate solution is more useful during dragging than a slow proof of global feasibility.

Least squares is still useful because it gives a clear notion of "optimal": minimize weighted squared residuals. It can be added after the XPBD layer when a precise best-fit residual is needed.

Interval CSP is not recommended for the main drag loop. It can prove infeasibility or isolate solution boxes, but it is a poor first fit for smooth continuous interaction because nonlinear angle/product constraints can create many boxes and still require an objective to choose one visible layout.

## Solver Model

### Variables

Each movable entity in the affected connected component contributes numeric variables:

```text
x_i, y_i
```

The initial value is the current scene position, after applying the user's proposed edit or the current trajectory tick.

### Component Selection

For every edit or animation tick:

1. Start from the moved entity or trajectory-controlled entity.
2. Walk constraints and entities as a bipartite graph.
3. Include all reachable entities and constraints.
4. Exclude unrelated scene components.
5. Treat explicitly fixed objects as anchors.

This keeps the solve small and avoids perturbing unrelated musical controls.

### Anchors And Intents

The solver should distinguish between hard anchors and soft intents:

- **Hard anchor:** listener or entity cannot move in the current solve.
- **Strong soft intent:** dragged object or trajectory-driven target should remain near the requested position.
- **Weak soft intent:** non-dragged movable entities should remain near their pre-solve positions to preserve visual continuity.

This prevents arbitrary drift when many configurations satisfy the same constraints.

## Constraint Priority Classes

The initial implementation should use three priority classes.

### Hard Constraints

Hard constraints should be projected or enforced as bounds whenever possible:

- `pin`
- radial limits
- angle sectors
- non-negotiable solid links, if the patch marks them as hard
- explicitly locked listener/source/mover positions

Hard constraints may still report residuals if the scene is infeasible, but the solver should attempt to satisfy them before soft preferences.

### Strong Soft Constraints

Strong soft constraints should have high weights but may bend if hard constraints make exact satisfaction impossible:

- current drag target
- current trajectory target
- hard-looking geometric relations that would otherwise over-constrain the scene
- optionally `solid` links when they should remain stable but not make the solve impossible

### Soft Constraints

Soft constraints participate in the best-fit objective:

- `sum`
- `product`
- `fixedDistance`
- `distanceRatio`
- `angle`
- `minSeparation`
- visual continuity from previous positions

The exact class can later become patch-configurable. The first implementation can use fixed priorities.

## Constraint Residuals

Every constraint should expose a normalized residual function in addition to its current propagation method.

### Distance

```text
residual = distance(A, B) - targetDistance
```

### Radial Limit

```text
distance = norm(source - listener)
residualMin = max(0, minDistance - distance)
residualMax = max(0, distance - maxDistance)
```

For XPBD, the projection clamps the source to the nearest allowed radius.

### Distance Ratio

```text
residual = distance(listener, A) / max(distance(listener, B), MIN_DISTANCE) - targetRatio
```

### Product

Use log-space to improve numerical stability:

```text
residual = sum(log(max(distance(listener, source_i), MIN_DISTANCE))) - log(targetProduct)
```

This avoids huge gradients when products are large and makes multiplicative correction additive.

### Sum

```text
residual = sum(distance(listener, source_i)) - targetSum
```

### Angle

```text
residual = normalizedAngle(
  angle(listener -> B) - angle(listener -> A) - targetAngle
)
```

### Sector

```text
residual = 0 if angle is inside the sector
residual = signed angular distance to nearest sector boundary otherwise
```

### Pin

```text
residualX = x - pinnedX
residualY = y - pinnedY
```

### Solid Link

For a translation-only link:

```text
residualX = (attached.x - carrier.x) - storedOffsetX
residualY = (attached.y - carrier.y) - storedOffsetY
```

For rotative objects, the residual should be expressed in the local frame of the carrier.

## XPBD Interaction Loop

For each drag event or animation frame:

```text
1. Apply the proposed edit to a working copy of the affected component.
2. Add a strong soft intent constraint for the dragged or trajectory-driven entity.
3. Add weak stay-near-current-position constraints for other movable entities.
4. Run a fixed number of XPBD iterations, initially 10.
5. Project hard constraints first or with much higher stiffness.
6. Apply soft constraint projections in stable deterministic order.
7. Commit the solved positions back to the scene.
8. Measure all residuals using the existing reporting tolerance.
9. Display residual diagnostics only when residuals exceed tolerance.
```

Current iteration budget:

```text
dragging: 10 iterations
animation: 10 iterations
mouse release refine: 40 iterations
idle least-squares refine: not implemented
```

An iteration sweep on `Granular Cloud Study` showed the hard Spray move improving from three residuals at 4-8 iterations to zero residuals at 40 iterations while staying in a small CPU budget in the test harness.

## Projection Rules

The first XPBD implementation does not need a perfect projection for every constraint. It should support the highest-value constraints first.

### Phase 1 Projections

- radial limit: clamp source radius around listener.
- pin: restore pinned position.
- fixed distance: move one or both endpoints along the connecting line according to mobility weights.
- min separation: push entities apart when too close.
- soft position intent: move entity toward target using stiffness.
- solid link: preserve stored offset, splitting correction by mobility.

### Phase 2 Projections

- sum: distribute radial error across movable sources.
- product: distribute log-distance error across movable sources, respecting radial limits.
- distance ratio: correct both radial distances with mobility weights.
- angle: rotate one or both sources around the listener.
- sector: project angle to nearest valid boundary when outside.

### Phase 3 Refinements

- rotative-object local-frame constraints.
- nested mover constraints.
- trajectory-aware constraints that distinguish authored path intent from solver repair.

## Mobility Weights

Each entity should have a mobility weight for the current solve:

```text
0.0 = immovable
0.1 = nearly fixed
1.0 = normal movable
10.0 = preferred correction target
```

Correction should be split according to inverse mobility where appropriate:

- dragged entity: low correction mobility relative to its intent, so it stays near the cursor.
- pinned entity: zero mobility.
- ordinary source: normal mobility.
- trajectory-driven mover: strong target intent but not necessarily immovable.

This is the main mechanism for avoiding arbitrary or surprising movement.

## Least-Squares Refinement

After XPBD is stable, add an optional local least-squares solver for precise best-fit diagnostics.

Objective:

```text
minimize sum(weight_i * residual_i(positions)^2)
```

with hard constraints represented either as high-weight penalties or projected bounds.

Recommended use:

- run on mouse release;
- run during idle time after animation pauses;
- run as a debug/analysis command;
- compare XPBD residuals against a more explicit optimum.

Do not block the drag loop on least-squares convergence.

## Realtime Budget

The target scene size is small:

```text
5-30 movable entities
10-60 constraints
6-20 iterations per frame
```

The implementation should avoid allocation-heavy inner loops. Component arrays, variable buffers, and residual buffers should be reused when possible.

Performance target:

```text
under 2 ms per ordinary drag frame
under 8 ms for large built-in patches
60 fps when no audio/MIDI work dominates the frame
```

If a component exceeds the budget, the solver should reduce iterations during animation and run a refinement pass only when idle.

## Reporting Semantics

The status line should change from propagation-cap language to solve-quality language.

Current style:

```text
Q reached its radial limit. Propagation capped one entity after 8 passes. Limit residual 4.56 px > 0.5 px.
```

Proposed style:

```text
Best fit: Q held at radial limit. Limit residual 4.56 px > 0.5 px.
```

If the solver converges within tolerance:

```text
Constraints satisfied.
```

If a residual remains:

```text
Best fit: Product residual 0.013 > 0.001. Limit residual 4.56 px > 0.5 px.
```

The UI should avoid presenting expected hard-bound contact as an error. A source touching a radial limit is only noteworthy when it causes another residual or when a debug mode is enabled.

## Implementation Phases

### Phase 0: Instrument Current Behavior

- Status: mostly complete through regression tests and comparison metrics.
- Current behavior is preserved as the default.
- Known capped/over-constrained cases are covered by regression tests.

### Phase 1: Solver Adapter Layer

- Status: implemented for XPBD mode.
- The current propagation solver remains the default.
- Mobility is still basic and should be tuned next.

### Phase 2: XPBD Prototype Behind A Flag

- Status: implemented behind `?solver=xpbd`.
- A visible solver badge identifies the active mode.
- Built-in patch comparisons are covered in tests.

### Phase 3: Full Constraint Coverage

- Status: first implementation complete.
- Product and ratio use log-space style correction.
- Further projection quality tuning remains open.

### Phase 4: Status And Diagnostics

- Status: partially implemented.
- XPBD reports best-fit residuals without propagation caps.
- Detailed residual ordering/debug UI remains open.

### Phase 5: Idle Least-Squares Refinement

- Status: not implemented.
- XPBD release refinement at 40 iterations is implemented instead.
- Least-squares remains a later diagnostic/refinement option.

### Phase 6: Default Rollout

- Make XPBD the default only after built-in patches match or improve current behavior.
- Keep the propagation solver available as a fallback until confidence is high.
- Update `CONSTRAINT_SEMANTICS.md` when the default behavior changes.

## Test Plan

Add tests for:

- radial limit clamp with no residual;
- product plus radial limit with no propagation cap;
- infeasible product plus radial limit reporting best-fit residual;
- fixed distance with both endpoints movable;
- pin overriding drag intent;
- angle plus ratio cycle preserving continuity;
- trajectory tick under constraints staying within frame budget;
- deterministic results from identical initial state and edit.

For performance, add a synthetic large component test with a fixed iteration budget and assert that the solver completes without allocation spikes or unbounded loops.

## Open Decisions

- Which constraints are hard by default versus strong soft by default?
- Should `solid` be hard, soft, or patch-configurable?
- Should the listener be movable during ordinary source solves?
- How should trajectory intent be weighted against musical constraints?
- Should solver mode be visible in the UI or only exposed as a debug option?
- Which least-squares implementation should be used if a refinement pass is added?

## Non-Goals For The First Implementation

- Proving global optimality.
- Exhaustive interval search.
- Solving all disconnected components.
- Replacing the patch format.
- Introducing external runtime dependencies before the in-house XPBD prototype is evaluated.
