const assert = require("node:assert/strict");

const test = require("node:test");

const {
  distance,
  loadFixturePatch,
  assertFinitePoint,
  assertFiniteReport,
  runScenarioInMode,
  compareSolvers,
  compareSolverMoveSeries,
  worstResidual,
  sweepXpbdIterations
} = require("./helpers/engine-harness");

const { createModelHarness } = require("./helpers/model-harness");

test("sum constraint redistributes distance and reports no residuals", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Sum smoke",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 0, y: 100 },
      { name: "C", x: -100, y: 0 }
    ],
    constraints: [{ type: "sum", sources: ["A", "B", "C"] }]
  });

  const report = engine.move("A", 130, 0);
  const listener = engine.point("Listener");
  const total = ["A", "B", "C"]
    .map((name) => distance(engine.point(name), listener))
    .reduce((sum, value) => sum + value, 0);

  assert.equal(report.satisfied, true);
  assert.equal(report.residuals.length, 0);
  assert.ok(Math.abs(total - 300) <= 0.5);
});

test("shared sum and angle graph propagates through the shared source", () => {
  const engine = createModelHarness();
  engine.loadPatch(loadFixturePatch("angle-balance.json"));
  const beforeB = engine.point("B");
  const beforeC = engine.point("C");

  const report = engine.move("D", 165, 147);
  const afterB = engine.point("B");
  const afterC = engine.point("C");

  assert.equal(report.hitStepCap, false);
  assert.ok(report.movedEntities.includes("A"), "shared source A should be propagated");
  assert.ok(distance(beforeB, afterB) > 1, "B should move after D pulls on shared A");
  assert.ok(distance(beforeC, afterC) > 1, "C should move after D pulls on shared A");
});

test("shift-style paused movement skips propagation and reports residuals", () => {
  const engine = createModelHarness();
  engine.loadPatch(loadFixturePatch("angle-balance.json"));
  const beforeB = engine.point("B");
  const beforeC = engine.point("C");

  const report = engine.move("D", 165, 147, { skipPropagation: true });
  const afterB = engine.point("B");
  const afterC = engine.point("C");

  assert.equal(report.propagationPaused, true);
  assert.equal(report.satisfied, false);
  assert.equal(report.propagationSteps, 0);
  assert.ok(report.residuals.length > 0);
  assert.deepEqual(afterB, beforeB);
  assert.deepEqual(afterC, beforeC);
});

test("resuming after paused movement retargets constraints before normal propagation", () => {
  const engine = createModelHarness();
  engine.loadPatch(loadFixturePatch("angle-balance.json"));

  engine.move("D", 165, 147, { skipPropagation: true });
  const shiftedB = engine.point("B");
  const shiftedC = engine.point("C");
  engine.resumePropagationAfterPausedDrag();

  const report = engine.move("D", 166, 148);
  const afterB = engine.point("B");
  const afterC = engine.point("C");

  assert.equal(report.propagationPaused, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(distance(shiftedB, afterB) < 8, "B should not jump back to the pre-pause constraint state");
  assert.ok(distance(shiftedC, afterC) < 8, "C should not jump back to the pre-pause constraint state");
});

test("product constraint and radial limits can back off without residuals", () => {
  const engine = createModelHarness();
  engine.loadPatch(loadFixturePatch("product-limit.json"));

  const report = engine.move("A", 200, 300);

  assert.equal(report.hitStepCap, false);
  assert.equal(report.residuals.length, 0);
  assert.equal(report.satisfied, true);
});

test("radial limits clamp an out-of-range source", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Radial limit smoke",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [{ type: "radialLimit", source: "A", minDistance: 50, maxDistance: 150 }]
  });

  const report = engine.move("A", 300, 0);
  const radius = distance(engine.point("A"), engine.point("Listener"));

  assert.equal(report.residuals.length, 0);
  assert.ok(Math.abs(radius - 150) <= 0.5);
});

