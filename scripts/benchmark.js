// Repeatable headless measurements. Timings are diagnostic, not CI assertions.
const { performance } = require("node:perf_hooks");
const { createEngineHarness, loadFixturePatch } = require("../tests/helpers/engine-harness");

const results = [];
for (const file of ["product-limit.json", "granular-cloud-study.json", "rotating-partials.json"]) {
  for (const mode of ["propagation", "xpbd"]) {
    const engine = createEngineHarness();
    const patch = loadFixturePatch(file);
    engine.loadPatch(patch);
    engine.api.setSolverMode(mode);
    const source = patch.sources[0];
    const samples = [];
    for (let i = 0; i < 240; i += 1) {
      const start = performance.now();
      engine.move(source.name, source.x + 10 * Math.sin(i / 12), source.y + 10 * Math.cos(i / 12));
      const elapsed = performance.now() - start;
      if (i >= 40) samples.push(elapsed);
    }
    samples.sort((a, b) => a - b);
    results.push({
      patch: file,
      mode,
      samples: samples.length,
      medianMs: +samples[Math.floor(samples.length / 2)].toFixed(4),
      p95Ms: +samples[Math.floor(samples.length * 0.95)].toFixed(4),
      maxMs: +samples.at(-1).toFixed(4),
      residuals: engine.api.getLastPropagationReport()?.residuals.length
    });
  }
}
console.log(
  JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, results }, null, 2)
);
