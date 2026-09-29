# Orbit × MusicSpace: play the relationships

A working proof of concept for **Yann Orlarey**: Faust Orbit UI controls coupled by
the standalone MusicSpace engine, driving an actual Faust WebAssembly instrument.

## Run or share

The folder is self-contained. All browser dependencies and the compiled DSP are
included; no npm install, CDN, account, microphone or Faust installation is needed
to play it.

From this folder:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. AudioWorklet requires **localhost or HTTPS**.
Opening `index.html` directly with `file://` will not work.

From the MusicSpace repository root, `npm run serve` serves the demo at
<http://localhost:8000/examples/orbit-musicspace/>. A static HTTPS host can serve
this folder unchanged. The current task does not publish it or send it to anyone.

## A 60-second demonstration

1. Click **Start sound**. Faust generates a quiet, pulsed minor chord.
2. Drag the green **Wet** dot inward. **Dry** moves outward: their sum stays at 1.
3. Disable **Keep the balance** and compare independent movement.
4. Enable **Give it a spring**. Pull **Cutoff** away from **Resonance** and release.
5. Click **Start sweep**. MusicSpace's shuttle moves Cutoff; Resonance responds
   through the spring. Click again to pause, or drag to take over.
6. **Undo** restores an entire gesture. **Save session** records the four controls,
   constraints, dynamic state and preset library; **Load session** restores them.

The sliders below the canvas provide conventional, keyboard-accessible editing.
Warm, Open and Hollow are starting points. Orbit's own preset library and morphing
overlay remain available through its toolbar.

## What is real

- **Orbit:** the actual `faust-orbit-ui` 0.4.1 source at
  [`9286c0739702b0959e3d8d951d14faf008eae191`](https://github.com/orlarey/faust-orbit-ui/tree/9286c0739702b0959e3d8d951d14faf008eae191),
  with the focused local extension described below.
- **MusicSpace:** the standalone `@musicspace/engine` 0.1.0-alpha.5 ES module.
  The adapter imports only its public API. No workbench or application globals.
- **Faust:** `audio/orbit-study.dsp`, compiled with Faust 2.81.2 to the included
  7.5 KB WebAssembly module. `audio/faust-worklet.mjs` calls the generated DSP on
  the audio thread. The metadata and Faust parameter indices come from the compiler.
- **Sound:** three band-limited sawtooth oscillators, a pulse envelope, a resonant
  lowpass filter and a dry/wet mix, with Faust parameter smoothing and bounded output.

## Integration boundary

```text
Orbit drag or value edit
    → resolveState(geometry, active parameter)
    → MusicSpace.move + constraint propagation
    → complete solved geometry
    → Orbit caches all values, updates dots and emits parameter changes
    → Faust AudioWorklet

MusicSpace.advance(timestamp)
    → shuttle + spring dynamics
    → Orbit.applyResolvedState
    → same display/audio path
```

`adapter.mjs` owns the geometric scene. `app.mjs` owns the demo controls, history,
audio lifecycle and file persistence. Faust mapping stays in Orbit.

### Proposed Orbit extensions

The local changes are in [`vendor/orbit/musicspace.patch`](vendor/orbit/musicspace.patch).
The original code and MIT notice are preserved in `vendor/orbit`.

| Extension | Purpose |
| --- | --- |
| `resolveState(state, path)` | Synchronous hook before drag/value proposals are published; returns solved geometry. A null path means a shared-center/radius change. |
| `applyResolvedState(state)` | Applies all coordinates and cached values together, including during pointer capture, then emits changed parameters. Does not clear the wrapper's parameter history. |
| `onParamsApplied(state)` | Tells the adapter that a preset, morph, or external parameter batch has established new geometry. |
| `drawRelations(ctx, state)` | Draws the balance and spring links in Orbit's world coordinates. |
| `getParamValues()` | Wrapper delegator for the renderer's existing value snapshot. |

The extension also brackets numeric detail edits as gestures and preserves the
detail slider DOM during external motion. Unicode toolbar glyphs are a host-side
convenience so this folder works without Google Fonts.

These are a proposal for discussion, not an upstream release or pull request.

## Semantics and current limits

- Orbit's existing **linear, inward-increasing radial mapping** is preserved.
  For two 0–1 parameters, `rDry + rWet = rInner + rOuter` means `dry + wet = 1`.
  The solver uses pixel-scale tolerances and Faust values are quantized; this is
  a control relation, not a sample-accurate constant-power crossfade.
- All four dots have radial bounds. The spring links **positions**, not a claimed
  perceptual equivalence between cutoff frequency and resonance.
- The host provides **whole-scene undo/redo** (up to 50 gestures), including engine
  state. Dynamics following a drag belong to that gesture. Restoring history or a
  file pauses motion until another gesture or sweep so the restored sound stays put.
- Preset recall and Orbit morphing restore the **exact parameter configuration**
  and recapture spring rest length. They stop the MusicSpace sweep. A recalled
  dry/wet mix is constrained on the next manual edit; this POC does not project
  every preset into a constrained parameter space. Included presets already sum to 1.
- The preset-map overlay keeps its original navigation and loop mechanism.
  MusicSpace physics pauses while the overlay is open. Driving its cursor with
  MusicSpace trajectories is a future integration step.
- Motion follows the foreground UI animation clock. It pauses when this page is
  hidden; the last Faust sound can continue. This is not audio-rate modulation.
- One active pointer per scene. No arbitrary relationship editor, DSP upload,
  multi-instrument routing or automatic semantic inference in this POC.
- The minimal worklet supports this compiled zero-input, stereo, single-precision
  instrument. General Faust DSP loading should use the standard FaustWasm runtime.

## Develop and verify (MusicSpace checkout)

```sh
npm run build:orbit
npm run test:orbit
```

To recompile the DSP as well (requires the Faust CLI):

```sh
node scripts/build-orbit-poc.cjs --compile-dsp
```

Browser tests cover real canvas dragging, propagation before mouse release,
whole-gesture undo/redo, independent mode, spring/shuttle movement, pause,
actual AudioWorklet output, audio pause/resume, session round-tripping,
invalid file rejection, and mobile layout. They do not substitute a mock DSP.

The browser-ready files are committed with the demo for easy copying. Rebuild after
changing the engine or vendored TypeScript. See `THIRD_PARTY_NOTICES.md` for attribution.
