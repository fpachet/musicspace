const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSceneModel } = require("../../../musicspace-model");
const { createPresentation } = require("../../../musicspace-presentation");
const { createPackageScene } = require("../../../musicspace-package-scene");
const engine = require("../dist/index.cjs");
const adapter = require("../dist/legacy-patch.cjs");
const directory = path.resolve(__dirname, "../../../patches");
const fixtures = JSON.parse(fs.readFileSync(path.join(directory, "index.json"))).patches;
const read = (file) => JSON.parse(fs.readFileSync(path.join(directory, file)));
async function setup(patch, solver = "propagation") {
  const view = createPresentation();
  view.setSolverMode(solver);
  const play = createPackageScene({ createView: () => view, loadModules: async () => [engine, adapter] });
  await play.initialize();
  assert.equal(play.loadPatch(patch), true, JSON.stringify(play.validation()));
  return { play, view };
}
function compare(play, standard) {
  const actual = play.serializePatch(),
    expected = standard.serializePatch();
  for (const group of ["sources", "movingObjects"])
    actual[group].forEach((p, i) => {
      for (const key of ["x", "y"])
        assert.ok(Math.abs(p[key] - expected[group][i][key]) < 1e-7, `${p.name}.${key}`);
      assert.deepEqual(p.dynamics, expected[group][i].dynamics);
    });
  assert.deepEqual(actual.listener, expected.listener);
  assert.deepEqual(
    play.measureConstraintResiduals().map((r) => r.measurement.error),
    standard.measureConstraintResiduals().map((r) => r.measurement.error)
  );
}
for (const fixture of fixtures)
  for (const solver of ["propagation", "xpbd"]) {
    test(`Play adapter matches ${solver}: ${fixture.file}`, async () => {
      const patch = read(fixture.file),
        { play, view } = await setup(patch, solver);
      const standard = createSceneModel();
      standard.setSolverMode(solver);
      assert.equal(standard.loadPatch(patch), true);
      // The presentation model must never perform a simulation operation.
      const forbidden = () => {
        throw new Error("Presentation simulation used");
      };
      for (const key of ["step", "moveEntity", "enforceConstraints", "refineXpbdAfterDrag"])
        view[key] = forbidden;
      for (const c of view.state.constraints) c.enforce = forbidden;
      for (const m of view.state.movingObjects) m.tick = forbidden;
      const a = play.state.sources[0],
        b = standard.state.sources[0];
      compare(play, standard);
      play.beginDrag(a);
      standard.beginDrag(b);
      for (const [dx, dy] of [
        [7, 3],
        [-4, 8]
      ]) {
        play.moveEntity(a, a.x + dx, a.y + dy);
        standard.moveEntity(b, b.x + dx, b.y + dy);
        compare(play, standard);
      }
      play.endDrag();
      standard.endDrag();
      if (solver === "xpbd") standard.refineXpbdAfterDrag(b);
      compare(play, standard);
      for (const mode of ["preserve", "retarget"]) {
        play.state.listenerMode = standard.state.listenerMode = mode;
        for (const model of [play, standard]) model.moveEntity(model.state.listener, 402, 298);
        compare(play, standard);
      }
      for (let i = 0; i < 20; i++) {
        play.step();
        standard.step();
      }
      compare(play, standard);
      assert.equal(play.state.sources[0], a);
      for (const model of [play, standard]) {
        const p = model.state.sources[0];
        model.beginDrag(p);
        model.moveEntity(p, p.x + 10, p.y + 5, { skipPropagation: true });
        model.endDrag();
        model.resumePropagationAfterPausedDrag();
        model.step();
      }
      compare(play, standard);
    });
  }
test("Play preserves view metadata, manual handles and invalid-load state", async () => {
  const { play } = await setup(read(fixtures[0].file));
  play.state.sources[0].drawTrace = true;
  const node = play.state.constraints[0].node;
  play.moveEntity(node, 123, 234);
  play.step();
  assert.equal(node.x, 123);
  assert.equal(node.y, 234);
  const saved = play.serializePatch();
  assert.equal(saved.sources[0].drawTrace, true);
  assert.equal(play.loadPatch({ sources: "invalid" }), false);
  assert.deepEqual(play.serializePatch(), saved);
  assert.equal(play.loadPatch(saved), true);
  assert.deepEqual(play.serializePatch(), saved);
});
test("Play uses runtime solver changes and click release skips refinement", async () => {
  const { play } = await setup(read(fixtures[0].file));
  play.state.solverMode = "xpbd";
  const point = play.state.sources[0];
  play.beginDrag(point);
  play.endDrag({ refine: false });
  assert.equal(play.refineXpbdAfterDrag(), false);
  play.beginDrag(point);
  play.moveEntity(point, point.x + 2, point.y + 3);
  play.endDrag();
  assert.equal(play.refineXpbdAfterDrag(), true);
  assert.equal(play.refineXpbdAfterDrag(), false);
  assert.equal(play.state.lastPropagationReport.solverMode, "xpbd");
});

test("authoring creates package-owned geometry while keeping inspector identities", async () => {
  const { play, view } = await setup({ listener: { x: 400, y: 500 }, sources: [], constraints: [] });
  const create = play.createObject;
  const anchor = create("SoundSource", 300, 150, "Anchor"),
    mass = create("SoundSource", 300, 300, "Mass");
  const mover = create("MovingObject", 500, 200, "Mover", { type: "translation", vx: 1, vy: 0 });
  const spring = create("SpringConstraint", anchor, mass);
  assert.equal(
    play.editGeometry(() => {
      play.state.sources.push(anchor, mass);
      play.state.movingObjects.push(mover);
      play.state.constraints.push(spring, create("PinConstraint", anchor));
    }),
    true
  );
  for (const object of play.state.constraints)
    object.enforce = () => {
      throw Error("View solver called");
    };
  mover.tick = () => {
    throw Error("View tick called");
  };
  view.loadPatch = () => {
    throw Error("View recreated during editing");
  };
  assert.equal(
    play.editGeometry(() => {
      spring.stiffness = 80;
      mass.dynamics.mass = 2;
    }),
    true
  );
  assert.equal(play.state.sources[1], mass);
  assert.equal(play.state.constraints[0], spring);
  play.moveEntity(mass, 300, 370);
  play.step();
  assert.ok(mass.y < 370);
  assert.ok(mover.x > 500);
  assert.equal(play.serializePatch().constraints[0].stiffness, 80);
  assert.equal(play.serializePatch().sources[1].dynamics.mass, 2);
});
test("failed authoring restores nested fields, topology and the running engine", async () => {
  const patch = read("simple-spring.json");
  const { play } = await setup(patch),
    { play: control } = await setup(patch);
  const mass = play.state.sources[1],
    node = play.state.constraints[0].node;
  play.moveEntity(mass, mass.x, mass.y + 30);
  control.moveEntity(control.state.sources[1], mass.x, mass.y);
  const saved = play.serializePatch();
  assert.equal(
    play.editGeometry(() => {
      mass.name = "Changed";
      mass.dynamics.mass = -1;
      node.x = 123;
      play.state.sources.push(play.createObject("SoundSource", 1, 2, "Extra"));
    }),
    false
  );
  assert.equal(play.state.sources[1], mass);
  assert.deepEqual(play.serializePatch(), saved);
  play.step();
  control.step();
  assert.deepEqual(play.serializePatch(), control.serializePatch());
  assert.equal(
    play.editGeometry(() => {
      play.state.sources = [];
      play.state.constraints = [];
    }),
    true
  );
  assert.equal(play.loadPatch(play.serializePatch()), true);
  assert.deepEqual(play.state.sources, []);
});
