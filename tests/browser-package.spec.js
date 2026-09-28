/* global scene, state */
const { expect, test } = require("@playwright/test");
const fixtures = require("../patches/index.json").patches;
async function ready(page, query = "engine=package") {
  await page.goto(`/musicspace.html?${query}`);
  await expect(page.locator("#patch-select")).toBeEnabled();
}
test("standard mode stays independent of package artifacts", async ({ page }) => {
  const imports = [];
  page.on("request", (r) => {
    if (r.url().includes("/dist/")) imports.push(r.url());
  });
  await page.route("**/packages/musicspace-engine/dist/**", (route) => route.abort());
  await ready(page, "patch=simple-spring");
  await expect(page.locator("#patch-select")).toHaveValue("simple-spring");
  await expect(page.locator("#package-engine-notice")).toBeHidden();
  await expect(page.locator("#ui-mode-edit")).toBeEnabled();
  expect(imports).toEqual([]);
});
test("package import failure is visible and does not silently select standard mode", async ({ page }) => {
  await page.route("**/packages/musicspace-engine/dist/**", (route) => route.abort());
  await page.goto("/musicspace.html?engine=package");
  await expect(page.locator("#package-engine-message")).toContainText("npm run build");
  await expect(page.locator("#patch-select")).toBeDisabled();
  await expect(page.locator("#standard-engine-link")).toBeVisible();
});
for (const solver of ["propagation", "xpbd"]) {
  test(`package UI matches standard gestures and animation for every patch (${solver})`, async ({
    page,
    context
  }) => {
    const standard = await context.newPage();
    await ready(standard, `solver=${solver}`);
    await ready(page, `engine=package&solver=${solver}`);
    const failures = [];
    page.on("pageerror", (e) => failures.push(e.message));
    for (const fixture of fixtures) {
      const results = [];
      for (const target of [standard, page]) {
        results.push(
          await target.evaluate(async (key) => {
            window.stopAnimation();
            const patch = await (await fetch(`/patches/${key}.json`)).json();
            window.loadPatch(patch);
            window.stopAnimation();
            const source = state.sources[0];
            scene.beginDrag(source);
            window.moveEntity(source, source.x + 12, source.y + 7);
            scene.endDrag();
            if (scene.engineKind !== "package") scene.refineXpbdAfterDrag(source);
            for (let i = 0; i < 20; i++) window.stepAnimation(1 / 60);
            window.drawAll();
            const saved = window.serializePatch();
            // rotationDelta is transient solver state, intentionally absent from package saves.
            for (const mover of saved.movingObjects) delete mover.trajectory.rotationDelta;
            return {
              listener: saved.listener,
              sources: saved.sources,
              movers: saved.movingObjects.map(({ name, x, y, dynamics, trajectory }) => ({
                name,
                x,
                y,
                dynamics,
                phase: trajectory.phase
              }))
            };
          }, fixture.key)
        );
      }
      expect(results[1], fixture.key).toEqual(results[0]);
    }
    expect(failures).toEqual([]);
    await standard.close();
  });
}
test("package Play supports dragging, traces, undo and return to the selected standard patch", async ({
  page
}) => {
  await ready(page, "engine=package&patch=angle-balance");
  await expect(page.locator("#ui-mode-edit")).toBeEnabled();
  const before = await page.evaluate(() => window.serializePatch());
  let box = await page.locator("#canvas").boundingBox();
  const source = before.sources[0];
  let x = box.x + (source.x * box.width) / 800,
    y = box.y + (source.y * box.height) / 600;
  await page.mouse.click(x, y);
  await page.locator("#trace-selected").click();
  // Let the prior selection click leave the double-click window.
  await page.waitForTimeout(550);
  // Selection controls can change toolbar wrapping and move the canvas.
  box = await page.locator("#canvas").boundingBox();
  x = box.x + (source.x * box.width) / 800;
  y = box.y + (source.y * box.height) / 600;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y + 20, { steps: 5 });
  await page.mouse.up();
  const moved = await page.evaluate(() => window.serializePatch());
  expect(moved.sources[0].drawTrace).toBe(true);
  expect(moved.sources[0].x).not.toBe(source.x);
  expect(
    await page.evaluate(() => {
      const ctx = document.getElementById("trace").getContext("2d");
      return ctx.getImageData(0, 0, 800, 600).data.some((v, i) => i % 4 === 3 && v > 0);
    })
  ).toBe(true);
  await page.keyboard.press("ControlOrMeta+z");
  expect(await page.evaluate(() => state.sources[0].x)).toBe(source.x);
  await page.locator("#patch-select").selectOption("simple-spring");
  await expect(page.locator("#standard-engine-link")).toHaveAttribute("href", /patch=simple-spring/);
  await page.screenshot({ path: test.info().outputPath("package-play.png"), fullPage: true });
  await page.locator("#standard-engine-link").click();
  await expect(page.locator("#patch-select")).toHaveValue("simple-spring");
  await expect(page.locator("#ui-mode-edit")).toBeEnabled();
});
test("package motion drives mappings and all bundled sound backends still start and stop", async ({
  page
}) => {
  const failures = [];
  page.on("pageerror", (e) => failures.push(e.message));
  await ready(page, "engine=package&patch=musical-spring");
  const values = await page.evaluate(() => {
    window.stopAnimation();
    const a = scene.getObjectByName("A"),
      mapping = window.serializePatch().parameterMappings[0];
    scene.moveEntity(a, a.x, a.y + 60);
    return Array.from({ length: 60 }, () => {
      window.stepAnimation(1 / 60);
      window.drawAll();
      return MusicSpaceMapping.valueFromMapping(mapping, scene.parameterFeatureValue(mapping.feature, a));
    });
  });
  expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(100);
  for (const key of [
    "cycloid-percussion",
    "openspace-ostinatos",
    "rotating-partials",
    "jazz-trio-midi",
    "faust-control-study",
    "fm-space",
    "fm-harmonic-space",
    "granular-cloud-study"
  ]) {
    await page.locator("#patch-select").selectOption(key);
    if (key === "jazz-trio-midi") await expect(page.locator("#midi-status")).toContainText("tracks loaded");
    await page.locator("#target-toggle").click();
    await expect(page.locator("#target-toggle")).toHaveAttribute("aria-pressed", "true");
    await page.locator("#target-toggle").click();
    await expect(page.locator("#target-toggle")).toHaveAttribute("aria-pressed", "false");
  }
  expect(failures).toEqual([]);
});
test.describe("package touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("fullscreen extended bounds, drag ownership and spring release", async ({ page, context }) => {
    await ready(page, "engine=package&patch=musical-spring");
    await page.evaluate(() => {
      document.getElementById("stage").requestFullscreen = undefined;
    });
    await page.locator("#canvas-fullscreen").tap();
    await page.evaluate(() => {
      window.stopAnimation();
      scene.moveEntity(scene.getObjectByName("A"), 250, 300);
      window.drawAll();
    });
    const box = await page.locator("#canvas").boundingBox();
    const scale = Math.min(box.width / 800, box.height / 600);
    const offsetX = (box.width - 800 * scale) / 2,
      offsetY = (box.height - 600 * scale) / 2;
    const client = await context.newCDPSession(page);
    const touch = (type, touchPoints) => client.send("Input.dispatchTouchEvent", { type, touchPoints });
    const start = { id: 1, x: box.x + offsetX + 250 * scale, y: box.y + offsetY + 300 * scale };
    const end = { id: 1, x: box.x + 180, y: box.y + 100 };
    await touch("touchStart", [start]);
    await touch("touchMove", [end]);
    await page.evaluate(() => window.stopAnimation());
    expect(await page.evaluate(() => scene.state.draggedEntity?.name)).toBe("A");
    const held = await page.evaluate(() => scene.getObjectByName("A").y);
    expect(held).toBeCloseTo((end.y - box.y - offsetY) / scale, 0);
    expect(held).toBeLessThan(0);
    await touch("touchStart", [end, { id: 2, x: end.x + 50, y: end.y }]);
    expect(await page.evaluate(() => scene.state.draggedEntity?.name)).toBe("A");
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) scene.step();
    });
    expect(await page.evaluate(() => scene.getObjectByName("A").y)).toBe(held);
    await touch("touchEnd", []);
    expect(await page.evaluate(() => scene.state.draggedEntity)).toBeNull();
    const released = await page.evaluate(() => {
      for (let i = 0; i < 20; i++) scene.step();
      return scene.getObjectByName("A").y;
    });
    expect(released).toBeGreaterThan(held);
    await page.locator("#canvas-fullscreen").tap();
    await expect(page.locator("#stage")).not.toHaveClass(/is-fullscreen/);
    await client.detach();
  });
});
