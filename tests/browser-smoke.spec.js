// These bindings are provided by musicspace.js inside page.evaluate callbacks.
/* global scene, state, SpringConstraint */
const { expect, test } = require("@playwright/test");

test("musicspace page loads and core controls respond", async ({ page }) => {
  const failures = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    failures.push(error.message);
  });

  await page.goto("/musicspace.html");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "assets/favicon.svg");
  const faviconResponse = await page.request.get("/assets/favicon.svg");
  expect(faviconResponse.ok()).toBe(true);

  const patchSelect = page.locator("#patch-select");
  await expect(patchSelect).toBeEnabled();
  await expect.poll(async () => patchSelect.locator("option").count()).toBeGreaterThan(0);
  await expect(page.locator("#ui-mode-play")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#transport-toolbar-group")).toBeHidden();
  await expect(page.locator("#midi-toolbar-group")).toBeHidden();
  await patchSelect.selectOption("cycloid-percussion");

  const animationToggle = page.locator("#animation-toggle");
  await expect(animationToggle).toBeVisible();
  await animationToggle.click();
  await expect(animationToggle).toHaveAttribute("aria-pressed", "true");
  await animationToggle.click();
  await expect(animationToggle).toHaveAttribute("aria-pressed", "false");

  const soundToggle = page.locator("#target-toggle");
  await expect(soundToggle).toBeVisible();
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "true");
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "false");

  const playStageBox = await page.locator("#stage").boundingBox();
  expect(playStageBox).not.toBeNull();
  const patchInspectorToggle = page.locator("#patch-inspector-toggle");
  await expect(patchInspectorToggle).toBeHidden();
  await page.locator("#ui-mode-edit").click();
  await expect(patchInspectorToggle).toBeVisible();
  const editStageBox = await page.locator("#stage").boundingBox();
  expect(editStageBox).not.toBeNull();
  expect(Math.abs(editStageBox.x - playStageBox.x)).toBeLessThan(1);
  expect(Math.abs(editStageBox.y - playStageBox.y)).toBeLessThan(1);
  expect(Math.abs(editStageBox.width - playStageBox.width)).toBeLessThan(1);
  expect(Math.abs(editStageBox.height - playStageBox.height)).toBeLessThan(1);
  await expect(page.locator("#patch-inspector")).toBeHidden();
  await patchInspectorToggle.click();
  await expect(page.locator("#patch-inspector")).toBeVisible();
  await expect(page.locator("#patch-summary")).toContainText("Cycloid Percussion");
  await expect(page.locator("#canvas")).toBeVisible();

  await patchSelect.selectOption("openspace-ostinatos");
  await expect(page.locator("#patch-summary")).toContainText("OpenSpace Ostinatos");
  await expect(page.locator("#patch-summary")).toContainText("ostinato pitch");
  await page.locator("#ui-mode-play").click();
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "true");
  await soundToggle.click();
  await expect(soundToggle).toHaveAttribute("aria-pressed", "false");

  await page.locator("#ui-mode-edit").click();
  await patchSelect.selectOption("rotating-partials");
  await expect(page.locator("#patch-summary")).toContainText("Rotating Partials");
  await expect(page.locator("#patch-summary")).toContainText("additive");
  await page.locator("#ui-mode-play").click();

  await page.locator("#ui-mode-edit").click();
  await patchSelect.selectOption("fm-space");
  await expect(page.locator("#patch-summary")).toContainText("FM Space");
  await expect(page.locator("#patch-summary")).toContainText("/modA/index");
  await page.locator("#ui-mode-play").click();

  await page.locator("#ui-mode-edit").click();
  await patchSelect.selectOption("fm-harmonic-space");
  await expect(page.locator("#patch-summary")).toContainText("FM Harmonic Space");
  await expect(page.locator("#patch-summary")).toContainText("/modA/ratio");
  await page.locator("#ui-mode-play").click();

  await page.locator("#reset").click();
  await expect(patchSelect).toHaveValue("fm-harmonic-space");

  expect(failures).toEqual([]);
});

test("MusicXML chord notes share the preceding note onset", async ({ page }) => {
  await page.goto("/musicspace.html");
  const notes = await page.evaluate(async () => {
    const response = await fetch("/examples/chord.musicxml");
    const sequence = await MusicSpaceMidiFileClient.parseSequenceFile(
      "chord.musicxml",
      await response.arrayBuffer()
    );
    return sequence.events
      .filter((event) => event.type === "noteOn")
      .map((event) => [event.note, event.tick]);
  });
  expect(notes).toEqual([
    [60, 0],
    [64, 0],
    [67, 480]
  ]);
});

