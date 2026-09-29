# MusicSpace

MusicSpace is an old idea: bringing together the power of constraint propagation with spatialization and parameter control. The idea was developed at Sony CSL, originally in Java, and was the subject of Olivier Delerue's Ph.D. as well as many papers. It deserves to be brought back to life with modern technologies: it is still largely unexploited, and has many possible domains of application.

This project is a browser-based MusicSpace workbench for constraint-based spatialization and musical control. Sources, listeners, movers, trajectories, and constraint nodes are represented as 2D objects on a canvas; Moving one object propagates through the active constraint graph in real time until the scene reaches a stable fixed point or reports the remaining residuals.

MusicSpace now includes two interactive solver modes: the default bounded propagation solver with local repair/backoff strategies, and an experimental XPBD solver for iterative best-fit geometric projection. It also includes a JSON patch library, an editable patch inspector, patch validation, documented constraint semantics, source audio bindings, source generators, trajectory and rotative-object editing, trace drawing/export, regression tests, generic parameter mappings, Web Audio target backends, Faust-ready target binding, and MIDI/MusicXML sequence spatialization. Implemented constraints include angle, balance/sum, product, radial limits, fixed distance, distance ratio, pin, solid link, minimum separation, angle sector, and dynamic springs. Spring networks add mass, damping, and optional gravity through the existing XPBD projectors, while their moving positions continue to drive musical mappings.

Live demo: <https://fpachet.github.io/musicspace/>

## Build your own interface

Try the [Orbit × MusicSpace proof of concept](examples/orbit-musicspace/README.md):
three instruments combining Yann Orlarey's Faust Orbit UI with the standalone
MusicSpace engine and real Faust WebAssembly audio.

