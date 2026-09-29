const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");

async function snapshot(page) {
  return page.evaluate(() => window.orbitStudy.snapshot());
}

function named(record, name) {
  return Object.entries(record.params).find(([path]) => path.endsWith(`/${name}`))[1];
}

async function dragDot(page, label, radialScale) {
  const coords = await page.evaluate(
    ({ label, radialScale }) => {
      const state = window.orbitStudy.snapshot().orbit;
      const point = Object.values(state.controls).find((control) => control.label === label);
      const canvas = document.querySelector("#orbit").shadowRoot.querySelector("canvas");
      const rect = canvas.getBoundingClientRect();
      const transform = canvas.getContext("2d").getTransform();
      const ratio = canvas.width / rect.width;
      const screen = (x, y) => ({
        x: rect.x + (x * transform.a + transform.e) / ratio,
        y: rect.y + (y * transform.d + transform.f) / ratio
      });
      return {
        start: screen(point.x, point.y),
        end: screen(
          state.center.x + (point.x - state.center.x) * radialScale,
          state.center.y + (point.y - state.center.y) * radialScale
        )
      };
    },
    { label, radialScale }
  );
  await page.mouse.move(coords.start.x, coords.start.y);
  await page.mouse.down();
  await page.mouse.move(coords.end.x, coords.end.y, { steps: 15 });
  const during = await snapshot(page);
  await page.mouse.up();
  return during;
}

test("Orbit study loads without page errors and renders the instrument", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/examples/orbit-musicspace/");
  await expect(page.locator("#audio")).toBeEnabled();
  await expect(page.locator("#value-Wet")).toHaveText("45.0");
  await expect(page.locator("#constraint-status")).toHaveText("Dry + Wet = 1.000");
  await page.screenshot({ path: "test-results/orbit-poc-initial.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("real dot dragging couples both values and positions; one undo restores the gesture", async ({
  page
}) => {
  await page.goto("/examples/orbit-musicspace/");
  await expect(page.locator("#audio")).toBeEnabled();
  const before = await snapshot(page);
  const during = await dragDot(page, "Wet", 0.65);
  expect(named(during, "Wet")).toBeGreaterThan(named(before, "Wet") + 0.1);
  expect(named(during, "Dry")).toBeLessThan(named(before, "Dry") - 0.1);
  expect(named(during, "Dry") + named(during, "Wet")).toBeCloseTo(1, 3);
  const dryPath = Object.keys(before.params).find((path) => path.endsWith("/Dry"));
  expect(during.orbit.controls[dryPath].x).not.toBeCloseTo(before.orbit.controls[dryPath].x, 1);
  await page.locator("#undo").click();
  expect((await snapshot(page)).params).toEqual(before.params);
  await page.locator("#redo").click();
  expect((await snapshot(page)).params).toEqual(during.params);
  await page.locator("#balance").click();
  const freeBefore = await snapshot(page);
  await dragDot(page, "Wet", 1.3);
  expect(named(await snapshot(page), "Dry")).toBe(named(freeBefore, "Dry"));
});

test("spring and shuttle produce changing sound controls, and pause stops motion", async ({ page }) => {
  await page.goto("/examples/orbit-musicspace/");
  await expect(page.locator("#audio")).toBeEnabled();
  await page.locator("#spring").click();
  const before = await snapshot(page);
  await page.locator("#sweep").click();
  await expect
    .poll(async () => Math.abs(named(await snapshot(page), "Cutoff") - named(before, "Cutoff")))
    .toBeGreaterThan(50);
  await expect
    .poll(async () => Math.abs(named(await snapshot(page), "Resonance") - named(before, "Resonance")))
    .toBeGreaterThan(0.03);
  await page.locator("#sweep").click();
  const paused = (await snapshot(page)).params;
  await page.waitForTimeout(200);
  expect((await snapshot(page)).params).toEqual(paused);
  await page.screenshot({ path: "test-results/orbit-poc-spring.png", fullPage: true });
});

