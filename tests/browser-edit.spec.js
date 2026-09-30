/* global scene, state, selectedEntity:writable, undoStack */
const { expect, test } = require("@playwright/test");
async function open(page, engine = "package", patch = "simple-spring") {
  await page.goto(`/musicspace.html?engine=${engine}&patch=${patch}`);
  await expect(page.locator("#patch-select")).toBeEnabled();
  await page.locator("#ui-mode-edit").click();
  await page.evaluate(() => window.stopAnimation());
}
for (const engine of ["standard", "package"])
  test.describe(`${engine} editing`, () => {
    test("create objects, spring parameters, mass, deletion and undo", async ({ page }) => {
      await open(page, engine);
      const failures = [];
      page.on("pageerror", (error) => failures.push(error.message));
      await page.locator('[data-tool="source"]').click();
      const box = await page.locator("#canvas").boundingBox();
      await page.mouse.click(box.x + (100 * box.width) / 800, box.y + (100 * box.height) / 600);
      expect(await page.evaluate(() => state.sources.length)).toBe(3);
      await page.evaluate(() => window.openSourceEditor(state.sources.at(-1)));
      await page.locator("#source-name").fill("New Control");
      await page.locator("#source-apply").click();
      expect(await page.evaluate(() => window.serializePatch().sources.at(-1).name)).toBe("New Control");
      await page.evaluate(() => {
        window.closeSourceEditor();
        window.openConstraintEditor(state.constraints.find((c) => c.node.label === "Spring"));
      });
      await page.locator("#constraint-value-a").fill("145");
      await page.locator("#constraint-value-b").fill("80");
      await page.locator("#constraint-value-c").fill("3");
      await page.locator("#constraint-apply").click();
      expect(
        await page.evaluate(() => window.serializePatch().constraints.find((c) => c.type === "spring"))
      ).toMatchObject({ restLength: 145, stiffness: 80, damping: 3 });
      await page.locator("#constraint-value-b").fill("-1");
      await page.locator("#constraint-apply").click();
      await expect(page.locator("#constraint-status")).toContainText("nonnegative");
      expect(
        await page.evaluate(
          () => window.serializePatch().constraints.find((c) => c.type === "spring").stiffness
        )
      ).toBe(80);
      await page.evaluate(() => window.openSourceEditor(scene.getObjectByName("Mass")));
      await page.locator("#source-mass").fill("2.5");
      await page.locator("#source-apply").click();
      expect(
        await page.evaluate(
          () => window.serializePatch().sources.find((p) => p.name === "Mass").dynamics.mass
        )
      ).toBe(2.5);
      await page.evaluate(() => {
        window.closeSourceEditor();
        selectedEntity = scene.getObjectByName("New Control");
        window.deleteSelectedEntity();
      });
      expect(await page.evaluate(() => state.sources.length)).toBe(2);
      await page.evaluate(() => window.undoLastEdit());
      await page.evaluate(() => window.stopAnimation());
      expect(await page.evaluate(() => scene.getObjectByName("New Control")?.name)).toBe("New Control");
      await page.screenshot({ path: test.info().outputPath(`${engine}-editing.png`), fullPage: true });
      expect(failures).toEqual([]);
    });
    test("trajectory editing, referenced endpoint deletion, save/load and undo", async ({ page }) => {
      await open(page, engine, "shuttle-spin");
      await page.evaluate(() =>
        window.openShuttleEditor(state.movingObjects.find((m) => m.trajectory.type === "shuttle"))
      );
      await page.locator("#shuttle-speed").fill("0.023");
      await page.locator("#shuttle-apply").click();
      expect(
        await page.evaluate(
          () =>
            window.serializePatch().movingObjects.find((m) => m.trajectory.type === "shuttle").trajectory
              .speed
        )
      ).toBe(0.023);
      const result = await page.evaluate(() => {
        selectedEntity = scene.getObjectByName("Start");
        const x = selectedEntity.x,
          y = selectedEntity.y;
        window.deleteSelectedEntity();
        const patch = window.serializePatch();
        const start = patch.movingObjects.find((m) => m.trajectory.type === "shuttle").trajectory.start;
        const valid = window.loadPatch(patch);
        window.stopAnimation();
        for (let i = 0; i < 10; i++) scene.step();
        return { start, x, y, valid };
      });
      expect(result.valid).toBe(true);
      expect(result.start).toMatchObject({ type: "fixed", x: result.x, y: result.y });
      await page.evaluate(() => window.undoLastEdit());
      await page.evaluate(() => window.stopAnimation());
      expect(await page.evaluate(() => scene.getObjectByName("Start")?.name)).toBe("Start");
      await page.locator("#patch-select").selectOption("simple-rotator");
      await page.evaluate(() => {
        window.stopAnimation();
        window.openRotationEditor(state.movingObjects[0]);
      });
      await page.locator("#rotation-period").fill("7");
      await page.locator("#rotation-apply").click();
      const rotation = await page.evaluate(() => {
        const mover = state.movingObjects[0],
          before = mover.trajectory.phase;
        scene.step();
        return { before, after: mover.trajectory.phase, period: mover.trajectory.periodSeconds };
      });
      expect(rotation.period).toBe(7);
      expect(rotation.after).not.toBe(rotation.before);
    });
    test("renaming and deleting output-bound sources preserves valid patches and undo", async ({ page }) => {
      await open(page, engine, "musical-spring");
      await page.evaluate(() => window.openSourceEditor(scene.getObjectByName("A")));
      await page.locator("#source-name").fill("Renamed");
      await page.locator("#source-apply").click();
      const renamed = await page.evaluate(() => window.serializePatch());
      expect(renamed.parameterMappings[0].source).toBe("Renamed");
      await page.evaluate(() => {
        window.closeSourceEditor();
        selectedEntity = scene.getObjectByName("Renamed");
        window.deleteSelectedEntity();
      });
      const after = await page.evaluate(() => {
        const patch = window.serializePatch();
        return { patch, errors: scene.validatePatch(patch).filter((f) => f.level === "error") };
      });
      expect(after.errors).toEqual([]);
      expect(after.patch.parameterMappings || []).toEqual(
        renamed.parameterMappings.filter((m) => m.source !== "Renamed")
      );
      await page.evaluate(() => {
        window.undoLastEdit();
        window.stopAnimation();
      });
      expect(await page.evaluate(() => window.serializePatch().parameterMappings[0].source)).toBe("Renamed");
      // Remove every object, then reload the empty scene and create a source again.
      const empty = await page.evaluate(() => {
        for (const entity of [...state.sources, ...state.movingObjects]) {
          selectedEntity = entity;
          window.deleteSelectedEntity();
        }
        const saved = window.serializePatch();
        const ok = window.loadPatch(saved);
        window.stopAnimation();
        window.setActiveTool("source");
        window.handleToolClick(123, 234, null);
        return { saved, ok, count: state.sources.length };
      });
      expect(empty.saved.sources).toEqual([]);
      expect(empty.ok).toBe(true);
      expect(empty.count).toBe(1);
    });
    test("invalid geometry and JSON leave the scene and undo history intact", async ({ page }) => {
      await open(page, engine, "simple-rotator");
      await page.locator("#patch-json-inline-toggle").click();
      const json = page.locator("#patch-json");
      const before = JSON.parse(await json.inputValue());
      await json.fill(JSON.stringify({ ...before, movingObjects: "invalid" }));
      await page.locator("#patch-json-apply").click();
      await expect(page.locator("#constraint-status")).toContainText("must be an array");
      expect(await page.evaluate(() => window.serializePatch().sources)).toEqual(before.sources);
      if (engine === "package") {
        const invalid = await page.evaluate(() => {
          const before = window.serializePatch(),
            undo = undoStack.length;
          const ok = window.editGeometry("invalid", () => {
            state.sources[0].x = NaN;
            state.sources[0].name = "broken";
          });
          return { ok, before, after: window.serializePatch(), undo, undoAfter: undoStack.length };
        });
        expect(invalid.ok).toBe(false);
        expect(invalid.after).toEqual(invalid.before);
        expect(invalid.undoAfter).toBe(invalid.undo);
      }
      await json.fill(
        JSON.stringify({ ...before, sources: before.sources.map((p) => ({ ...p, x: p.x + 10 })) })
      );
      await page.locator("#patch-json-apply").click();
      expect(await page.evaluate(() => state.sources[0].x)).toBe(before.sources[0].x + 10);
      await page.evaluate(() => {
        window.undoLastEdit();
        window.stopAnimation();
      });
      expect(await page.evaluate(() => window.serializePatch().sources)).toEqual(before.sources);
      await expect(page.locator("#patch-select")).toHaveValue("simple-rotator");
    });
  });
