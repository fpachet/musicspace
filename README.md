# MusicSpace

A JavaScript prototype of the MusicSpace interface idea: sources are represented as 2D objects in a canvas, and constraints between them propagate source movements in real time.

The current demo has a listener, three sound sources, an angle constraint, a sum-distance constraint, draggable constraint nodes, and optional trace drawing for an animated source.

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

- Drag the listener, sources, or constraint nodes on the canvas.
- Use **Start** / **Stop** to animate source A with a smooth random walk.
- Use **Clear Trace** to erase the trace canvas.
- Use **Save Trace** to download the current trace as `musicspace_trace.png`.
- Use **Reset** to restore the initial scene.

## Repository Layout

- `musicspace.html` contains the static page structure and styling.
- `musicspace.js` contains the canvas entities, constraints, drawing, interaction, and animation logic.
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
- Trace export for animated source motion.
- A compact codebase intended for experimentation with spatialization controls.

## Authors

- [François Pachet](https://github.com/fpachet)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