test("actual Faust AudioWorklet produces bounded nonzero audio and supports pause/resume", async ({
  page
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/examples/orbit-musicspace/");
  await page.locator("#audio").click();
  await expect(page.locator("#audio-status")).toContainText("live");
  await expect.poll(() => page.evaluate(() => window.orbitStudy.audioRms)).toBeGreaterThan(0.0001);
  expect(await page.evaluate(() => window.orbitStudy.audioRms)).toBeLessThan(0.17);
  await page.locator("#audio").click();
  await expect.poll(() => page.evaluate(() => window.orbitStudy.audioState)).toBe("suspended");
  await page.locator("#audio").click();
  await expect.poll(() => page.evaluate(() => window.orbitStudy.audioState)).toBe("running");
  expect(errors).toEqual([]);
});

test("session file round-trips and invalid input leaves the live session unchanged", async ({ page }) => {
  await page.goto("/examples/orbit-musicspace/");
  await expect(page.locator("#audio")).toBeEnabled();
  await dragDot(page, "Wet", 0.8);
  await page.locator("#spring").click();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#save").click();
  const download = await downloadEvent;
  const path = await download.path();
  const saved = JSON.parse(await fs.readFile(path, "utf8"));
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await page.locator("#file").setInputFiles(path);
  await expect(page.locator("#message")).toContainText("Session restored");
  expect((await snapshot(page)).params).toEqual(saved.params);
  await expect(page.locator("#spring")).toHaveAttribute("aria-checked", "true");
  const before = await snapshot(page);
  saved.engine.scene.points.pop();
  await page.locator("#file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved))
  });
  await expect(page.locator("#message")).toContainText("Could not load session");
  expect((await snapshot(page)).params).toEqual(before.params);
});

test("mobile layout has no horizontal overflow and keeps the controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/examples/orbit-musicspace/");
  await expect(page.locator("#audio")).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await dragDot(page, "Wet", 0.7);
  expect(named(await snapshot(page), "Wet")).toBeGreaterThan(0.5);
  await page.screenshot({ path: "test-results/orbit-poc-mobile.png", fullPage: true });
});

test("Orbit's numeric detail editor resolves linked values as one undoable gesture", async ({ page }) => {
  await page.goto("/examples/orbit-musicspace/");
  await expect(page.locator("#audio")).toBeEnabled();
  await dragDot(page, "Wet", 1);
  const before = await snapshot(page);
  const field = page.locator("#orbit .orbit-detail-value");
  await field.fill("0.7");
  await field.press("Enter");
  const after = await snapshot(page);
  expect(named(after, "Wet")).toBeCloseTo(0.7, 3);
  expect(named(after, "Dry")).toBeCloseTo(0.3, 3);
  await page.locator("#undo").click();
  expect((await snapshot(page)).params).toEqual(before.params);
});

test("Constellation draws nineteen constraints, highlights rules and hides only their appearance", async ({
  page
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/examples/orbit-musicspace/constellation.html");
  await expect(page.locator("#audio")).toBeEnabled();
  await expect(page.locator("#counts")).toHaveText("19 active constraints · 8 types");
  const before = await snapshot(page);
  expect(before.scene.points).toHaveLength(10);
  expect(before.scene.constraints).toHaveLength(19);
  await expect.poll(() => page.evaluate(() => window.orbitStudy.drawnConstraints.length)).toBe(9);
  await expect(page.locator("#solver-status")).toHaveText("All geometric constraints satisfied");
  await page.screenshot({ path: "test-results/orbit-constellation.png", fullPage: true });
  await page.locator("#select-filter").click();
  await page.locator("#visibility").selectOption("related");
  await expect.poll(() => page.evaluate(() => window.orbitStudy.drawnConstraints)).toEqual(["filter"]);
  await page.locator("#guides").check();
  await expect
    .poll(() => page.evaluate(() => window.orbitStudy.drawnConstraints))
    .toEqual(["filter", "radial-bounds"]);
  await page.locator("#visibility").selectOption("none");
  await expect.poll(() => page.evaluate(() => window.orbitStudy.drawnConstraints.length)).toBe(0);
  expect((await snapshot(page)).scene.constraints.filter((c) => c.enabled).length).toBe(19);
  await page.locator("#toggle-filter").click();
  await expect(page.locator("#counts")).toHaveText("18 active constraints · 7 types");
  expect((await snapshot(page)).scene.constraints.find((c) => c.id === "filter").enabled).toBe(false);
  await page.locator("#undo").click();
  expect((await snapshot(page)).scene.constraints.find((c) => c.id === "filter").enabled).toBe(true);
  expect(errors).toEqual([]);
});

test("Constellation propagates a drag, restores it with undo, and produces real Faust audio", async ({
  page
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/examples/orbit-musicspace/constellation.html");
  await expect(page.locator("#audio")).toBeEnabled();
  const before = await snapshot(page);
  const after = await dragDot(page, "Bass", 0.8);
  expect(named(after, "Bass")).toBeGreaterThan(named(before, "Bass") + 0.05);
  expect(
    Math.abs(named(after, "Body") - named(before, "Body")) +
      Math.abs(named(after, "Air") - named(before, "Air"))
  ).toBeGreaterThan(0.01);
  expect(named(after, "Bass") + named(after, "Body") + named(after, "Air")).toBeCloseTo(1, 1);
  await page.locator("#undo").click();
  expect((await snapshot(page)).params).toEqual(before.params);
  await page.locator("#audio").click();
  await expect(page.locator("#audio-status")).toContainText("live");
  await expect.poll(() => page.evaluate(() => window.orbitStudy.audioRms)).toBeGreaterThan(0.0001);
  expect(await page.evaluate(() => window.orbitStudy.audioRms)).toBeLessThan(0.17);
  await page.locator("#dynamics").click();
  await dragDot(page, "Air", 0.75);
  const moving = await snapshot(page);
  await expect
    .poll(async () => Math.abs(named(await snapshot(page), "Cutoff") - named(moving, "Cutoff")))
    .toBeGreaterThan(1);
  await page.locator("#dynamics").click();
  const stopped = (await snapshot(page)).params;
  await page.waitForTimeout(150);
  expect((await snapshot(page)).params).toEqual(stopped);
  expect(errors).toEqual([]);
});

test("Constellation remains usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/examples/orbit-musicspace/constellation.html");
  await expect(page.locator("#audio")).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator("#select-pulse").click();
  await expect(page.locator("#select-pulse")).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/orbit-constellation-mobile.png", fullPage: true });
});

