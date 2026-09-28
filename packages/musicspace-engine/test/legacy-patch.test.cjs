const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSpace, CENTER } = require("../dist/index.cjs");
const { importLegacyPatch, exportLegacyPatch } = require("../dist/legacy-patch.cjs");
const { createSceneModel } = require("../../../musicspace-model");
const directory = path.resolve(__dirname, "../../../patches");
const fixtures = JSON.parse(fs.readFileSync(path.join(directory, "index.json"))).patches;
const read = (file) => JSON.parse(fs.readFileSync(path.join(directory, file)));
const freeBounds = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };

function modelFrom(patch, solver = "propagation", centerMode = "retarget") {
  const model = createSceneModel();
  assert.equal(model.loadPatch(patch), true, JSON.stringify(model.validation()));
  model.setSolverMode(solver);
  model.state.listenerMode = centerMode;
  return model;
}
function close(actual, expected, label) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected));
  assert.ok(
    Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)),
    `${label}: ${actual} != ${expected}`
  );
}
function compare(space, model, context) {
  for (const [name, id] of Object.entries(context.pointIds)) {
    const a = space.getPoint(id),
      b = model.getObjectByName(name);
    close(a.x, b.x, `${name}.x`);
    close(a.y, b.y, `${name}.y`);
  }
  const actual = space.diagnostics();
  const expected = model.measureConstraintResiduals().map(({ constraint, measurement }) => ({
    id: context.constraintIds[model.state.constraints.indexOf(constraint)],
    ...measurement
  }));
  assert.equal(actual.residuals.length, expected.length);
  actual.residuals.forEach((residual, i) => {
    assert.equal(residual.id, expected[i].id);
    assert.equal(residual.unit, expected[i].unit);
    close(residual.error, expected[i].error, `${residual.id}.error`);
    assert.equal(residual.tolerance, expected[i].tolerance);
  });
  const report = model.getLastPropagationReport();
  assert.equal(actual.hitStepCap, Boolean(report?.hitStepCap));
  assert.equal(actual.hitEntityCap, Boolean(report?.hitEntityCap));
  assert.equal(actual.propagationPaused, model.state.propagationPaused);
  const scene = space.snapshot();
  for (const p of scene.points) {
    const name = Object.keys(context.pointIds).find((name) => context.pointIds[name] === p.id);
    const b = model.getObjectByName(name);
    if (p.dynamics) {
      close(p.dynamics.mass, b.dynamics.mass, `${name}.mass`);
      close(p.dynamics.vx, b.dynamics.vx, `${name}.vx`);
      close(p.dynamics.vy, b.dynamics.vy, `${name}.vy`);
    }
  }
}

for (const fixture of fixtures) {
  test(`legacy round trip preserves ${fixture.file}`, () => {
    const patch = read(fixture.file),
      original = structuredClone(patch);
    const { scene, context } = importLegacyPatch(patch);
    const exported = exportLegacyPatch(createSpace(scene).snapshot(), context);
    assert.deepEqual(modelFrom(exported).serializePatch(), modelFrom(patch).serializePatch());
    for (const key of Object.keys(patch)) {
      if (!["listener", "sources", "movingObjects", "constraints", "gravity"].includes(key))
        assert.deepEqual(exported[key], patch[key], key);
    }
    assert.deepEqual(patch, original);
    assert.deepEqual(context.patch, original);
  });
  for (const solver of ["propagation", "xpbd"]) {
    test(`${solver} gestures, motion and resumed saves match for ${fixture.file}`, () => {
      const patch = read(fixture.file);
      const { scene, context } = importLegacyPatch(patch, { solver, centerMode: "preserve" });
      const space = createSpace(scene),
        model = modelFrom(patch, solver, "preserve");
      compare(space, model, context);
      const name = patch.sources[0].name,
        id = context.pointIds[name];
      space.beginDrag(id);
      model.beginDrag(model.getObjectByName(name));
      for (const [dx, dy] of [
        [8, 4],
        [-12, 9],
        [3, -7]
      ]) {
        const p = model.getObjectByName(name),
          x = p.x + dx,
          y = p.y + dy;
        space.move(id, x, y);
        model.moveEntity(p, x, y, { bounds: freeBounds });
        compare(space, model, context);
      }
      space.endDrag();
      model.endDrag();
      if (solver === "xpbd") model.refineXpbdAfterDrag(model.getObjectByName(name));
      compare(space, model, context);
      const center = space.getPoint(CENTER);
      space.move(CENTER, center.x + 4, center.y - 3);
      model.moveEntity(model.state.listener, center.x + 4, center.y - 3, { bounds: freeBounds });
      compare(space, model, context);
      for (let i = 0; i < 60; i++) {
        space.step();
        model.step();
        if (i % 10 === 0) compare(space, model, context);
      }
      const exported = JSON.parse(JSON.stringify(exportLegacyPatch(space.snapshot(), context)));
      const resumed = modelFrom(exported, solver, "preserve");
      // Re-loading resets transient rotator deltas in both paths.
      const expected = modelFrom(JSON.parse(JSON.stringify(model.serializePatch())), solver, "preserve");
      for (let i = 0; i < 30; i++) {
        resumed.step();
        expected.step();
      }
      for (const name of Object.keys(context.pointIds)) {
        const a = resumed.getObjectByName(name),
          b = expected.getObjectByName(name);
        close(a.x, b.x, name);
        close(a.y, b.y, name);
      }
      assert.deepEqual(
        resumed.measureConstraintResiduals().map(({ measurement }) => measurement),
        expected.measureConstraintResiduals().map(({ measurement }) => measurement)
      );
    });
  }
}