for (const solver of ["propagation", "xpbd"])
  test(`all constraint and trajectory tools run equivalently after edits (${solver})`, async ({
    page,
    context
  }) => {
    const other = await context.newPage();
    await open(page, "package");
    await open(other, "standard");
    const results = [];
    for (const target of [other, page])
      results.push(
        await target.evaluate((solver) => {
          window.setSolverMode(solver);
          const base = {
            listener: { x: 400, y: 500 },
            sources: [
              { name: "A", x: 300, y: 150 },
              { name: "B", x: 500, y: 250 },
              { name: "C", x: 400, y: 300 }
            ],
            constraints: []
          };
          const results = [];
          for (const tool of [
            "angle",
            "sum",
            "product",
            "radialLimit",
            "fixedDistance",
            "spring",
            "distanceRatio",
            "pin",
            "solid",
            "separation",
            "angleSector"
          ]) {
            window.loadPatch(base);
            window.stopAnimation();
            window.setActiveTool(tool);
            const count = window.requiredEntityCount(tool);
            for (let i = 0; i < count; i++) window.handleToolClick(0, 0, state.sources[i]);
            if (window.isVariableArityConstraintTool(tool)) window.finishPendingConstraintTool();
            window.stopAnimation();
            const constraint = state.constraints[0];
            window.openConstraintEditor(constraint);
            window.applyConstraintEditor();
            window.recaptureConstraintFromGeometry();
            scene.moveEntity(state.sources[0], 320, 170);
            for (let i = 0; i < 5; i++) scene.step();
            const saved = window.serializePatch();
            results.push({ tool, sources: saved.sources, constraints: saved.constraints });
          }
          for (const tool of [
            "translateTrajectory",
            "rotateTrajectory",
            "rotatorTrajectory",
            "shuttleTrajectory",
            "bounceTrajectory"
          ]) {
            window.loadPatch(base);
            window.stopAnimation();
            window.setActiveTool(tool);
            window.handleToolClick(200, 300, null);
            for (let i = 0; i < 10; i++) scene.step();
            const m = state.movingObjects[0];
            results.push({ tool, x: m.x, y: m.y, type: m.trajectory.type });
          }
          return results;
        }, solver)
      );
    expect(results[1]).toEqual(results[0]);
    await other.close();
  });