test("Living springs starts moving automatically, stays silent until asked, and freezes exactly", async ({
  page
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/examples/orbit-musicspace/living-springs.html");
  await expect(page.locator("#audio")).toBeEnabled();
  const before = await snapshot(page);
  expect(before.engine.scene.constraints.filter((c) => c.type === "spring")).toHaveLength(14);
  expect(before.engine.scene.points.filter((p) => p.id.startsWith("motor-"))).toHaveLength(2);
  expect(await page.evaluate(() => window.orbitStudy.audioState)).toBe("idle");
  await expect
    .poll(async () => {
      const now = await snapshot(page);
      return Object.keys(before.params).filter(
        (path) => Math.abs(now.params[path] - before.params[path]) > 0.01
      ).length;
    })
    .toBeGreaterThan(5);
  await expect.poll(() => page.evaluate(() => window.orbitStudy.drawnSprings)).toBe(14);
  await page.locator("#freeze").click();
  const frozen = await snapshot(page);
  await page.waitForTimeout(200);
  expect((await snapshot(page)).engine.scene.points).toEqual(frozen.engine.scene.points);
  await page.screenshot({ path: "test-results/orbit-living-springs.png", fullPage: true });
  await page.locator("#connections").uncheck();
  await expect.poll(() => page.evaluate(() => window.orbitStudy.drawnSprings)).toBe(0);
  expect((await snapshot(page)).engine.scene.constraints.filter((c) => c.type === "spring")).toHaveLength(14);
  await page.locator("#freeze").click();
  await expect
    .poll(async () => JSON.stringify((await snapshot(page)).params))
    .not.toBe(JSON.stringify(frozen.params));
  expect(errors).toEqual([]);
});

test("Living springs supports motor power, feel controls, a pluck and undo with real audio", async ({
  page
}) => {
  await page.goto("/examples/orbit-musicspace/living-springs.html");
  await expect(page.locator("#audio")).toBeEnabled();
  await page.locator("#motors").click();
  const unpowered = await snapshot(page);
  expect(unpowered.engine.settings.powered).toBe(false);
  const anchors = unpowered.engine.scene.points.filter((p) => p.id.startsWith("motor-"));
  await page.waitForTimeout(250);
  const later = await snapshot(page);
  for (const anchor of anchors) {
    const now = later.engine.scene.points.find((p) => p.id === anchor.id);
    expect(now.x).toBe(anchor.x);
    expect(now.y).toBe(anchor.y);
  }
  await page.getByRole("button", { name: "Flutter", exact: true }).click();
  const flutter = await snapshot(page);
  expect(flutter.engine.settings).toEqual({ speed: 1.65, stiffness: 48, damping: 0.6, powered: true });
  await page.locator("#freeze").click();
  const before = await snapshot(page);
  await dragDot(page, "Air", 0.65);
  await page.locator("#undo").click();
  expect((await snapshot(page)).params).toEqual(before.params);
  await page.locator("#audio").click();
  await expect(page.locator("#audio-status")).toContainText("live");
  await expect.poll(() => page.evaluate(() => window.orbitStudy.audioRms)).toBeGreaterThan(0.0001);
  expect(await page.evaluate(() => window.orbitStudy.audioRms)).toBeLessThan(0.17);
});

test("Living springs fits a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/examples/orbit-musicspace/living-springs.html");
  await expect(page.locator("#audio")).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator("#freeze").click();
  await page.screenshot({ path: "test-results/orbit-living-springs-mobile.png", fullPage: true });
});
