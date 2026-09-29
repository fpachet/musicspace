# Try MusicSpace engine

Version **0.1.0-alpha.5**. The archive contains the complete engine, examples,
TypeScript declarations and MIT license. You do not need the MusicSpace repository.

## 1. Install the archive

Use Node.js 18 or newer and npm. In a new directory:

```sh
npm init -y
npm install /absolute/path/to/musicspace-engine-0.1.0-alpha.5.tgz
node node_modules/@musicspace/engine/examples/basic.mjs
```

The example moves A from radius 100 to 130. B moves from radius 100 to 70,
preserving a total distance of 200. It prints the new positions and diagnostics.
There is no install-time build and the engine has no runtime dependencies.

## 2. Try the visual examples

With Python 3 available, serve the installed package:

```sh
python3 -m http.server 8000 --directory node_modules/@musicspace/engine
```

Open <http://localhost:8000/examples/playground.html>. Drag the controls and center;
try the balance, rotating constellation and spring examples. Save and reload JSON.
The playground source is in `examples/playground.mjs` and `examples/playground.html`.
You can use any static HTTP server instead of Python.

## 3. Connect your own interface

In an application using JavaScript modules:

```js
import { createSpace, CENTER } from '@musicspace/engine';

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
cp node_modules/@musicspace/engine/examples/typed-consumer.mts ./consumer.mts
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