test("package source editors retain audio, generator and MIDI bindings through rename/delete/undo", async ({
  page
}) => {
  await open(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const key of ["openspace-ostinatos", "jazz-trio-midi", "beatles-trajectory-study"]) {
    await page.locator("#patch-select").selectOption(key);
    if (key === "jazz-trio-midi") await expect(page.locator("#midi-status")).toContainText("tracks loaded");
    await page.evaluate(() => {
      window.stopAnimation();
      window.openSourceEditor(state.sources[0]);
    });
    const before = await page.evaluate(() => window.serializePatch());
    await page.locator("#source-name").fill("Renamed");
    await page.locator("#source-apply").click();
    const after = await page.evaluate(() => {
      const patch = window.serializePatch();
      return { patch, errors: scene.validatePatch(patch).filter((f) => f.level === "error") };
    });
    expect(after.errors, key).toEqual([]);
    expect(after.patch.sources[0].name, key).toBe("Renamed");
    for (const block of [
      "sourceBindings",
      "sourceGenerators",
      "sourceGeneratorMappings",
      "parameterMappings"
    ]) {
      if (before[block]?.some((p) => p.source === before.sources[0].name))
        expect(
          after.patch[block].some((p) => p.source === "Renamed"),
          `${key}:${block}`
        ).toBe(true);
    }
    if (key === "jazz-trio-midi")
      expect(after.patch.midiFile.trackBindings.some((p) => p.source === "Renamed")).toBe(true);
    await page.evaluate(() => {
      window.closeSourceEditor();
      selectedEntity = state.sources[0];
      window.deleteSelectedEntity();
    });
    expect(
      await page.evaluate(() =>
        scene.validatePatch(window.serializePatch()).filter((f) => f.level === "error")
      )
    ).toEqual([]);
    await page.evaluate(() => {
      window.undoLastEdit();
      window.stopAnimation();
    });
    expect(await page.evaluate(() => window.serializePatch().sources[0].name)).toBe("Renamed");
  }
  expect(errors).toEqual([]);
});

