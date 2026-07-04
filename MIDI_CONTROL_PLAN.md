# MIDI Control Plan

This document describes a proposed live MIDI input/output feature for MusicSpace. It is separate from the existing MIDI/MusicXML file playback client: sequence playback owns imported notes, tracks, transport, and spatialized rendering, while MIDI control should own live external routing between MIDI devices and MusicSpace state.

The guiding idea is bidirectional control:

```text
MIDI input event -> mapping -> MusicSpace endpoint
MusicSpace endpoint/feature -> mapping -> MIDI output event
```

This should make MusicSpace usable both as a controller surface for external systems and as an instrument that can be steered from external controllers.

## Fit With The Current System

MusicSpace already has the main output architecture:

```text
scene / movement -> feature extraction -> mapping -> target backend
```

The relevant pieces are:

- `musicspace-mapping.js`: generic scaling, curves, quantization, and allowed-value snapping.
- `musicspace-parameter-client.js`: patch-level parameter mapping lifecycle and target monitor UI.
- `musicspace-targets.js`: target backend registry for Web Audio, Faust-style, MIDI-file, and future clients.
- `musicspace-generator-client.js`: per-source generators, including external Web MIDI output for MIDI ostinatos.
- `musicspace-midi-file-client.js`: MIDI/MusicXML parsing, track binding, transport, internal synth playback, and external sequence output.

The live MIDI control feature should reuse the mapping vocabulary where possible, but it should not be folded into `musicspace-midi-file-client.js`. MIDI file playback is about scheduled musical content. MIDI control is about live routing and should be implemented as a dedicated client.

Proposed module:

```text
musicspace-midi-control-client.js
```

This client would:

- request Web MIDI access
- track available MIDI input and output devices
- monitor incoming activity
- implement MIDI learn
- normalize input values from CC, notes, pitch bend, aftertouch, and program changes
- apply input mappings to MusicSpace endpoints
- evaluate output mappings from MusicSpace features to MIDI messages
- serialize live MIDI control mappings into the patch

## Patch Shape

Add a top-level `midiControl` block. Initial shape:

```json
{
  "midiControl": {
    "inputs": [
      {
        "source": { "type": "cc", "channel": 1, "controller": 74 },
        "target": { "type": "parameter", "path": "/filter/frequency" },
        "inputMin": 0,
        "inputMax": 127,
        "outputMin": 300,
        "outputMax": 4000,
        "curve": "exp",
        "smoothingMs": 40
      }
    ],
    "outputs": [
      {
        "source": { "type": "feature", "object": "A", "feature": "distance" },
        "target": { "type": "cc", "channel": 1, "controller": 21 },
        "inputMin": 40,
        "inputMax": 320,
        "outputMin": 0,
        "outputMax": 127,
        "quantize": 1,
        "rateLimitMs": 20
      }
    ]
  }
}
```

This keeps direction explicit while preserving the familiar mapping fields:

- `inputMin` / `inputMax`
- `outputMin` / `outputMax`
- `curve`
- `quantize`
- `values`

Additional live-control fields can be optional:

- `smoothingMs`: smooth incoming or outgoing continuous values.
- `rateLimitMs`: avoid flooding MIDI outputs with redundant CC or bend messages.
- `mode`: choose behavior for note targets, such as `trigger`, `gate`, `toggle`, or `momentary`.
- `deviceId` / `deviceName`: optional preferred device hints. Mappings should remain usable if the exact device is missing.

## MIDI Input Sources

Supported input message sources should start small and expand in place:

- `cc`: channel controller, normalized from `0..127`.
- `note`: note-on/note-off with pitch and velocity.
- `pitch-bend`: 14-bit bend value, normalized from `-1..1` or `0..16383`.
- `aftertouch`: channel pressure.
- `poly-aftertouch`: note-specific pressure.
- `program-change`: discrete program index.

The first useful version only needs CC and note input. Pitch bend and aftertouch are natural next steps because they are expressive continuous controllers.

## MIDI Input Targets

Input targets should be a small vocabulary over existing MusicSpace state, not arbitrary JavaScript callbacks.

Initial targets:

- `parameter`: patch-level target backend parameter, such as `/filter/frequency`.
- `generator`: source generator parameter, such as `pitch`, `periodMs`, `durationMs`, `velocity`, `channel`, `frequencyHz`, or `gain`.
- `position`: source or mover coordinate, such as `A.x` or `A.y`.
- `trajectory`: mover trajectory parameter, such as speed, revolution period, direction, or running state.
- `transport`: actions such as start/stop movers, play/stop sound, reset, or freeze.

Later targets:

- `constraint`: editable constraint parameter, such as radial limit bounds or angle-sector width.
- `selection`: select source, mover, patch, or mapping.
- `macro`: one input controls multiple targets with separate ranges.
- `gesture`: record a MIDI-driven movement as a trajectory.

The important behavioral rule is that MIDI-driven scene changes should enter through the same mutation path as user interaction. If a CC moves a source, constraints should propagate normally, and patch serialization should see a coherent scene. Incoming MIDI should not bypass the constraint engine by directly mutating object fields in a hidden side channel.

## MIDI Output Sources

MIDI output sources should reuse MusicSpace feature extraction. Initial source types:

- `feature`: source or mover `x`, `y`, `distance`, or `angle`.
- `parameter`: current mapped value of a backend parameter.
- `generator`: current effective generator parameter for a source.
- `transport`: animation or sound state, useful for LEDs.

Later source types:

- `constraint`: residual error, satisfaction state, or constraint node position.
- `trajectory`: phase, speed, endpoint, or active state.
- `event`: source entered a zone, crossed a threshold, selected object changed, patch changed.

## MIDI Output Targets

Initial output messages:

- `cc`: continuous controller.
- `note`: note-on/note-off, either triggered by thresholds/events or generated from source/generator state.
- `pitch-bend`: high-resolution continuous output.
- `program-change`: scene or patch transition output.

Later output messages:

- `aftertouch`
- `poly-aftertouch`
- MIDI clock and transport
- MIDI Machine Control-style commands if useful

For continuous messages, the client should cache the last sent value and avoid sending unchanged values. CC and pitch bend output should be rate-limited to avoid overwhelming devices.

## Runtime Behavior

The MIDI control client should be loaded with the patch and started/stopped with the rest of explicit output only when needed.

Suggested integration:

- `loadPatch(patch)`: normalize `patch.midiControl`.
- `serialize()`: return the current `midiControl` block.
- `setEnabled(enabled)`: request MIDI access and attach/detach live listeners.
- `update()`: evaluate output mappings from current scene state.
- `renameSource(oldName, newName)`: update mapping references.
- `removeMappingsForMissingSources(sourceNames)`: drop invalid scene references.

`toggleSoundOutput()` currently starts parameter targets, source audio, MIDI-file playback, and generators. MIDI control can join that same transport if the patch has live MIDI output mappings or input mappings that should only be active during performance. A later UI may split this into separate toggles, but the first version can keep the behavior simple.

Input mappings raise one subtle question: should MIDI input be active only after pressing **Play Sound**, or whenever the MIDI panel is armed? The safest initial design is:

- MIDI learn is active only while editing and explicitly armed.
- MIDI input mappings are active only while **Play Sound** is enabled.
- A later `armed: true` option can allow always-on control for installation or controller-surface workflows.

## UI Design

Add a MIDI control panel in Edit mode, probably near the Patch Inspector rather than inside the Source Inspector.

Expected controls:

- input device selector
- output device selector
- activity monitor for the latest message
- Learn button
- mapping direction selector: `In` or `Out`
- source selector for incoming MIDI source or outgoing MusicSpace source
- target selector for MusicSpace target or outgoing MIDI message
- range controls
- curve, quantize, smoothing, and rate limit controls
- remove mapping button

The panel should list current mappings with readable summaries:

```text
In  CC 74 ch 1 -> /filter/frequency 300..4000 Hz
Out A.distance -> CC 21 ch 1 0..127
```

The UI should populate target choices from current patch state:

- scene objects and movers
- active target backend parameters
- source generator parameters
- trajectory parameters
- transport actions

## Validation

Patch validation should check:

- `midiControl.inputs` and `midiControl.outputs` are arrays when present.
- input source message types are known.
- output target message types are known.
- channels are `1..16`.
- CC, note, program, and velocity values stay in MIDI ranges.
- referenced scene objects exist.
- referenced backend parameters are declared by the active target backend when possible.
- referenced source generators exist when a mapping targets generator parameters.
- exponential mappings use positive output ranges.
- `inputMin` and `inputMax` are finite and distinct, with a warning when identical.

Schema support should mirror the permissive current patch style: document the shape while allowing future properties.

## Implementation Phases

### Phase 1: MIDI Output CC Backend

Start with outbound CC mappings from MusicSpace features:

```text
feature -> mapping -> CC
```

This validates the architecture with minimal risk. It can share the existing value mapping logic and use Web MIDI output code similar to the generator and MIDI-file clients.

### Phase 2: MIDI Input CC To Parameters

Add inbound CC mappings to target backend parameters:

```text
CC -> mapping -> parameter
```

This proves MIDI learn, device monitoring, and live external control without touching the constraint engine.

### Phase 3: MIDI Input To Scene Movement

Add position and trajectory targets:

```text
CC -> source.x / source.y / mover speed
```

This is where the feature becomes specifically MusicSpace. Scene mutation must go through propagation-aware helpers so constraints react as if the user moved the object.

### Phase 4: Notes, Triggers, And Feedback

Add note input/output, transport actions, threshold triggers, LEDs, and optional controller feedback.

Examples:

- Note C2 toggles movement.
- Note D2 freezes constraints.
- Distance crossing a threshold emits a note.
- Current patch state sends CC or note feedback to an external controller.

### Phase 5: Macros And Higher-Level Routing

Add macro mappings, presets, multi-target fanout, and possibly a generalized routing abstraction shared by MIDI, OSC, and future DAW bridges.

## Open Questions

- Should live MIDI input be active only during **Play Sound**, or should the MIDI panel have an independent arm state?
- Should output mappings belong inside `midiControl.outputs`, or should MIDI output also be expressible as a `target.type: "midi-control"` backend?
- How should note mappings handle polyphony when a note is used as a continuous gate?
- Should MIDI clock be an input, an output, or both?
- Should learned mappings prefer stable device ids, names, or both?
- How should MIDI-driven object movement interact with undo history? Continuous input should probably not create one undo snapshot per CC event.

## Design Principle

MIDI control should not become a special-purpose patch hack. It should be a routing layer over existing MusicSpace concepts:

```text
external performance gesture <-> MusicSpace scene/movement/parameter state
```

That keeps the old MusicSpace idea intact: the visible constrained space remains the musical control surface, while MIDI becomes one more way to play it and one more way for it to play the outside world.