test("distance ratio propagation preserves listener-relative ratio", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Ratio smoke",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 50, y: 0 }
    ],
    constraints: [{ type: "distanceRatio", sources: ["A", "B"], ratio: 2 }]
  });

  const report = engine.move("B", 70, 0);
  const listener = engine.point("Listener");
  const ratio = distance(engine.point("A"), listener) / distance(engine.point("B"), listener);

  assert.equal(report.residuals.length, 0);
  assert.ok(Math.abs(ratio - 2) <= 0.01);
});

test("solid link carries the attached object with its carrier", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Solid link smoke",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 150, y: 20 }
    ],
    constraints: [{ type: "solid", carrier: "A", attached: "B", offsetX: 50, offsetY: 20 }]
  });

  const report = engine.move("A", 130, 10);
  const b = engine.point("B");

  assert.equal(report.residuals.length, 0);
  assert.ok(Math.abs(b.x - 180) <= 0.5);
  assert.ok(Math.abs(b.y - 30) <= 0.5);
});

test("over-constrained graphs expose residual diagnostics", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Conflict smoke",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [
      { type: "pin", target: "A", x: 100, y: 0 },
      { type: "radialLimit", source: "A", minDistance: 200, maxDistance: 250 }
    ]
  });

  const report = engine.move("A", 120, 0);

  assert.equal(report.satisfied, false);
  assert.ok(report.residuals.length >= 1);
  assert.ok(report.residuals.some((residual) => residual.label === "Pin" || residual.label === "Limit"));
});

test("infeasible product with radial limits reports conflict diagnostics", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Product limit conflict",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 0, y: 100 },
      { name: "C", x: -100, y: 0 }
    ],
    constraints: [
      { type: "pin", target: "A", x: 300, y: 0 },
      { type: "radialLimit", source: "B", minDistance: 10, maxDistance: 50 },
      { type: "radialLimit", source: "C", minDistance: 10, maxDistance: 50 },
      { type: "product", sources: ["A", "B", "C"] }
    ]
  });

  const report = engine.move("A", 300, 0);
  const listener = engine.point("Listener");
  const diagnosticLabels = new Set(report.residuals.map((residual) => residual.label));
  const diagnosticText = report.messages.join(" ");

  assert.equal(report.satisfied, false);
  assert.ok(
    diagnosticLabels.has("Product") ||
      diagnosticLabels.has("Pin") ||
      diagnosticLabels.has("Limit") ||
      diagnosticText.includes("Product constraint has no solution")
  );
  assert.ok(distance(engine.point("B"), listener) <= 50.5);
  assert.ok(distance(engine.point("C"), listener) <= 50.5);
});

test("ratio and radial limit conflict stays bounded and reports diagnostics", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Ratio limit conflict",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 100, y: 0 }
    ],
    constraints: [
      { type: "pin", target: "B", x: 100, y: 0 },
      { type: "radialLimit", source: "A", minDistance: 50, maxDistance: 120 },
      { type: "distanceRatio", sources: ["A", "B"], ratio: 4 }
    ]
  });

  const report = engine.move("B", 100, 0);
  const listener = engine.point("Listener");
  const diagnosticLabels = new Set(report.residuals.map((residual) => residual.label));

  assert.equal(report.satisfied, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(diagnosticLabels.has("Ratio") || diagnosticLabels.has("Limit") || diagnosticLabels.has("Pin"));
  assert.ok(distance(engine.point("A"), listener) <= 120.5);
});

test("pin versus radial limit conflict reports a hard-constraint residual", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Pin limit conflict",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [
      { type: "pin", target: "A", x: 100, y: 0 },
      { type: "radialLimit", source: "A", minDistance: 200, maxDistance: 250 }
    ]
  });

  const report = engine.move("A", 240, 0);
  const residualLabels = report.residuals.map((residual) => residual.label);

  assert.equal(report.satisfied, false);
  assert.ok(residualLabels.includes("Pin") || residualLabels.includes("Limit"));
});

