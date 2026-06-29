# MusicSpace Constraint Backlog

This file lists constraint, trajectory, and mapping types to implement once the prototype has a basic reusable engine. The list is grounded in the MusicSpace/MidiSpace papers, the current JavaScript demo, and the planned move toward real audio or arbitrary parameter control.

## Current Prototype Slice

- Canvas tool palette for creating sources, movers, and constraints by clicking objects.
- First-class moving objects with translation, orbital rotation, rotative/spin, shuttle, and bounce trajectories.
- Solid attachment constraints so sources or movers can be carried by moving objects, including rotative objects that rotate attached objects around themselves.
- Shuttle trajectories can use fixed endpoints or object endpoints, so the two extremities can be sources, movers, the listener, or fixed coordinates.
- Additional geometric constraints: fixed distance, distance ratio, pin, minimum separation, and angle sector.
- Product constraint nodes use a `π` glyph, matching the older MusicSpace visual convention.
- Rotative object editor for start/running state, revolution period, direction, and displacement-induced rotation.
- Per-object drawing toggle so listeners, sources, movers, and constraint nodes can leave traces while moving.
- Patch serialization for moving objects, trajectories, and the new constraint types.
- Built-in Beatles trajectory study patch that sketches the remixing-with-trajectories use case.
- Built-in Faust-style control study patches with serialized parameter mappings from source features to Web Audio synth parameters, including subtractive and granular synthesis backends.
- The current JavaScript code separates the canvas/constraint prototype from generic parameter mapping, target-client UI/lifecycle, optional client demo patches, and target backends.

## Constraint Propagation Model

The current demo uses deterministic local propagation rather than a full symbolic constraint solver. A drag or trajectory tick enqueues the moved entity, then each constraint that references it may adjust one or more dependent entities and report those adjusted entities back to the propagation queue.

Propagation is intentionally iterative: an entity can be processed more than once if another constraint moves it later in the same chain. This is necessary for shared-source graphs such as a source that belongs to two `sum` constraints and an `angle` constraint. The queue is bounded by a maximum total step count and a maximum per-entity process count, so cyclic or over-constrained scenes cannot loop forever.

Constraints that adjust groups, such as `SumConstraint` and `ProductConstraint`, must return every adjusted entity through `movedEntities`. Constraints that adjust a single dependent entity may return `movedEntity`. New constraint types should follow the same reporting convention, otherwise downstream constraints will not see the induced motion.

## Paper-Backed Core Constraints

### Balance / Constant Energy

- **Acts on:** two or more sources and the listener.
- **Goal:** preserve the total perceived energy of a group while individual sources move.
- **Current status:** partially implemented as `SumConstraint`.
- **Implementation note:** keep this as a first-class `BalanceConstraint`, with explicit conflict/backoff behavior when a drag would require impossible negative distances.

### Constant Angle

- **Acts on:** two or more sources and the listener.
- **Goal:** preserve angular relationships between sources around the listener.
- **Current status:** implemented for two sources as `AngleConstraint`.
- **Implementation note:** generalize from a pair to an ordered group of sources, preserving angular offsets or the full angular pattern.

### Constant Distance Ratio

- **Acts on:** two or more sources and the listener.
- **Goal:** preserve proportional distances to the listener.
- **Example:** bass stays twice as far from the listener as drums.
- **Implementation note:** solve radially, preserving each source angle unless another constraint requests otherwise.

### Radial Limits

- **Acts on:** one or more sources and the listener.
- **Goal:** constrain sources to stay within a minimum and/or maximum distance from the listener.
- **Visual form:** one or two circles centered on the listener.
- **Implementation note:** inequality constraint; violations should clamp or reject the user action depending on the active conflict policy.

### Grouping

- **Acts on:** two or more sources.
- **Goal:** preserve distances between sources, independently of the listener.
- **Example:** keep a rhythm section spatially grouped while the listener or other sources move.
- **Implementation note:** start with pairwise fixed distances; later support rigid groups that preserve shape and orientation.

### Handles / One-Way Constraints

- **Acts on:** a handle node and a set of sources or constraints.
- **Goal:** let users manipulate groups through higher-level controls without every relation propagating back to the handle.
- **Examples:** volume handle, plug/acoustic balance handle, section handle.
- **Implementation note:** model handles as directional propagators. They should be visible and draggable, but the user can choose whether underlying constraints are shown.

### Incompatibility