- [Study 01: Play the relationships](https://fpachet.github.io/musicspace/examples/orbit-musicspace/) — linked dry/wet controls, a spring and an automatic cutoff sweep.
- [Study 02: Constellation](https://fpachet.github.io/musicspace/examples/orbit-musicspace/constellation.html) — ten controls and nineteen constraints, with visible links and individual rule switches.
- [Study 03: Living springs](https://fpachet.github.io/musicspace/examples/orbit-musicspace/living-springs.html) — fourteen springs driven continuously by two moving anchors; pluck the dots and adjust speed, tension and damping.

Click **Start sound** to hear each instrument. To run locally, use `npm run serve`
and open `/examples/orbit-musicspace/`. The demo folder is self-contained and
includes a walkthrough and the proposed Orbit integration patch.

The [MusicSpace engine package](packages/musicspace-engine/README.md) exposes the
shared constraint engine for custom interfaces: points, geometric relations,
trajectories, linked rotations, spring dynamics, change notifications and scene
save/restore. Your application supplies the rendering, gestures and parameter
meanings. JavaScript ES modules, CommonJS and TypeScript declarations are included.

**Status: `0.1.0-alpha.5`, distributed as an installable archive, not published on npm.**
For recipients, start with the [package quick-start guide](packages/musicspace-engine/QUICKSTART.md)
and [release notes](packages/musicspace-engine/CHANGELOG.md).
`@musicspace/engine` is a provisional package name. The workbench uses its original engine by default. An optional
package-backed Play and Edit mode is available for testing the gradual migration.
All 23 presets and larger scenes are covered by regression checks;
[performance measurements](benchmarks/package-performance.md) include 1,000 controls.

Build and try the package from this repository:

```sh
npm run build --prefix packages/musicspace-engine
node packages/musicspace-engine/examples/basic.mjs
npm run serve
```

Open <http://localhost:8000/packages/musicspace-engine/examples/playground.html>
for three interactive examples: balance around a movable center, a rotating
constellation, and coupled springs. Building the package is required for these
examples; the existing workbench continues to run without a build.

After building, open <http://localhost:8000/musicspace.html?engine=package> to try
the current interface with the package engine. Add `&patch=musical-spring` to select
a patch, or `&solver=xpbd` to compare solvers. A banner identifies this experimental
mode. Both **Play** and **Edit** are available: create/delete controls and constraints,
edit trajectories and source bindings, change JSON, and undo edits. Invalid geometry
edits leave the scene and undo history intact. Empty patches can be saved and loaded.
The experimental UI uses plain display records and renderer functions, with all
simulation owned by the package. The standard engine remains the default.
The return link reloads the selected built-in patch with the standard engine;
it does not transfer live changes. Without `?engine=package`, no package artifacts
are loaded and no build is needed.

See the [package guide](packages/musicspace-engine/README.md) for creating an
installable archive, the API and alpha limitations, and the
[migration plan](packages/musicspace-engine/MIGRATION.md) for preserving current
interfaces and saved patches. Current limitations include pixel-like units,
fixed bounce bounds and one active drag per scene.

An optional `@musicspace/engine/legacy-patch` adapter now imports and exports the
existing workbench patches while preserving output bindings and display metadata.
Equivalence tests cover all 23 library patches with both solvers; the workbench
itself has not been migrated.

## Demo Snapshots

| Cycloid Percussion | OpenSpace Ostinatos |
| --- | --- |
| ![MusicSpace Cycloid Percussion audio demo](assets/screenshots/musicspace-cycloid-percussion.png?v=demo-gallery) | ![MusicSpace OpenSpace Ostinatos MIDI generator demo](assets/screenshots/musicspace-openspace-ostinatos.png?v=demo-gallery) |
| Jazz Trio MIDI Spatializer | Granular Cloud Study |
| ![MusicSpace Jazz Trio MIDI spatialization demo](assets/screenshots/musicspace-jazz-trio-midi.png?v=demo-gallery) | ![MusicSpace Granular Cloud parameter mapping demo](assets/screenshots/musicspace-granular-cloud-study.png?v=demo-gallery) |

Short WebM captures. Cycloid Percussion, Faust Control Study, Granular Cloud Study, and Musical Spring include recorded sound; Cycloid Rotator is motion-only.

| Cycloid Rotator | Cycloid Percussion |
| --- | --- |
| [Watch clip](assets/videos/musicspace-cycloid-rotator.webm) | [Watch clip](assets/videos/musicspace-cycloid-percussion.webm) |
| Faust Control Study | Granular Cloud Study |
| [Watch clip](assets/videos/musicspace-faust-control-study.webm) | [Watch clip](assets/videos/musicspace-granular-cloud-study.webm) |

**Musical Spring:** [Watch WebM](assets/videos/musicspace-musical-spring.webm) · [Watch MP4](assets/videos/linkedin/musicspace-musical-spring-linkedin.mp4). Two drag-and-release gestures excite the coupled masses and vary synth pitch and filter frequency.

## Running

Serve the repository root locally:

```sh
npm run serve
```

Then open <http://localhost:8000/musicspace.html>.

`npm run serve` is a convenience wrapper around `python3 -m http.server 8000`; no npm package installation or build step is required. Keep that terminal running while using MusicSpace.

The built-in patch library is loaded from JSON files, so the page must be opened through HTTP. Opening `musicspace.html` directly from Finder or as a `file://` URL causes the message `Could not load built-in patch JSON: Failed to fetch`. If that appears, start the server from the repository root and reload <http://localhost:8000/musicspace.html>.

The current propagation solver remains the default. Use the Solver segmented control above the canvas to switch between Propagation and the experimental XPBD solver. You can also open <http://localhost:8000/musicspace.html?solver=xpbd> directly.

No build step or package installation is required.

For development, use Node.js 22.13 or later and run `npm ci` once. Run syntax and lint checks with:

```sh
npm run check
```

Run all unit, model, parser and lifecycle regressions with:

```sh
npm test
```

Run the Chromium integration tests with:

```sh
npx playwright install chromium
npm run smoke
```

Refresh the README screenshots with:

```sh
npm run capture:screenshot
```

Refresh the demo videos with:

```sh
npm run capture:video
```

The video capture script uses Playwright/Chromium for the canvas recording and `ffmpeg` to mux the recorded Web Audio bus into the `.webm` files.

Export LinkedIn-friendly MP4 versions of the sound demos with:

```sh
npm run export:linkedin
```

Regenerate only the spring clip and its MP4 export with:

```sh
npm run capture:video -- musical-spring musicspace-musical-spring.webm 14000
npm run export:linkedin -- musicspace-musical-spring.webm
```

## Controls

### On a phone

Use **Play** mode, choose a patch, and tap **Play Sound** when available. Touch near
an object and drag it; touch targets stay at least 44 screen pixels across even
when the scene is scaled down. For springs, drag a red mass endpoint and release.

Tap **Expand** to use the entire screen, in portrait or landscape. Objects keep their proportions, and you can drag them into the extra space around the patch. **Close**
returns to the controls. The scene keeps its proportions in either orientation.
**More** reveals drawing and trace controls. Selection help appears below the canvas.
In **Edit** mode, creation tools sit below the scene and inspectors fit the screen.

### General controls

- Use the patch menu to load built-in scenes, including constraint examples and trajectory studies.
- Use **Play** mode for the selected patch: runtime transport, MIDI output, fullscreen, and trace controls are shown only when they apply.
- Use **Edit** mode for authoring: the creation palette, solver, import, patch inspector, JSON editor, and save/load patch controls appear there.
- In Edit mode, use **Save Patch** / **Load Patch** to export and import scene JSON.
- In Edit mode, use **Inspect** in the Patch toolbar to open the Patch Inspector popup, validate scene/backend references, edit generic parameter mappings, or open **JSON** for an editable patch snapshot. Applying edited JSON creates a separate edited patch entry in the menu.
- The patch strip under the toolbar shows the current example description and tags so built-in patches are easier to browse.
- Use the tool palette to create sources, movers, constraints, and simple trajectories directly on the canvas.
- Sum and Product constraints accept two or more sources. Click the tool, select each source, then click the same Sum/Product tool again to finish.
- Use **Orbit** when the mover itself should travel around the listener.
- Use **Spin** to create a rotative object. Link sources or movers to it with **Link**; linked objects rotate around it.
- Double-click a source to open the Source Inspector. A source can stay as a pure geometric/control object, or it can be renamed and assigned to one active output mode: audio file, MIDI ostinato generator, or, for imported sequence patches, MIDI file track. The inspector shows only the controls that apply to the selected output mode; changing the output and applying removes the previous source output binding.
- MIDI ostinatos can map source position features to pitch, period, duration, velocity, or channel.
- Patch-level parameter mappings can be edited in the Patch Inspector. Use **Add Mapping** to connect a source feature such as `distance` or `angle` to a target parameter such as `/filter/frequency`, then apply the mapping and use **Play Sound** to hear the backend follow the scene.
- Double-click a rotative mover to open its popup editor, where its start state, revolution period, direction, and displacement-induced rotation can be changed.
- Double-click a shuttle mover to open its popup editor, change endpoints, and toggle its dotted path line. Each endpoint can be a fixed point or an existing object such as a source, mover, or the listener.
- Double-click the listener to open the Listener Inspector and choose listener mode:
  - **Re-anchor** moves the listener and retargets constraints to the new geometry.
  - **Preserve** moves the listener while preserving active constraints.
- Use the **Solver** control to switch between the default Propagation solver and the experimental XPBD solver.
- Drag the listener, sources, movers, or constraint nodes on the canvas.
- Double-click a source, the listener, a rotative/shuttle mover, or a constraint node to edit its parameters in a popup inspector. Use the arrow buttons in an inspector to move to the previous or next editable item.
- The canvas shows a compact selection summary and source-type legend for silent/control, audio, and MIDI-emitting sources.
- Hold Shift while dragging to pause constraint propagation for fine positioning; releasing the drag retargets constraints to the paused layout before normal propagation resumes.
- Use arrow keys to nudge the selected object; hold Shift for larger steps.
- Use **Fullscreen** in the Display toolbar to let the canvas fill the viewport; press Escape to return to the normal layout.
- Use **Draw Selected** in the Display toolbar to let the selected listener, source, mover, or constraint node draw on the trace layer while it moves.
- Use **Stop Drawing All** to turn off drawing for every object without erasing the current trace.
- Pure geometric/control sources draw as light hollow handles; sources with audio-file, additive synth, MIDI-file track, or generated MIDI output draw with a stronger emitter style and a small sound or MIDI icon badge.
- Use Backspace/Delete to remove the selected source, mover, or constraint node. Dependent constraints are removed with deleted sources/movers.
- Use Cmd/Ctrl+Z to undo edits, especially deletes. The toolbar shows the pending undo action when one is available.
- Use **Start Movers** / **Stop Movers**, or press Shift+Space, to animate movers. Restarting resumes their positions; the simulation uses elapsed time consistently across display refresh rates and pauses its clock while the page is hidden. The mover transport appears only on patches with moving objects.
- Use **Play Sound** / **Stop Sound** or press Space to enable or stop browser sound. It starts source audio-file bindings, source generators, MIDI/MusicXML sequence playback, and parameter target backends only when the patch actually contains `sourceBindings`, `sourceGenerators`, `midiFile`, or `parameterMappings`; patches with only geometric constraints stay silent. Select a source and press `m` to mute or unmute its audio binding, additive synth, or generated MIDI ostinato.
- Transport and MIDI output controls are hidden when they do not apply to the current patch.
- Use **Load MIDI/MusicXML** to import `.mid`, `.midi`, `.musicxml`, `.xml`, or compressed `.mxl` files. MusicSpace creates one source per playable track or part.
- Use **Save Patch** after importing a sequence file if you want a portable patch JSON; user-loaded sequence patches embed their parsed note data because they do not have a project-local URL.
- On MIDI/MusicXML patches, the MIDI output controls appear automatically. **Internal GM Synth** renders basic browser piano, bass, and drum sounds; **External MIDI** sends notes and spatial control changes through Web MIDI when an output is available. Double-click a MIDI-file source to edit its track channel, program, and drum flag in the Source Inspector; channel changes are mainly meaningful for External MIDI because the internal browser synth is track-based. The Source Inspector can also convert that source away from its MIDI-file track output by choosing another output mode and applying the change. Stopping Play Sound sends MIDI panic messages so external synths release pending notes.
- Source generator mapping rows show the current source-motion value and resulting generator parameter value, so mappings such as angle-to-period or distance-to-gain can be checked while editing.
- Use **Clear Trace** in the Display toolbar to erase the trace canvas.
- Use **Save Trace** to download the current trace as `musicspace_trace.png`.
- Use **Reset** to restore the currently selected patch.

## Built-In Patches

See [the guided exercises](EXAMPLES.md) for a progression through the examples and their expected results.

- **Angle + Balance** shows a two-source angle relation plus a group balance/sum relation.
- **Product + Limit** demonstrates bounded deterministic backoff: a product constraint propagates multiplicatively, but once source B reaches its radial limit, the product correction is propagated to the remaining source.
- **Open Trio** is a simpler three-source balance scene for experimenting with listener and source motion.
- **Simple Rotator** has one rotative object carrying several sources.
- **Nested Rotators** links one rotative object to another, producing epicycle-like compound motion.
- **Cycloid Rotator** carries a rotative object around an orbital mover; enable drawing manually to produce cycloid-like traces.
- **Shuttle Spin** carries a rotative object between two draggable source endpoints.
- **Bouncing Constellation** carries a rotative object with a bouncing mover while preserving simple separation constraints.
- **Cycloid Percussion** binds three short bundled marimba, timbale, and bell loops to nested cycloid-style source motion, so Play Sound immediately demonstrates spatialized audio-file playback with changing rhythmic perspective.
- **OpenSpace Ostinatos** revives the Agon/Delerue OpenSpace idea in miniature: each source is a generated MIDI-style ostinato, and a rotative object moves the pulses through the stereo field.
- **Rotating Partials** uses native additive synthesis with partials as real sources: forty constrained sine oscillators form four rotating timbre constellations while mappings bend gain/frequency and independent swell envelopes animate the spectrum.
- **Beatles Trajectory Study** sketches the trajectory-driven remixing pattern: a rotative object carries several sources through solid links while ordinary constraints still propagate.
- **Jazz Trio MIDI Spatializer** declares a `midi-file` target, loads `Midifiles/triojazz.mid`, represents Bass, Drums, and Piano as three MusicSpace sources, and maps their listener-relative positions to pan, gain, reverb, and filter controls in either an internal browser synth or external MIDI output; the Source Inspector can retarget each track's external MIDI channel/program.
- **Faust Control Study** maps constrained source motion to a `faust-wasm` target: `/osc/freq`, `/filter/frequency`, `/filter/q`, and `/output/gain`. The bundled study includes a Faust DSP source plus a browser adapter, so it runs without a compile step while keeping the same patch-level binding used by compiled Faust artifacts.
- **FM Space** maps constrained source constellations to a Faust-style two-modulator FM synth: carrier frequency, modulator ratios/indices, vibrato, tremolo, feedback color, drive, filter, pan, and gain all move from MusicSpace geometry.
- **FM Harmonic Space** uses the same Faust-style FM target but snaps modulator ratios to harmonic integer values, letting continuous spatial motion choose stable FM islands instead of sweeping through every in-between ratio.
- **Chord Import Check** plays C and E together, followed by G, using a small MusicXML fixture.
- **Conflict Diagnostics** intentionally combines an incompatible pin and radial limit so residual reporting can be inspected.
- **Granular Cloud Study** maps compound trajectories and constraints to a self-contained granular synth: `/grain/rate`, `/grain/size`, `/grain/pitch`, `/grain/spread`, `/filter/frequency`, `/filter/q`, and `/output/gain`.

## Repository Layout

- `packages/musicspace-engine/` contains the standalone engine's public API, build script, TypeScript declarations, examples and distribution tests. Generated bundles and package archives are rebuilt locally and are not committed.
- `musicspace.html` contains the static page structure and styling.
- `musicspace.js` contains rendering, interaction, inspectors, undo commands, and output coordination.
- `musicspace-model.js` owns the headless scene and edit operations; `musicspace-solvers.js` and `musicspace-graph.js` own solving and indexed adjacency.
- `musicspace-trajectories.js` and `musicspace-clock.js` provide fixed simulation steps driven by elapsed time.
- `musicspace-patch.js` validates input before scene replacement and provides independent snapshots.
- `ARCHITECTURE.md` documents module boundaries and lifecycle contracts; `TESTING.md` documents checks and benchmarks; `EXAMPLES.md` provides guided exercises.
- `REFACTORING.md` records the reliability and performance implementation and measured results.
- `musicspace-mapping.js` contains backend-independent parameter mapping from scene features to target values.
- `musicspace-parameter-client.js` owns the generic target monitor UI, target lifecycle, mapping normalization, and patch serialization for `parameterMappings`.
- `musicspace-source-audio-client.js` owns per-source audio-file playback and listener-relative pan, distance gain, and distance reverb send for `sourceBindings`.
- `musicspace-generator-client.js` owns lightweight per-source generated playback for `sourceGenerators`, including MIDI ostinatos and additive sine-partial timbres.
- `musicspace-targets.js` contains the target backend registry plus Web Audio subtractive and granular examples.
- `musicspace-audio-capture.js` provides the optional recording bus used by the demo video capture script.
- `musicspace-midi-file-client.js` contains MIDI/MusicXML parsing, transport, Web MIDI output, and internal browser synth playback for sequence-file patches.
- `assets/` contains the favicon, README screenshots, and short demo video captures.
- `audio/cycloid-percussion/` contains the small bundled WAV loops used by the Cycloid Percussion patch.
- `patches/index.json` lists the built-in patch files loaded by the patch menu.
- `patches/*.json` contains built-in MusicSpace patches using the same JSON format as saved patches.
- The in-page Patch Inspector validates patch JSON against MusicSpace-level rules such as object references, constraint parameters, backend declarations, Faust adapter links, MIDI bindings, and parameter mapping targets.
- `targets/faust/` contains Faust target source/adapter files referenced by Faust patch JSON.
- `schemas/musicspace-patch.schema.json` documents the patch JSON format.
- `schemas/musicspace-patch-index.schema.json` documents the patch manifest format.
- `PATCH_FORMAT.md` explains how to author and register patch JSON files.
- `CONSTRAINT_SEMANTICS.md` documents current constraint invariants and propagation behavior.
- `MIDI_CONTROL_PLAN.md` describes the planned live MIDI input/output routing layer, distinct from MIDI/MusicXML sequence playback.
- `OPTIMAL_SOLVER_PLAN.md` documents the implemented XPBD prototype and the remaining real-time XPBD/least-squares solver roadmap.
- `TARGET_BACKENDS.md` describes Web Audio, Faust WebAssembly, MIDI, OSC, and other parameterized clients.
- `Midifiles/triojazz.mid` is the included three-track jazz trio MIDI example.
- Saved patches now write `parameterMappings`; older patches with `audioMappings` still load.
- `CONSTRAINTS.md` describes the planned constraint, trajectory, patch, backoff, and audio/parameter mapping roadmap.
- `TODO.md` tracks likely next steps for the prototype.
- `LICENSE` contains the MIT license.

## Background

- Pachet, F. and Delerue, O. On-The-Fly Multi-Track Mixing. Proceedings of AES 109th Convention, Los Angeles, USA, 2000 AES.
- Pachet, F. and Delerue, O. MidiSpace: a Constraint-based Temporal Music Spatializer. ACM Multimedia Conference, pages 351-359, Bristol, UK, 1998
- Pachet, F., Delerue, O. and Hanappe, P. Dynamic Audio Mixing. In I. Zannos, editor, Proceedings of ICMC, pages 133-136, Berlin, 2000 ICMA.
- Pachet, F., Delerue, O. and Hanappe, P. MusicSpace goes Audio. In Roads, C., editor, Sound in Space, Santa Barbara, 2000, CREATE.
- Pachet, F. and Delerue, O. MusicSpace: a Constraint-based Control System for Music Spatialization. Proceedings of ICMC 1999, pages 272-275, Beijing, China, 1999, ICMA.
- Delerue, O. and Agon, C. OpenMusic + MusicSpace = OpenSpace. Actes des Journées d’informatique musicale, JIM 99, Issy-les-moulineaux, pages 89-96, 1999
- Pachet, F. and Delerue, O. Annotations for Real Time Music Spatialization. Proceedings of International Workshop on Knowledge Representation for Interactive Multimedia Systems (KRIMS), Trento, Italy, 1998
- Pachet, F. and Delerue, O. A Mixed 2D/3D Interface for Music Spatialization. First International Conference on Virtual Worlds, Lecture Notes in Computer Science (no. 1434), pages 298-307, 1998, Springer Verlag.
- Delerue, O. and Pachet, F. MidiSpace, un spatialisateur Midi interactif. JIM 98, Agelonde, France, 1998
- Pachet, F. and Delerue, O. Constraint-Based Spatialization. First COST-G6 Workshop on Digital Audio Effects (DAFX98), pages 71-75, Barcelona, Spain, November 1998
- Delerue, O. and Pachet, F. MidiSpace: a Temporal Constraint-Based Music Spatializer. Workshop on Constraints for Artistic Applications, ECAI’98, Brighton, UK., 1998
- Delerue, O. Spatialisation du son et programmation par contraintes : le système MusicSpace, Ph.D. Université Pierre et Marie Curie, 2004

## Features

- Browser-based MusicSpace workbench with no build step or runtime dependencies.
- Deterministic local constraint propagation that establishes a fixed point for coherent edits, with local backoff/clamping and residual diagnostics for unsatisfied graphs.
- Experimental XPBD solver mode for iterative best-fit projection, with release refinement and regression coverage across representative constraint graphs.
- Compliant springs with mass, damping, optional gravity, rigid-link coupling, and saved velocities.
- Versioned JSON patch loading, saving, inspection, editing, and validation.
- Canvas palette for creating sources, movers, constraints, and trajectory assignments.
- Product constraints are shown with a `π` glyph, following the older MusicSpace visual convention.
- Built-in product + radial limit example for deterministic backoff.
- Built-in rotative-object + solid-link example for trajectory-driven remixing.
- Built-in parameter mapping examples with live Web Audio output, including Faust-style oscillator/filter and granular synthesis studies, plus a Patch Inspector mapping editor for changing those bindings without editing JSON.
- Per-source audio-file bindings through the Source Inspector, with listener-relative stereo pan, optional distance gain, and per-source mute.
- Per-source generators, editable in the Source Inspector, for small OpenSpace-inspired generated-note patches and sustained additive sine-partial timbres with optional partial-level amplitude drift, detune drift, and swell envelopes. MIDI ostinatos can render through the internal browser synth or an external Web MIDI output/channel, and Source Inspector mappings can connect spatial features to generator pitch, period, duration, velocity, channel, frequency, or gain.
- Built-in MIDI/MusicXML spatialization support with one source per playable track or part controlling pan, gain, reverb, and filter behavior.
- Trace export for animated source and mover motion.
- A sharper separation between MusicSpace scene logic, generic parameter mapping, target-client UI/lifecycle, optional client patches, and independent target backends.
- A compact codebase intended for continued experimentation with constraint-based spatialization controls.

## Springs and coupled oscillators

The patch menu includes **Simple Spring**, **Coupled Springs**, **Spring Pendulum**, and
**Musical Spring**. The simulation starts automatically, but the examples without gravity
begin at equilibrium. Drag the red **Mass**, **A**, or **B** endpoint and release to
excite the springs. In Spring Pendulum, drag **Bob** sideways. The pink **S** node is
an inspector/label handle: dragging it changes only its display position.

The musical patch maps A's Y position to pitch and B's Y position to filter frequency.
Click **Play Sound** to hear the result. Double-click S in Edit mode to adjust rest
length, stiffness, and damping; edit mass through the source inspector.
See the [launch instructions](EXAMPLES.md#spring-examples) and
[spring constraint documentation](CONSTRAINT_SEMANTICS.md#springs-and-dynamic-networks).

## Authors

- [François Pachet](https://github.com/fpachet)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
