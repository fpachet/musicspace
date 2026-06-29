# MusicSpace Patch Format

MusicSpace patches are JSON files that describe a complete scene: listener, sources, optional moving objects, constraints, target mappings, and optional sequence-file settings.

Built-in patches live in `patches/*.json` and are listed by `patches/index.json`. User-saved patches use the same `version: 1` format, but do not need a `key` unless they are added to the built-in menu.

The formal schemas are:

- `schemas/musicspace-patch.schema.json`
- `schemas/musicspace-patch-index.schema.json`

## Inspecting And Validating Patches

The app includes a Patch Inspector under the canvas. It summarizes the active patch, shows the selected backend and any MIDI/Faust artifacts, lists constraints and mappings, and reports validation findings.

Use **JSON** in the inspector to open an editable snapshot of the active patch. **Apply JSON** parses that snapshot, validates it, and loads it as a separate edited patch entry instead of overwriting a built-in patch.

Validation checks MusicSpace-level semantics that JSON Schema cannot fully express: object references used by constraints, constraint parameter ranges, backend type declarations, Faust adapter/artifact references, parameter mapping targets, and MIDI track bindings.

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
- `target`: optional parameter target selection.
- `parameterMappings`: optional mappings from scene features to target parameters.
- `midiFile`: optional MIDI/MusicXML sequence-file binding.

## Target Backend Binding

Patches bind to parameter backends with the top-level `target` object. If `target` is omitted, MusicSpace uses the built-in `subtractive` Web Audio backend.

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
- `sum`: preserves the total listener distance of one or more sources.
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
