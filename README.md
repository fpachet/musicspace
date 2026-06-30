# MusicSpace

MusicSpace is an old idea: bringing together the power of constraint propagation with spatialization and parameter control. The idea was developed at Sony CSL, originally in Java, and was the subject of Olivier Delerue's Ph.D. as well as many papers. It deserves to be brought back to life with modern technologies: it is still largely unexploited, and has many possible domains of application.

This project is a browser-based MusicSpace workbench for constraint-based spatialization and musical control. Sources, listeners, movers, trajectories, and constraint nodes are represented as 2D objects on a canvas; Moving one object propagates through the active constraint graph in real time until the scene reaches a stable fixed point or reports the remaining residuals.

MusicSpace now includes two interactive solver modes: the default bounded propagation solver with local repair/backoff strategies, and an experimental XPBD solver for iterative best-fit geometric projection. It also includes a JSON patch library, an editable patch inspector, patch validation, documented constraint semantics, source audio bindings, trajectory and rotative-object editing, trace drawing/export, regression tests, generic parameter mappings, Web Audio target backends, Faust-ready target binding, and MIDI/MusicXML sequence spatialization. Implemented constraints include angle, balance/sum, product, radial limits, fixed distance, distance ratio, pin, solid link, minimum separation, and angle sector.

Live demo: <https://fpachet.github.io/musicspace/>

## Running

Serve the directory locally:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/musicspace.html>.

The built-in patch library is loaded from JSON files, so the page needs HTTP. Browsers usually block `fetch()` for local `file://` assets.

The current propagation solver remains the default. Use the Solver segmented control above the canvas to switch between Propagation and the experimental XPBD solver. You can also open <http://localhost:8000/musicspace.html?solver=xpbd> directly.

No build step or package installation is required.

If you have Node.js available, you can run a syntax check:

```sh
npm run check
```

Run the engine regression suite with:

```sh
node --test tests/constraint-engine.test.js
```

## Controls

- Use the patch menu to load built-in scenes, including constraint examples and trajectory studies.
- Use **Save Patch** / **Load Patch** to export and import scene JSON.
- Use **Patch Inspector** to read the active patch summary, validate scene/backend references, or open **JSON** for an editable patch snapshot. Applying edited JSON creates a separate edited patch entry in the menu.
- Use the tool palette to create sources, movers, constraints, and simple trajectories directly on the canvas.
- Sum and Product constraints accept two or more sources. Click the tool, select each source, then click the same Sum/Product tool again to finish.
- Use **Orbit** when the mover itself should travel around the listener.
- Use **Spin** to create a rotative object. Link sources or movers to it with **Link**; linked objects rotate around it.
- Double-click a source to open the Source Inspector. A source can stay as a pure geometric/control object, or it can be renamed and bound to an audio file.
- Double-click a rotative mover to open the editor, where its start state, revolution period, direction, and displacement-induced rotation can be changed.
- Double-click a shuttle mover to edit its endpoints and toggle its dotted path line. Each endpoint can be a fixed point or an existing object such as a source, mover, or the listener.
- Choose listener mode:
  - **Re-anchor** moves the listener and retargets constraints to the new geometry.
  - **Preserve** moves the listener while preserving active constraints.
- Use the **Solver** control to switch between the default Propagation solver and the experimental XPBD solver.
- Drag the listener, sources, movers, or constraint nodes on the canvas.
- Hold Shift while dragging to pause constraint propagation for fine positioning; releasing the drag retargets constraints to the paused layout before normal propagation resumes.
- Use arrow keys to nudge the selected object; hold Shift for larger steps.
- Use **Draw Selected** to let the selected listener, source, mover, or constraint node draw on the trace layer while it moves.
- Use **Stop Drawing All** to turn off drawing for every object without erasing the current trace.
- Pure geometric/control sources draw as light hollow handles; sources with audio-file or MIDI track bindings draw with a stronger emitter style and an `A`, `M`, or `A+M` badge.
- Use Backspace/Delete to remove the selected source, mover, or constraint node. Dependent constraints are removed with deleted sources/movers.
- Use Cmd/Ctrl+Z to undo edits, especially deletes. The toolbar shows the pending undo action when one is available.
- Use **Start Movers** / **Stop Movers** to animate movers. If a patch has no movers, source A still uses the older smooth random walk fallback.
- Use **Play Sound** / **Stop Sound** or press Space to enable or stop browser sound. It starts source audio-file bindings and parameter target backends only when the patch actually contains `sourceBindings` or `parameterMappings`; patches with only geometric constraints stay silent. Select a source and press `m` to mute or unmute its audio binding.
- Use **Load MIDI/MusicXML** to import `.mid`, `.midi`, `.musicxml`, `.xml`, or compressed `.mxl` files. MusicSpace creates one source per playable track or part.
- Use **Save Patch** after importing a sequence file if you want a portable patch JSON; user-loaded sequence patches embed their parsed note data because they do not have a project-local URL.
- Use **Play MIDI** / **Stop MIDI** on MIDI/MusicXML patches. **Internal GM Synth** renders basic browser piano, bass, and drum sounds; **External MIDI** sends notes and spatial control changes through Web MIDI when an output is available. Stopping sends MIDI panic messages so external synths release pending notes.
- Use **Clear Trace** to erase the trace canvas.
- Use **Save Trace** to download the current trace as `musicspace_trace.png`.
- Use **Reset** to restore the currently selected patch.

