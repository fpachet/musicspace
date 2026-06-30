# TODO

This file collects likely next steps for the MusicSpace prototype. It is intentionally lightweight: the project is still a small static demo, so these items should stay practical and easy to revise.

## Near Term

- Add a browser smoke test that loads `musicspace.html`, checks for console errors, and verifies the Start/Stop/Reset controls.
- Add a small favicon or page icon to avoid the missing `favicon.ico` request during local serving.
- Add an explicit pause/resume state for trajectory playback.

## Interaction Model

- Expand the patch menu with more built-in scenes as new constraints and trajectories are introduced.
- Add visible delete affordances for sources, movers, and constraints beyond keyboard deletion.
- Generalize the rotative-object popup into a compact side panel for all constraint nodes and movers.
- Add a reset option for manually moved constraint nodes.
- Add richer hover tooltips that identify listener, sources, and constraint types without cluttering the canvas. Long source labels now render outside source markers.
- Add parameter controls for newly created constraints and non-rotative trajectories instead of relying only on defaults.

## Constraint System

- Clarify how conflicts between several constraints should be resolved.
- Add focused fixtures for solvable local failures before deciding whether transactional propagation or generalized per-constraint backoff is worth adding.
- Use patches as regression fixtures for solver behavior, including the product + radial limit backoff case.
- Use `CONSTRAINTS.md` as the implementation backlog for paper-backed constraints, temporal trajectories, trace drawing, and output mappings.
- Add more constraint types, such as alignment, barycenter, zone/region, grouping, symmetry, and handles.
- Add examples that reproduce canonical MusicSpace/MidiSpace scenarios.
- Move constraint propagation into a small testable model module once behavior stabilizes.
- Replace patch-level undo snapshots with operation-aware transactions once the engine is split from the UI.

## Temporal Trajectories

- Expand moving objects into editable timeline objects that can be recorded, edited, replayed, serialized, and constrained.
- Add trajectory types such as waypoint paths, recorded gestures, constrained bouncing inside zones, and compound mover presets.
- Expand trace drawing so any moving source can leave a persistent trace, and export either the trace layer or the composed scene drawing.
- Add tests and patches for mover-to-mover solid attachments, cycloid-like compound motion, and trajectory failure/backoff.

## Audio and MIDI

- Add a server-backed audio stem-splitting import flow. The first trial used `audio-separator` with the Demucs `htdemucs` model to produce vocals, drums, bass, and other stems; MusicSpace can then create one source binding per stem.
- Replace or complement the current Web Audio Faust-style demo with a real compiled Faust DSP backend.
- Add a patch-level editor for generic parameter mappings instead of defining them only in built-in JSON.
- Expand the Faust target backend beyond the current adapter-based `faust-wasm` bridge, including compiled DSP loading/introspection workflows.
- Expand the MIDI/MusicXML client with richer instrument rendering, MIDI output selection persistence, and mapping presets.
- Add OSC and spatial audio adapters as target backends that consume named parameter values and target manifests.
- Map source positions to useful audio parameters such as pan, gain, distance attenuation, or reverb send.
- Expand the generic mapping layer beyond source features so handles, trajectories, and constraint values can drive arbitrary target parameters.
- Expand the optional demo sound sources into richer spatialized audio with distance attenuation and reverb send.

## Project Hygiene

- Add a simple formatter or linter once the codebase grows beyond a single JavaScript file.
- Keep the GitHub Pages workflow healthy as the public live demo changes.
- Keep the README focused on usage and move longer research notes into separate documentation if it grows.
- Add screenshots or a short animated capture after the UI stabilizes.
- Decide whether this should remain a static prototype or become a packaged JavaScript module.

## Open Questions

- Should sources represent abstract control points, audio tracks, MIDI channels, or all of these?
- Should constraints be enforced exactly, approximately, or with priorities?
- Should the interface remain purely 2D, or should it eventually support mixed 2D/3D spatialization?
- What is the smallest useful musical demo that proves the concept?
