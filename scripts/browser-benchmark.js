// Profile both revisions in the same browser. --baseline serves tracked HEAD files.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const baselineArgument = process.argv.find((arg) => arg === "--baseline" || arg.startsWith("--baseline="));
const baseline = Boolean(baselineArgument);
const baselineRef = baselineArgument?.split("=")[1] || "HEAD";
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml"
};
const cache = new Map();

async function main() {
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, "http://localhost").pathname.slice(1);
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (!cache.has(name))
        cache.set(
          name,
          baseline
            ? execFileSync("git", ["show", `${baselineRef}:${name}`], {
                cwd: root,
                stdio: ["ignore", "pipe", "ignore"]
              })
            : fs.readFileSync(file)
        );
      response.setHeader("Content-Type", mime[path.extname(name)] || "application/octet-stream");
      response.end(cache.get(name));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/musicspace.html`);
    await page.waitForFunction(() => !document.getElementById("patch-select").disabled);
    const results = await page.evaluate(async () => {
      const getEntity = window.eval("getObjectByName");
      const solve = window.eval("enforceConstraints");
      const report = window.MusicSpaceModel
        ? window.eval("scene.getLastPropagationReport")
        : window.getLastPropagationReport;
      const output = [];
      const synthetic = {
        name: "100 independent links",
        listener: { x: 400, y: 300 },
        sources: [],
        constraints: []
      };
      for (let i = 0; i < 100; i += 1) {
        synthetic.sources.push({ name: `A${i}`, x: 100, y: 100 }, { name: `B${i}`, x: 150, y: 100 });
        synthetic.constraints.push({ type: "fixedDistance", anchor: `A${i}`, target: `B${i}`, distance: 50 });
      }
      const fixtures = [];
      for (const file of ["product-limit", "granular-cloud-study", "rotating-partials"])
        fixtures.push(await (await fetch(`/patches/${file}.json`)).json());
      fixtures.push(synthetic);
      const stats = (values) => {
        values.sort((a, b) => a - b);
        return {
          medianMs: +values[Math.floor(values.length / 2)].toFixed(4),
          p95Ms: +values[Math.floor(values.length * 0.95)].toFixed(4)
        };
      };
      for (const patch of fixtures)
        for (const mode of ["propagation", "xpbd"]) {
          window.loadPatch(patch);
          window.setSolverMode(mode);
          const entity = getEntity(patch.sources[0].name);
          const origin = { x: entity.x, y: entity.y };
          const solves = [],
            renders = [];
          let constraintVisits = 0;
          const constraints = window.eval(window.MusicSpaceModel ? "state.constraints" : "constraints");
          for (const constraint of constraints) {
            const enforce = constraint.enforce.bind(constraint);
            constraint.enforce = (...args) => {
              constraintVisits += 1;
              return enforce(...args);
            };
          }
          let domNodes = 0;
          const create = document.createElement;
          document.createElement = function (...args) {
            domNodes += 1;
            return create.apply(this, args);
          };
          try {
            for (let i = 0; i < 540; i += 1) {
              entity.x = origin.x + 10 * Math.sin(i / 12);
              entity.y = origin.y + 10 * Math.cos(i / 12);
              const start = performance.now();
              solve(entity);
              const middle = performance.now();
              window.drawAll();
              const end = performance.now();
              if (i >= 40) {
                solves.push(middle - start);
                renders.push(end - middle);
              } else {
                domNodes = 0;
                constraintVisits = 0;
              }
            }
          } finally {
            document.createElement = create;
          }
          output.push({
            patch: patch.name,
            mode,
            samples: solves.length,
            solve: stats(solves),
            render: stats(renders),
            domNodes,
            constraintVisits,
            residuals: report()?.residuals.length
          });
        }
      return output;
    });
    console.log(
      JSON.stringify(
        {
          revision: baseline
            ? execFileSync("git", ["rev-parse", "--short", baselineRef], {
                cwd: root,
                encoding: "utf8"
              }).trim()
            : "working tree",
          browser: browser.version(),
          results
        },
        null,
        2
      )
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