- **Acts on:** two or more sources.
- **Goal:** enforce that only one source in a set is active/audible at a time.
- **Example:** the closest source is heard and the others are muted.
- **Implementation note:** symbolic/audio-facing constraint. In the visual prototype, represent this by dimming inactive sources before real audio exists.

### Equalizing

- **Acts on:** source group, audio features, and output mix state.
- **Goal:** keep the spectral balance of the overall mix inside an acceptable range.
- **Implementation note:** defer until an audio engine or descriptor layer exists. This is not purely geometric.

## Temporal Trajectories And Dynamic Constraints

The original MusicSpace/MidiSpace idea includes time-varying source movements. Trajectories should be first-class timeline objects, not just animation helpers, because they may be constrained, recorded, edited, replayed, traced, and mapped to audio or arbitrary parameters.

In the initial system, trajectories were themselves handled through the constraint graph: a source could be attached with a solid constraint to a moving object, and moving objects could be constrained to other moving objects. We should preserve that idea. A trajectory should be represented as a temporal object that proposes motion, then ordinary deterministic propagation should make attached sources, handles, and other moving objects follow.

### Moving Object

- **Acts on:** source, listener, handle, constraint node, or another moving object.
- **Goal:** represent a time-driven point or frame generated by a temporal law such as translation, rotation, bounce, shuttle motion, or recorded path playback.
- **Implementation note:** moving objects should participate in the same graph as sources and constraints. They are not just animation callbacks; they are entities whose proposed positions are propagated through constraints each tick.

### Solid Attachment Constraint

- **Acts on:** one source, handle, listener, or moving object attached to another object.
- **Goal:** keep the attached object at a fixed relative offset, distance, angle, or local-frame transform from the carrier object.
- **Example:** attach a vocal source to a rotating moving object so it follows the rotation exactly.
- **Implementation note:** this is the key bridge between trajectories and ordinary source motion. It should work for source-to-mover, mover-to-mover, and source-to-source attachments.

### Composed Moving Objects

- **Acts on:** two or more moving objects connected by solid, distance, angle, or other constraints.
- **Goal:** create compound trajectories by constraining moving objects to each other.
- **Examples:** cycloids, epicycles, rotating objects carried by translating objects, bouncing objects carrying rotating children.
- **Implementation note:** each tick should first advance independent movers, then propagate through mover constraints, then propagate to attached sources and audio mappings.

### Timed Constraint Annotation

- **Acts on:** any constraint.
- **Goal:** add and remove constraints over musical time.
- **Example:** a balance constraint starts at beat 7.692 and lasts 2000 beats/ticks.
- **Implementation note:** constraints need lifecycle methods: `activate`, `deactivate`, `play(t)`, and smooth transition behavior when activation would violate the new constraint.

### Recorded Trajectory

- **Acts on:** source, listener, handle, or constraint node.
- **Goal:** replay recorded movements as temporal annotations.
- **Implementation note:** reuse the existing trace concept, but store time-tagged control points instead of only drawing pixels. Recorded trajectories should be editable and serializable.

### Rotation Trajectory

- **Acts on:** one source, source pair, or group.
- **Goal:** make a mover orbit around the listener or another center over time.
- **Example:** periodically emphasize strings or rhythm tracks as they pass closer to the listener.
- **Important distinction:** orbital rotation moves the mover itself. It is different from a rotative object, which stays conceptually central and rotates attached objects around itself.
- **Implementation note:** combine with angle limits to keep rotation inside musically useful sectors.

### Rotative Object / Spin Trajectory

- **Acts on:** moving object plus sources or movers attached by solid constraints.
- **Goal:** rotate attached objects around the rotative object, as in the old rotative constraint editor.
- **Parameters:** running/start state, revolution period, positive/negative direction, displacement-induced rotation.
- **Implementation note:** displacement-induced rotation means dragging the rotative object can also rotate the offsets of attached objects, not only translate the whole group.

### Translation Trajectory

- **Acts on:** source, listener, handle, group, or constraint node.
- **Goal:** move an object along a vector over time.
- **Example:** slowly pan a source from left-front to right-back.
- **Implementation note:** should support absolute target positions, relative offsets, speed-based motion, and duration-based motion.

### Bounce Trajectory

- **Acts on:** source, listener, handle, group, or constraint node.
- **Goal:** move an object until it hits a boundary, then reflect direction.
- **Examples:** bounce on canvas borders, bounce inside a zone, bounce inside radial or angular limits.
- **Implementation note:** boundaries should come from the scene, zones, or constraints. The bounce should occur before constraint propagation so dependent objects follow the reflected position.

