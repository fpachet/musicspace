# MusicSpace

A JavaScript prototype of the MusicSpace interface idea: sources are represented as 2D objects in a canvas, and constraints between them propagate source movements in real time.

The current demo has a listener, sound sources, moving trajectory objects, rotative objects, draggable constraint nodes, built-in patches, listener drag modes, JSON patch import/export, optional trace drawing, click-to-create tools, and several prototype constraints including angle, balance/sum, product, radial limits, fixed distance, distance ratio, pin, solid link, minimum separation, and angle sector.

## Running

Open `musicspace.html` directly in a browser.

You can also serve the directory locally:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/musicspace.html>.

No build step or package installation is required.

If you have Node.js available, you can run a syntax check:

```sh
npm run check
```

## Controls

- Use the patch menu to load built-in scenes, including constraint examples and trajectory studies.
- Use **Save Patch** / **Load Patch** to export and import scene JSON.
- Use the tool palette to create sources, movers, constraints, and simple trajectories directly on the canvas.
- Use **Orbit** when the mover itself should travel around the listener.
- Use **Spin** to create a rotative object. Link sources or movers to it with **Link**; linked objects rotate around it.
- Double-click a rotative mover to open the editor, where its start state, revolution period, direction, and displacement-induced rotation can be changed.
- Double-click a shuttle mover to edit its endpoints. Each endpoint can be a fixed point or an existing object such as a source, mover, or the listener.
- Choose listener mode:
  - **Re-anchor** moves the listener and retargets constraints to the new geometry.
  - **Preserve** moves the listener while preserving active constraints.
- Drag the listener, sources, movers, or constraint nodes on the canvas.
- Use arrow keys to nudge the selected object; hold Shift for larger steps.
- Use Backspace/Delete to remove the selected source, mover, or constraint node. Dependent constraints are removed with deleted sources/movers.
- Use **Undo** or Cmd/Ctrl+Z to undo edits, especially deletes.
- Use **Start** / **Stop** to animate movers. If a patch has no movers, source A still uses the older smooth random walk fallback.
- Use **Clear Trace** to erase the trace canvas.
- Use **Save Trace** to download the current trace as `musicspace_trace.png`.
- Use **Reset** to restore the currently selected patch.

## Built-In Patches

- **Angle + Balance** shows a two-source angle relation plus a group balance/sum relation.
- **Product + Limit** demonstrates bounded deterministic backoff: a product constraint propagates multiplicatively, but once source B reaches its radial limit, the product correction is propagated to the remaining source.
- **Open Trio** is a simpler three-source balance scene for experimenting with listener and source motion.
- **Simple Rotator** has one rotative object carrying several sources.
- **Nested Rotators** links one rotative object to another, producing epicycle-like compound motion.
- **Cycloid Rotator** carries a rotative object around an orbital mover, producing cycloid-like traces.
- **Shuttle Spin** carries a rotative object between two draggable source endpoints.
- **Bouncing Constellation** carries a rotative object with a bouncing mover while preserving simple separation constraints.
- **Beatles Trajectory Study** sketches the trajectory-driven remixing pattern: a rotative object carries several sources through solid links while ordinary constraints still propagate.

## Repository Layout

- `musicspace.html` contains the static page structure and styling.
- `musicspace.js` contains the canvas entities, constraints, drawing, interaction, and animation logic.
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

- Static browser demo with no runtime dependencies.
- Simple implementation of visual constraint propagation.
- JSON patch loading and saving.
- Canvas palette for creating sources, movers, constraints, and trajectory assignments.
- Product constraints are shown with a `π` glyph, following the older MusicSpace visual convention.
- Built-in product + radial limit example for deterministic backoff.
- Built-in rotative-object + solid-link example for trajectory-driven remixing.
- Trace export for animated source and mover motion.
- A compact codebase intended for experimentation with spatialization controls.

## Authors

- [François Pachet](https://github.com/fpachet)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
