const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSceneModel } = require("../musicspace-model");
const { valueFromMapping } = require("../musicspace-mapping");
const patch = require("../patches/three-body.json");
const metadata = require("../targets/faust/three-body.json");
const controls = metadata.ui.flatMap((group) => group.items.flatMap((voice) => voice.items));
const wasm = fs.readFileSync(path.join(__dirname, "../targets/faust/three-body.wasm"));

function values(model) {
  return Object.fromEntries(
    patch.parameterMappings.map((m) => {
      const p = model.getObjectByName(m.source);
      const feature =
        m.feature === "distance"
          ? Math.hypot(p.x - model.state.listener.x, p.y - model.state.listener.y)
          : p[m.feature];
      return [m.target, valueFromMapping(m, feature)];
    })
  );
}
test("three-body mappings cover the actual Faust controls and follow each body's orbit", () => {
  const model = createSceneModel();
  assert.equal(model.loadPatch(patch), true);
  assert.equal(patch.parameterMappings.length, 12);
  assert.deepEqual(
    new Set(patch.parameterMappings.map((m) => m.target)),
    new Set(controls.map((c) => c.address))
  );
  const before = values(model);
  for (let i = 0; i < 120; i++) model.step();
  const after = values(model);
  for (const m of patch.parameterMappings) {
    assert.notEqual(after[m.target], before[m.target], m.target);
    for (const raw of [-1e6, 1e6]) {
      const value = valueFromMapping(m, raw),
        control = controls.find((c) => c.address === m.target);
      assert.ok(value >= control.min && value <= control.max);
    }
  }
});

test("compiled Faust renders three bounded stereo voices, responds to pan, and mutes", async () => {
  const module = await WebAssembly.compile(wasm);
  const { exports: dsp } = await WebAssembly.instantiate(module, {
    env: { _powf: Math.pow, _sinf: Math.sin, _tanf: Math.tan, _tanhf: Math.tanh }
  });
  dsp.init(0, 48000);
  const pointer = Math.ceil(metadata.size / 16) * 16;
  const addresses = new Int32Array(dsp.memory.buffer);
  const buffers = [0, 1].map((ch) => {
    const address = pointer + 8 + ch * 128 * 4;
    addresses[pointer / 4 + ch] = address;
    return new Float32Array(dsp.memory.buffer, address, 128);
  });
  const set = (voice, param, value) =>
    dsp.setParamValue(
      0,
      Number(controls.find((c) => c.address === `/ThreeBody/${voice}/${param}`).index),
      value
    );
  function render() {
    let square = [0, 0],
      peak = 0;
    // Allow parameter smoothing to settle before measuring.
    for (let i = 0; i < 300; i++) {
      dsp.compute(0, 128, 0, pointer);
      if (i < 200) continue;
      buffers.forEach((buffer, ch) => {
        for (const sample of buffer) {
          assert.ok(Number.isFinite(sample));
          square[ch] += sample * sample;
          peak = Math.max(peak, Math.abs(sample));
        }
      });
    }
    return { rms: square.map((v) => Math.sqrt(v / (100 * 128))), peak };
  }
  for (const voice of ["A", "B", "C"]) {
    for (const other of ["A", "B", "C"]) set(other, "gain", other === voice ? 0.15 : 0);
    set(voice, "pan", -1);
    const left = render();
    assert.ok(left.rms[0] > 0.01, voice);
    assert.ok(left.rms[1] < 0.001, JSON.stringify(left));
    assert.ok(left.peak < 0.2);
    set(voice, "pan", 1);
    const right = render();
    assert.ok(right.rms[1] > 0.01, voice);
    assert.ok(right.rms[0] < 0.001, JSON.stringify(right));
  }
  for (const voice of ["A", "B", "C"]) {
    set(voice, "gain", 0.2);
    set(voice, "pan", 0);
  }
  assert.ok(render().peak < 0.65);
  for (const voice of ["A", "B", "C"]) set(voice, "gain", 0);
  assert.ok(render().peak < 1e-5);
});