test("MusicXML voices retain measure boundaries and tempo changes", async ({ page }) => {
  await page.goto("/musicspace.html");
  const notes = await page.evaluate(async () => {
    const response = await fetch("/tests/fixtures/voices.musicxml");
    const sequence = await MusicSpaceMidiFileClient.parseSequenceFile(
      "voices.musicxml",
      await response.arrayBuffer()
    );
    return sequence.events
      .filter((event) => event.type === "noteOn")
      .map((event) => [event.note, event.seconds, event.durationSeconds]);
  });
  expect(notes).toEqual([
    [60, 0, 1],
    [64, 0, 0.5],
    [67, 1, 1]
  ]);
});

test("unchanged parameter updates reuse DOM rows", async ({ page }) => {
  await page.goto("/musicspace.html");
  const result = await page.evaluate(() => {
    const panel = document.createElement("div");
    const grid = document.createElement("div");
    panel.append(grid);
    const client = MusicSpaceParameterClient.createParameterClient({
      panel,
      grid,
      monitorIntervalMs: 0,
      getEntity: () => ({ x: 0 }),
      getFeature: () => 0
    });
    client.loadPatch({
      parameterMappings: [
        {
          source: "A",
          feature: "x",
          target: "/osc/freq",
          inputMin: 0,
          inputMax: 800,
          outputMin: 100,
          outputMax: 1000
        }
      ]
    });
    const firstRow = grid.firstChild;
    const createElement = document.createElement;
    let created = 0;
    document.createElement = function (...args) {
      created += 1;
      return createElement.apply(this, args);
    };
    try {
      for (let i = 0; i < 60; i += 1) client.update();
    } finally {
      document.createElement = createElement;
      client.dispose();
    }
    return { created, retained: grid.firstChild === firstRow };
  });
  expect(result).toEqual({ created: 0, retained: true });
});

test("invalid JSON edits preserve the scene and patch selection", async ({ page }) => {
  await page.goto("/musicspace.html");
  const patches = page.locator("#patch-select");
  await expect(patches).toBeEnabled();
  await patches.selectOption("simple-rotator");
  await page.locator("#ui-mode-edit").click();
  await page.locator("#patch-json-inline-toggle").click();
  const json = page.locator("#patch-json");
  const before = JSON.parse(await json.inputValue());
  await json.fill(JSON.stringify({ ...before, movingObjects: "invalid" }));
  await page.locator("#patch-json-apply").click();
  await expect(page.locator("#constraint-status")).toContainText("must be an array");
  await expect(patches).toHaveValue("simple-rotator");
  const current = await page.evaluate(() => window.serializePatch());
  expect(current.sources).toEqual(before.sources);
  expect(current.movingObjects).toEqual(before.movingObjects);
});

test("every bundled sound backend starts, stops and releases playback", async ({ page }) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  await page.goto("/musicspace.html");
  const patches = page.locator("#patch-select");
  await expect(patches).toBeEnabled();
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
    await patches.selectOption(key);
    if (key === "jazz-trio-midi") await expect(page.locator("#midi-status")).toContainText("tracks loaded");
    const sound = page.locator("#target-toggle");
    await sound.click();
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await sound.click();
    await expect(sound).toHaveAttribute("aria-pressed", "false");
  }
  expect(failures).toEqual([]);
});

for (const action of ["stop", "dispose"]) {
  test(`Faust ${action} cancels a delayed adapter without connecting stale output`, async ({ page }) => {
    await page.goto("/musicspace.html");
    await page.evaluate(() => {
      window.adapterConnections = 0;
      window.adapterDestroys = 0;
      const module = `export async function createFaustNode(context) {
        const node = context.createGain();
        const connect = node.connect.bind(node);
        node.connect = (...args) => { window.adapterConnections++; return connect(...args); };
        await new Promise(resolve => { window.releaseAdapter = resolve; });
        return { node, destroy() { window.adapterDestroys++; node.disconnect(); } };
      }`;
      window.delayedTarget = window.MusicSpaceTargets.createTargetController({
        type: "faust-wasm",
        module: `data:text/javascript,${encodeURIComponent(module)}`
      });
      window.delayedStart = window.delayedTarget.setEnabled(true);
    });
    await expect.poll(() => page.evaluate(() => typeof window.releaseAdapter)).toBe("function");
    const result = await page.evaluate(async (method) => {
      await window.delayedTarget[method]();
      window.releaseAdapter();
      const enabled = await window.delayedStart;
      const result = { enabled, connections: window.adapterConnections, destroys: window.adapterDestroys };
      window.delayedTarget.dispose();
      return result;
    }, action);
    expect(result).toEqual({ enabled: false, connections: 0, destroys: action === "dispose" ? 1 : 0 });
  });
}