for (const engine of ["standard", "package"]) {
  test(`dotted trajectory endpoints drag, save and undo (${engine})`, async ({ page }) => {
    await open(page, engine, "driven-springs");
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    const initial = await page.evaluate(() => window.serializePatch());
    const undoCount = await page.evaluate(() => undoStack.length);
    let box = await page.locator("#canvas").boundingBox();
    const at = (x, y) => ({ x: box.x + (x * box.width) / 800, y: box.y + (y * box.height) / 600 });
    for (const [key, from, to] of [
      ["start", at(300, 100), at(220, 160)],
      ["end", at(500, 180), at(620, 220)]
    ]) {
      await page.mouse.move(from.x, from.y);
      await expect(page.locator("#canvas")).toHaveCSS("cursor", "grab");
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 5 });
      await page.mouse.up();
      const t = await page.evaluate(() => window.serializePatch().movingObjects[0].trajectory);
      expect(t[key].x).toBeCloseTo(key === "start" ? 220 : 620, 1);
      expect(t[key].y).toBeCloseTo(key === "start" ? 160 : 220, 1);
      expect(t[key === "start" ? "end" : "start"].x).toBeCloseTo(key === "start" ? 500 : 220, 1);
    }
    expect(await page.evaluate(() => undoStack.length)).toBe(undoCount + 2);
    await expect(page.locator("#animation-toggle")).toHaveAttribute("aria-pressed", "false");
    const saved = await page.evaluate(() => window.serializePatch());
    expect(
      await page.evaluate((patch) => {
        const loaded = window.loadPatch(patch);
        window.stopAnimation();
        return loaded;
      }, saved)
    ).toBe(true);
    expect(await page.evaluate(() => window.serializePatch().movingObjects[0].trajectory)).toMatchObject(
      saved.movingObjects[0].trajectory
    );
    // Reloading above clears undo; test a fresh drag and restore on the saved path.
    await page.mouse.move(at(220, 160).x, at(220, 160).y);
    await page.mouse.down();
    await page.mouse.move(at(180, 100).x, at(180, 100).y, { steps: 3 });
    await page.mouse.up();
    await page.evaluate(() => {
      window.undoLastEdit();
      window.stopAnimation();
    });
    expect(await page.evaluate(() => window.serializePatch().movingObjects[0].trajectory.start)).toEqual(
      saved.movingObjects[0].trajectory.start
    );
    expect(saved.movingObjects[0].trajectory.speed).toBe(initial.movingObjects[0].trajectory.speed);
    // Endpoints bound to objects retain their references and move with those objects.
    await page.locator("#patch-select").selectOption("shuttle-spin");
    await page.evaluate(() => window.stopAnimation());
    box = await page.locator("#canvas").boundingBox();
    await page.mouse.move(at(230, 210).x, at(230, 210).y);
    await page.mouse.down();
    await page.mouse.move(at(200, 180).x, at(200, 180).y, { steps: 3 });
    await page.mouse.up();
    expect(
      await page.evaluate(() => window.serializePatch().movingObjects[0].trajectory.start)
    ).toMatchObject({ type: "object", name: "Start" });
    expect(await page.evaluate(() => scene.getObjectByName("Start").x)).toBeCloseTo(200, 1);
    expect(failures).toEqual([]);
  });
}