test("display metadata and unknown fields survive edits and serialized adapter context", () => {
  const patch = read("faust-control-study.json");
  patch.custom = { nested: ["keep", 42] };
  patch.listener.drawTrace = true;
  patch.listener.custom = "center";
  patch.sources[0].drawTrace = true;
  patch.sources[0].custom = { color: "violet" };
  patch.constraints[0].node = { x: 17, y: 28, isManual: true, drawTrace: true, custom: "label" };
  patch.constraints[0].custom = [1, 2];
  const imported = JSON.parse(JSON.stringify(importLegacyPatch(patch)));
  const space = createSpace(imported.scene);
  const name = patch.sources[0].name;
  space.move(imported.context.pointIds[name], 220, 300);
  const saved = exportLegacyPatch(space.snapshot(), imported.context);
  assert.deepEqual(saved.custom, patch.custom);
  assert.deepEqual(saved.constraints[0].node, patch.constraints[0].node);
  assert.deepEqual(saved.constraints[0].custom, patch.constraints[0].custom);
  assert.deepEqual(saved.sources[0].custom, patch.sources[0].custom);
  assert.equal(saved.sources[0].drawTrace, true);
  assert.equal(saved.listener.drawTrace, true);
  assert.equal(saved.listener.custom, "center");
  assert.deepEqual(saved.parameterMappings, patch.parameterMappings);
  assert.deepEqual(saved.target, patch.target);
  saved.custom.nested[0] = "changed";
  assert.equal(imported.context.patch.custom.nested[0], "keep");
});

test("reserved names and prototype-like names round trip through independent IDs", () => {
  const patch = {
    listener: { x: 0, y: 0 },
    sources: [
      { name: "$center", x: 100, y: 0 },
      { name: "$musicspace-empty", x: 200, y: 0 },
      { name: "__proto__", x: 0, y: 100 },
      { name: "constructor", x: 0, y: 200 }
    ],
    constraints: [{ type: "sum", sources: ["$center", "__proto__"] }],
    movingObjects: [
      {
        name: "shuttle",
        x: 0,
        y: 0,
        trajectory: {
          type: "shuttle",
          start: { type: "object", name: "Listener" },
          end: { type: "object", name: "constructor" }
        }
      }
    ]
  };
  const { scene, context } = importLegacyPatch(patch);
  const exported = exportLegacyPatch(scene, context);
  assert.deepEqual(
    exported.sources.map((p) => p.name),
    patch.sources.map((p) => p.name)
  );
  assert.deepEqual(exported.constraints[0].sources, ["$center", "__proto__"]);
  assert.equal(exported.movingObjects[0].trajectory.start.name, "Listener");
  assert.equal(exported.movingObjects[0].trajectory.end.name, "constructor");
});

test("disabled constraints and deleted output references fail explicitly without changing inputs", () => {
  const patch = read("faust-control-study.json");
  const { scene, context } = importLegacyPatch(patch);
  const space = createSpace(scene);
  space.updateConstraint(scene.constraints[0].id, { enabled: false });
  assert.throws(() => exportLegacyPatch(space.snapshot(), context), /disabled constraints/);
  const mappedName = patch.parameterMappings[0].source;
  const other = createSpace(scene);
  other.removePoint(context.pointIds[mappedName]);
  assert.throws(() => exportLegacyPatch(other.snapshot(), context));
  assert.deepEqual(context.patch, patch);
  assert.throws(() => importLegacyPatch({ ...patch, version: 2 }));
});

test("authoring changes retain names and unrelated metadata", () => {
  const patch = {
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 200, y: 0 }
    ],
    custom: { keep: true },
    constraints: [{ type: "sum", sources: ["A", "B"] }]
  };
  const { scene, context } = importLegacyPatch(patch);
  const space = createSpace(scene);
  space.removePoint(context.pointIds.B);
  space.addPoint({ id: "C", x: 100, y: 100 });
  space.addConstraint({
    id: "new",
    type: "fixedDistance",
    anchor: context.pointIds.A,
    target: "C",
    distance: 100
  });
  const exported = exportLegacyPatch(space.snapshot(), context);
  assert.deepEqual(
    exported.sources.map((p) => p.name),
    ["A", "C"]
  );
  assert.equal(exported.constraints[0].anchor, "A");
  assert.equal(exported.constraints[0].target, "C");
  assert.deepEqual(exported.custom, { keep: true });
});

