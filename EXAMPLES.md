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
Simple Spring, Coupled Springs, and Musical Spring remain still at equilibrium until you displace a mass. Driven Springs moves continuously without a gesture. Drag
and release a red endpoint labeled **Mass**, **A**, **B**, or **Bob** to excite it;
use **Stop Motion** to inspect a still frame. Clicking or double-clicking an object
keeps a stopped scene paused, as does dragging a constraint label. Pulling a physical
object resumes spring motion. In Edit mode,
double-click a spring to edit rest length, stiffness, and damping, or a mass to edit its
mass. Select an object and use the existing drawing toggle to trace its path.

The pink node with a coil glyph is the spring's inspector/label handle. Moving it only
changes its display position. Move a red mass endpoint to stretch or compress the
spring: its smooth spiral coils visibly spread apart or pack together, with shaded
front and back arcs giving the wire depth, while the terminal
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
| **Driven Springs** | [driven-springs.json](patches/driven-springs.json) | Watch the shuttle drive two spring-connected masses continuously. Drag A or B to perturb them, or click **Play Sound** for changing pitch and filter frequency. |

Driven Springs uses a prescribed shuttle trajectory as its moving anchor, with gravity
and two damped springs. The shuttle supplies energy on every cycle, so damping does
not bring the patch to rest. A's Y position controls pitch and B's Y position controls
filter frequency. Drag the small white circles at either end of the dotted line to reshape the path,
even while it is running. In Edit mode, double-click **Driver** to adjust the shuttle speed
or use **Pick two points on canvas** to place fixed endpoints with two taps (then **Apply**), or a spring node to adjust stiffness and damping. **Stop Motion** pauses
both the trajectory and the springs.

The JSON files can also be opened with **Load Patch**. See
[spring semantics](CONSTRAINT_SEMANTICS.md#springs-and-dynamic-networks) for units,
damping, anchor behavior, and headless stepping.

## Pendulum studies

These three patches use the existing physics engine and browser synthesis. They start
moving as soon as they are selected; **Play Sound** enables audio. **Stop Motion** freezes
the geometry, and **Reset** restores the initial positions and velocities. No audio files
or external synthesizer are required.

| Patch | What to watch and hear |
| --- | --- |
| [Coupled Pendulums](https://fpachet.github.io/musicspace/musicspace.html?patch=coupled-pendulums) | A starts displaced while B hangs vertically. B takes over most of the motion after roughly 10 seconds, then A takes it back around 19 seconds. Two tones, D3 and A3, swell as their bobs rise. |
| [Elastic Pendulum](https://fpachet.github.io/musicspace/musicspace.html?patch=elastic-pendulum) | A single mass swings while the spring stretches and contracts. Higher positions raise oscillator pitch; moving right opens the filter. Pull Bob sideways and release to change the pattern. |
| [Quintuple Pendulum](https://fpachet.github.io/musicspace/musicspace.html?patch=quintuple-pendulum) | Five equal masses on five rigid links start in a folded configuration. Bobs 1, 3, and 5 generate a low three-voice texture, with horizontal position changing pitch and stereo pan. Select Bob 5 and enable **Draw Selected** to see its path. |

Coupled Pendulums connects the spring directly between the bobs, simplifying the
mid-rod attachment in the visual reference. Its loudness mapping follows bob height,
not total mechanical energy. The two additive voices also follow source/listener pan
and distance. Quintuple Pendulum uses the same spatialization with three audible bobs;
the remaining two masses participate in the physics without adding voices.

All three are unpowered initial-value experiments. Their motion gradually loses energy
through spring damping and numerical integration; they do not promise perpetual motion
or exact energy conservation. The initial configurations stay visible and retain motion
in a two-minute simulation. Large manual displacements can move them outside that layout.
**Driven Springs** remains the example for sustained excitation by a moving anchor.

In **Edit** mode, stop motion and double-click a mass, spring, or distance constraint to
adjust its parameters. Short rigid links use small green inspector handles to keep the
chain readable; selecting a handle reveals its full label. JSON definitions: [coupled-pendulums.json](patches/coupled-pendulums.json),
[elastic-pendulum.json](patches/elastic-pendulum.json), and
[quintuple-pendulum.json](patches/quintuple-pendulum.json).
