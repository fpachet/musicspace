const assert = require("node:assert/strict");
const test = require("node:test");
const { createSceneModel } = require("../musicspace-model");
const { createClock } = require("../musicspace-clock");
const mapping = require("../musicspace-mapping");
const { loadFixturePatch } = require("./helpers/engine-harness");

function scene(patch = loadFixturePatch("simple-spring.json")) {
  const model = createSceneModel();
  assert.equal(model.loadPatch(patch), true, JSON.stringify(model.validation()));
  return model;
}
function steps(model, count) {
  for (let i = 0; i < count; i += 1) model.step();
}
function close(actual, expected, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}
function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function energy(model) {
  const b = model.getObjectByName("Mass");
  const anchor = model.getObjectByName("Anchor");
  const spring = model.state.constraints[1];
  return (
    0.5 * b.dynamics.mass * (b.dynamics.vx ** 2 + b.dynamics.vy ** 2) +
    0.5 * spring.stiffness * (distance(anchor, b) - spring.restLength) ** 2
  );
}

test("spring at equilibrium remains exactly motionless", () => {
  const model = scene();
  const before = model.serializePatch();
  steps(model, 240);
  assert.deepEqual(model.serializePatch(), before);
  assert.equal(model.getLastPropagationReport().satisfied, true);
});

for (const [name, initialY, direction] of [
  ["stretched", 360, -1],
  ["compressed", 240, 1]
]) {
  test(`${name} spring accelerates toward its rest length`, () => {
    const model = scene();
    const b = model.getObjectByName("Mass");
    model.moveEntity(b, 400, initialY);
    model.step();
    assert.ok(direction * (b.y - initialY) > 0);
    assert.ok(direction * b.dynamics.vy > 0);
    assert.equal(model.getLastPropagationReport().residuals.length, 0);
  });
}

test("damping reduces oscillation energy and converges to equilibrium", () => {
  const damped = scene();
  const undamped = scene();
  undamped.state.constraints[1].damping = 0;
  for (const model of [damped, undamped]) model.moveEntity(model.getObjectByName("Mass"), 400, 360);
  const initialEnergy = energy(damped);
  let crossedEquilibrium = false;
  for (let i = 0; i < 600; i += 1) {
    damped.step();
    undamped.step();
    crossedEquilibrium ||= damped.getObjectByName("Mass").y < 300;
  }
  assert.ok(crossedEquilibrium, "underdamped spring crosses equilibrium");
  assert.ok(energy(damped) < initialEnergy * 1e-7);
  assert.ok(
    energy(undamped) > initialEnergy * 0.1,
    "undamped system retains oscillation despite implicit integration loss"
  );
  close(damped.getObjectByName("Mass").y, 300, 0.01);
});

test("pinned anchor stays exactly fixed during oscillation and dragging", () => {
  const model = scene();
  const anchor = model.getObjectByName("Anchor");
  const b = model.getObjectByName("Mass");
  model.moveEntity(b, 430, 370);
  for (let i = 0; i < 300; i += 1) {
    model.step();
    assert.equal(anchor.x, 400);
    assert.equal(anchor.y, 140);
  }
  model.beginDrag(anchor);
  model.moveEntity(anchor, 450, 160);
  model.step();
  model.endDrag();
  assert.equal(anchor.x, 400);
  assert.equal(anchor.y, 140);
});

test("two free masses react inversely to mass and conserve their center of mass", () => {
  const model = scene({
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 100, dynamics: { mass: 1 } },
      { name: "B", x: 260, y: 100, dynamics: { mass: 3 } }
    ],
    constraints: [{ type: "spring", anchor: "A", target: "B", restLength: 100, stiffness: 40, damping: 0 }]
  });
  const a = model.getObjectByName("A");
  const b = model.getObjectByName("B");
  model.stepDynamics(1 / 240);
  assert.ok(a.x > 100);
  assert.ok(b.x < 260);
  close((a.x - 100) / (260 - b.x), 3);
  steps(model, 300);
  close((a.x + 3 * b.x) / 4, 220, 1e-6);
});

test("heavier masses accelerate less; higher stiffness approaches rigid distance", () => {
  const light = scene();
  const heavy = scene();
  const stiff = scene();
  heavy.getObjectByName("Mass").dynamics.mass = 4;
  stiff.state.constraints[1].stiffness = 1e8;
  for (const model of [light, heavy, stiff]) {
    model.moveEntity(model.getObjectByName("Mass"), 400, 360);
    model.stepDynamics(1 / 240);
  }
  assert.ok(
    Math.abs(light.getObjectByName("Mass").dynamics.vy) >
      Math.abs(heavy.getObjectByName("Mass").dynamics.vy) * 3.9
  );
  close(stiff.getObjectByName("Mass").y, 300, 0.1);
});

test("perturbing the end of a two-spring chain excites both masses", () => {
  const model = scene({
    listener: { x: 0, y: 0 },
    sources: [
      { name: "Anchor", x: 200, y: 100 },
      { name: "A", x: 200, y: 200 },
      { name: "B", x: 200, y: 340 }
    ],
    constraints: [
      { type: "pin", target: "Anchor", x: 200, y: 100 },
      { type: "spring", anchor: "Anchor", target: "A", restLength: 100 },
      { type: "spring", anchor: "A", target: "B", restLength: 100 }
    ]
  });
  steps(model, 15);
  assert.ok(model.getObjectByName("A").y > 201);
  assert.ok(model.getObjectByName("B").y < 339);
});

