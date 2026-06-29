# MusicSpace Patch Format

MusicSpace patches are JSON files that describe a complete scene: listener, sources, optional moving objects, constraints, target mappings, and optional sequence-file settings.

Built-in patches live in `patches/*.json` and are listed by `patches/index.json`. User-saved patches use the same `version: 1` format, but do not need a `key` unless they are added to the built-in menu.

The formal schemas are:

- `schemas/musicspace-patch.schema.json`
- `schemas/musicspace-patch-index.schema.json`

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
