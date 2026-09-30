# Guided MusicSpace examples

Serve the project with `npm run serve`, open `http://localhost:8000/musicspace.html`, and choose patches from the menu. Use Edit mode for inspectors and solver selection.

| Patch | Exercise | Expected result |
| --- | --- | --- |
| Angle + Balance | Drag a source, then repeat while holding Shift | Normal dragging propagates relationships. Shift pauses propagation; release recaptures the layout. |
| Product + Limit | Pull A outward until B reaches its radial bound | The remaining source absorbs the product correction where feasible; the limit prevents B moving farther. |
| Simple Rotator | Start movers, stop midway, then start again | Linked sources rotate together; restarting continues from the stopped positions. The authored period uses elapsed simulation time. |
| Cycloid Percussion | Play sound and start movers | Three loops start together and follow source positions through pan, gain and reverb. |
| OpenSpace Ostinatos | Inspect a source's mappings and move it | Generated note parameters and mapping readouts follow source motion. |
| FM Harmonic Space | Play sound and move ratio controls | Mapped ratios snap to the authored harmonic values. |
| Chord Import Check | Play sound | C and E begin together; G begins one beat later. The underlying file is `examples/chord.musicxml`. |
| Conflict Diagnostics | Drag A; compare Propagation and XPBD | A cannot satisfy both the pin and radial limit. Residual diagnostics remain visible; neither solver should run indefinitely. |

For import testing, load `examples/chord.musicxml` through **Load MIDI/MusicXML**. Save the resulting patch and reload it: imported sequence data is embedded in the saved JSON. The same file is an automated browser regression fixture.

For headless experimentation, run `npm run example`. `examples/headless.js` loads Product + Limit, moves A through the same model used by the browser, and prints its propagation report.

MusicXML support covers the implemented partwise note, chord, voice-cursor and tempo paths; it is not a complete notation renderer. Repeats, ties and other notation semantics need additional implementation and fixtures. Compressed MXL entries using data descriptors remain unsupported and report an explicit error. Standard MIDI formats 0 and 1 with positive PPQ timing are supported; format 2 and SMPTE timing are explicitly rejected.

## Spring examples

Run `npm run serve`, open [MusicSpace](http://localhost:8000/musicspace.html), and select
one of these patches from the patch menu. The simulation starts automatically; the
examples without gravity remain still at equilibrium until you displace a mass. Drag
and release a red endpoint labeled **Mass**, **A**, **B**, or **Bob** to excite it;
use **Stop Motion** to inspect a still frame. In Edit mode,
double-click a spring to edit rest length, stiffness, and damping, or a mass to edit its
mass. Select an object and use the existing drawing toggle to trace its path.

The pink node with a coil glyph is the spring's inspector/label handle. Moving it only
changes its display position. Move a red mass endpoint to stretch or compress the
spring: its shaded coils visibly spread apart or pack together while the terminal
rods stay attached to the endpoints.

[Watch the Musical Spring demo with sound (MP4)](assets/videos/linkedin/musicspace-musical-spring-linkedin.mp4)
or [WebM](assets/videos/musicspace-musical-spring.webm). The recording uses the same
canvas and audio capture workflow as the earlier demos and includes two real pointer
drag-and-release gestures.

| Menu entry | Patch file | Try this |
| --- | --- | --- |
| **Simple Spring** | [simple-spring.json](patches/simple-spring.json) | Pull Mass down and release. It oscillates about its rest length while Anchor stays pinned. |
| **Coupled Springs** | [coupled-springs.json](patches/coupled-springs.json) | Pull A down and sideways. Both masses respond through the rigid link; B has greater mass. |
| **Spring Pendulum** | [spring-pendulum.json](patches/spring-pendulum.json) | Swing Bob sideways and release. Gravity, two springs, and two rigid links transfer motion throughout the system. |
| **Musical Spring** | [musical-spring.json](patches/musical-spring.json) | Click **Play Sound**, then pull A down and release. A's Y position controls synth pitch; B's Y position controls the filter through ordinary parameter mappings. |

The JSON files can also be opened with **Load Patch**. See
[spring semantics](CONSTRAINT_SEMANTICS.md#springs-and-dynamic-networks) for units,
damping, anchor behavior, and headless stepping.
