const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { createSpace, CENTER } = require("../dist/index.cjs");
const { createSceneModel } = require("../../../musicspace-model");
const near = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test("empty scenes, unbounded coordinates and independent snapshots", () => {
  const scene = createSpace();
  scene.addPoint({ id: "a", x: 10, y: 20 });
  scene.move("a", -1000, 2000);
  assert.deepEqual(scene.getPoint("a"), { id: "a", x: -1000, y: 2000 });
  const saved = scene.snapshot();
  saved.points[0].x = 12;
  assert.equal(scene.getPoint("a").x, -1000);
  scene.removePoint("a");
  assert.deepEqual(scene.positions(), [{ id: CENTER, x: 0, y: 0 }]);
});

test("sum propagation and center motion preserve invariant", () => {
  const scene = createSpace({
    points: [
      { id: "a", x: 100, y: 0 },
      { id: "b", x: 0, y: 100 }
    ],
    constraints: [{ id: "sum", type: "sum", points: ["a", "b"] }]
  });
  scene.move("a", 130, 0);
  near(scene.getPoint("b").y, 70);
  scene.move(CENTER, 10, 10);
  const center = scene.getPoint(CENTER);
  const total = ["a", "b"].reduce((sum, id) => {
    const p = scene.getPoint(id);
    return sum + Math.hypot(p.x - center.x, p.y - center.y);
  }, 0);
  near(total, 200);
  assert.equal(scene.diagnostics().satisfied, true);
});

test("notifications include indirect movement, are isolated, and can be unsubscribed", () => {
  const scene = createSpace({
    points: [
      { id: "a", x: 100, y: 0 },
      { id: "b", x: 0, y: 100 }
    ],
    constraints: [{ id: "sum", type: "sum", points: ["a", "b"] }]
  });
  let calls = 0,
    received;
  const off = scene.onChange((event) => {
    calls++;
    event.positions[0].x = 999;
  });
  scene.onChange((event) => {
    received = event;
  });
  scene.move("a", 120, 0);
  assert.deepEqual(
    received.changed.map((p) => p.id),
    ["a", "b"]
  );
  assert.equal(received.positions[0].x, 0);
  off();
  scene.move("a", 130, 0);
  assert.equal(calls, 1);
});

test("invalid edits and restores leave the scene unchanged", () => {
  const scene = createSpace({ points: [{ id: "a", x: 100, y: 0 }] });
  const before = scene.snapshot();
  for (const action of [
    () => scene.addPoint({ id: "a", x: 0, y: 0 }),
    () => scene.addPoint({ id: "b", x: Infinity, y: 0 }),
    () => scene.addConstraint({ id: "bad", type: "sum", points: ["a", "missing"] }),
    () => scene.move("a", NaN, 0),
    () => scene.restore({ version: 99 }),
    () => scene.configure({ solver: "unknown" }),
    () =>
      scene.updatePoint("a", { trajectory: { type: "shuttle", start: { type: "object", id: "missing" } } })
  ]) {
    assert.throws(action);
    assert.deepEqual(scene.snapshot(), before);
  }
});

test("disabling, editing, re-enabling and removing constraints retain targets", () => {
  const scene = createSpace({
    points: [
      { id: "a", x: 100, y: 0 },
      { id: "b", x: 0, y: 100 }
    ],
    constraints: [{ id: "sum", type: "sum", points: ["a", "b"] }]
  });
  scene.updateConstraint("sum", { enabled: false });
  scene.move("a", 150, 0);
  near(scene.getPoint("b").y, 100);
  scene.updateConstraint("sum", { enabled: true });
  scene.solve("a");
  near(scene.getPoint("b").y, 50);
  scene.updateConstraint("sum", { totalDistance: 220 });
  scene.solve("a");
  near(scene.getPoint("b").y, 70);
  scene.removeConstraint("sum");
  scene.move("a", 200, 0);
  near(scene.getPoint("b").y, 70);
});

test("conflict diagnostics expose public ids without internal references", () => {
  const scene = createSpace({
    points: [{ id: "a", x: 100, y: 0 }],
    constraints: [
      { id: "pin", type: "pin", target: "a", x: 100, y: 0 },
      { id: "limit", type: "radialLimit", point: "a", minDistance: 10, maxDistance: 20 }
    ]
  });
  const event = scene.move("a", 90, 0);
  assert.equal(event.diagnostics.satisfied, false);
  assert.ok(event.diagnostics.residuals.length);
  assert.ok(event.diagnostics.residuals.every((r) => ["pin", "limit"].includes(r.id)));
  assert.doesNotThrow(() => JSON.stringify(event));
});

test("rotators carry attached points and work in mover-only scenes", () => {
  const scene = createSpace({
    points: [
      { id: "rotor", x: 200, y: 200, trajectory: { type: "rotator", periodSeconds: 4 } },
      { id: "a", x: 300, y: 200, trajectory: { type: "free" } }
    ],
    constraints: [{ id: "link", type: "solid", carrier: "rotor", attached: "a" }]
  });
  for (let i = 0; i < 60; i++) scene.step();
  near(scene.getPoint("a").x, 200);
  near(scene.getPoint("a").y, 300);
  const restored = createSpace(JSON.parse(JSON.stringify(scene.snapshot())));
  scene.step();
  restored.step();
  assert.deepEqual(restored.positions(), scene.positions());
});