test("impossible fixed-distance triangle exposes residuals without unbounded propagation", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Impossible triangle",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 0, y: 0 },
      { name: "B", x: 100, y: 0 },
      { name: "C", x: 50, y: 86.6025 }
    ],
    constraints: [
      { type: "pin", target: "A", x: 0, y: 0 },
      { type: "pin", target: "B", x: 100, y: 0 },
      { type: "fixedDistance", anchor: "A", target: "C", distance: 60 },
      { type: "fixedDistance", anchor: "B", target: "C", distance: 60 },
      { type: "fixedDistance", anchor: "A", target: "B", distance: 150 }
    ]
  });

  const report = engine.move("C", 50, 20);
  const residualLabels = report.residuals.map((residual) => residual.label);

  assert.equal(report.satisfied, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(residualLabels.includes("Distance") || residualLabels.includes("Pin"));
});

test("solid-link chain dragged into a radial boundary remains bounded", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Link chain limit",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 80, y: 0 },
      { name: "B", x: 130, y: 0 },
      { name: "C", x: 180, y: 0 }
    ],
    constraints: [
      { type: "solid", carrier: "A", attached: "B", offsetX: 50, offsetY: 0 },
      { type: "solid", carrier: "B", attached: "C", offsetX: 50, offsetY: 0 },
      { type: "radialLimit", source: "C", minDistance: 40, maxDistance: 160 }
    ]
  });

  const report = engine.move("A", 140, 0);
  const listener = engine.point("Listener");

  assert.equal(report.hitStepCap, false);
  assert.ok(distance(engine.point("C"), listener) <= 160.5);
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
});

test("trajectory-style repeated pushes through a radial limit stay finite", () => {
  const engine = createModelHarness();
  engine.loadPatch({
    name: "Repeated trajectory pressure",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "Driver", x: 60, y: 0 },
      { name: "Q", x: 100, y: 0 }
    ],
    constraints: [
      { type: "solid", carrier: "Driver", attached: "Q", offsetX: 40, offsetY: 0 },
      { type: "radialLimit", source: "Q", minDistance: 40, maxDistance: 120 }
    ]
  });

  let report;
  for (let step = 0; step < 24; step += 1) {
    report = engine.move("Driver", 80 + step * 5, 0);
  }

  const listener = engine.point("Listener");
  assert.ok(report);
  assert.equal(report.hitStepCap, false);
  assert.ok(distance(engine.point("Q"), listener) <= 120.5);
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
});

test("large synthetic component respects the bounded propagation budget", () => {
  const engine = createModelHarness();
  const sources = Array.from({ length: 24 }, (_, index) => ({
    name: `S${index}`,
    x: 120 + index * 8,
    y: index % 2 === 0 ? 40 : -40
  }));
  const constraints = [];

  for (let index = 0; index < sources.length - 1; index += 1) {
    constraints.push({
      type: "fixedDistance",
      anchor: `S${index}`,
      target: `S${index + 1}`,
      distance: 60
    });
  }
  constraints.push({ type: "sum", sources: sources.map((source) => source.name) });

  engine.loadPatch({
    name: "Large bounded component",
    version: 1,
    listener: { x: 0, y: 0 },
    sources,
    constraints
  });

  const start = process.hrtime.bigint();
  const report = engine.move("S0", 200, 80);
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

  assert.ok(report.propagationSteps <= 96);
  assert.ok(elapsedMs < 50, `large component solve took ${elapsedMs.toFixed(2)}ms`);
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
});

test("tiny repeated moves keep the constrained solution continuous", () => {
  const engine = createModelHarness();
  engine.loadPatch(loadFixturePatch("angle-balance.json"));

  let previousB = engine.point("B");
  let previousC = engine.point("C");

  for (let step = 0; step < 20; step += 1) {
    const report = engine.move("D", 160 + step, 145 + step * 0.5);
    const nextB = engine.point("B");
    const nextC = engine.point("C");

    assert.equal(report.hitStepCap, false);
    assert.ok(distance(previousB, nextB) < 35, `B jumped on step ${step}`);
    assert.ok(distance(previousC, nextC) < 35, `C jumped on step ${step}`);
    previousB = nextB;
    previousC = nextC;
  }
});

