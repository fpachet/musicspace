// These bindings are provided by musicspace.js inside page.evaluate callbacks.
/* global scene, state, isViewKind */
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
  for (const key of [
    "simple-spring",
    "coupled-springs",
    "spring-pendulum",
    "driven-springs",
    "musical-spring"
  ]) {
    await patches.selectOption(key);
    await expect(page.locator("#animation-toggle")).toHaveAttribute("aria-pressed", "true");
    if (key === "driven-springs") {
      const initialY = await page.evaluate(() => scene.getObjectByName("B").y);
      await page.waitForFunction((y) => Math.abs(scene.getObjectByName("B").y - y) > 10, initialY);
      await page.locator("#stage").screenshot({ path: test.info().outputPath("driven-springs.png") });
    }
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
    window.openConstraintEditor(state.constraints.find((c) => isViewKind(c, "SpringConstraint")))
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
      expect(canvasBox.width).toBeCloseTo(viewport.width, 0);
      expect(canvasBox.height).toBeCloseTo(viewport.height, 0);
      const transform = await page.evaluate(() =>
        document.getElementById("canvas").getContext("2d").getTransform().toJSON()
      );
      expect(transform.a).toBeCloseTo(transform.d, 2);
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

  for (const fallback of [false, true]) {
    test(`fullscreen touch uses the entire screen (${fallback ? "CSS fallback" : "browser API"})`, async ({
      page,
      context
    }) => {
      await page.goto("/musicspace.html");
      await expect(page.locator("#patch-select")).toBeEnabled();
      await page.locator("#patch-select").selectOption("musical-spring");
      if (fallback) {
        await page.evaluate(() => {
          document.getElementById("stage").requestFullscreen = undefined;
        });
      }
      const client = await context.newCDPSession(page);
      const touch = (type, points) => client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 844, height: 390 }
      ]) {
        await page.setViewportSize(viewport);
        await page.locator("#canvas-fullscreen").tap();
        await expect(page.locator("#canvas-fullscreen")).toHaveText("Close");
        if (!fallback) await page.waitForFunction(() => document.fullscreenElement?.id === "stage");
        await page.evaluate(() => {
          window.stopAnimation();
          const source = scene.getObjectByName("A");
          source.x = 250;
          source.y = 300;
          window.drawAll();
        });
        const box = await page.locator("#canvas").boundingBox();
        expect(box.width).toBeCloseTo(viewport.width, 0);
        expect(box.height).toBeCloseTo(viewport.height, 0);
        const scale = Math.min(box.width / 800, box.height / 600);
        const offsetX = (box.width - 800 * scale) / 2;
        const offsetY = (box.height - 600 * scale) / 2;
        const start = { id: 1, x: box.x + offsetX + 250 * scale, y: box.y + offsetY + 300 * scale };
        // Reach above the old 4:3 rectangle in portrait, and to its left in landscape.
        const end = { id: 1, x: box.x + (viewport.width < viewport.height ? 180 : 40), y: box.y + 100 };
        await touch("touchStart", [start]);
        expect(await page.evaluate(() => scene.state.draggedEntity?.name)).toBe("A");
        await touch("touchMove", [end]);
        await page.evaluate(() => window.stopAnimation());
        const position = await page.evaluate(() => {
          const a = scene.getObjectByName("A");
          return { x: a.x, y: a.y };
        });
        expect(position.x).toBeCloseTo((end.x - box.x - offsetX) / scale, 0);
        expect(position.y).toBeCloseTo((end.y - box.y - offsetY) / scale, 0);
        await touch("touchEnd", []);
        // The moved source stays visible and can be grabbed in the expanded area.
        await touch("touchStart", [end]);
        expect(await page.evaluate(() => scene.state.draggedEntity?.name)).toBe("A");
        await page.evaluate(() => window.stopAnimation());
        await page.screenshot({ path: test.info().outputPath(`fullscreen-${viewport.width}.png`) });
        await touch("touchEnd", []);
        await page.locator("#canvas-fullscreen").tap();
        await expect(page.locator("#stage")).not.toHaveClass(/is-fullscreen/);
      }
      await client.detach();
    });
  }

  for (const engine of ["standard", "package"]) {
    test(`finger drags small trajectory handles in play and fullscreen (${engine})`, async ({
      page,
      context
    }) => {
      await page.goto(`/musicspace.html?engine=${engine}&patch=driven-springs`);
      await expect(page.locator("#patch-select")).toBeEnabled();
      await expect(page.locator("#patch-select")).toHaveValue("driven-springs");
      const client = await context.newCDPSession(page);
      const send = (type, touchPoints) => client.send("Input.dispatchTouchEvent", { type, touchPoints });
      for (const fullscreen of [false, true]) {
        if (fullscreen) {
          await page.evaluate(() => {
            document.getElementById("stage").requestFullscreen = undefined;
          });
          await page.locator("#canvas-fullscreen").tap();
          await expect(page.locator("#canvas-fullscreen")).toHaveText("Close");
        }
        const start = await page.evaluate(() => window.serializePatch().movingObjects[0].trajectory.start);
        const box = await page.locator("#canvas").boundingBox();
        const scale = Math.min(box.width / 800, box.height / 600);
        const offsetX = (box.width - 800 * scale) / 2;
        const offsetY = (box.height - 600 * scale) / 2;
        // Start outside the 5px dot, inside its 22px finger target.
        const x = box.x + offsetX + start.x * scale - 15;
        const y = box.y + offsetY + start.y * scale;
        await send("touchStart", [{ id: 1, x, y }]);
        await send("touchMove", [{ id: 1, x: x - 20, y: y + 30 }]);
        // A second finger cannot take over the endpoint gesture.
        await send("touchStart", [
          { id: 1, x: x - 20, y: y + 30 },
          { id: 2, x: x + 60, y }
        ]);
        await send("touchEnd", []);
        const changed = await page.evaluate(() => window.serializePatch().movingObjects[0].trajectory.start);
        expect(changed.x).toBeCloseTo(start.x - 20 / scale, 0);
        expect(changed.y).toBeCloseTo(start.y + 30 / scale, 0);
        await expect(page.locator("#animation-toggle")).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("#stage")).not.toHaveClass(/is-dragging/);
        await page
          .locator("#stage")
          .screenshot({ path: test.info().outputPath(`trajectory-handles-${fullscreen}.png`) });
      }
      await page.locator("#canvas-fullscreen").tap();
      await client.detach();
    });
  }

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