for (const solver of ["propagation", "xpbd"]) {
  test(`${solver} matches workbench bounds, paused gestures and constraint retargeting`, () => {
    const patch = read("angle-balance.json");
    const { scene, context } = importLegacyPatch(patch, { solver });
    const space = createSpace(scene),
      model = modelFrom(patch, solver);
    const name = patch.sources[0].name,
      id = context.pointIds[name];
    const bounds = { left: 0, top: 0, right: 800, bottom: 600 };
    space.beginDrag(id);
    model.beginDrag(model.getObjectByName(name));
    space.move(id, -100, 900, { bounds, skipPropagation: true });
    model.moveEntity(model.getObjectByName(name), -100, 900, { bounds, skipPropagation: true });
    compare(space, model, context);
    assert.equal(space.diagnostics().satisfied, false);
    space.endDrag();
    model.endDrag();
    compare(space, model, context); // XPBD must not refine while propagation is paused.
    space.resumePropagation();
    model.resumePropagationAfterPausedDrag();
    compare(space, model, context);
    space.move(id, 20, 550, { bounds });
    model.moveEntity(model.getObjectByName(name), 20, 550, { bounds });
    compare(space, model, context);
    // The adapter's default center mode matches the workbench: retarget.
    space.move(CENTER, 410, 290);
    model.moveEntity(model.state.listener, 410, 290);
    compare(space, model, context);
    assert.equal(space.snapshot().centerMode, "retarget");
  });
}

test("paused spring gestures preserve rest lengths and resume dynamics", () => {
  const patch = read("simple-spring.json");
  const { scene, context } = importLegacyPatch(patch);
  const space = createSpace(scene),
    model = modelFrom(patch);
  const name = "Mass",
    id = context.pointIds[name];
  const original = space.snapshot().constraints.find((c) => c.type === "spring").restLength;
  space.move(id, 530, 260, { skipPropagation: true });
  model.moveEntity(model.getObjectByName(name), 530, 260, { skipPropagation: true });
  for (let i = 0; i < 5; i++) {
    space.step();
    model.step();
  }
  compare(space, model, context);
  space.resumePropagation();
  model.resumePropagationAfterPausedDrag();
  assert.equal(space.snapshot().constraints.find((c) => c.type === "spring").restLength, original);
  for (let i = 0; i < 20; i++) {
    space.step();
    model.step();
  }
  compare(space, model, context);
});

test("invalid movement bounds are rejected before geometry changes", () => {
  const space = createSpace({ points: [{ id: "A", x: 100, y: 100 }] });
  const before = space.snapshot();
  for (const bounds of [
    null,
    {},
    { left: 2, right: 1, top: 0, bottom: 10 },
    { left: 0, right: Infinity, top: 0, bottom: 10 }
  ]) {
    assert.throws(() => space.move("A", 30, 40, { bounds }), TypeError);
    assert.deepEqual(space.snapshot(), before);
  }
});

test("changed trajectory and constraint types discard obsolete fields but retain custom metadata", () => {
  const patch = {
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 200, y: 0 }
    ],
    movingObjects: [
      {
        name: "M",
        x: 150,
        y: 0,
        trajectory: {
          type: "shuttle",
          start: { type: "object", name: "B" },
          end: { type: "fixed", x: 300, y: 0 },
          custom: { keep: true }
        }
      }
    ],
    constraints: [{ type: "fixedDistance", anchor: "A", target: "M", distance: 50, custom: "keep" }]
  };
  const { scene, context } = importLegacyPatch(patch);
  const space = createSpace(scene);
  space.updatePoint(context.pointIds.M, { trajectory: { type: "free" } });
  space.removePoint(context.pointIds.B);
  space.removeConstraint(scene.constraints[0].id);
  space.addConstraint({ id: scene.constraints[0].id, type: "pin", target: context.pointIds.A, x: 100, y: 0 });
  const exported = exportLegacyPatch(space.snapshot(), context);
  assert.deepEqual(exported.movingObjects[0].trajectory, { type: "free", custom: { keep: true } });
  assert.equal(exported.constraints[0].anchor, undefined);
  assert.equal(exported.constraints[0].distance, undefined);
  assert.equal(exported.constraints[0].custom, "keep");
});

test("constraint metadata follows stable IDs when array order changes", () => {
  const patch = {
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 200, y: 0 }
    ],
    constraints: [
      { type: "pin", target: "A", x: 100, y: 0, custom: "first" },
      { type: "pin", target: "B", x: 200, y: 0, custom: "second" }
    ]
  };
  const { scene, context } = importLegacyPatch(patch);
  scene.constraints.reverse();
  const exported = exportLegacyPatch(scene, context);
  assert.deepEqual(
    exported.constraints.map((c) => [c.target, c.custom]),
    [
      ["B", "second"],
      ["A", "first"]
    ]
  );
});
