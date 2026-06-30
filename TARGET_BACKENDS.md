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
- `midi-file`: MIDI/MusicXML sequence-file playback handled by the MIDI file client.
- `faust-wasm`: a patch-provided Faust WebAssembly target loaded through an adapter module.

The Web Audio examples expose Faust-style parameter paths, but they are not compiled from Faust patches. `faust-wasm` is the bridge for actual Faust artifacts.

`Play Sound` does not start a backend merely because a `target` exists or because the default `subtractive` backend is available. It enables parameter targets only when the patch has `parameterMappings`, and it enables source audio only when the patch has `sourceBindings`.

## Patch-Level Faust Binding

A patch specifies the actual Faust target in its `target` object:

```json
{
  "target": {
    "type": "faust-wasm",
    "name": "Freeverb",
    "module": "targets/faust/freeverb-adapter.js",
    "wasm": "targets/faust/freeverb.wasm",
    "json": "targets/faust/freeverb.json",
    "dsp": "targets/faust/freeverb.dsp",
    "parameters": {
      "/freeverb/roomSize": { "default": 0.5, "min": 0, "max": 1 },
      "/freeverb/damp": { "default": 0.5, "min": 0, "max": 1 },
      "/freeverb/output": { "default": 0.2, "min": 0, "max": 1 }
    }
  }
}
```

The adapter module must export `createFaustNode(context, target)` or a default factory. MusicSpace resolves `wasm`, `json`, and `metadata` URLs before passing the target object to the adapter. A `dsp` source path can also be provided for documentation or adapter-specific compilation workflows. The factory returns either an `AudioNode` with `setParamValue(path, value)`, or an object with `node`/`output`, `setParamValue`, and optional `destroy`/`dispose`.

`parameterMappings` then map MusicSpace features to the Faust parameter addresses exposed by that target.

## MIDI File Client

The Jazz Trio demo and user-loaded sequence files declare `target.type: "midi-file"` and use a separate `midiFile` block for sequence details. The target type makes the patch-level backend binding explicit, while the MIDI/MusicXML client owns MIDI parsing, MusicXML/MXL conversion, transport, note scheduling, Web MIDI output, and a small internal Web Audio synth. MusicSpace still only supplies source/listener geometry.

```json
{
  "target": { "type": "midi-file" },
  "midiFile": {
    "url": "Midifiles/triojazz.mid",
    "preferredMode": "internal",
    "trackBindings": [
      { "track": "Bass", "source": "Bass", "channel": 2, "program": 33 }
    ]
  }
}
```

```text
MIDI/MusicXML client
  -> track/channel events
  -> one source binding per MIDI track or MusicXML part
  -> listener-relative pan, gain, reverb, filter values
  -> internal browser synth or external Web MIDI output
```

This keeps sequence-file time and note playback separate from the constraint system, while preserving the same MusicSpace idea: spatial source motion controls musical output.

When external Web MIDI playback stops, the client sends sustain-off, all-sound-off, all-notes-off, and explicit note-off messages on the active channels. It repeats that panic shortly after stop because browser-scheduled Web MIDI note-ons cannot be cancelled once queued.

## Source Audio Bindings

Sources can also be direct audio emitters through patch-level `sourceBindings`. This is separate from generic `parameterMappings`: the source binding owns the sound material, while the source position still comes from the ordinary scene, constraints, and trajectories.

```json
{
  "sourceBindings": [
    {
      "source": "A",
      "type": "audio-file",
      "name": "voice.wav",
      "mimeType": "audio/wav",
      "dataUrl": "data:audio/wav;base64,...",
      "loop": true,
      "gain": 0.8,
      "spatialization": "pan-distance"
    }
  ]
}
```

`Play Sound` starts and stops source audio bindings together with mapped parameter target backends. Patches without `sourceBindings` or `parameterMappings` remain silent. `pan-distance` maps left/right position around the listener to stereo pan and listener distance to gain attenuation; `stereo-pan` keeps gain constant and only pans.

## Faust Direction

The Faust backend is a registered target backend, not a special case in MusicSpace core.

The Faust integration can work in two phases:

- **Introspection:** compile or inspect a Faust patch, then extract slider/button metadata, parameter paths, ranges, units, defaults, groups, and annotations.
- **Runtime:** instantiate the compiled DSP through the patch-provided adapter module and call the Faust parameter setter for each mapped path.

The generated target manifest can then seed MusicSpace mappings and suggested constraints, while still allowing the user to edit the controller scene.
