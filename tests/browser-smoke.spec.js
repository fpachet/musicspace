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
