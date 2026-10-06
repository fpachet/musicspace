const assert = require("node:assert/strict");
const test = require("node:test");
const { createSceneModel } = require("../musicspace-model");
const { loadFixturePatch } = require("./helpers/engine-harness");

function scene({
  massA = 1,
  massB = 1,
  distance = 200,
  strength = 1e6,
  softening = 10,
  constraints = []
} = {}) {
  const model = createSceneModel();
  assert.equal(
    model.loadPatch({
      version: 1,
      listener: { x: 400, y: 550 },
      sources: [
        { name: "A", x: 300, y: 300, dynamics: { mass: massA } },
        { name: "B", x: 300 + distance, y: 300, dynamics: { mass: massB } }
      ],
      constraints: [{ type: "gravitational", anchor: "A", target: "B", strength, softening }, ...constraints]
    }),
    true
  );
  return model;
}
function near(a, b, epsilon = 1e-7) {
  assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
}
function energy(model) {
  const kinetic = model.state.sources.reduce(
    (sum, p) => sum + (p.dynamics.mass * (p.dynamics.vx ** 2 + p.dynamics.vy ** 2)) / 2,
    0
  );
  return (
    kinetic -
    model.state.constraints
      .filter((c) => c.strength !== undefined)
      .reduce(
        (sum, c) =>
          sum +
          (c.strength * c.anchor.dynamics.mass * c.target.dynamics.mass) /
            Math.hypot(c.target.x - c.anchor.x, c.target.y - c.anchor.y, c.softening),
        0
      )
  );
}

test("mutual gravity uses masses and softened inverse square attraction", () => {
  const model = scene({ massA: 2, massB: 5 });
  const [a, b] = model.state.sources;
  const dt = 1e-5;
  model.step(dt);
  const acceleration = (1e6 * 200) / (200 ** 2 + 10 ** 2) ** 1.5;
  near(a.dynamics.vx / dt, 5 * acceleration, 1e-5);
  near(b.dynamics.vx / dt, -2 * acceleration, 1e-5);
  near(2 * a.dynamics.vx + 5 * b.dynamics.vx, 0);
  near(2 * a.x + 5 * b.x, 3100);
  assert.equal(model.getLastPropagationReport().satisfied, true);
});

test("two-body orbit conserves energy, momentum and radius over 30 revolutions", () => {
  const model = scene();
  const [a, b] = model.state.sources;
  const speed = Math.sqrt((1e6 * 200 * 100) / (200 ** 2 + 10 ** 2) ** 1.5);
  a.dynamics.vy = -speed;
  b.dynamics.vy = speed;
  const initial = energy(model);
  let worst = 0;
  const ticks = Math.ceil(((30 * 2 * Math.PI * 100) / speed) * 60);
  for (let i = 0; i < ticks; i++) {
    model.step();
    worst = Math.max(worst, Math.abs((energy(model) - initial) / initial));
  }
  assert.ok(worst < 1e-6, `relative energy error ${worst}`);
  near(Math.hypot(a.x - b.x, a.y - b.y), 200, 0.002);
  near(a.x + b.x, 800, 1e-6);
  near(a.y + b.y, 600, 1e-6);
  near(a.dynamics.vx + b.dynamics.vx, 0, 1e-7);
  near(a.dynamics.vy + b.dynamics.vy, 0, 1e-7);
});

test("coincident and head-on bodies remain finite without collision singularities", () => {
  for (const distance of [0, 100]) {
    const model = scene({ distance });
    for (let i = 0; i < 1200; i++) model.step();
    for (const p of model.state.sources) {
      assert.ok([p.x, p.y, p.dynamics.vx, p.dynamics.vy].every(Number.isFinite));
      if (!distance) {
        near(p.x, 300);
        near(p.dynamics.vx, 0);
      }
    }
  }
});

test("pinned and held bodies attract mobile bodies and stay fixed", () => {
  for (const held of [false, true]) {
    const model = scene({
      massA: 4,
      constraints: held ? [] : [{ type: "pin", target: "A", x: 300, y: 300 }]
    });
    const [a, b] = model.state.sources;
    if (held) model.state.draggedEntity = a;
    model.step();
    near(a.x, 300);
    near(a.dynamics.vx, 0);
    assert.ok(b.dynamics.vx < 0);
  }
});

test("gravity composes with springs, rigid links and uniform gravity", () => {
  const model = scene({
    constraints: [
      { type: "fixedDistance", anchor: "A", target: "B", distance: 200 },
      { type: "spring", anchor: "A", target: "B", restLength: 180, stiffness: 40, damping: 2 }
    ]
  });
  model.state.gravity = { x: 0, y: 10 };
  for (let i = 0; i < 60; i++) model.step();
  const [a, b] = model.state.sources;
  near(Math.hypot(a.x - b.x, a.y - b.y), 200, 0.01);
  near(a.y, 305, 1e-6);
  near(a.dynamics.vy, 10, 1e-6);
});

test("three-body preset starts in a balanced orbit and saves subsequent motion", () => {
  const model = createSceneModel();
  assert.equal(model.loadPatch(loadFixturePatch("three-body.json")), true);
  for (let i = 0; i < 600; i++) model.step();
  for (const p of model.state.sources) near(Math.hypot(p.x - 400, p.y - 300), 150, 0.01);
  const saved = model.serializePatch(),
    restored = createSceneModel();
  assert.equal(restored.loadPatch(saved), true);
  for (let i = 0; i < 100; i++) {
    model.step();
    restored.step();
  }
  assert.deepEqual(restored.serializePatch(), model.serializePatch());
});

test("invalid gravitational parameters and references are rejected atomically", () => {
  const model = scene(),
    before = model.serializePatch();
  for (const change of [
    { strength: -1 },
    { strength: Infinity },
    { softening: 0 },
    { softening: -1 },
    { softening: NaN },
    { anchor: "B" },
    { target: "missing" }
  ]) {
    const patch = structuredClone(before);
    Object.assign(patch.constraints[0], change);
    assert.equal(model.loadPatch(patch), false);
    assert.deepEqual(model.serializePatch(), before);
  }
});

test("a prescribed trajectory stays kinematic while attracting a free body", () => {
  const model = createSceneModel();
  assert.equal(
    model.loadPatch({
      version: 1,
      listener: { x: 400, y: 550 },
      movingObjects: [
        { name: "Anchor", x: 100, y: 100, trajectory: { type: "translation", vx: 1, vy: 0, bounce: false } }
      ],
      sources: [{ name: "Body", x: 300, y: 100 }],
      constraints: [{ type: "gravitational", anchor: "Anchor", target: "Body" }]
    }),
    true
  );
  for (let i = 0; i < 60; i++) model.step();
  const anchor = model.getObjectByName("Anchor"),
    body = model.getObjectByName("Body");
  near(anchor.x, 160);
  near(anchor.y, 100);
  assert.equal(anchor.dynamics, undefined);
  assert.ok(body.x < 300);
  assert.ok(body.dynamics.vx < 0);
});
