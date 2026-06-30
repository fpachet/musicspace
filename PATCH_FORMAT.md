# MusicSpace Patch Format

MusicSpace patches are JSON files that describe a complete scene: listener, sources, optional moving objects, constraints, source audio bindings, source generators, target mappings, and optional sequence-file settings.

Built-in patches live in `patches/*.json` and are listed by `patches/index.json`. User-saved patches use the same `version: 1` format, but do not need a `key` unless they are added to the built-in menu.

The formal schemas are:

- `schemas/musicspace-patch.schema.json`
- `schemas/musicspace-patch-index.schema.json`

## Inspecting And Validating Patches

The app includes a Patch Inspector popup opened from the Patch toolbar. It summarizes the active patch, shows the selected backend and any MIDI/Faust artifacts, lists constraints and mappings, and reports validation findings.

Use **JSON** in the inspector to open an editable snapshot of the active patch. **Apply JSON** parses that snapshot, validates it, and loads it as a separate edited patch entry instead of overwriting a built-in patch.

Validation checks MusicSpace-level semantics that JSON Schema cannot fully express: object references used by constraints, constraint parameter ranges, source audio bindings, source generators, backend type declarations, Faust adapter/artifact references, parameter mapping targets, and MIDI track bindings.

## Minimal Patch

```json
{
  "$schema": "../schemas/musicspace-patch.schema.json",
  "version": 1,
  "key": "angle-balance",
  "name": "Angle + Balance",
  "listener": { "x": 400, "y": 300 },
  "sources": [
    { "name": "A", "x": 300, "y": 200 },
    { "name": "B", "x": 400, "y": 200 },
    { "name": "C", "x": 350, "y": 300 }
  ],
  "constraints": [
    { "type": "angle", "sources": ["A", "B"] },
    { "type": "sum", "sources": ["A", "B", "C"] }
  ]
}
```

## Top-Level Fields

- `version`: patch format version. Currently `1`.
- `key`: stable built-in patch id used by `patches/index.json`. Optional for user-saved patches.
- `name`: display name.
- `listener`: listener position, with optional `drawTrace`.
- `sources`: named sound-source positions, each with optional `drawTrace`.
- `movingObjects`: optional named movers with trajectory descriptions.
- `constraints`: optional geometric/relational constraints.
- `sourceBindings`: optional direct audio emitters bound to sources.
- `sourceGenerators`: optional generated note emitters bound to sources.
- `target`: optional parameter target selection.
- `parameterMappings`: optional mappings from scene features to target parameters.
- `midiFile`: optional MIDI/MusicXML sequence-file binding.

Trace state is serialized with `drawTrace` on listeners, sources, movers, and constraint nodes. A constraint `node` stores the visual handle position plus `isManual` and `drawTrace`.

`movingObjects` may include a serialized `trajectory`. Schema-covered temporal trajectory types are `rotation`, `rotator`, `shuttle`, and `bounce`; the runtime may also use `free` for movers that have no active temporal motion. Shuttle endpoints can be fixed points or object references:

```json
{
  "name": "Shuttle",
  "x": 420,
  "y": 260,
  "trajectory": {
    "type": "shuttle",
    "start": { "type": "object", "name": "A" },
    "end": { "type": "fixed", "x": 620, "y": 260 },
    "speed": 0.01,
    "showPath": true
  }
}
```

Parameter mappings connect a source feature to a target parameter path:

```json
{
  "source": "A",
  "feature": "distance",
  "target": "/filter/frequency",
  "inputMin": 40,
  "inputMax": 320,
  "outputMin": 300,
  "outputMax": 3000,
  "curve": "linear"
}
```

Source bindings make a source a direct audio emitter. The Source Inspector writes `audio-file` bindings with embedded user-loaded files (`dataUrl`) or URL-based files for authored patches:

```json
{
  "source": "A",
  "type": "audio-file",
  "name": "voice.wav",
  "mimeType": "audio/wav",
  "dataUrl": "data:audio/wav;base64,...",
  "loop": true,
  "gain": 0.8,
  "muted": false,
  "spatialization": "pan-distance"
}
```

`loop` defaults to `true` when omitted and can be changed in the Source Inspector. `muted` silences the source without changing its gain, geometry, or serialized audio file. Select a source and press `m`, or use **Mute / Unmute** in the Source Inspector. `spatialization: "pan-distance"` maps listener-relative left/right position to stereo pan, distance to gain attenuation, and distance to a shared reverb send. `spatialization: "stereo-pan"` keeps gain constant and only pans. Source names can be edited in the Source Inspector; the app updates constraints, source bindings, source generators, parameter mappings, MIDI track bindings, and object-referenced shuttle endpoints.

Source generators make a source emit generated musical events without requiring an audio file or imported MIDI sequence. The first generator type is `midi-ostinato`, inspired by the OpenSpace prototype: it repeats one MIDI pitch at a fixed period and renders through the browser synth used by **Play Sound**.

