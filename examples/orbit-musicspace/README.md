# Orbit × MusicSpace: play the relationships

A working proof of concept for **Yann Orlarey**: Faust Orbit UI controls coupled by
the standalone MusicSpace engine, driving an actual Faust WebAssembly instrument.

## Run or share

Public demos on GitHub Pages:

- [Study 01: Play the relationships](https://fpachet.github.io/musicspace/examples/orbit-musicspace/)
- [Study 02: Constellation](https://fpachet.github.io/musicspace/examples/orbit-musicspace/constellation.html)
- [Study 03: Living springs](https://fpachet.github.io/musicspace/examples/orbit-musicspace/living-springs.html)
- [Three-Body Gravity · Faust workbench](https://fpachet.github.io/musicspace/musicspace.html?patch=three-body)

The three Orbit studies in this folder are self-contained. All browser dependencies and the compiled DSP are
included; no npm install, CDN, account, microphone or Faust installation is needed
to play it.

From this folder:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. AudioWorklet requires **localhost or HTTPS**.
Opening `index.html` directly with `file://` will not work.

The header links to **Study 02: Constellation**, also directly available at
`constellation.html` in this folder, and **Study 03: Living springs** at
`living-springs.html`. Each study also links to the hosted **Three-Body Gravity**
Faust demo, which uses the full MusicSpace workbench.

From the MusicSpace repository root, `npm run serve` serves the demo at
<http://localhost:8000/examples/orbit-musicspace/>. A static HTTPS host can serve
this folder unchanged.

## Install the engine from npm

The standalone engine is published as
[`@fpachet/musicspace-engine`](https://www.npmjs.com/package/@fpachet/musicspace-engine).
The current npm release is **0.1.0-alpha.6**:

```sh
npm install @fpachet/musicspace-engine@alpha
```

```js
import { createSpace } from '@fpachet/musicspace-engine';
```

The Orbit studies include their own engine copy so they run without installation.
Mutual gravity is part of the **alpha.7 repository build**; it is not included in
the published alpha.6 package. See the
[package quick-start guide](../../packages/musicspace-engine/QUICKSTART.md) for
installation and building gravity-enabled scenes locally.

## Three-Body Gravity: Faust workbench demo

[Open Three-Body Gravity](https://fpachet.github.io/musicspace/musicspace.html?patch=three-body).
Three equal masses attract each other, starting in a rotating triangle. Their
motion drives three voices from a compiled Faust DSP: height controls pitch,
horizontal position controls stereo pan, and distance from Listener controls
brightness and loudness.

Click **Play Sound**, drag a body to perturb the orbit, and use **Draw Selected**
to trace its path. **Reset** restores the initial orbit. This example runs in the
MusicSpace workbench and demonstrates another way to control Faust with the same
constraint and dynamics system. See the
[sonification guide](../../EXAMPLES.md#three-body-gravity) for controls and mappings.
To run it locally, serve the repository root and open `/musicspace.html?patch=three-body`.

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
- **MusicSpace:** the standalone `@fpachet/musicspace-engine` 0.1.0-alpha.5 ES module.
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

The extension also brackets numeric detail edits as gestures, preserves the
detail slider DOM during external motion, and prevents keyboard focus from scrolling
the canvas away from the pointer at the start of a drag. Unicode toolbar glyphs are a host-side
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

Before pushing, run the same checks as the GitHub Pages workflow:

```sh
npm run check
npm run format:check
npm test
npm run smoke
npm test --prefix packages/musicspace-engine
```

`npm run smoke` includes the Orbit tests alongside the workbench tests using the
CI browser configuration. The drag regression explicitly uses a 1280 × 720 viewport
and checks that focusing the instrument leaves the page's scroll position unchanged.
The focused Orbit configuration also covers a larger desktop viewport and mobile layouts.

Pushes to `main` trigger `.github/workflows/pages.yml`. GitHub Pages is updated only
after the tests pass. A successful push alone does not confirm deployment; check
both the **test** and **deploy** jobs in GitHub Actions before sharing an update.

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

## Study 02: Constellation

Open `constellation.html` for a second, denser instrument: **ten Faust parameters,
nineteen constraints, eight constraint types**. Its own Faust DSP mixes bass, body
and upper voices, with dry/wet balance, resonant filtering, tremolo rate/depth and
stereo pan. It uses the same Orbit build and MusicSpace package as Study 01.

| Rule | Controls | Geometry |
| --- | --- | --- |
| 01 Voice balance | Bass, Body, Air | Sum of radii; normalized levels sum to one |
| 02 Dry/wet balance | Dry, Wet | Sum of radii; normalized levels sum to one |
| 03 Filter linkage | Cutoff, Resonance | Fixed pairwise distance |
| 04 Pulse proportion | Rate, Depth | Ratio of distances from Orbit's center |
| 05 Voice angle | Bass, Body | Fixed angle at the center |
| 06 Make room | Body, Cutoff | Minimum separation |
| 07 Air/filter spring | Air, Cutoff | Elastic pairwise distance |
| 08 Pulse/pan spring | Depth, Pan | Elastic pairwise distance |
| 09 Pan corridor | Pan | Angular sector |
| Ten radial bounds | Every parameter | Inner/outer limits |

The canvas draws the **actual active graph** using Orbit's `drawRelations` hook.
Numbered badges match the inspector; selecting a row highlights its links and
controls. "Selected only" isolates that rule, or rules touching the last dragged
control when no row is selected. "Hide" changes only the drawing. The ten radial
limits share the same annulus and are shown by the optional range guides.

Switches disable individual rules while retaining their invariant targets.
Undo/redo restores both geometry and enabled states. Scene export includes the
complete engine snapshot and Faust values; this study currently exports files
for inspection/reuse and does not provide a file-import UI.

The scene starts feasible, with both springs at rest. Dynamics start paused so
geometric coupling is easy to inspect. Turn on **Animate springs** and drag Air or
Depth to excite the network. Springs act in both directions. XPBD solves this
denser graph; it can leave residuals during strong or incompatible edits. Red links
and inspector warnings report geometric errors outside the engine's tolerance.
Elastic spring extensions are excluded from those warnings because extension is
part of their behavior. The sums are therefore approximate within solver and
parameter-step tolerances, especially during motion.

`constellation-model.mjs` defines the engine scene; `constraint-drawing.mjs` draws
the constraints; `constellation.mjs` connects gestures, history and audio. The new
DSP is `audio/constellation.dsp`, with compiled JSON/WASM alongside it. The shared
audio runtime now accepts a DSP URL; Study 01 retains its original default.

## Study 03: Living springs

Open `living-springs.html`. Motion starts immediately, while audio starts only
when you click **Start sound**. The page reuses Study 02's real compiled Faust
synth; this is a new geometric controller for that instrument.

Ten Faust controls form a ring of ten springs. Four additional springs attach
the ring to two non-audio motor points: an offset circular trajectory with a
7.3-second base period, and a shuttle with an approximately 10.8-second base
period. The motors use the public MusicSpace trajectory API. Their unequal
periods continuously supply energy; moving positions are not decorative jitter.
Both trajectories change distances from Orbit's center, producing audible
parameter changes. Ten radial limits bound the sound controls.

- **Pluck:** drag any sound-control dot, then release it into the network.
- **Motor speed, spring tension, damping:** shape the response. Parameter changes
  preserve positions, velocities and spring rest lengths.
- **Float / Wiggle / Flutter:** three choices of speed, stiffness and damping.
- **Motor power:** off replaces the trajectories with pinned anchors so the
  springs can settle; on resumes trajectory motion from the anchored positions.
- **Freeze motion:** pauses the entire simulation without changing audio state.
- **Show springs / Motion trails:** control the overlay independently of physics.
- **Undo / redo:** restore the complete engine state and freeze it for inspection.

The two motors are drawn as gold diamonds with dashed paths; their four springs
are gold. The other coils change tint with extension/compression. Faint traces
show the last few seconds of control movement. Motors are animation sources, not
additional Faust parameters. There are no sum/balance constraints in this study;
all ten sound parameters are free to evolve within their radial bounds.

`living-springs-model.mjs` defines the spring network, masses and trajectories.
`living-springs.mjs` hosts Orbit, renders the coils/trails and connects Faust audio.
The engine runs fixed 1/60-second simulation steps through `advance(timestamp)`.
Background tabs pause physics and resume without accumulating a catch-up burst.
This is control-rate modulation; Faust smooths parameter changes on the audio thread.

The test suite checks continued radial motion after 40 simulated seconds at
three motor speeds, preservation of spring rest lengths when changing the feel,
fixed anchors with motors off, automatic startup, exact freeze/resume, plucking
and undo, sound output, and mobile layout.
