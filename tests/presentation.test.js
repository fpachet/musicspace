const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { createPresentation, legacyPresentation, containsPoint } = require("../musicspace-presentation");
const { createSceneModel } = require("../musicspace-model");
const fixtures = require("../patches/index.json").patches;
for (const fixture of fixtures)
  test(`plain presentation matches saved display data: ${fixture.key}`, () => {
    const patch = JSON.parse(fs.readFileSync(path.join(__dirname, "../patches", fixture.file)));
    const view = createPresentation(),
      model = createSceneModel();
    assert.equal(view.loadPatch(patch), true);
    assert.equal(model.loadPatch(patch), true);
    const legacy = legacyPresentation(model);
    const objects = (s) => [
      s.listener,
      ...s.sources,
      ...s.movingObjects,
      ...s.constraints.map((c) => c.node)
    ];
    const shapes = (items, kindOf) =>
      items.map((p) => ({
        kind: kindOf(p),
        x: p.x,
        y: p.y,
        color: p.color,
        radius: p.radius,
        name: p.name,
        label: p.label,
        glyph: p.glyph,
        isManual: p.isManual,
        drawTrace: p.drawTrace
      }));
    assert.deepEqual(shapes(objects(view.state), view.kindOf), shapes(objects(model.state), legacy.kindOf));
    for (const object of [...objects(view.state), ...view.state.constraints]) {
      assert.equal(Object.getPrototypeOf(object), Object.prototype);
      assert.ok(!Object.values(object).some((v) => typeof v === "function"));
    }
    assert.equal(view.classes, undefined);
    assert.equal(view.graph, undefined);
    assert.equal(view.step, undefined);
    assert.deepEqual(view.serializePatch().constraints, model.serializePatch().constraints);
    for (const [index, constraint] of view.state.constraints.entries()) {
      const expected = model.state.constraints[index];
      assert.deepEqual(
        view.affectedEntities(constraint).map((p) => p.name),
        expected.affectedEntities().map((p) => p.name)
      );
      view.updateNode(constraint);
      expected.updateNode?.();
      assert.equal(constraint.node.x, expected.node.x);
      assert.equal(constraint.node.y, expected.node.y);
      view.refresh(constraint);
      expected.refresh();
    }
    assert.deepEqual(view.serializePatch().constraints, model.serializePatch().constraints);
    const center = view.state.listener;
    assert.equal(containsPoint(center, center.x + center.radius, center.y), true);
    assert.equal(containsPoint(center, center.x + center.radius + 1, center.y), false);
  });