## Built-In Patches

- **Angle + Balance** shows a two-source angle relation plus a group balance/sum relation.
- **Product + Limit** demonstrates bounded deterministic backoff: a product constraint propagates multiplicatively, but once source B reaches its radial limit, the product correction is propagated to the remaining source.
- **Open Trio** is a simpler three-source balance scene for experimenting with listener and source motion.
- **Simple Rotator** has one rotative object carrying several sources.
- **Nested Rotators** links one rotative object to another, producing epicycle-like compound motion.
- **Cycloid Rotator** carries a rotative object around an orbital mover; enable drawing manually to produce cycloid-like traces.
- **Shuttle Spin** carries a rotative object between two draggable source endpoints.
- **Bouncing Constellation** carries a rotative object with a bouncing mover while preserving simple separation constraints.
- **Cycloid Percussion** binds three short bundled marimba, timbale, and bell loops to nested cycloid-style source motion, so Play Sound immediately demonstrates spatialized audio-file playback with changing rhythmic perspective.
- **Beatles Trajectory Study** sketches the trajectory-driven remixing pattern: a rotative object carries several sources through solid links while ordinary constraints still propagate.
- **Jazz Trio MIDI Spatializer** declares a `midi-file` target, loads `Midifiles/triojazz.mid`, represents Bass, Drums, and Piano as three MusicSpace sources, and maps their listener-relative positions to pan, gain, reverb, and filter controls in either an internal browser synth or external MIDI output.
- **Faust Control Study** maps constrained source motion to a `faust-wasm` target: `/osc/freq`, `/filter/frequency`, `/filter/q`, and `/output/gain`. The bundled study includes a Faust DSP source plus a browser adapter, so it runs without a compile step while keeping the same patch-level binding used by compiled Faust artifacts.
- **Granular Cloud Study** maps compound trajectories and constraints to a self-contained granular synth: `/grain/rate`, `/grain/size`, `/grain/pitch`, `/grain/spread`, `/filter/frequency`, `/filter/q`, and `/output/gain`.

## Repository Layout

- `musicspace.html` contains the static page structure and styling.
- `musicspace.js` contains the canvas entities, constraints, drawing, interaction, animation logic, and scene feature extraction. It does not know about Faust, Web Audio, MIDI, OSC, or concrete target clients.
- `musicspace-mapping.js` contains backend-independent parameter mapping from scene features to target values.
- `musicspace-parameter-client.js` owns the generic target monitor UI, target lifecycle, mapping normalization, and patch serialization for `parameterMappings`.
- `musicspace-source-audio-client.js` owns per-source audio-file playback and listener-relative pan, distance gain, and distance reverb send for `sourceBindings`.
- `musicspace-targets.js` contains the target backend registry plus Web Audio subtractive and granular examples.
- `musicspace-midi-file-client.js` contains MIDI/MusicXML parsing, transport, Web MIDI output, and internal browser synth playback for sequence-file patches.
- `audio/cycloid-percussion/` contains the small bundled WAV loops used by the Cycloid Percussion patch.
- `patches/index.json` lists the built-in patch files loaded by the patch menu.
- `patches/*.json` contains built-in MusicSpace patches using the same JSON format as saved patches.
- The in-page Patch Inspector validates patch JSON against MusicSpace-level rules such as object references, constraint parameters, backend declarations, Faust adapter links, MIDI bindings, and parameter mapping targets.
- `targets/faust/` contains Faust target source/adapter files referenced by Faust patch JSON.
- `schemas/musicspace-patch.schema.json` documents the patch JSON format.
- `schemas/musicspace-patch-index.schema.json` documents the patch manifest format.
- `PATCH_FORMAT.md` explains how to author and register patch JSON files.
- `CONSTRAINT_SEMANTICS.md` documents current constraint invariants and propagation behavior.
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
- Versioned JSON patch loading, saving, inspection, editing, and validation.
- Canvas palette for creating sources, movers, constraints, and trajectory assignments.
- Product constraints are shown with a `π` glyph, following the older MusicSpace visual convention.
- Built-in product + radial limit example for deterministic backoff.
- Built-in rotative-object + solid-link example for trajectory-driven remixing.
- Built-in parameter mapping examples with live Web Audio output, including Faust-style oscillator/filter and granular synthesis studies.
- Per-source audio-file bindings through the Source Inspector, with listener-relative stereo pan, optional distance gain, and per-source mute.
- Built-in MIDI/MusicXML spatialization support with one source per playable track or part controlling pan, gain, reverb, and filter behavior.
- Trace export for animated source and mover motion.
- A sharper separation between MusicSpace scene logic, generic parameter mapping, target-client UI/lifecycle, optional client patches, and independent target backends.
- A compact codebase intended for continued experimentation with constraint-based spatialization controls.

## Authors

- [François Pachet](https://github.com/fpachet)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
