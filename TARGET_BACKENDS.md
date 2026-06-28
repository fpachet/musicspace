# Target Backends

MusicSpace should treat sound engines and external clients as parameterized targets. The canvas scene, constraints, and trajectories produce feature values; mappings translate those features into named parameter values; a target backend applies those values somewhere useful.

This keeps the core system independent from any one output technology.

```text
MusicSpace scene
  -> feature extraction
  -> parameter mappings
  -> target backend
  -> Web Audio, Faust, MIDI, OSC, DAW bridge, visualization, etc.
```

## Backend Contract

A backend is registered with `MusicSpaceTargets.registerTargetBackend(backend)`.

```js
{
  type: "faust-wasm",
  label: "Faust WebAssembly",
  defaults: {
    "/filter/frequency": 1200,
    "/filter/q": 1.4,
    "/output/gain": 0.15
  },
  parameterConfig: {
    "/filter/frequency": { suffix: " Hz", digits: 0 },
    "/filter/q": { suffix: "", digits: 2 },
    "/output/gain": { suffix: "", digits: 2 }
  },
  metadata() {
    return { family: "faust" };
  },
  createRuntime({ spec, onStatus }) {
    // Allocate audio nodes, open a MIDI/OSC connection, or attach to a compiled Faust DSP.
  },
  async setEnabled(runtime, enabled, values, spec) {
    // Start/stop audio or connect/disconnect the external client.
  },
  apply(runtime, values, enabled, immediate, spec) {
    // Apply the current parameter values.
  },
  dispose(runtime, spec) {
    // Release resources.
  }
}
```

Only `type` and `createRuntime` are mandatory, but useful backends should provide defaults and parameter metadata so mappings can be validated and monitored.

## Current Backends

- `subtractive`: a local Web Audio sawtooth oscillator through a resonant low-pass filter.
- `granular`: a local Web Audio granular cloud with filter, compressor, and output gain.

Both expose Faust-style parameter paths, but neither is currently compiled from a Faust patch.

## MIDI File Client

The Jazz Trio demo uses a separate MIDI-file client rather than the generic target backend registry. That client owns MIDI parsing, transport, note scheduling, Web MIDI output, and a small internal Web Audio synth. MusicSpace still only supplies source/listener geometry.

```text
MIDI file client
  -> track/channel events
  -> Bass, Drums, Piano source bindings
  -> listener-relative pan, gain, reverb, filter values
  -> internal browser synth or external Web MIDI output
```

This keeps MIDI-file time and note playback separate from the constraint system, while preserving the same MusicSpace idea: spatial source motion controls musical output.

When external Web MIDI playback stops, the client sends sustain-off, all-sound-off, all-notes-off, and explicit note-off messages on the active channels. It repeats that panic shortly after stop because browser-scheduled Web MIDI note-ons cannot be cancelled once queued.

## Faust Direction

A Faust backend should become another registered target backend, not a special case in MusicSpace core.

The Faust integration can work in two phases:

- **Introspection:** compile or inspect a Faust patch, then extract slider/button metadata, parameter paths, ranges, units, defaults, groups, and annotations.
- **Runtime:** instantiate the compiled DSP and implement `apply()` by calling the Faust parameter setter for each mapped path.

The generated target manifest can then seed MusicSpace mappings and suggested constraints, while still allowing the user to edit the controller scene.
