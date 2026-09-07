const assert = require("node:assert/strict");
const { createSceneModel } = require("../../musicspace-model");

function createModelHarness() {
  const api = createSceneModel();
  const entity = (name) => {
    const object = api.getObjectByName(name);
    assert.ok(object, `Expected ${name} to exist`);
    return object;
  };
  return {
    api,
    loadPatch(patch) {
      assert.equal(api.loadPatch(patch), true, JSON.stringify(api.validation()));
    },
    move(name, x, y, options) {
      return api.moveEntity(entity(name), x, y, options);
    },
    point(name) {
      const { x, y } = entity(name);
      return { x, y };
    },
    points(names) {
      return Object.fromEntries(names.map((name) => [name, this.point(name)]));
    },
    report: api.getLastPropagationReport,
    residuals: api.measureConstraintResiduals,
    resumePropagationAfterPausedDrag: api.resumePropagationAfterPausedDrag,
    setSolverMode: api.setSolverMode,
    solverMode: api.getSolverMode,
    moveWithXpbdIterations(name, x, y, iterations) {
      const object = entity(name);
      object.x = x;
      object.y = y;
      return api.enforceConstraintsWithXpbd(object, { iterations });
    },
    refineXpbdAfterDrag(name) {
      api.refineXpbdAfterDrag(entity(name));
      return api.getLastPropagationReport();
    },
    tickMover(name) {
      const mover = entity(name);
      if (mover.tick()) api.enforceConstraints(mover, { preserveTrajectoryFrame: true });
      return api.getLastPropagationReport();
    },
    tickMovers(names, count = 1) {
      for (let step = 0; step < count; step += 1) for (const name of names) this.tickMover(name);
      return api.getLastPropagationReport();
    }
  };
}
module.exports = { createModelHarness };