test("spring dynamics, drag release and state restoration preserve subsequent motion", () => {
  const scene = createSpace({
    points: [
      { id: "anchor", x: 100, y: 100 },
      { id: "mass", x: 200, y: 100, dynamics: { mass: 2 } }
    ],
    constraints: [
      { id: "pin", type: "pin", target: "anchor", x: 100, y: 100 },
      {
        id: "spring",
        type: "spring",
        anchor: "anchor",
        target: "mass",
        restLength: 100,
        stiffness: 60,
        damping: 1
      }
    ]
  });
  scene.beginDrag("mass");
  scene.move("mass", 260, 100);
  scene.step();
  scene.endDrag();
  for (let i = 0; i < 10; i++) scene.step();
  assert.ok(scene.getPoint("mass").x < 260);
  const restored = createSpace(JSON.parse(JSON.stringify(scene.snapshot())));
  for (let i = 0; i < 30; i++) {
    scene.step();
    restored.step();
  }
  assert.deepEqual(restored.positions(), scene.positions());
});

test("fixed clock produces identical trajectories at 30, 60 and 120 display Hz", () => {
  const results = [30, 60, 120].map((rate) => {
    const scene = createSpace({
      points: [{ id: "a", x: 0, y: 0, trajectory: { type: "translation", vx: 1, vy: 0, bounce: false } }]
    });
    for (let i = 0; i <= rate; i++) scene.advance((i * 1000) / rate);
    return scene.getPoint("a").x;
  });
  assert.deepEqual(results, [60, 60, 60]);
});

test("removing a point removes dependent constraints and freezes shuttle endpoints", () => {
  const scene = createSpace({
    points: [
      { id: "a", x: 100, y: 0 },
      {
        id: "b",
        x: 200,
        y: 0,
        trajectory: {
          type: "shuttle",
          start: { type: "object", id: "a" },
          end: { type: "fixed", x: 300, y: 0 }
        }
      }
    ],
    constraints: [{ id: "sum", type: "sum", points: ["a", "b"] }]
  });
  scene.removePoint("a");
  const saved = scene.snapshot();
  assert.equal(saved.constraints.length, 0);
  assert.deepEqual(saved.points[0].trajectory.start, { type: "fixed", x: 100, y: 0 });
  scene.step();
});

test("bundled engine matches existing model on product/limit fixture", () => {
  const patch = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../patches/product-limit.json")));
  const model = createSceneModel();
  assert.equal(model.loadPatch(patch), true);
  const constraints = patch.constraints.map(({ sources, source, node: _node, ...c }, i) => ({
    ...c,
    id: `c${i}`,
    ...(sources ? { points: sources } : {}),
    ...(source ? { point: source } : {})
  }));
  const space = createSpace({
    center: patch.listener,
    points: patch.sources.map(({ name, ...p }) => ({ ...p, id: name })),
    constraints
  });
  for (const x of [200, 250, 300, 350]) {
    model.moveEntity(model.getObjectByName("A"), x, 300);
    space.move("A", x, 300);
    for (const p of patch.sources) {
      const actual = space.getPoint(p.name),
        expected = model.getObjectByName(p.name);
      near(actual.x, expected.x, 1e-8);
      near(actual.y, expected.y, 1e-8);
    }
  }
});

test("ESM entry imports without creating global MusicSpace objects", async () => {
  const before = Object.keys(globalThis).filter((key) => key.startsWith("MusicSpace"));
  const esm = await import("../dist/index.mjs");
  assert.equal(esm.createSpace().positions().length, 1);
  assert.deepEqual(
    Object.keys(globalThis).filter((key) => key.startsWith("MusicSpace")),
    before
  );
});

test("runtime settings validate atomically and preserve paused drags", () => {
  const space = createSpace({ points: [{ id: "a", x: 10, y: 20, dynamics: { mass: 1, vx: 3, vy: 4 } }] });
  space.beginDrag("a");
  space.move("a", 12, 24, { skipPropagation: true });
  const before = space.snapshot();
  for (const options of [
    { solver: null },
    { centerMode: null },
    { solver: "xpbd", gravity: { x: NaN, y: 2 } }
  ]) {
    assert.throws(() => space.configure(options), TypeError);
    assert.deepEqual(space.snapshot(), before);
  }
  space.configure({ solver: "xpbd", centerMode: "retarget", gravity: { x: 0, y: 150 } });
  assert.equal(space.diagnostics().propagationPaused, true);
  space.resumePropagation();
  space.step();
  assert.deepEqual(space.getPoint("a"), { id: "a", x: 12, y: 24 });
  space.endDrag({ refine: false });
  space.step();
  assert.ok(space.getPoint("a").y > 24);
});
