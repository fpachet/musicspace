# TODO

This file collects likely next steps for the MusicSpace prototype. It is intentionally lightweight: the project is still a small static demo, so these items should stay practical and easy to revise.

## Near Term

- Add pointer events so dragging works consistently with mouse, trackpad, stylus, and touch screens.
- Add a browser smoke test that loads `musicspace.html`, checks for console errors, and verifies the Start/Stop/Reset controls.
- Add a small favicon or page icon to avoid the missing `favicon.ico` request during local serving.
- Improve drag behavior by changing the cursor on hover and preserving the pointer offset from the dragged object center.
- Add an explicit pause/resume state for animation if more animated sources are introduced.

## Interaction Model

- Add controls for creating and deleting sound sources.
- Add controls for creating and deleting constraints.
- Make constraint nodes easier to inspect, possibly with a compact side panel showing their parameters.
- Add a reset option for manually moved constraint nodes.
- Add labels or tooltips that identify listener, sources, and constraint types without cluttering the canvas.

## Constraint System

- Separate the constraint model from the canvas UI so the propagation logic can be tested independently.
- Clarify how conflicts between several constraints should be resolved.
- Add more constraint types, such as fixed distance, alignment, barycenter, angle range, and circular trajectory constraints.
- Add serialization so scenes can be saved and restored as JSON.
- Add examples that reproduce canonical MusicSpace/MidiSpace scenarios.

## Audio and MIDI

- Decide the first real output target: Web Audio spatialization, MIDI control, OSC, or another control stream.
- Map source positions to useful audio parameters such as pan, gain, distance attenuation, or reverb send.
- Add an optional demo sound source so the spatialization behavior can be heard.
- Consider Web MIDI support for controlling external devices or software.

## Project Hygiene

- Add a simple formatter or linter once the codebase grows beyond a single JavaScript file.
- Add GitHub Pages deployment for a live demo.
- Keep the README focused on usage and move longer research notes into separate documentation if it grows.
- Add screenshots or a short animated capture after the UI stabilizes.
- Decide whether this should remain a static prototype or become a packaged JavaScript module.

## Open Questions

- Should sources represent abstract control points, audio tracks, MIDI channels, or all of these?
- Should constraints be enforced exactly, approximately, or with priorities?
- Should the interface remain purely 2D, or should it eventually support mixed 2D/3D spatialization?
- What is the smallest useful musical demo that proves the concept?
