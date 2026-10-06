# Try MusicSpace engine

Version **0.1.0-alpha.6**, published on npm. The package contains the complete engine, examples,
TypeScript declarations and MIT license. You do not need the MusicSpace repository.

The repository also contains **0.1.0-alpha.7 (unreleased)**, adding mutual gravity.
For that feature, use the development build instructions below. Installing
`@alpha` currently gives the published alpha.6 release.

## 1. Install

Use Node.js 18 or newer and npm. In a new directory:

```sh
npm init -y
npm install @fpachet/musicspace-engine@alpha
node node_modules/@fpachet/musicspace-engine/examples/basic.mjs
```

If you received the archive directly, replace the install command with
`npm install /absolute/path/to/fpachet-musicspace-engine-0.1.0-alpha.6.tgz`.

The example moves A from radius 100 to 130. B moves from radius 100 to 70,
preserving a total distance of 200. It prints the new positions and diagnostics.
There is no install-time build and the engine has no runtime dependencies.

## 2. Try the visual examples

With Python 3 available, serve the installed package:

```sh
python3 -m http.server 8000 --directory node_modules/@fpachet/musicspace-engine
```

Open <http://localhost:8000/examples/playground.html>. Drag the controls and center;
try the balance, rotating constellation and spring examples. Save and reload JSON.
The playground source is in `examples/playground.mjs` and `examples/playground.html`.
You can use any static HTTP server instead of Python.

## 3. Connect your own interface

In an application using JavaScript modules:

```js
import { createSpace, CENTER } from '@fpachet/musicspace-engine';

const space = createSpace({
  center: { x: 300, y: 200 },
  points: [
    { id: 'A', x: 200, y: 200 },
    { id: 'B', x: 400, y: 200 }
  ],
  constraints: [{ id: 'balance', type: 'sum', points: ['A', 'B'] }]
});

// Supply rendering and sound mapping in your application.
const unsubscribe = space.onChange(({ changed, diagnostics }) => {
  for (const point of changed) {
    // Update the corresponding control's position, including indirect movement.
    const center = space.getPoint(CENTER);
    const radius = Math.hypot(point.x - center.x, point.y - center.y);
    // Use radius (or another feature) to calculate your parameter value.
    console.log(point.id, point.x, point.y, radius);
  }
  console.log(diagnostics);
});

space.beginDrag('A');               // pointer down
space.move('A', 170, 200);          // pointer move, in your scene coordinates
space.endDrag();                    // pointer up or cancel
space.move(CENTER, 320, 220);       // the center is movable too
unsubscribe();                      // when removing the interface
```

Use `space.positions()` for the initial render. If parameters depend on distance
to the center, recompute them for every control when the center moves, even when
that control's own position is unchanged. Render the resulting coordinates without
feeding the same update back into `move` from the change callback.

For a plain browser without a bundler, copy `dist/index.mjs` next to your code and
use `import { createSpace } from './index.mjs'` in a module script. Serve it over HTTP.
The public API works with SVG, Canvas, DOM or a framework. The engine determines
positions; your application determines the meaning of each control. Orbit-specific
integration is left to the host application.

## TypeScript

The archive includes declarations for both package entry points and a runnable
consumer using the geometry API and legacy adapter:

```sh
npm install --save-dev typescript@7.0.2
cp node_modules/@fpachet/musicspace-engine/examples/typed-consumer.mts ./consumer.mts
npx tsc consumer.mts --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --outDir compiled
node compiled/consumer.mjs
```

This release is tested with TypeScript 7.0.2, strict checking, and NodeNext and
Bundler resolution. TypeScript is only needed to compile TypeScript applications.

## First integration exercise and feedback

A useful first trial is to connect two existing controls, add a sum or fixed-distance
constraint, and move the center. Keep your existing parameter mapping and redraw
all controls moved by the engine. Then try adding/removing a constraint and restoring
a saved snapshot. This tests the API in your own interface with little setup.

Feedback to collect:

- Which UI code was difficult to connect? A small code example is especially useful.
- Does movement preserve the control semantics you want?
- Do you need several radial centers, simultaneous pointers or batch proposals?
- What scene size and frame times do you observe with your actual audio processing?
- Can you share a scene JSON that behaves unexpectedly, plus the solver and gesture?

External integration feedback has not yet been collected for this release.

## Alpha limits to account for

- The API may change between alpha versions.
- Each scene has one radial center and one active drag. Pairwise constraints can
  use arbitrary points as anchors.
- Use coordinates spanning hundreds of units. Distance tolerance is 0.5 units;
  normalized 0–1 geometry needs scaling before calling the engine.
- Solvers report residuals for unsatisfied constraints. Dense graphs and incompatible
  constraints may not converge; read `diagnostics()`.
- Bounce trajectories use an 800 × 600 world. Use `bounce: false` for unbounded
  translation. Solver tolerances and bounce bounds are not configurable yet.

The [API reference](README.md) covers all constraints, dynamics, trajectories,
notifications, snapshots and patch conversion.

## Try mutual gravity from the development checkout

From the full MusicSpace repository root:

```sh
npm run build --prefix packages/musicspace-engine
node packages/musicspace-engine/examples/three-body.mjs
npm run serve
```

Open [Three-Body Gravity](http://localhost:8000/musicspace.html?engine=package&patch=three-body).
Drag a body to perturb the orbit. In Edit mode, use **Gravity** to connect two
bodies, or double-click a G node to edit strength and softening.

To use this build in another application, create and install a local archive:

```sh
npm pack ./packages/musicspace-engine --pack-destination /tmp
# Run this command in your application's directory:
npm install /tmp/fpachet-musicspace-engine-0.1.0-alpha.7.tgz
```

The [gravity API documentation](README.md#mutual-gravity-and-three-body-scenes-alpha7)
explains masses, initial velocities, pairwise links and numerical limits.
