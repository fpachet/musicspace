const assert = require("node:assert/strict");
const test = require("node:test");
const { createSceneModel } = require("../musicspace-model");
const { loadFixturePatch } = require("./helpers/engine-harness");
const mapping = require("../musicspace-mapping");

function scene(key, mode = "propagation") {
  const model = createSceneModel();
  assert.equal(model.loadPatch(loadFixturePatch(`${key}.json`)), true, JSON.stringify(model.validation()));
  model.setSolverMode(mode);
  return model;
}

for (const mode of ["propagation", "xpbd"]) {
  for (const key of ["coupled-pendulums", "elastic-pendulum", "quintuple-pendulum"]) {
    test(`${key} stays visible, constrained and moving for two minutes (${mode})`, () => {
      const model = scene(key, mode);
      const bodies = model.state.sources.filter((s) => s.dynamics);
      const ranges = bodies.map(() => [Infinity, -Infinity]);
      const specs = model.serializePatch();
      const mappings = specs.parameterMappings || specs.sourceGeneratorMappings;
      const mappedRanges = mappings.map(() => [Infinity, -Infinity]);
      for (let frame = 0; frame < 7200; frame += 1) {
        model.step();
        bodies.forEach((body, i) => {
          assert.ok([body.x, body.y, body.dynamics.vx, body.dynamics.vy].every(Number.isFinite));
          assert.ok(body.x > 40 && body.x < 760 && body.y > 40 && body.y < 520);
          if (frame >= 6600) {
            ranges[i][0] = Math.min(ranges[i][0], body.x);
            ranges[i][1] = Math.max(ranges[i][1], body.x);
          }
        });
        for (const c of specs.constraints) {
          const target = model.getObjectByName(c.target);
          if (c.type === "pin") {
            assert.equal(target.x, c.x);
            assert.equal(target.y, c.y);
          } else if (c.type === "fixedDistance") {
            const anchor = model.getObjectByName(c.anchor);
            assert.ok(Math.abs(Math.hypot(target.x - anchor.x, target.y - anchor.y) - c.distance) < 0.01);
          }
        }
        if (frame < 1200) {
          mappings.forEach((spec, i) => {
            const value = mapping.valueFromMapping(spec, model.getObjectByName(spec.source)[spec.feature]);
            assert.ok(Number.isFinite(value));
            mappedRanges[i][0] = Math.min(mappedRanges[i][0], value);
            mappedRanges[i][1] = Math.max(mappedRanges[i][1], value);
          });
        }
      }
      for (const [min, max] of ranges) assert.ok(max - min > 15, "each bob still swings late in the run");
      mappedRanges.forEach(([min, max], i) => {
        assert.ok(
          max - min > Math.abs(mappings[i].outputMax - mappings[i].outputMin) * 0.05,
          "the physics audibly changes each mapped parameter"
        );
      });
    });
  }
}

test("coupled pendulums transfer motion from A to B and back", () => {
  const model = scene("coupled-pendulums");
  const energy = (name) => {
    const bob = model.getObjectByName(name);
    return 0.5 * (bob.dynamics.vx ** 2 + bob.dynamics.vy ** 2) + 180 * (310 - bob.y);
  };
  assert.equal(energy("B"), 0);
  for (let i = 0; i < 600; i += 1) model.step();
  assert.ok(energy("B") > energy("A") * 10, "B takes over after about ten seconds");
  for (let i = 0; i < 540; i += 1) model.step();
  assert.ok(energy("A") > energy("B") * 10, "A takes over again after about nineteen seconds");
});

test("elastic pendulum stretches while swinging", () => {
  const model = scene("elastic-pendulum");
  const pivot = model.getObjectByName("Pivot");
  const bob = model.getObjectByName("Bob");
  const lengths = [];
  let crossed = false;
  for (let i = 0; i < 1200; i += 1) {
    model.step();
    lengths.push(Math.hypot(bob.x - pivot.x, bob.y - pivot.y));
    crossed ||= bob.x < pivot.x;
  }
  assert.ok(crossed);
  assert.ok(Math.max(...lengths) - Math.min(...lengths) > 50);
});