for (const mode of ["propagation", "xpbd"]) {
  test(`drag/release excites a spring/rigid network in ${mode} mode`, () => {
    const model = scene(loadFixturePatch("coupled-springs.json"));
    model.setSolverMode(mode);
    const a = model.getObjectByName("A");
    const b = model.getObjectByName("B");
    model.beginDrag(a);
    model.moveEntity(a, 270, 370);
    for (let i = 0; i < 30; i += 1) {
      model.step();
      close(a.x, 270);
      close(a.y, 370);
      close(distance(a, b), 300, 0.01);
    }
    const beforeB = { x: b.x, y: b.y };
    model.endDrag();
    for (let i = 0; i < 300; i += 1) {
      model.step();
      close(distance(a, b), 300, 0.01);
    }
    assert.ok(distance(a, { x: 270, y: 370 }) > 10);
    assert.ok(distance(b, beforeB) > 10);
  });
}

test("a pendulum emerges from pin, rigid link, explicit mass and gravity alone", () => {
  const model = scene({
    listener: { x: 400, y: 100 },
    gravity: { x: 0, y: 180 },
    sources: [{ name: "Bob", x: 500, y: 100, dynamics: { mass: 1 } }],
    constraints: [{ type: "fixedDistance", anchor: "Listener", target: "Bob", distance: 100 }]
  });
  const bob = model.getObjectByName("Bob");
  steps(model, 30);
  assert.ok(bob.y > 110);
  assert.ok(bob.x < 500);
  close(distance(model.state.listener, bob), 100, 0.01);
});

test("long simulations, coincident endpoints and stiff damped springs remain finite", () => {
  for (const key of ["simple-spring", "coupled-springs", "spring-pendulum"]) {
    const model = scene(loadFixturePatch(`${key}.json`));
    const spring = model.state.constraints.find((c) => c instanceof model.classes.SpringConstraint);
    spring.stiffness = 1e6;
    spring.damping = 200;
    spring.target.x = spring.anchor.x;
    spring.target.y = spring.anchor.y;
    for (let i = 0; i < 1800; i += 1) {
      model.step();
      for (const entity of model.state.sources) {
        assert.ok(
          [entity.x, entity.y, entity.dynamics?.vx ?? 0, entity.dynamics?.vy ?? 0].every(Number.isFinite)
        );
        assert.ok(Math.hypot(entity.x, entity.y) < 10000);
      }
    }
    for (const c of model.state.constraints.filter(
      (c) => c instanceof model.classes.FixedDistanceConstraint
    )) {
      close(distance(c.anchor, c.target), c.distance, 0.5);
    }
  }
});

test("save/load preserves spring parameters, mass, gravity, velocity and subsequent motion", () => {
  const model = scene(loadFixturePatch("spring-pendulum.json"));
  steps(model, 47);
  const saved = model.serializePatch();
  const restored = scene(saved);
  assert.deepEqual(restored.serializePatch(), saved);
  steps(model, 120);
  steps(restored, 120);
  assert.deepEqual(restored.serializePatch(), model.serializePatch());
});

test("fixed clock gives the same dynamic state at 30, 60 and 120 display Hz", () => {
  const snapshots = [];
  for (const hz of [30, 60, 120]) {
    const model = scene(loadFixturePatch("spring-pendulum.json"));
    const clock = createClock();
    clock.reset(0);
    for (let i = 1; i <= hz; i += 1) clock.advance((i * 1000) / hz, (dt) => model.step(dt));
    snapshots.push(model.serializePatch());
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
  assert.deepEqual(snapshots[1], snapshots[2]);
});

test("ordinary mappings observe dynamic positions in the musical spring patch", () => {
  const model = scene(loadFixturePatch("musical-spring.json"));
  const spec = model.serializePatch().parameterMappings[0];
  const a = model.getObjectByName(spec.source);
  model.moveEntity(a, a.x, a.y + 60);
  const values = [];
  for (let i = 0; i < 90; i += 1) {
    model.step();
    values.push(mapping.valueFromMapping(spec, model.parameterFeatureValue(spec.feature, a)));
  }
  assert.ok(Math.max(...values) - Math.min(...values) > 100);
});

test("invalid dynamic data is rejected atomically and old patches acquire no bodies", () => {
  const model = scene(loadFixturePatch("open-trio.json"));
  assert.ok(model.state.sources.every((s) => s.dynamics === undefined));
  const before = model.serializePatch();
  for (const change of [
    (p) => {
      p.gravity = { x: 0, y: Infinity };
    },
    (p) => {
      p.sources[1].dynamics = { mass: 0 };
    },
    (p) => {
      p.sources[1].dynamics = { vx: "fast" };
    },
    (p) => {
      p.constraints[1].stiffness = -1;
    },
    (p) => {
      p.constraints[1].restLength = NaN;
    },
    (p) => {
      p.constraints[1].damping = Infinity;
    },
    (p) => {
      p.constraints[1].target = "Missing";
    },
    (p) => {
      p.constraints[1].target = "Anchor";
    }
  ]) {
    const patch = loadFixturePatch("simple-spring.json");
    change(patch);
    assert.equal(model.loadPatch(patch), false);
    assert.deepEqual(model.serializePatch(), before);
  }
  for (const dt of [0, -1, Infinity, NaN, 1]) assert.throws(() => model.stepDynamics(dt), RangeError);
});

test("Shift pause freezes dynamics, keeps rest length, and resumes without stale drag state", () => {
  const model = scene();
  const mass = model.getObjectByName("Mass");
  model.beginDrag(mass);
  model.moveEntity(mass, 400, 360, { skipPropagation: true });
  steps(model, 20);
  close(mass.y, 360);
  model.endDrag();
  model.resumePropagationAfterPausedDrag();
  assert.equal(model.state.constraints[1].restLength, 160);
  model.step();
  assert.ok(mass.y < 360);
  model.beginDrag(mass);
  assert.equal(model.loadPatch(loadFixturePatch("simple-spring.json")), true);
  assert.equal(model.state.draggedEntity, null);
});
