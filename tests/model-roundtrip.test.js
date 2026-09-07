const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSceneModel } = require("../musicspace-model");
const { createClock } = require("../musicspace-clock");
const { loadFixturePatch } = require("./helpers/engine-harness");

test("all library patches survive a headless round trip including optional outputs", () => {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, "../patches/index.json"), "utf8"));
  for (const entry of index.patches) {
    const model = createSceneModel();
    assert.equal(model.loadPatch(loadFixturePatch(entry.file)), true, entry.file);
    const saved = model.serializePatch();
    const restored = createSceneModel();
    assert.equal(restored.loadPatch(saved), true, JSON.stringify(restored.validation()));
    assert.deepEqual(restored.serializePatch(), saved, entry.file);
  }
});

test("aggregate targets and nested trajectories survive snapshots made while unsatisfied", () => {
  const model = createSceneModel();
  model.loadPatch(loadFixturePatch("angle-balance.json"));
  model.moveEntity(model.getObjectByName("A"), 100, 100, { skipPropagation: true });
  const before = model.measureConstraintResiduals().map(({ measurement }) => measurement);
  const restored = createSceneModel();
  assert.equal(restored.loadPatch(model.serializePatch()), true);
  assert.deepEqual(
    restored.measureConstraintResiduals().map(({ measurement }) => measurement),
    before
  );

  model.loadPatch(loadFixturePatch("shuttle-spin.json"));
  const snapshot = model.serializePatch();
  const serialized = JSON.stringify(snapshot);
  model.step();
  for (const mover of model.state.movingObjects) model.translateEntity(mover, 10, 0);
  assert.equal(JSON.stringify(snapshot), serialized);
});

test("graph indexes invalidate on addition, removal and scene replacement", () => {
  const model = createSceneModel();
  model.loadPatch({
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 200, y: 300 }],
    constraints: []
  });
  const a = model.getObjectByName("A");
  model.moveEntity(a, 190, 300);
  const builds = model.graph.stats().rebuilds;
  model.moveEntity(a, 180, 300);
  assert.equal(model.graph.stats().rebuilds, builds);
  model.state.constraints.push(new model.classes.PinConstraint(a, 200, 300));
  model.moveEntity(a, 100, 300);
  assert.equal(a.x, 200);
  model.state.constraints.splice(0, 1);
  model.moveEntity(a, 100, 300);
  assert.equal(a.x, 100);
  assert.equal(model.graph.stats().rebuilds, builds + 2);
  model.loadPatch(loadFixturePatch("product-limit.json"));
  model.moveEntity(model.getObjectByName("A"), 200, 300);
  assert.equal(model.graph.stats().rebuilds, builds + 3);
});

test("equivalent elapsed time produces identical constrained scenes across refresh rates", () => {
  const snapshots = [];
  for (const hz of [30, 60, 120]) {
    const model = createSceneModel();
    model.loadPatch(loadFixturePatch("cycloid-rotator.json"));
    const clock = createClock();
    clock.reset(0);
    for (let frame = 1; frame <= hz * 3; frame += 1) clock.advance((frame * 1000) / hz, () => model.step());
    snapshots.push(model.serializePatch());
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
  assert.deepEqual(snapshots[1], snapshots[2]);
});

test("malformed scene shapes and nonnumeric trajectories never change model state", () => {
  const model = createSceneModel();
  model.loadPatch(loadFixturePatch("simple-rotator.json"));
  const before = model.serializePatch();
  for (const update of [
    { constraints: [null] },
    { sources: [null] },
    { version: 999 },
    { listener: { x: "400", y: 300 } },
    {
      movingObjects: [
        { name: "Spin", x: 400, y: 300, trajectory: { type: "rotator", periodSeconds: "fast" } }
      ]
    }
  ]) {
    assert.equal(model.loadPatch({ ...before, ...update }), false);
    assert.deepEqual(model.serializePatch(), before);
  }
});
