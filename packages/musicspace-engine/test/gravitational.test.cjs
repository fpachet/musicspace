const assert = require("node:assert/strict");
const test = require("node:test");
const { createSpace } = require("../dist/index.cjs");
const { importLegacyPatch, exportLegacyPatch } = require("../dist/legacy-patch.cjs");
const fixture = require("../../../patches/three-body.json");

function pair() {
  return createSpace({
    points: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 200, y: 0 }
    ],
    constraints: [{ id: "g", type: "gravitational", anchor: "a", target: "b" }]
  });
}
test("public gravitational API defaults, updates, disable, drag, restore and notifications", () => {
  const space = pair();
  assert.equal(space.snapshot().points.find((p) => p.id === "a").dynamics.mass, 1);
  assert.equal(space.snapshot().constraints.find((c) => c.id === "g").strength, 1e6);
  assert.equal(space.snapshot().constraints.find((c) => c.id === "g").softening, 10);
  let changed;
  space.onChange((event) => {
    changed = event.changed;
  });
  space.beginDrag("a");
  space.step();
  assert.equal(space.getPoint("a").x, 0);
  assert.ok(space.getPoint("b").x < 200);
  assert.ok(changed.some((p) => p.id === "b"));
  space.endDrag();
  space.updateConstraint("g", { strength: 2e6, softening: 20 });
  const saved = space.snapshot();
  const restored = createSpace(saved);
  space.step();
  restored.step();
  assert.deepEqual(restored.snapshot(), space.snapshot());
  space.updateConstraint("g", { enabled: false });
  const vx = space.snapshot().points.find((p) => p.id === "b").dynamics.vx;
  space.step();
  assert.ok(Math.abs(space.snapshot().points.find((p) => p.id === "b").dynamics.vx - vx) < 1e-8);
  space.updateConstraint("g", { enabled: true });
  assert.equal(space.snapshot().constraints.find((c) => c.id === "g").strength, 2e6);
});
test("public API rejects invalid gravity edits without partial mutation", () => {
  const space = pair(),
    before = space.snapshot();
  for (const change of [
    { strength: -1 },
    { strength: NaN },
    { softening: 0 },
    { softening: Infinity },
    { target: "a" }
  ]) {
    assert.throws(() => space.updateConstraint("g", change));
    assert.deepEqual(space.snapshot(), before);
  }
});
test("legacy adapter preserves edited gravity parameters and three-body state", () => {
  const imported = importLegacyPatch(fixture);
  const space = createSpace(imported.scene);
  const id = space.snapshot().constraints[0].id;
  space.updateConstraint(id, { strength: 2345678, softening: 23 });
  space.step();
  const patch = exportLegacyPatch(space.snapshot(), imported.context);
  assert.equal(patch.constraints[0].strength, 2345678);
  assert.equal(patch.constraints[0].softening, 23);
  const restored = createSpace(importLegacyPatch(patch).scene);
  assert.deepEqual(restored.snapshot(), space.snapshot());
});