### Lift / Shuttle Trajectory

- **Acts on:** source, listener, handle, group, or constraint node.
- **Goal:** move back and forth between two points.
- **Example:** a source oscillates between two spatial roles.
- **Implementation note:** support ping-pong timing, easing curves, optional pause at endpoints, and endpoints represented either as fixed coordinates or references to existing objects.

### Path / Waypoint Trajectory

- **Acts on:** source, listener, handle, group, or constraint node.
- **Goal:** follow a user-drawn or edited polyline/spline path.
- **Implementation note:** should support looping, ping-pong, one-shot playback, speed control, and snapping waypoints to meaningful objects or zones.

### Trace Drawing

- **Acts on:** any moving source, handle, or trajectory.
- **Goal:** optionally leave a visible trace of movement and save the whole drawing produced by motion.
- **Current status:** the demo can toggle drawing for the selected listener, source, mover, or constraint node, clear the trace layer, and save it as an image.
- **Implementation note:** make traces explicit layers with color, opacity, stroke width, fade/persist modes, clear/save controls, and scene serialization. Export should include either the trace layer alone or the composed scene plus trace.

### Angle Limits / Sector

- **Acts on:** one or more sources and the listener.
- **Goal:** keep sources inside an angular range.
- **Example:** drums and bass may rotate but remain in the rear half-plane.
- **Implementation note:** inequality constraint over azimuth; visualize with a wedge centered on the listener.

### Smooth Transition

- **Acts on:** any constraint activation or conflict recovery.
- **Goal:** when a constraint is added, avoid sudden jumps by moving objects gradually into a satisfying configuration.
- **Implementation note:** needs interpolation plus conflict detection. Treat this as engine behavior shared by constraints.

## Output Mapping Targets

Sources should not only be visual points. Their positions, trajectories, and constraint states should be mappable to real audio sources or arbitrary synthesis/control parameters.

The intended boundary is:

- **MusicSpace engine/UX:** owns entities, constraints, trajectories, propagation, hit testing, selection, editors, and patch state.
- **Parameter mapping layer:** converts scene features such as `x`, `y`, distance, angle, speed, or constraint error into named parameter values.
- **Parameter client layer:** owns mapping normalization against the active target manifest, the target-parameter monitor UI, target lifecycle, and patch serialization. It reads MusicSpace scene features through callbacks rather than importing scene objects.
- **Client demo patches:** optional examples that bind MusicSpace scenes to concrete targets. They are not part of the core scene engine.
- **Target backends:** receive named parameter values through an independent adapter. Targets should not know about MusicSpace objects or constraints.
- **Target manifests:** expose parameter ids, defaults, ranges, labels, units, scaling, and smoothing. Faust, Web Audio, MIDI, OSC, and spatial audio should all fit this shape.

### Audio Source Mapping

- **Acts on:** source, listener, and audio track/player node.
- **Goal:** map visual position to audio parameters such as gain, pan, distance attenuation, reverb send, azimuth, elevation, or spatializer coordinates.
- **Implementation note:** keep the mapping layer separate from constraints. Constraints decide geometry; mappings translate geometry to audio.

### Web Audio Spatialization

- **Acts on:** source and browser audio graph.
- **Goal:** use browser-native audio to make the prototype audible.
- **Current status:** the demo includes a simple Web Audio oscillator through a resonant low-pass filter, controlled by Faust-style parameter paths.
- **Implementation note:** extend this from scalar synth parameters to `PannerNode`, gain, stereo pan, and later multichannel or custom spatializers.

### MIDI / OSC Mapping

- **Acts on:** source, handle, constraint, or trajectory values.
- **Goal:** output MusicSpace control data to external music systems.
- **Implementation note:** MIDI CC and OSC-style mappings should support scaling, smoothing, rate limiting, and named destinations.

### Faust Parameter Mapping

- **Acts on:** source, handle, constraint, trajectory, or derived feature.
- **Goal:** drive arbitrary parameters of a Faust patch.
- **Examples:** x controls filter cutoff, distance controls reverb send, angle controls modulation index, trace speed controls delay feedback.
- **Current status:** the patch schema can serialize mappings from source features to target parameter paths, and the demo applies them to local Web Audio synth backends, including a subtractive oscillator/filter and a granular cloud.
- **Implementation note:** each mapping needs source expression, target parameter path, range transform, smoothing, and update rate. Treat compiled Faust DSP as one target backend in a generic parameter-mapping system.

### Derived Feature Mapping

