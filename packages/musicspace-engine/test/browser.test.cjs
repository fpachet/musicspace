const assert = require("node:assert/strict");
const test = require("node:test");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require("@playwright/test");

test("plain-browser package supports dragging, animation and saved scenes", async () => {
  const root = path.resolve(__dirname, "..");
  const server = http.createServer(async (request, response) => {
    const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.resolve(root, `.${relative}`);
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const contents = await fs.readFile(file);
      const type = file.endsWith(".mjs")
        ? "text/javascript"
        : file.endsWith(".html")
          ? "text/html"
          : "text/plain";
      response.writeHead(200, { "Content-Type": type });
      response.end(contents);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1050, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/playground.html`);
    const a = page.locator('circle[data-id="A"]');
    const b = page.locator('circle[data-id="B"]');
    await a.waitFor();
    const start = await a.boundingBox(),
      before = await b.boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x - 35, start.y + start.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.ok((await b.boundingBox()).x < before.x - 20, "sum should move B closer to center");
    assert.equal(await page.locator("#status").textContent(), "All constraints satisfied");
    const download = page.waitForEvent("download");
    await page.locator("#save").click();
    const saved = await download;
    const savedPath = await saved.path();
    const scene = JSON.parse(await fs.readFile(savedPath, "utf8"));
    assert.equal(scene.constraints[0].type, "sum");
    await page.locator("#reset").click();
    await page.locator("#file").setInputFiles(savedPath);
    await page.waitForFunction(() => document.querySelector("#hint").textContent.startsWith("Loaded scene"));
    assert.ok((await b.boundingBox()).x < before.x - 20);

    await page.locator("#scene").selectOption("rotator");
    const transform = await a.locator("..").getAttribute("transform");
    await page.waitForFunction(
      (old) => document.querySelector('circle[data-id="A"]').parentNode.getAttribute("transform") !== old,
      transform
    );
    await page.locator("#play").click();
    await page.screenshot({
      path: path.join(os.tmpdir(), "musicspace-package-playground.png"),
      fullPage: true
    });

    await page.locator("#scene").selectOption("spring");
    await page.locator("#play").click();
    const mass = await b.boundingBox();
    await page.mouse.move(mass.x + mass.width / 2, mass.y + mass.height / 2);
    await page.mouse.down();
    await page.mouse.move(mass.x + 55, mass.y - 40, { steps: 5 });
    await page.mouse.up();
    const released = await b.locator("..").getAttribute("transform");
    await page.waitForFunction(
      (old) => document.querySelector('circle[data-id="B"]').parentNode.getAttribute("transform") !== old,
      released
    );
    const importedPatch = await page.evaluate(async () => {
      const { importLegacyPatch, exportLegacyPatch } = await import("/dist/legacy-patch.mjs");
      const { createSpace } = await import("/dist/index.mjs");
      const { scene, context } = importLegacyPatch({
        listener: { x: 0, y: 0 },
        sources: [{ name: "A", x: 10, y: 20 }],
        note: "keep"
      });
      const space = createSpace(scene);
      space.move(context.pointIds.A, 30, 40);
      return exportLegacyPatch(space.snapshot(), context);
    });
    assert.equal(importedPatch.sources[0].x, 30);
    assert.equal(importedPatch.note, "keep");
    assert.deepEqual(errors, []);
    assert.equal(
      await page.evaluate(() => Object.keys(window).some((key) => key.startsWith("MusicSpace"))),
      false
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