for (const engine of ["standard", "package"]) {
  test(`${engine} diagnostics keep the canvas stable while dragging source E`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`/musicspace.html?patch=angle-balance&engine=${engine}`);
    await expect(page.locator("#patch-select")).toBeEnabled();
    const initial = await page.evaluate(() => {
      const rect = document.getElementById("canvas").getBoundingClientRect();
      const source = state.sources.find((p) => p.name === "E");
      return {
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        x: rect.x + (source.x * rect.width) / 800,
        y: rect.y + (source.y * rect.height) / 600
      };
    });
    await page.mouse.move(initial.x, initial.y);
    await page.mouse.down();
    const samples = [];
    for (let i = 0; i < 45; i++) {
      await page.mouse.move(initial.x + 70 * Math.sin(i / 16), initial.y + i / 4);
      samples.push(
        await page.evaluate(() => {
          const rect = document.getElementById("canvas").getBoundingClientRect();
          const source = state.sources.find((p) => p.name === "E");
          return {
            top: rect.y,
            width: rect.width,
            height: rect.height,
            screenY: rect.y + (source.y * rect.height) / 600,
            message: document.getElementById("constraint-status").textContent
          };
        })
      );
    }
    await page.mouse.up();
    expect(samples.some((s) => s.message.includes("capped"))).toBe(true);
    for (const sample of samples) {
      expect(sample.top).toBe(initial.top);
      expect(sample.width).toBe(initial.width);
      expect(sample.height).toBe(initial.height);
    }
    // A gradual vertical gesture must not produce the old ~24 px layout jumps.
    for (let i = 1; i < samples.length; i++)
      expect(Math.abs(samples[i].screenY - samples[i - 1].screenY)).toBeLessThan(2);

    // Long diagnostics also wrap on phones. Keep every message readable by
    // scrolling inside the fixed status area, without moving/resizing the scene.
    await page.setViewportSize({ width: 390, height: 844 });
    const messages = [
      "",
      "Propagation capped one entity after 8 passes.",
      "Sum constraint reached its limit; source motion was backed off. ".repeat(6),
      ""
    ];
    const layouts = await page.evaluate(
      (values) =>
        values.map((message) => {
          window.setConstraintStatus(message);
          window.drawAll();
          const rect = document.getElementById("canvas").getBoundingClientRect();
          const row = document.querySelector(".status-row");
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            scrollable: row.scrollHeight > row.clientHeight,
            text: document.getElementById("constraint-status").textContent
          };
        }),
      messages
    );
    for (const layout of layouts)
      expect([layout.x, layout.y, layout.width, layout.height]).toEqual([
        layouts[0].x,
        layouts[0].y,
        layouts[0].width,
        layouts[0].height
      ]);
    expect(layouts[2].scrollable).toBe(true);
    expect(layouts[2].text).toBe(messages[2]);
  });
}