- **Acts on:** computed values from the scene.
- **Goal:** map higher-level geometric features rather than only raw x/y.
- **Examples:** distance to listener, azimuth, speed, acceleration, distance ratio, group barycenter, constraint error, inside/outside zone state.
- **Implementation note:** derived features should be reusable by audio mappings, Faust mappings, visualization, and tests.

## Patches And Use Cases

Patches should become the main way to save, share, load, and regression-test MusicSpace scenes.

### Patch

- **Contains:** listener, sources, handles, constraints, trajectories, mappings, trace settings, and UI-relevant metadata.
- **Goal:** represent a complete use case that can be loaded from the interface.
- **Current status:** built-in patches live as individual JSON files in `patches/`, are listed by `patches/index.json`, and reference the JSON Schema in `schemas/musicspace-patch.schema.json`.
- **Implementation note:** patches should remain JSON-serializable and versioned. Built-in patches should use the same schema as user-saved patches.

### Built-In Patch Library

- **Goal:** provide canonical examples for demos and testing.
- **Initial examples:** angle + balance, product + radial limit backoff, open trio, simple rotator, nested rotators, cycloid rotator, shuttle spin, bouncing constellation, Beatles remix trajectory study.
- **Implementation note:** once the basic engine is ready, each bug or paper-inspired scenario should become a patch fixture.

### Trajectory Study Patches

- **Simple Rotator:** one rotative object carries several sources through solid constraints.
- **Nested Rotators:** a parent rotative object carries a child rotative object, which carries sources; this creates epicycle-like compound motion.
- **Cycloid Rotator:** an orbital mover carries a rotative object, whose linked sources draw cycloid-like paths.
- **Shuttle Spin:** a shuttle mover carries a rotative object between two draggable endpoint sources while attached sources rotate.
- **Bouncing Constellation:** a bouncing mover carries a rotative object and demonstrates that ordinary constraints can still participate.

### Product + Limit Patch

- **Goal:** demonstrate bounded deterministic backoff.
- **Scenario:** a product constraint propagates multiplicatively across sources; one source has a radial limit; once that source reaches the limit, product propagation continues over only the non-limited sources.
- **Implementation note:** this is the clearest current example of why per-constraint backoff strategies are useful without invoking a full constraint solver.

### Beatles Remix Trajectory Patch

- **Reference:** "Remixing the Beatles" by Sony CSL Paris, YouTube video `Wod1W2-DTgI`.
- **Goal:** reproduce the trajectory-driven remixing use case from the previous MusicSpace system.
- **Scenario:** musical sources are attached to moving objects. Moving objects can translate, rotate, bounce, or follow recorded paths, and can themselves be constrained to other moving objects to create compound curves such as cycloids.
- **Implementation note:** this patch should become a regression fixture for temporal propagation: mover tick, solid attachment, composed mover constraints, trace drawing, and audio/parameter mapping should all be exercised together.

## Useful Prototype Extensions

### Fixed Distance

- **Acts on:** one source and one anchor, usually the listener.
- **Goal:** keep a source at a constant radius.
- **Implementation note:** simple radial projection; useful as a building block for other constraints.

### Fixed Position / Pin

- **Acts on:** source, listener, handle, or constraint node.
- **Goal:** prevent an object from moving while other constraints propagate around it.
- **Implementation note:** important for conflict handling and user intent.

### Alignment

- **Acts on:** two or more sources or handles.
- **Goal:** align objects horizontally, vertically, on the same radial line, or on the same azimuth.
- **Implementation note:** implement as several small variants rather than one overloaded constraint.

### Symmetry / Stereo Pair

- **Acts on:** two sources and an axis or listener.
- **Goal:** keep sources mirrored around a center line.
- **Example:** preserve left/right stereo balance around the listener.
- **Implementation note:** should support mirror around listener-forward axis and arbitrary handle-defined axes.

### Barycenter / Group Center

- **Acts on:** source group and optional target point or handle.
- **Goal:** preserve or control the centroid of a group.
- **Implementation note:** useful for moving sections while keeping internal relationships partially flexible.

### Minimum Separation

- **Acts on:** two or more sources.
- **Goal:** prevent sources from becoming too close.
- **Implementation note:** inequality constraint; likely useful for preventing visual and audio clutter.

### Zone / Region

- **Acts on:** one or more sources.
- **Goal:** keep sources inside named spatial regions.
- **Examples:** soloist zone, accompaniment arc, rear percussion band.
- **Implementation note:** zones can be circles, annuli, sectors, rectangles, or arbitrary polygons later.