test("spring patches animate, drag, edit and drive existing musical mappings", async ({ page }) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/musicspace.html");
  const patches = page.locator("#patch-select");
  await expect(patches).toBeEnabled();
  for (const key of ["simple-spring", "coupled-springs", "spring-pendulum", "musical-spring"]) {
    await patches.selectOption(key);
    await expect(page.locator("#animation-toggle")).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => {
      window.stopAnimation();
      for (let i = 0; i < 10; i += 1) scene.step();
      window.drawAll();
    });
  }
  await page.locator("#target-toggle").click();
  await expect(page.locator("#target-toggle")).toHaveAttribute("aria-pressed", "true");
  const mappedValues = await page.evaluate(() => {
    const a = scene.getObjectByName("A");
    scene.moveEntity(a, a.x, a.y + 60);
    const mapping = scene.serializePatch().parameterMappings[0];
    const values = [];
    for (let i = 0; i < 60; i += 1) {
      window.stepAnimation(1 / 60);
      window.drawAll();
      values.push(
        MusicSpaceMapping.valueFromMapping(mapping, scene.parameterFeatureValue(mapping.feature, a))
      );
    }
    return values;
  });
  expect(Math.max(...mappedValues) - Math.min(...mappedValues)).toBeGreaterThan(100);

  await patches.selectOption("simple-spring");
  await page.locator("#ui-mode-edit").click();
  await page.evaluate(() => window.stopAnimation());
  const box = await page.locator("#canvas").boundingBox();
  const at = (x, y) => ({ x: box.x + (x * box.width) / 800, y: box.y + (y * box.height) / 600 });
  const mass = at(400, 300);
  const pulled = at(400, 360);
  await page.mouse.move(mass.x, mass.y);
  await page.mouse.down();
  await page.mouse.move(pulled.x, pulled.y, { steps: 5 });
  const held = await page.evaluate(() => {
    window.stopAnimation();
    for (let i = 0; i < 20; i += 1) scene.step();
    return { y: scene.getObjectByName("Mass").y, anchorY: scene.getObjectByName("Anchor").y };
  });
  expect(held.y).toBeCloseTo(360, 1);
  expect(held.anchorY).toBe(140);
  await page.mouse.up();
  const releasedY = await page.evaluate(() => {
    for (let i = 0; i < 20; i += 1) scene.step();
    window.drawAll();
    return scene.getObjectByName("Mass").y;
  });
  expect(releasedY).toBeLessThan(held.y - 10);
  await page.evaluate(() =>
    window.openConstraintEditor(state.constraints.find((c) => c instanceof SpringConstraint))
  );
  await expect(page.locator("#constraint-value-c-row")).toBeVisible();
  await page.locator("#constraint-value-a").fill("150");
  await page.locator("#constraint-value-b").fill("70");
  await page.locator("#constraint-value-c").fill("3");
  await page.locator("#constraint-apply").click();
  await page.screenshot({ path: test.info().outputPath("spring-editor.png"), fullPage: true });
  const spring = await page.evaluate(() =>
    window.serializePatch().constraints.find((c) => c.type === "spring")
  );
  expect(spring).toMatchObject({ restLength: 150, stiffness: 70, damping: 3 });
  await page.evaluate(() => window.openSourceEditor(scene.getObjectByName("Mass")));
  await expect(page.locator("#source-mass-row")).toBeVisible();
  await page.locator("#source-mass").fill("2.5");
  await page.locator("#source-apply").click();
  expect(await page.evaluate(() => scene.getObjectByName("Mass").dynamics.mass)).toBe(2.5);
  expect(failures).toEqual([]);
});