for (const engine of ["standard", "package"]) {
  for (const key of ["coupled-pendulums", "elastic-pendulum", "quintuple-pendulum"]) {
    test(`${key} starts moving and produces sound (${engine})`, async ({ page }) => {
      const failures = [];
      page.on("pageerror", (error) => failures.push(error.message));
      await page.addInitScript(() => {
        // Observe the real output signal, including target synths and per-source generators.
        window.outputAnalysers = [];
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (destination, ...args) {
          if (destination instanceof AudioDestinationNode) {
            const analyser = this.context.createAnalyser();
            connect.call(this, analyser);
            window.outputAnalysers.push(analyser);
          }
          return connect.call(this, destination, ...args);
        };
      });
      await page.goto(`/musicspace.html?engine=${engine}&patch=${key}`);
      await expect(page.locator("#patch-select")).toHaveValue(key);
      await expect(page.locator("#animation-toggle")).toHaveAttribute("aria-pressed", "true");
      const initialX = await page.evaluate(() => state.sources[0].x);
      await page.waitForFunction((x) => Math.abs(state.sources[0].x - x) > 5, initialX);
      await page.locator("#target-toggle").click();
      await expect(page.locator("#target-toggle")).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(() =>
          page.evaluate(() => {
            let peak = 0;
            for (const analyser of window.outputAnalysers) {
              const samples = new Float32Array(analyser.fftSize);
              analyser.getFloatTimeDomainData(samples);
              for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
            }
            return peak;
          })
        )
        .toBeGreaterThan(0.0001);
      await page.evaluate(() => window.stopAnimation());
      await page.locator("#stage").screenshot({ path: test.info().outputPath(`${key}.png`) });
      await page.locator("#target-toggle").click();
      await expect(page.locator("#target-toggle")).toHaveAttribute("aria-pressed", "false");
      expect(failures).toEqual([]);
    });
  }
}

/* global parameterClient */
for (const engine of ["standard", "package"]) {
  test(`${engine} three-body Faust voices follow motion and produce stereo audio`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const NativeNode = window.AudioWorkletNode;
      window.__threeBodyNodes = [];
      window.AudioWorkletNode = class extends NativeNode {
        constructor(...args) {
          super(...args);
          if (args[1] === "three-body") window.__threeBodyNodes.push(this);
        }
      };
    });
    await page.goto(`/musicspace.html?engine=${engine}&patch=three-body`);
    await expect(page.locator("#patch-select")).toBeEnabled();
    const before = await page.evaluate(() => parameterClient.parameterValues());
    await expect
      .poll(async () => {
        const current = await page.evaluate(() => parameterClient.parameterValues());
        return Math.abs(current["/ThreeBody/A/frequency"] - before["/ThreeBody/A/frequency"]);
      })
      .toBeGreaterThan(1);
    await page.locator("#target-toggle").click();
    await expect(page.locator("#target-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.evaluate(() => window.__threeBodyNodes.length)).toBe(1);
    await page.evaluate(() => {
      const node = window.__threeBodyNodes[0];
      window.__audioProbe = node.context.createAnalyser();
      window.__audioProbe.fftSize = 2048;
      node.connect(window.__audioProbe);
    });
    const rms = () =>
      page.evaluate(() => {
        const data = new Float32Array(window.__audioProbe.fftSize);
        window.__audioProbe.getFloatTimeDomainData(data);
        return Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
      });
    await expect.poll(rms).toBeGreaterThan(0.005);
    expect(await rms()).toBeLessThan(0.5);
    await page.locator("#target-toggle").click();
    await expect.poll(() => page.evaluate(() => window.__threeBodyNodes[0].context.state)).toBe("suspended");
    await page.locator("#target-toggle").click();
    await expect.poll(() => page.evaluate(() => window.__threeBodyNodes[0].context.state)).toBe("running");
    expect(await page.evaluate(() => window.__threeBodyNodes.length)).toBe(1);
    await page.locator("#patch-select").selectOption("angle-balance");
    await expect.poll(() => page.evaluate(() => window.__threeBodyNodes[0].context.state)).toBe("closed");
    expect(errors).toEqual([]);
  });
}