```json
{
  "source": "Pulse C",
  "type": "midi-ostinato",
  "pitch": 60,
  "periodMs": 1200,
  "durationMs": 160,
  "velocity": 72,
  "channel": 1,
  "waveform": "triangle",
  "spatialization": "pan-distance"
}
```

Generator sources use the same listener-relative pan and distance gain model as direct audio sources. They are currently authored in patch JSON; source-inspector editing and musical constraints over pitch, period, density, or register are future extensions.

## Target Backend Binding

Patches bind to parameter backends with the top-level `target` object. If `target` is omitted, MusicSpace uses the built-in `subtractive` Web Audio backend for validating and applying `parameterMappings`.

`Play Sound` only starts browser audio when there is something explicit to play: at least one `sourceBindings` entry, at least one `sourceGenerators` entry, or at least one `parameterMappings` entry. A patch that only has geometry, constraints, and an omitted `target` stays silent.

Current target types:

- `subtractive`: built-in Web Audio oscillator/filter.
- `granular`: built-in Web Audio granular cloud.
- `midi-file`: MIDI/MusicXML sequence playback handled by the MIDI file client.
- `faust-wasm`: patch-provided Faust WebAssembly target.

For MIDI/MusicXML patches, use `target.type: "midi-file"` and keep the sequence-specific details in `midiFile`:

```json
{
  "target": { "type": "midi-file" },
  "midiFile": {
    "url": "Midifiles/triojazz.mid",
    "preferredMode": "internal",
    "trackBindings": [
      { "track": "Bass", "source": "Bass", "channel": 2, "program": 33 },
      { "track": "Drums", "source": "Drums", "channel": 10, "program": 1, "isDrums": true },
      { "track": "Piano", "source": "Piano", "channel": 3, "program": 1 }
    ]
  }
}
```

The `target` block answers which backend family the patch uses. The `midiFile` block answers which sequence file to load and how its tracks bind to MusicSpace sources.

For `faust-wasm`, the patch names the actual Faust artifact and adapter:

```json
{
  "target": {
    "type": "faust-wasm",
    "name": "Freeverb",
    "module": "targets/faust/freeverb-adapter.js",
    "wasm": "targets/faust/freeverb.wasm",
    "json": "targets/faust/freeverb.json",
    "parameters": {
      "/freeverb/roomSize": { "default": 0.5, "min": 0, "max": 1 },
      "/freeverb/damp": { "default": 0.5, "min": 0, "max": 1 },
      "/freeverb/output": { "default": 0.2, "min": 0, "max": 1 }
    }
  }
}
```

`module` must be an ES module exporting either `createFaustNode(context, target)` or a default factory. MusicSpace passes the target object to that factory, with `wasm`, `json`, and `metadata` resolved to absolute URLs when present. A source `.dsp` path can also be included for documentation or adapter-specific compilation workflows. The factory should return either an `AudioNode` with `setParamValue(path, value)`, or an object like:

```js
export async function createFaustNode(context, target) {
  return {
    node,
    output: node,
    setParamValue(path, value) {
      node.setParamValue(path, value);
    },
    destroy() {
      node.destroy?.();
    }
  };
}
```

`parameters` is optional but useful. When present, it gives MusicSpace parameter defaults, display units, and a finite list of valid mapping targets before the Faust node is loaded.

Mappings then connect scene features to Faust parameter addresses:

```json
{
  "source": "Room",
  "feature": "distance",
  "target": "/freeverb/roomSize",
  "inputMin": 60,
  "inputMax": 260,
  "outputMin": 0.1,
  "outputMax": 0.95,
  "curve": "linear"
}
```

## Constraint Specs

Supported constraint `type` values:

- `angle`: preserves the angle relation between two sources around the listener.
- `sum`: preserves the total listener distance of two or more sources.
- `product`: preserves the product of listener distances.
- `radialLimit`: clamps one source between `minDistance` and `maxDistance` from the listener.
- `fixedDistance`: preserves a fixed distance between `anchor` and `target`.
- `distanceRatio`: preserves a ratio between two listener-relative source distances.
- `pin`: pins a target to fixed `x`, `y` coordinates.
- `solid`: attaches one object to a carrier with an optional offset.
- `separation`: enforces a minimum distance between two sources.
- `angleSector`: keeps a source inside an angular sector around the listener.

Each serialized constraint may also include a `node` object with display position and trace settings for its draggable constraint node.

## Adding A Built-In Patch

1. Add a new `patches/<key>.json` file.
2. Include `$schema`, `version`, `key`, `name`, `listener`, `sources`, and any optional sections.
3. Add an entry to `patches/index.json`:

```json
{
  "key": "my-patch",
  "name": "My Patch",
  "file": "my-patch.json"
}
```

The app loads `patches/index.json` over HTTP, then fetches each listed patch file.