test("xpbd mode clamps radial limits without propagation caps", () => {
  const engine = createModelHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch({
    name: "XPBD radial clamp",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [{ type: "radialLimit", source: "A", minDistance: 50, maxDistance: 150 }]
  });

  const report = engine.move("A", 300, 0);
  const radius = distance(engine.point("A"), engine.point("Listener"));

  assert.equal(report.solverMode, "xpbd");
  assert.equal(report.hitEntityCap, false);
  assert.equal(report.hitStepCap, false);
  assert.equal(report.residuals.length, 0);
  assert.ok(Math.abs(radius - 150) <= 0.5);
});

test("xpbd mode satisfies simple fixed-distance constraints", () => {
  const engine = createModelHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch({
    name: "XPBD distance",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 0, y: 0 },
      { name: "B", x: 100, y: 0 }
    ],
    constraints: [{ type: "fixedDistance", anchor: "A", target: "B", distance: 100 }]
  });

  const report = engine.move("A", 50, 0);
  const currentDistance = distance(engine.point("A"), engine.point("B"));

  assert.equal(report.solverMode, "xpbd");
  assert.equal(report.hitEntityCap, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(Math.abs(currentDistance - 100) <= 0.5);
});

test("xpbd mode keeps product plus radial limit bounded", () => {
  const engine = createModelHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch(loadFixturePatch("product-limit.json"));

  const report = engine.move("A", 200, 300);
  const listener = engine.point("Listener");
  const bRadius = distance(engine.point("B"), listener);

  assert.equal(report.solverMode, "xpbd");
  assert.equal(report.hitEntityCap, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(bRadius >= 59.5 && bRadius <= 130.5);
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
});

test("xpbd mode reports best-fit diagnostics for pin and limit conflict", () => {
  const engine = createModelHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch({
    name: "XPBD hard conflict",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [
      { type: "pin", target: "A", x: 100, y: 0 },
      { type: "radialLimit", source: "A", minDistance: 200, maxDistance: 250 }
    ]
  });

  const report = engine.move("A", 240, 0);
  const residualLabels = report.residuals.map((residual) => residual.label);

  assert.equal(report.solverMode, "xpbd");
  assert.equal(report.satisfied, false);
  assert.equal(report.hitEntityCap, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(residualLabels.includes("Pin") || residualLabels.includes("Limit"));
});

test("xpbd mode rotates solid attachments on rotator trajectory ticks", () => {
  const engine = createModelHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch(loadFixturePatch("simple-rotator.json"));

  const before = engine.point("S1");
  const report = engine.tickMover("Spin");
  const after = engine.point("S1");

  assert.equal(report.solverMode, "xpbd");
  assert.equal(report.hitEntityCap, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(distance(before, after) > 0.5, "rotator-attached source should move after a rotator tick");
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
});

test("xpbd mode preserves object-referenced shuttle endpoints during trajectory ticks", () => {
  const engine = createModelHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch(loadFixturePatch("shuttle-spin.json"));

  const lift = engine.api.getObjectByName("Lift");
  const before = {
    ax: lift.trajectory.ax,
    ay: lift.trajectory.ay,
    bx: lift.trajectory.bx,
    by: lift.trajectory.by,
    start: { ...lift.trajectory.start },
    end: { ...lift.trajectory.end }
  };

  const report = engine.tickMover("Lift");

  assert.equal(report.solverMode, "xpbd");
  assert.equal(lift.trajectory.ax, before.ax);
  assert.equal(lift.trajectory.ay, before.ay);
  assert.equal(lift.trajectory.bx, before.bx);
  assert.equal(lift.trajectory.by, before.by);
  assert.equal(lift.trajectory.start.type, before.start.type);
  assert.equal(lift.trajectory.start.name, before.start.name);
  assert.equal(lift.trajectory.start.x, before.start.x);
  assert.equal(lift.trajectory.start.y, before.start.y);
  assert.equal(lift.trajectory.end.type, before.end.type);
  assert.equal(lift.trajectory.end.name, before.end.name);
  assert.equal(lift.trajectory.end.x, before.end.x);
  assert.equal(lift.trajectory.end.y, before.end.y);
});

test("propagation and xpbd both keep representative edit scenarios finite", () => {
  const scenarios = [
    {
      file: "product-limit.json",
      moved: "A",
      x: 200,
      y: 300,
      check(engine) {
        const listener = engine.point("Listener");
        const bRadius = distance(engine.point("B"), listener);
        assert.ok(bRadius >= 59.5 && bRadius <= 130.5);
      }
    },
    {
      file: "angle-balance.json",
      moved: "D",
      x: 165,
      y: 147,
      check(engine) {
        assertFinitePoint(engine.point("B"), "B");
        assertFinitePoint(engine.point("C"), "C");
      }
    },
    {
      file: "faust-control-study.json",
      moved: "Q",
      x: 610,
      y: 455,
      check(engine) {
        assertFinitePoint(engine.point("Q"), "Q");
        assertFinitePoint(engine.point("Cutoff"), "Cutoff");
      }
    },
    {
      file: "granular-cloud-study.json",
      moved: "Spray",
      x: 665,
      y: 430,
      check(engine) {
        const listener = engine.point("Listener");
        const sprayRadius = distance(engine.point("Spray"), listener);
        assert.ok(sprayRadius >= 79.5 && sprayRadius <= 210.5);
      }
    }
  ];

  for (const scenario of scenarios) {
    const patch = loadFixturePatch(scenario.file);
    for (const mode of ["propagation", "xpbd"]) {
      const { engine, report } = runScenarioInMode(mode, patch, (candidate) =>
        candidate.move(scenario.moved, scenario.x, scenario.y)
      );

      assertFiniteReport(report);
      assert.equal(report.hitStepCap, false, `${mode} hit step cap in ${scenario.file}`);
      if (mode === "xpbd") {
        assert.equal(report.hitEntityCap, false, `xpbd hit entity cap in ${scenario.file}`);
      }
      scenario.check(engine, report, mode);
    }
  }
});

test("xpbd trajectory patches stay finite and preserve authored frames over repeated ticks", () => {
  const scenarios = [
    {
      file: "simple-rotator.json",
      movers: ["Spin"],
      watched: ["S1", "S2", "S3", "S4"],
      ticks: 24
    },
    {
      file: "nested-rotators.json",
      movers: ["Parent", "Child"],
      watched: ["Lead", "Echo", "Pad"],
      ticks: 20
    },
    {
      file: "cycloid-rotator.json",
      movers: ["Orbit", "Spin"],
      watched: ["A", "B", "C"],
      ticks: 20
    },
    {
      file: "shuttle-spin.json",
      movers: ["Lift", "Spin"],
      watched: ["Vox", "Beat", "Bass"],
      ticks: 20,
      preserveShuttle: "Lift"
    },
    {
      file: "bouncing-constellation.json",
      movers: ["Bounce", "Spin"],
      watched: ["One", "Two", "Three"],
      ticks: 20
    }
  ];

  for (const scenario of scenarios) {
    const engine = createModelHarness();
    engine.setSolverMode("xpbd");
    engine.loadPatch(loadFixturePatch(scenario.file));
    const before = engine.points(scenario.watched);
    const shuttle = scenario.preserveShuttle ? engine.api.getObjectByName(scenario.preserveShuttle) : null;
    const shuttleFrame = shuttle
      ? {
          ax: shuttle.trajectory.ax,
          ay: shuttle.trajectory.ay,
          bx: shuttle.trajectory.bx,
          by: shuttle.trajectory.by,
          startName: shuttle.trajectory.start?.name,
          endName: shuttle.trajectory.end?.name
        }
      : null;

    const report = engine.tickMovers(scenario.movers, scenario.ticks);
    const after = engine.points(scenario.watched);

    assertFiniteReport(report);
    assert.equal(report.hitStepCap, false, `xpbd hit step cap in ${scenario.file}`);
    assert.equal(report.hitEntityCap, false, `xpbd hit entity cap in ${scenario.file}`);

    for (const [name, point] of Object.entries(after)) {
      assertFinitePoint(point, `${scenario.file}:${name}`);
      assert.ok(distance(before[name], point) < 600, `${scenario.file}:${name} moved implausibly far`);
    }

    if (shuttleFrame) {
      assert.equal(shuttle.trajectory.ax, shuttleFrame.ax);
      assert.equal(shuttle.trajectory.ay, shuttleFrame.ay);
      assert.equal(shuttle.trajectory.bx, shuttleFrame.bx);
      assert.equal(shuttle.trajectory.by, shuttleFrame.by);
      assert.equal(shuttle.trajectory.start?.name, shuttleFrame.startName);
      assert.equal(shuttle.trajectory.end?.name, shuttleFrame.endName);
    }
  }
});

test("solver comparison metrics summarize propagation and xpbd behavior", () => {
  const metrics = compareSolvers(
    loadFixturePatch("product-limit.json"),
    (engine) => engine.move("A", 200, 300),
    ["A", "B", "C"]
  );

  for (const mode of ["propagation", "xpbd"]) {
    assert.equal(typeof metrics[mode].elapsedMs, "number");
    assert.equal(typeof metrics[mode].hitEntityCap, "boolean");
    assert.equal(typeof metrics[mode].hitStepCap, "boolean");
    assert.equal(typeof metrics[mode].movedCount, "number");
    assert.equal(typeof metrics[mode].residualCount, "number");
    assert.equal(typeof metrics[mode].satisfied, "boolean");
    assert.equal(typeof metrics[mode].totalDisplacement, "number");
    assert.equal(typeof metrics[mode].worstResidual, "number");
    assert.ok(Number.isFinite(metrics[mode].elapsedMs));
    assert.ok(Number.isFinite(metrics[mode].totalDisplacement));
    assert.ok(Number.isFinite(metrics[mode].worstResidual));
  }

  assert.equal(metrics.xpbd.hitEntityCap, false);
  assert.equal(metrics.xpbd.hitStepCap, false);
});

test("solver series comparison tracks propagated sources and cpu", () => {
  const scenarios = [
    {
      name: "product-limit/A radial sweep",
      patch: loadFixturePatch("product-limit.json"),
      watched: ["A", "B", "C"],
      moves: [
        { name: "A", x: 260, y: 300 },
        { name: "A", x: 230, y: 330 },
        { name: "A", x: 200, y: 300 },
        { name: "A", x: 235, y: 260 },
        { name: "A", x: 300, y: 300 }
      ]
    },
    {
      name: "angle-balance/D diagonal",
      patch: loadFixturePatch("angle-balance.json"),
      watched: ["A", "B", "C", "D"],
      moves: Array.from({ length: 8 }, (_, index) => ({
        name: "D",
        x: 150 + index * 5,
        y: 140 + index * 4
      }))
    },
    {
      name: "granular-cloud/Spray limit pressure",
      patch: loadFixturePatch("granular-cloud-study.json"),
      watched: ["Rate", "Size", "Pitch", "Spray", "Tone", "Level"],
      moves: [
        { name: "Spray", x: 620, y: 390 },
        { name: "Spray", x: 650, y: 430 },
        { name: "Spray", x: 690, y: 455 },
        { name: "Spray", x: 580, y: 370 },
        { name: "Spray", x: 540, y: 330 }
      ]
    }
  ];
  const summaries = {};

  for (const scenario of scenarios) {
    const comparison = compareSolverMoveSeries(scenario.patch, scenario.moves, scenario.watched);
    summaries[scenario.name] = {
      propagation: {
        elapsedMs: Number(comparison.propagation.elapsedMs.toFixed(3)),
        maxStepMs: Number(comparison.propagation.maxStepMs.toFixed(3)),
        residualCount: comparison.propagation.residualCount,
        hitEntityCapCount: comparison.propagation.hitEntityCapCount,
        hitStepCapCount: comparison.propagation.hitStepCapCount,
        cumulativePathBySource: Object.fromEntries(
          Object.entries(comparison.propagation.cumulativePathBySource).map(([name, value]) => [
            name,
            Number(value.toFixed(3))
          ])
        ),
        displacementBySource: Object.fromEntries(
          Object.entries(comparison.propagation.displacementBySource).map(([name, value]) => [
            name,
            Number(value.toFixed(3))
          ])
        )
      },
      xpbd: {
        elapsedMs: Number(comparison.xpbd.elapsedMs.toFixed(3)),
        maxStepMs: Number(comparison.xpbd.maxStepMs.toFixed(3)),
        residualCount: comparison.xpbd.residualCount,
        hitEntityCapCount: comparison.xpbd.hitEntityCapCount,
        hitStepCapCount: comparison.xpbd.hitStepCapCount,
        cumulativePathBySource: Object.fromEntries(
          Object.entries(comparison.xpbd.cumulativePathBySource).map(([name, value]) => [
            name,
            Number(value.toFixed(3))
          ])
        ),
        displacementBySource: Object.fromEntries(
          Object.entries(comparison.xpbd.displacementBySource).map(([name, value]) => [
            name,
            Number(value.toFixed(3))
          ])
        )
      },
      finalDistanceBetweenModes: Object.fromEntries(
        Object.entries(comparison.finalDistanceBetweenModes).map(([name, value]) => [
          name,
          Number(value.toFixed(3))
        ])
      )
    };

    for (const mode of ["propagation", "xpbd"]) {
      assert.equal(comparison[mode].hitStepCapCount, 0, `${scenario.name} ${mode} hit step caps`);
      assert.ok(Number.isFinite(comparison[mode].worstResidual));
      for (const point of Object.values(comparison[mode].after)) {
        assertFinitePoint(point, `${scenario.name}:${mode}`);
      }
    }

    assert.equal(comparison.xpbd.hitEntityCapCount, 0, `${scenario.name} xpbd hit entity caps`);
  }

  if (process.env.MUSICSPACE_PRINT_SOLVER_COMPARISON === "1") {
    console.log(JSON.stringify(summaries, null, 2));
  }
});

test("xpbd iteration sweep reports convergence and cpu tradeoffs", () => {
  const sweep = sweepXpbdIterations(
    loadFixturePatch("granular-cloud-study.json"),
    { name: "Spray", x: 690, y: 455 },
    ["Rate", "Size", "Pitch", "Spray", "Tone", "Level"],
    [4, 6, 8, 10, 16, 24, 40]
  );

  for (const row of sweep) {
    assert.ok(Number.isFinite(row.elapsedMs));
    assert.ok(Number.isFinite(row.worstResidual));
    assert.ok(Number.isFinite(row.maxDisplacement));
    assert.ok(Number.isFinite(row.nonFiniteResidualCount));
  }

  assert.equal(sweep.at(-1).nonFiniteResidualCount, 0);

  if (process.env.MUSICSPACE_PRINT_XPBD_SWEEP === "1") {
    console.log(
      JSON.stringify(
        sweep.map((row) => ({
          iterations: row.iterations,
          elapsedMs: Number(row.elapsedMs.toFixed(3)),
          nonFiniteResidualCount: row.nonFiniteResidualCount,
          residualCount: row.residualCount,
          worstResidual: Number(row.worstResidual.toFixed(3)),
          maxDisplacement: Number(row.maxDisplacement.toFixed(3)),
          displacementBySource: Object.fromEntries(
            Object.entries(row.displacementBySource).map(([name, value]) => [name, Number(value.toFixed(3))])
          )
        })),
        null,
        2
      )
    );
  }
});

test("xpbd release refinement improves residuals after drag-budget solve", () => {
  const engine = createModelHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch(loadFixturePatch("granular-cloud-study.json"));

  const dragReport = engine.moveWithXpbdIterations("Spray", 690, 455, 10);
  const releaseReport = engine.refineXpbdAfterDrag("Spray");

  assert.ok(dragReport.residuals.length > 0);
  assert.equal(releaseReport.hitEntityCap, false);
  assert.equal(releaseReport.hitStepCap, false);
  assert.ok(releaseReport.residuals.length <= dragReport.residuals.length);
  assert.ok(worstResidual(releaseReport) <= worstResidual(dragReport));
});