test.describe("paused scene inspector gestures", () => {
  test.use({ hasTouch: true });
  for (const engine of ["standard", "package"]) {
    for (const pointer of ["mouse", "touch"]) {
      test(`double-click edits without starting motion (${engine}, ${pointer})`, async ({ page }) => {
        await open(page, engine, "driven-springs");
        const click = async (point) => {
          if (pointer === "touch") await page.touchscreen.tap(point.x, point.y);
          else await page.mouse.click(point.x, point.y);
        };
        for (const [patch, kind, panel] of [
          ["driven-springs", "spring", "constraint"],
          ["coupled-springs", "distance", "constraint"],
          ["driven-springs", "source", "source"],
          ["driven-springs", "mover", "shuttle"]
        ]) {
          await page.locator("#patch-select").selectOption(patch);
          await page.evaluate(() => window.stopAnimation());
          const point = await page.evaluate((kind) => {
            const entity =
              kind === "source"
                ? state.sources[0]
                : kind === "mover"
                  ? state.movingObjects[0]
                  : state.constraints.find(
                      (c) => c.node.label === (kind === "spring" ? "Spring" : "Distance")
                    ).node;
            const box = document.getElementById("canvas").getBoundingClientRect();
            return { x: box.x + (entity.x * box.width) / 800, y: box.y + (entity.y * box.height) / 600 };
          }, kind);
          await click(point);
          await expect(page.locator("#animation-toggle")).toHaveAttribute("aria-pressed", "false");
          await click(point);
          await expect(page.locator(`#${panel}-editor`)).toBeVisible();
          await expect(page.locator("#animation-toggle")).toHaveAttribute("aria-pressed", "false");
          if (kind === "spring") {
            await page.locator("#constraint-value-b").fill("75");
            await page.locator("#constraint-apply").click();
            expect(await page.evaluate(() => window.serializePatch().constraints[0].stiffness)).toBe(75);
            await expect(page.locator("#animation-toggle")).toHaveAttribute("aria-pressed", "false");
          }
          await page.locator(`#${panel}-close`).click();
        }
        // Moving a label must also stay paused; pulling a mass still excites it.
        await page.locator("#patch-select").selectOption("simple-spring");
        await page.evaluate(() => window.stopAnimation());
        const box = await page.locator("#canvas").boundingBox();
        for (const kind of ["label", "mass"]) {
          const point = await page.evaluate((kind) => {
            const e =
              kind === "label"
                ? state.constraints.find((c) => c.node.label === "Spring").node
                : scene.getObjectByName("Mass");
            return { x: e.x, y: e.y };
          }, kind);
          const x = box.x + (point.x * box.width) / 800;
          const y = box.y + (point.y * box.height) / 600;
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + 30, y + 25, { steps: 4 });
          await page.mouse.up();
          await expect(page.locator("#animation-toggle")).toHaveAttribute(
            "aria-pressed",
            kind === "mass" ? "true" : "false"
          );
        }
      });
    }
  }
});