test.describe("phone layout and touch interaction", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test("phone controls fit, canvas expands without distortion, and inspectors remain reachable", async ({
    page
  }) => {
    await page.goto("/musicspace.html");
    await expect(page.locator("#patch-select")).toBeEnabled();
    await page.locator("#patch-select").selectOption("musical-spring");
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const stageBox = await page.locator("#stage").boundingBox();
      expect(stageBox.y + stageBox.height).toBeLessThan(720);
      expect(stageBox.width).toBeGreaterThan(width - 24);
      expect((await page.locator("#target-toggle").boundingBox()).height).toBeGreaterThanOrEqual(44);
      const summary = await page.locator("#selection-summary").boundingBox();
      if (summary) expect(summary.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height);
    }
    await expect(page.locator("#display-tools")).toBeHidden();
    await page.locator("#mobile-tools-toggle").tap();
    await expect(page.locator("#display-tools")).toBeVisible();
    await page.locator("#mobile-tools-toggle").tap();
    await page.screenshot({ path: test.info().outputPath("phone-play.png"), fullPage: true });
    // Exercise the CSS fallback used when a phone has no element fullscreen API.
    await page.evaluate(() => {
      document.getElementById("stage").requestFullscreen = undefined;
    });
    await page.locator("#canvas-fullscreen").tap();
    await expect(page.locator("#canvas-fullscreen")).toHaveText("Close");
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 }
    ]) {
      await page.setViewportSize(viewport);
      const canvasBox = await page.locator("#canvas").boundingBox();
      expect(canvasBox.width / canvasBox.height).toBeCloseTo(4 / 3, 2);
      expect(canvasBox.x).toBeGreaterThanOrEqual(0);
      expect(canvasBox.y).toBeGreaterThanOrEqual(0);
      expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    await page.screenshot({ path: test.info().outputPath("phone-landscape.png") });
    await page.locator("#canvas-fullscreen").tap();
    await expect(page.locator("#stage")).not.toHaveClass(/is-fullscreen/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#ui-mode-edit").tap();
    const canvasBox = await page.locator("#stage").boundingBox();
    const toolsBox = await page.locator(".tool-palette").boundingBox();
    expect(toolsBox.y).toBeGreaterThan(canvasBox.y + canvasBox.height);
    await page.locator("#patch-inspector-toggle").tap();
    const panel = await page.locator("#patch-inspector").boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(390);
    expect(panel.y + panel.height).toBeLessThanOrEqual(844);
    await page.locator("#patch-inspector-close").tap();
    await expect(page.locator("#patch-inspector")).toBeHidden();
  });

  test("a finger near a mass can drag it, a second finger cannot steal it, and release resumes dynamics", async ({
    page,
    context
  }) => {
    await page.goto("/musicspace.html");
    await expect(page.locator("#patch-select")).toBeEnabled();
    await page.locator("#patch-select").selectOption("simple-spring");
    await page.evaluate(() => window.stopAnimation());
    const canvasBox = await page.locator("#canvas").boundingBox();
    const x = canvasBox.x + canvasBox.width / 2 - 18;
    const y = canvasBox.y + canvasBox.height / 2;
    const client = await context.newCDPSession(page);
    const send = (type, touchPoints) => client.send("Input.dispatchTouchEvent", { type, touchPoints });
    const finger = (id, x, y) => ({ id, x, y });
    await send("touchStart", [finger(1, x, y)]);
    expect(await page.evaluate(() => scene.state.draggedEntity?.name)).toBe("Mass");
    await send("touchMove", [finger(1, x, y + 30)]);
    await page.evaluate(() => window.stopAnimation());
    const heldY = await page.evaluate(() => scene.getObjectByName("Mass").y);
    expect(heldY).toBeGreaterThan(340);
    await send("touchStart", [finger(1, x, y + 30), finger(2, x + 70, y)]);
    expect(await page.evaluate(() => scene.state.draggedEntity?.name)).toBe("Mass");
    await send("touchEnd", []);
    expect(await page.evaluate(() => scene.state.draggedEntity)).toBeNull();
    const releasedY = await page.evaluate(() => {
      for (let i = 0; i < 20; i += 1) scene.step();
      return scene.getObjectByName("Mass").y;
    });
    expect(releasedY).toBeLessThan(heldY - 10);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await client.detach();
  });
});
