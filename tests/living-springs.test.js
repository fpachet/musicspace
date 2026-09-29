const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function fixture(settings) {
  const { LivingSprings } = await import("../examples/orbit-musicspace/living-springs-model.mjs");
  const { names } = await import("../examples/orbit-musicspace/constellation-model.mjs");
  const metadata = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../examples/orbit-musicspace/audio/constellation.json"), "utf8")
  );
  const widgets = [];
  const walk = (items) => items.forEach((item) => (item.items ? walk(item.items) : widgets.push(item)));
  walk(metadata.ui);
  const paths = Object.fromEntries(widgets.map((w) => [w.label, w.address]));
  const state = { center: { x: 400, y: 280 }, innerRadius: 30, outerRadius: 200, controls: {} };
  const angles = [-2.3, -1.57, -0.85, -3, -0.14, 2.55, 1.97, 0.95, 0.42, 1.35];
  names.forEach((name, i) => {
    const w = widgets.find((item) => item.label === name),
      r = 200 - ((w.init - w.min) / (w.max - w.min)) * 170;
    state.controls[w.address] = {
      path: w.address,
      x: 400 + Math.cos(angles[i]) * r,
      y: 280 + Math.sin(angles[i]) * r
    };
  });
  return new LivingSprings(state, paths, settings);
}

test("powered springs still move after 40 simulated seconds, including both speed extremes", async () => {
  for (const speed of [0.35, 1, 2]) {
    const model = await fixture({ speed });
    for (let i = 0; i < 2100; i++) model.space.step();
    const before = model.space.positions();
    for (let i = 0; i < 300; i++) model.space.step();
    let moved = 0;
    for (const p of model.space.positions()) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), "position remains finite");
      if (!model.state.controls[p.id]) continue;
      const old = before.find((q) => q.id === p.id);
      if (Math.abs(Math.hypot(p.x - 400, p.y - 280) - Math.hypot(old.x - 400, old.y - 280)) > 2) moved++;
    }
    assert.ok(moved >= 6, `speed ${speed}: at least six audible radial values keep changing, got ${moved}`);
  }
});

test("changing the feel preserves spring rest lengths, and unpowered motor positions stay fixed", async () => {
  const model = await fixture();
  for (let i = 0; i < 120; i++) model.space.step();
  const rest = model
    .snapshot()
    .scene.constraints.filter((c) => c.type === "spring")
    .map((c) => c.restLength);
  model.configure({ stiffness: 65, damping: 0.3, speed: 2, powered: false });
  assert.deepEqual(
    model
      .snapshot()
      .scene.constraints.filter((c) => c.type === "spring")
      .map((c) => c.restLength),
    rest
  );
  const before = model.space.positions().filter((p) => p.id.startsWith("motor-"));
  for (let i = 0; i < 180; i++) model.space.step();
  assert.deepEqual(
    model.space.positions().filter((p) => p.id.startsWith("motor-")),
    before
  );
  model.configure({ powered: true });
  for (let i = 0; i < 60; i++) model.space.step();
  assert.notDeepEqual(
    model.space.positions().filter((p) => p.id.startsWith("motor-")),
    before
  );
});