## Engine Requirements Before Implementing Most Of These

- Constraint model separated from canvas rendering.
- Trajectory model separated from animation rendering.
- Mapping model separated from constraints and trajectories.
- Multi-way propagation with clear driver/object roles.
- Directional and one-way propagation support.
- Inequality constraints that can clamp, reject, or report conflicts.
- Conflict policy: reject action, backoff, priority, or try alternate deterministic solutions.
- Speculative propagation transactions: try a propagation strategy on a temporary scene state, commit it on success, or roll it back on failure.
- Per-constraint backoff strategies: each constraint should expose an ordered list of deterministic repair methods before the engine declares failure.
- Constraint graph cycles with conflict checking.
- Serialization for sources, handles, constraints, trajectories, mappings, parameters, traces, and temporal annotations.
- Patch schema and patch library for saving, loading, sharing, and regression-testing use cases.
- Timeline scheduler for trajectory playback and timed constraint activation.
- Trace layer API for recording, clearing, compositing, and exporting movement drawings.
- Parameter mapping API with scaling, smoothing, update throttling, and backend adapters.
- Tests for each constraint independent of the canvas UI.

## Propagation And Backoff Policy

The original solver was deterministic: a user edit induced recursive propagations through the constraint graph, and failure stopped the edit. We should keep that direct interactive character, but add a bounded repair layer that tries alternate deterministic propagations before giving up.

### Design Principle

- Do not use a general-purpose combinatorial constraint solver for normal interaction.
- Keep propagation local, deterministic, and fast enough for pointer dragging.
- Treat backoff as a small ordered strategy list, not an open-ended search.
- Prefer predictable behavior over mathematically exhaustive solving.
- Make failure explicit when all strategies fail.

### Propagation Transaction

Each user edit or trajectory tick should run inside a transaction:

1. Snapshot the affected model state.
2. Apply the user's direct edit.
3. Propagate constraints in graph order.
4. If a constraint fails, try its backoff strategies in order.
5. Commit the first satisfying result.
6. If all strategies fail, roll back and report "No solution found" or a more specific message.

### Constraint Strategy Interface

Each constraint should eventually provide something like:

- `primaryStrategy`: the normal deterministic propagation.
- `backoffStrategies`: ordered alternate strategies.
- `check`: validates whether the constraint is satisfied.
- `explainFailure`: returns a useful message for the UI.

The exact code does not need to use exceptions, but the control flow should feel similar: a failed strategy aborts cleanly, restores state, and lets the engine try the next strategy. In JavaScript, this can be represented with returned result objects, thrown typed errors, or a small transaction helper.

### Example Backoff Strategies

- **Balance / Constant Energy:** distribute distance delta equally; if that would pass through the listener, clamp affected sources; if still impossible, back off the user-driven source.
- **Constant Angle:** when dragging A, move B; if B is pinned or blocked, move A less; if both fail, try rotating the whole group.
- **Radial Limits:** clamp to nearest valid radius; if another constraint rejects that, reject the user edit.
- **Grouping:** preserve rigid group shape; if impossible, preserve pairwise distances approximately in priority order.
- **Handles:** move controlled sources; if some sources are pinned, move only unconstrained members and report partial propagation if allowed.
- **Trajectories:** if the next tick violates constraints, project to nearest valid point; if projection fails, pause or reverse the trajectory.

### Failure Semantics

Failure should remain an ordinary part of the interaction model. The engine should be smarter than the original recursive solver, but it should not hide impossible configurations behind surprising jumps. Good failure behavior is:

- rollback the direct edit or trajectory tick;
- keep the previous valid scene;
- show a concise status message;
- optionally highlight the constraint that failed;
- leave a hook for future priority-based or approximate solving.

## Suggested Implementation Order

1. **Engine split:** model, renderer, scheduler, and mapping boundaries.
2. **Patch schema and built-in patch loader**
3. **Propagation transactions and deterministic backoff API**
4. **Fixed Distance**
5. **Radial Limits**
6. **Constant Distance Ratio**
7. **Grouping**
8. **Generalized Constant Angle**
9. **Handles / One-Way Constraints**
10. **Trace Drawing**
11. **Basic Trajectory API:** translation, rotation, shuttle, path.
12. **Angle Limits / Sector**
13. **Bounce Trajectory**
14. **Timed Constraint Annotation**
15. **Audio Source Mapping**
16. **Generic Parameter Mapping / Faust-ready backend**
17. **Incompatibility**
18. **Equalizing**
