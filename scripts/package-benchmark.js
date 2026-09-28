// Browser timings are diagnostics; geometry/finite-state checks are hard failures.
/* global scene, state */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const { performanceScenes } = require("./performance-scenes");
const root = path.resolve(__dirname, "..");
const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
const baseline = option("baseline");
const saveBaseline = option("save-baseline");
const output = option("output");
if (saveBaseline) {
  for (const name of [
    ...fs.readdirSync(root).filter((n) => /^musicspace.*\.(js|html)$/.test(n)),
    ...["index.mjs", "legacy-patch.mjs"].map((n) => `packages/musicspace-engine/dist/${n}`)
  ]) {
    const target = path.join(saveBaseline, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, name), target);
  }
}
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml"
};
async function main() {
  const server = http.createServer((req, res) => {
    let name = new URL(req.url, "http://localhost").pathname.slice(1);
    let directory = root;
    if (name.startsWith("baseline/")) {
      name = name.slice(9);
      if (baseline && fs.existsSync(path.join(baseline, name))) directory = baseline;
    }
    const file = path.resolve(directory, name);
    if (!file.startsWith(path.resolve(directory) + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      res.setHeader("Content-Type", mime[path.extname(name)] || "application/octet-stream");
      res.end(fs.readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const variants = baseline ? ["baseline", "current"] : ["current"];
    const results = [];
    for (const variant of variants) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${origin}/${variant === "baseline" ? "baseline/" : ""}musicspace.html?engine=package`);
      await page.waitForFunction(() => !document.getElementById("patch-select").disabled);
      const records = await page.evaluate(async (largeFixtures) => {
        window.stopAnimation();
        const library = await (await fetch("patches/index.json")).json();
        const fixtures = await Promise.all(
          library.patches.map(async (p) => ({
            key: p.key,
            patch: await (await fetch(`patches/${p.file}`)).json()
          }))
        );
        fixtures.push(...largeFixtures);
        const canonical = (value) =>
          Array.isArray(value)
            ? value.map(canonical)
            : value && typeof value === "object"
              ? Object.fromEntries(
                  Object.keys(value)
                    .sort()
                    .map((key) => [key, canonical(value[key])])
                )
              : value;
        const stats = (values) => {
          values.sort((a, b) => a - b);
          return {
            medianMs: +values[Math.floor(values.length / 2)].toFixed(3),
            p95Ms: +values[Math.min(values.length - 1, Math.floor(values.length * 0.95))].toFixed(3)
          };
        };
        const result = [];
        for (const { key, patch } of fixtures)
          for (const solver of ["propagation", "xpbd"]) {
            window.setSolverMode(solver);
            const start = performance.now();
            if (!window.loadPatch(patch)) throw Error(`Cannot load ${key}`);
            window.stopAnimation();
            const loadMs = performance.now() - start;
            const source = state.sources[0],
              x = source.x,
              y = source.y;
            const move = [],
              frame = [],
              save = [],
              edit = [];
            scene.beginDrag(source);
            for (let i = 0; i < 70; i++) {
              const t = performance.now();
              scene.moveEntity(source, x + 8 * Math.sin(i / 12), y + 6 * Math.cos(i / 12));
              const u = performance.now();
              scene.step();
              window.drawAll();
              const v = performance.now();
              if (i >= 20) {
                move.push(u - t);
                frame.push(v - u);
              }
            }
            scene.endDrag();
            for (let i = 0; i < 8; i++) {
              let t = performance.now();
              window.serializePatch();
              const u = performance.now();
              const previousName = source.name;
              if (
                !window.editGeometry("benchmark edit", () => {
                  source.name = `${i % 2 ? "Original" : "Edited"}-${key}`;
                  window.renameTrajectoryEndpointReferences(previousName, source.name);
                })
              )
                throw Error(`Edit failed: ${key}`);
              window.renameSourceBindings(previousName, source.name);
              const v = performance.now();
              if (i >= 2) {
                save.push(u - t);
                edit.push(v - u);
              }
            }
            // Check the complete UI export after edits before loading the next fixture.
            // No audio output is enabled.
            const saved = window.serializePatch();
            if (scene.validatePatch(saved).some((f) => f.level === "error"))
              throw Error(`Invalid save: ${key}`);
            if (
              ![state.listener, ...state.sources, ...state.movingObjects].every(
                (p) => Number.isFinite(p.x) && Number.isFinite(p.y)
              )
            )
              throw Error(`Nonfinite geometry: ${key}`);
            result.push({
              key,
              solver,
              points: patch.sources.length + (patch.movingObjects?.length || 0),
              constraints: patch.constraints.length,
              loadMs: +loadMs.toFixed(3),
              move: stats(move),
              frame: stats(frame),
              save: stats(save),
              edit: stats(edit),
              residuals: scene.measureConstraintResiduals().length,
              signature: JSON.stringify(
                canonical({
                  listener: saved.listener,
                  sources: saved.sources,
                  movingObjects: saved.movingObjects,
                  constraints: saved.constraints
                })
              )
            });
          }
        return result;
      }, performanceScenes());
      if (errors.length) throw Error(errors.join("\n"));
      for (const record of records) {
        record.geometryHash = createHash("sha256").update(record.signature).digest("hex");
        delete record.signature;
      }
      results.push({ variant, records });
      await page.close();
    }
    if (baseline) {
      for (let i = 0; i < results[0].records.length; i++) {
        const before = results[0].records[i],
          after = results[1].records[i];
        if (
          before.key !== after.key ||
          before.solver !== after.solver ||
          before.geometryHash !== after.geometryHash
        )
          throw Error(`Baseline geometry mismatch: ${before.key}/${before.solver}`);
      }
    }
    const report = {
      commit: execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
      node: process.version,
      chromium: browser.version(),
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0].model,
      measuredAt: new Date().toISOString(),
      samples: { warmup: 20, move: 50, frame: 50, save: 6, edit: 6 },
      results
    };
    const json = JSON.stringify(report, null, 2) + "\n";
    if (output) fs.writeFileSync(output, json);
    else process.stdout.write(json);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
