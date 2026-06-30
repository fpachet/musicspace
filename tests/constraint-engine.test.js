const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function createCanvasContext() {
  const noop = () => {};
  return {
    arc: noop,
    beginPath: noop,
    clearRect: noop,
    closePath: noop,
    fill: noop,
    fillText: noop,
    lineTo: noop,
    moveTo: noop,
    rect: noop,
    restore: noop,
    rotate: noop,
    save: noop,
    setLineDash: noop,
    stroke: noop,
    translate: noop
  };
}

function createElement(id = "") {
  const listeners = new Map();
  const classes = new Set();
  const element = {
    id,
    attributes: new Map(),
    children: [],
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name, force) {
        const shouldAdd = force ?? !classes.has(name);
        if (shouldAdd) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
        return shouldAdd;
      }
    },
    dataset: {},
    disabled: false,
    files: [],
    hidden: false,
    options: [],
    style: {},
    textContent: "",
    value: "",
    addEventListener(type, listener) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(listener);
    },
    append(child) {
      this.children.push(child);
      if (child && "value" in child) {
        this.options.push(child);
      }
    },
    click() {
      for (const listener of listeners.get("click") || []) {
        listener({ target: this, preventDefault() {} });
      }
    },
    focus() {},
    getBoundingClientRect() {
      return { height: 600, left: 0, top: 0, width: 800, x: 0, y: 0 };
    },
    getContext() {
      return createCanvasContext();
    },
    releasePointerCapture() {},
    replaceChildren(...children) {
      this.children = children;
      this.options = children.filter((child) => child && "value" in child);
    },
    scrollIntoView() {},
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    setPointerCapture() {},
    toDataURL() {
      return "data:image/png;base64,";
    }
  };
  return element;
}

function createDocument() {
  const elements = new Map();
  return {
    createElement(tagName) {
      const element = createElement();
      element.tagName = tagName.toUpperCase();
      return element;
    },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, createElement(id));
      }
      return elements.get(id);
    },
    querySelectorAll() {
      return [];
    }
  };
}

function createEngineHarness() {
  const document = createDocument();
  const sandbox = {
    Blob,
    URL,
    console,
    document,
    fetch: async () => {
      throw new Error("fetch is disabled in constraint-engine tests");
    },
    FileReader: class {},
    MusicSpaceTargets: {
      listTargetBackends() {
        return [
          { type: "subtractive", parameters: ["/osc/freq", "/filter/frequency", "/filter/q", "/output/gain"] },
          { type: "granular", parameters: ["/grain/rate", "/grain/size", "/grain/pitch", "/grain/spread", "/filter/frequency", "/filter/q", "/output/gain"] },
          { type: "midi-file", parameters: [] },
          { type: "faust-wasm", parameters: [] }
        ];
      }
    },
    MusicSpaceMidiFileClient: {
      createMidiFileClient() {
        let midiFile = null;
        return {
          loadPatch(patch = {}) {
            midiFile = patch.midiFile ? JSON.parse(JSON.stringify(patch.midiFile)) : null;
          },
          renameSource(oldName, newName) {
            if (!midiFile?.trackBindings) {
              return;
            }
            midiFile.trackBindings = midiFile.trackBindings.map((binding) => (
              binding.source === oldName ? { ...binding, source: newName } : binding
            ));
          },
          serialize() {
            return midiFile ? { midiFile: JSON.parse(JSON.stringify(midiFile)) } : {};
          },
          updateSpatial() {}
        };
      }
    },
    MusicSpaceParameterClient: {
      createParameterClient() {
        let mappings = [];
        return {
          hasMappings() {
            return mappings.length > 0;
          },
          loadPatch(patch = {}) {
            mappings = Array.isArray(patch.parameterMappings)
              ? patch.parameterMappings.map((mapping) => ({ ...mapping }))
              : [];
          },
          mappedEntityNames() {
            return Array.from(new Set(mappings.map((mapping) => mapping.source)));
          },
          renameSource(oldName, newName) {
            mappings = mappings.map((mapping) => (
              mapping.source === oldName ? { ...mapping, source: newName } : mapping
            ));
          },
          serialize() {
            return { parameterMappings: mappings.map((mapping) => ({ ...mapping })) };
          },
          isEnabled() {
            return false;
          },
          async setEnabled() {
            return false;
          },
          update() {}
        };
      }
    },
    MusicSpaceSourceAudioClient: {
      createSourceAudioClient() {
        let bindings = [];
        return {
          bindingsForSource(sourceName) {
            return bindings.filter((binding) => binding.source === sourceName).map((binding) => ({ ...binding }));
          },
          hasBindings() {
            return bindings.length > 0;
          },
          isEnabled() {
            return false;
          },
          loadPatch(patch = {}) {
            bindings = Array.isArray(patch.sourceBindings)
              ? patch.sourceBindings.map((binding) => ({ ...binding }))
              : [];
          },
          removeBinding(sourceName) {
            bindings = bindings.filter((binding) => binding.source !== sourceName);
          },
          renameSource(oldName, newName) {
            bindings = bindings.map((binding) => (
              binding.source === oldName ? { ...binding, source: newName } : binding
            ));
          },
          removeBindingsForMissingSources(sourceNames) {
            const validNames = new Set(sourceNames);
            bindings = bindings.filter((binding) => validNames.has(binding.source));
          },
          serialize() {
            return { sourceBindings: bindings.map((binding) => ({ ...binding })) };
          },
          async setEnabled() {
            return false;
          },
          updateSpatial() {},
          upsertBinding(binding) {
            bindings = bindings.filter((candidate) => candidate.source !== binding.source);
            bindings.push({ ...binding });
            return { ...binding };
          }
        };
      }
    },
    window: {
      location: { href: "http://127.0.0.1/musicspace.html" },
      history: {
        replaceState(_state, _title, href) {
          sandbox.window.location.href = href;
        }
      }
    },
    cancelAnimationFrame() {},
    requestAnimationFrame() {
      return 1;
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const source = fs
    .readFileSync(path.join(ROOT, "musicspace.js"), "utf8")
    .replace(/\ninitializeApp\(\);\s*$/, "\n");
  const exposedSource = `${source}
globalThis.__musicspaceTestApi = {
  applySourceEditor,
  enforceConstraints,
  enforceConstraintsWithXpbd,
  getLastPropagationReport,
  getObjectByName,
  getSolverMode,
  handleEntityDoubleClick,
  handleToolButtonClick,
  handleToolClick,
  loadPatch,
  measureConstraintResiduals,
  moveEntity,
  refineXpbdAfterDrag,
  resumePropagationAfterPausedDrag,
  setSolverMode,
  setActiveTool,
  serializePatch,
  stopAllDrawing,
  validatePatch
};`;
  vm.runInContext(exposedSource, sandbox, { filename: "musicspace.js" });

  const api = sandbox.__musicspaceTestApi;
  return {
    api,
    loadPatch(patch) {
      api.loadPatch(JSON.parse(JSON.stringify(patch)), { clearUndo: true, preserveAsActive: true });
    },
    move(name, x, y, options) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      api.moveEntity(entity, x, y, options);
      return api.getLastPropagationReport();
    },
    moveWithXpbdIterations(name, x, y, iterations) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      entity.x = x;
      entity.y = y;
      return api.enforceConstraintsWithXpbd(entity, { iterations });
    },
    refineXpbdAfterDrag(name) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      api.refineXpbdAfterDrag(entity);
      return api.getLastPropagationReport();
    },
    point(name) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      return { x: entity.x, y: entity.y };
    },
    points(names) {
      return Object.fromEntries(names.map((name) => [name, this.point(name)]));
    },
    report() {
      return api.getLastPropagationReport();
    },
    resumePropagationAfterPausedDrag() {
      api.resumePropagationAfterPausedDrag();
    },
    residuals() {
      return api.measureConstraintResiduals().map(({ measurement }) => measurement);
    },
    setSolverMode(mode) {
      api.setSolverMode(mode);
    },
    clickSolverMode(mode) {
      const id = mode === "xpbd" ? "solver-mode-xpbd" : "solver-mode-propagation";
      document.getElementById(id).click();
    },
    currentHref() {
      return sandbox.window.location.href;
    },
    solverButtonPressed(mode) {
      const id = mode === "xpbd" ? "solver-mode-xpbd" : "solver-mode-propagation";
      return document.getElementById(id).attributes.get("aria-pressed");
    },
    solverMode() {
      return api.getSolverMode();
    },
    openSourceInspector(name) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      return api.handleEntityDoubleClick(entity);
    },
    sourceInspectorState() {
      return {
        hidden: document.getElementById("source-editor").hidden,
        name: document.getElementById("source-name").value,
        outputType: document.getElementById("source-output-type").value,
        fileLabel: document.getElementById("source-audio-file-name").textContent
      };
    },
    renameOpenSource(name) {
      document.getElementById("source-name").value = name;
      api.applySourceEditor();
      return api.serializePatch();
    },
    createConstraintWithTool(tool, names) {
      api.handleToolButtonClick(tool);
      let handled = false;
      for (const name of names) {
        const entity = api.getObjectByName(name);
        assert.ok(entity, `Expected entity ${name} to exist`);
        handled = api.handleToolClick(entity.x, entity.y, entity);
      }
      if (tool === "sum" || tool === "product") {
        api.handleToolButtonClick(tool);
      }
      return {
        handled,
        patch: api.serializePatch()
      };
    },
    stopAllDrawing() {
      api.stopAllDrawing();
      return api.serializePatch();
    },
    tickMover(name) {
      const mover = api.getObjectByName(name);
      assert.ok(mover, `Expected mover ${name} to exist`);
      const moved = mover.tick();
      if (moved) {
        api.enforceConstraints(mover, { preserveTrajectoryFrame: true });
      }
      return api.getLastPropagationReport();
    },
    tickMovers(names, count = 1) {
      let report = null;
      for (let step = 0; step < count; step += 1) {
        for (const name of names) {
          report = this.tickMover(name);
        }
      }
      return report;
    }
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function loadFixturePatch(fileName) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "patches", fileName), "utf8"));
}

function assertFinitePoint(point, label) {
  assert.ok(Number.isFinite(point.x), `${label}.x should be finite`);
  assert.ok(Number.isFinite(point.y), `${label}.y should be finite`);
}

function assertFiniteReport(report) {
  assert.ok(report, "expected a propagation report");
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
}

function runScenarioInMode(mode, patch, scenario) {
  const engine = createEngineHarness();
  engine.setSolverMode(mode);
  engine.loadPatch(patch);
  const report = scenario(engine);
  return { engine, report };
}

function compareSolvers(patch, scenario, watchedNames) {
  const results = {};

  for (const mode of ["propagation", "xpbd"]) {
    const engine = createEngineHarness();
    engine.setSolverMode(mode);
    engine.loadPatch(patch);
    const before = engine.points(watchedNames);
    const start = process.hrtime.bigint();
    const report = scenario(engine);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const after = engine.points(watchedNames);
    const displacements = watchedNames.map((name) => distance(before[name], after[name]));
    const residualErrors = report.residuals.map((residual) => residual.error);

    results[mode] = {
      elapsedMs,
      hitEntityCap: report.hitEntityCap,
      hitStepCap: report.hitStepCap,
      movedCount: report.movedEntities.length,
      residualCount: report.residuals.length,
      satisfied: report.satisfied,
      totalDisplacement: displacements.reduce((sum, value) => sum + value, 0),
      worstResidual: residualErrors.length > 0 ? Math.max(...residualErrors) : 0
    };
  }

  return results;
}

function compareSolverMoveSeries(patch, moves, watchedNames) {
  const results = {};

  for (const mode of ["propagation", "xpbd"]) {
    const engine = createEngineHarness();
    engine.setSolverMode(mode);
    engine.loadPatch(patch);
    const before = engine.points(watchedNames);
    let previous = before;
    const cumulativePathBySource = Object.fromEntries(watchedNames.map((name) => [name, 0]));
    const stepTimes = [];
    const reports = [];

    for (const move of moves) {
      const start = process.hrtime.bigint();
      const report = engine.move(move.name, move.x, move.y);
      stepTimes.push(Number(process.hrtime.bigint() - start) / 1e6);
      reports.push(report);
      const current = engine.points(watchedNames);
      for (const name of watchedNames) {
        cumulativePathBySource[name] += distance(previous[name], current[name]);
      }
      previous = current;
    }

    const after = engine.points(watchedNames);
    const displacementBySource = Object.fromEntries(watchedNames.map((name) => [
      name,
      distance(before[name], after[name])
    ]));
    const residualErrors = reports.flatMap((report) => report.residuals.map((residual) => residual.error));

    results[mode] = {
      after,
      cumulativePathBySource,
      displacementBySource,
      elapsedMs: stepTimes.reduce((sum, value) => sum + value, 0),
      maxStepMs: Math.max(...stepTimes),
      meanStepMs: stepTimes.reduce((sum, value) => sum + value, 0) / stepTimes.length,
      moveCount: moves.length,
      residualCount: reports.at(-1)?.residuals.length || 0,
      hitEntityCapCount: reports.filter((report) => report.hitEntityCap).length,
      hitStepCapCount: reports.filter((report) => report.hitStepCap).length,
      worstResidual: residualErrors.length > 0 ? Math.max(...residualErrors) : 0
    };
  }

  results.finalDistanceBetweenModes = Object.fromEntries(watchedNames.map((name) => [
    name,
    distance(results.propagation.after[name], results.xpbd.after[name])
  ]));

  return results;
}

function residualErrorValue(residual) {
  return residual?.measurement?.error ?? residual?.error;
}

function worstResidual(report) {
  const errors = report.residuals.map(residualErrorValue).filter(Number.isFinite);
  return errors.length > 0 ? Math.max(...errors) : 0;
}

function sweepXpbdIterations(patch, move, watchedNames, iterationCounts) {
  return iterationCounts.map((iterations) => {
    const engine = createEngineHarness();
    engine.setSolverMode("xpbd");
    engine.loadPatch(patch);
    const before = engine.points(watchedNames);
    const start = process.hrtime.bigint();
    const report = engine.moveWithXpbdIterations(move.name, move.x, move.y, iterations);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const after = engine.points(watchedNames);
    const displacementBySource = Object.fromEntries(watchedNames.map((name) => [
      name,
      distance(before[name], after[name])
    ]));
    const residualErrors = report.residuals.map(residualErrorValue);
    const finiteResidualErrors = residualErrors.filter(Number.isFinite);

    return {
      iterations,
      elapsedMs,
      maxDisplacement: Math.max(...Object.values(displacementBySource)),
      nonFiniteResidualCount: residualErrors.length - finiteResidualErrors.length,
      residualCount: report.residuals.length,
      worstResidual: finiteResidualErrors.length > 0 ? Math.max(...finiteResidualErrors) : 0,
      displacementBySource
    };
  });
}

test("sum constraint redistributes distance and reports no residuals", () => {
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("product-limit.json"));

  const report = engine.move("A", 200, 300);

  assert.equal(report.hitStepCap, false);
  assert.equal(report.residuals.length, 0);
  assert.equal(report.satisfied, true);
});

test("radial limits clamp an out-of-range source", () => {
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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

test("patch validation accepts coherent patch JSON", () => {
  const engine = createEngineHarness();
  const findings = engine.api.validatePatch(loadFixturePatch("jazz-trio-midi.json"));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "ok");
});

test("patch validation accepts every built-in patch", () => {
  const engine = createEngineHarness();
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, "patches", "index.json"), "utf8"));

  for (const entry of index.patches) {
    const findings = engine.api.validatePatch(loadFixturePatch(entry.file));
    const problems = findings.filter((finding) => finding.level !== "ok");

    assert.equal(problems.length, 0, `${entry.file}: ${problems.map((finding) => finding.message).join("; ")}`);
  }
});

test("patch validation reports dangling constraints and backend mistakes", () => {
  const engine = createEngineHarness();
  const findings = engine.api.validatePatch({
    name: "Broken patch",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 200, y: 200 }],
    constraints: [
      { type: "angle", sources: ["A", "Missing"] },
      { type: "radialLimit", source: "A", minDistance: 200, maxDistance: 100 }
    ],
    target: { type: "faust-wasm" },
    parameterMappings: [
      {
        source: "Missing",
        feature: "distance",
        target: "/osc/freq",
        inputMin: 0,
        inputMax: 100,
        outputMin: 0,
        outputMax: 880,
        curve: "exp"
      }
    ]
  });

  assert.ok(findings.some((finding) => finding.message.includes("unknown object Missing")));
  assert.ok(findings.some((finding) => finding.message.includes("min must be less than or equal to max")));
  assert.ok(findings.some((finding) => finding.message.includes("adapter module")));
  assert.ok(findings.some((finding) => finding.message.includes("positive outputMin/outputMax")));
});

test("source audio bindings serialize with the patch", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Source Audio",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    sourceBindings: [
      {
        source: "A",
        type: "audio-file",
        name: "voice.wav",
        mimeType: "audio/wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        loop: true,
        gain: 0.75,
        spatialization: "pan-distance"
      }
    ],
    constraints: []
  });

  const patch = engine.api.serializePatch();
  assert.equal(patch.sourceBindings.length, 1);
  assert.equal(patch.sourceBindings[0].source, "A");
  assert.equal(patch.sourceBindings[0].type, "audio-file");
  assert.equal(patch.sourceBindings[0].name, "voice.wav");
  assert.equal(patch.sourceBindings[0].gain, 0.75);
});

test("double-clicking a source opens the source inspector", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Source Inspector",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    constraints: []
  });

  assert.equal(engine.openSourceInspector("A"), true);
  const inspector = engine.sourceInspectorState();
  assert.equal(inspector.hidden, false);
  assert.equal(inspector.name, "A");
  assert.equal(inspector.outputType, "none");
  assert.equal(inspector.fileLabel, "No audio file assigned.");
});

test("source inspector rename updates patch references", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Rename source",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [
      { name: "A", x: 250, y: 300 },
      { name: "B", x: 500, y: 300 }
    ],
    movingObjects: [
      {
        name: "Lift",
        x: 350,
        y: 300,
        trajectory: {
          type: "shuttle",
          start: { type: "object", name: "A", x: 250, y: 300 },
          end: { type: "object", name: "B", x: 500, y: 300 },
          speed: 0.01
        }
      }
    ],
    constraints: [
      { type: "radialLimit", source: "A", minDistance: 50, maxDistance: 250 },
      { type: "solid", carrier: "Lift", attached: "A" }
    ],
    sourceBindings: [
      {
        source: "A",
        type: "audio-file",
        name: "voice.wav",
        mimeType: "audio/wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        loop: true,
        gain: 0.75,
        spatialization: "pan-distance"
      }
    ],
    parameterMappings: [
      {
        source: "A",
        feature: "distance",
        target: "/osc/freq",
        inputMin: 0,
        inputMax: 400,
        outputMin: 110,
        outputMax: 880
      }
    ],
    midiFile: {
      sequenceData: { title: "Stub" },
      trackBindings: [{ track: "Lead", source: "A", channel: 1, program: 1 }]
    }
  });

  assert.equal(engine.openSourceInspector("A"), true);
  const patch = engine.renameOpenSource("Lead");

  assert.ok(engine.api.getObjectByName("Lead"));
  assert.equal(engine.api.getObjectByName("A"), null);
  assert.deepEqual(patch.sources.map((source) => source.name), ["Lead", "B"]);
  assert.equal(patch.constraints.find((constraint) => constraint.type === "radialLimit").source, "Lead");
  assert.equal(patch.constraints.find((constraint) => constraint.type === "solid").attached, "Lead");
  assert.equal(patch.sourceBindings[0].source, "Lead");
  assert.equal(patch.parameterMappings[0].source, "Lead");
  assert.equal(patch.midiFile.trackBindings[0].source, "Lead");
  assert.equal(patch.movingObjects[0].trajectory.start.name, "Lead");
});

test("patch validation checks source audio bindings", () => {
  const engine = createEngineHarness();
  const findings = engine.api.validatePatch({
    name: "Broken source audio",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    sourceBindings: [
      { source: "Missing", type: "audio-file", name: "missing.wav", dataUrl: "data:audio/wav;base64,AAAA" },
      { source: "A", type: "audio-file", name: "empty.wav" },
      { source: "A", type: "stream", url: "stream://" }
    ],
    constraints: []
  });

  assert.ok(findings.some((finding) => finding.message.includes("unknown object Missing")));
  assert.ok(findings.some((finding) => finding.message.includes("needs a dataUrl or url")));
  assert.ok(findings.some((finding) => finding.message.includes("Unsupported source binding type")));
});

test("over-constrained graphs expose residual diagnostics", () => {
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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
  const engine = createEngineHarness();
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

test("tool workflow can add constraints in propagation mode", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("open-trio.json"));

  const before = engine.api.serializePatch().constraints.length;
  const result = engine.createConstraintWithTool("fixedDistance", ["Voice", "Bass"]);

  assert.equal(result.handled, true);
  assert.equal(result.patch.constraints.length, before + 1);
  assert.equal(result.patch.constraints.at(-1).type, "fixedDistance");
});

test("tool workflow can add constraints in xpbd mode", () => {
  const engine = createEngineHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch(loadFixturePatch("open-trio.json"));

  const before = engine.api.serializePatch().constraints.length;
  const result = engine.createConstraintWithTool("radialLimit", ["Voice"]);

  assert.equal(result.handled, true);
  assert.equal(result.patch.constraints.length, before + 1);
  assert.equal(result.patch.constraints.at(-1).type, "radialLimit");
});

test("tool workflow can add a two-source sum constraint", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("open-trio.json"));

  const result = engine.createConstraintWithTool("sum", ["Voice", "Bass"]);
  const constraint = result.patch.constraints.at(-1);

  assert.equal(result.handled, true);
  assert.equal(constraint.type, "sum");
  assert.equal(JSON.stringify(constraint.sources), JSON.stringify(["Voice", "Bass"]));
});

test("tool workflow can add a product constraint with more than three sources", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Four source product",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 0, y: 110 },
      { name: "C", x: -120, y: 0 },
      { name: "D", x: 0, y: -130 }
    ],
    constraints: []
  });

  const result = engine.createConstraintWithTool("product", ["A", "B", "C", "D"]);
  const constraint = result.patch.constraints.at(-1);

  assert.equal(result.handled, true);
  assert.equal(constraint.type, "product");
  assert.equal(JSON.stringify(constraint.sources), JSON.stringify(["A", "B", "C", "D"]));
});

test("stop all drawing clears every trace flag without selecting objects one by one", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Trace flags",
    version: 1,
    listener: { x: 0, y: 0, drawTrace: true },
    sources: [
      { name: "A", x: 100, y: 0, drawTrace: true },
      { name: "B", x: 0, y: 100, drawTrace: false }
    ],
    movingObjects: [
      { name: "M1", x: 50, y: 50, drawTrace: true, trajectory: { type: "free" } }
    ],
    constraints: [
      {
        type: "fixedDistance",
        anchor: "A",
        target: "B",
        distance: 120,
        node: { x: 50, y: 50, drawTrace: true }
      }
    ]
  });

  const patch = engine.stopAllDrawing();

  assert.equal(patch.listener.drawTrace, false);
  assert.ok(patch.sources.every((source) => source.drawTrace === false));
  assert.ok(patch.movingObjects.every((mover) => mover.drawTrace === false));
  assert.ok(patch.constraints.every((constraint) => constraint.node.drawTrace === false));
});

test("patch validation rejects one-source sum and product constraints", () => {
  const engine = createEngineHarness();
  const findings = engine.api.validatePatch({
    name: "Bad arity",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [
      { type: "sum", sources: ["A"] },
      { type: "product", sources: ["A"] }
    ]
  });

  assert.equal(findings.filter((finding) => finding.message.includes("at least 2")).length, 2);
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
    const engine = createEngineHarness();
    engine.setSolverMode("xpbd");
    engine.loadPatch(loadFixturePatch(scenario.file));
    const before = engine.points(scenario.watched);
    const shuttle = scenario.preserveShuttle ? engine.api.getObjectByName(scenario.preserveShuttle) : null;
    const shuttleFrame = shuttle ? {
      ax: shuttle.trajectory.ax,
      ay: shuttle.trajectory.ay,
      bx: shuttle.trajectory.bx,
      by: shuttle.trajectory.by,
      startName: shuttle.trajectory.start?.name,
      endName: shuttle.trajectory.end?.name
    } : null;

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

test("solver selector reflects the active solver mode", () => {
  const engine = createEngineHarness();

  engine.setSolverMode("propagation");
  assert.equal(engine.solverMode(), "propagation");
  assert.equal(engine.solverButtonPressed("propagation"), "true");
  assert.equal(engine.solverButtonPressed("xpbd"), "false");
  engine.setSolverMode("xpbd");
  assert.equal(engine.solverMode(), "xpbd");
  assert.equal(engine.solverButtonPressed("propagation"), "false");
  assert.equal(engine.solverButtonPressed("xpbd"), "true");
  engine.clickSolverMode("propagation");
  assert.equal(engine.solverMode(), "propagation");
  assert.equal(engine.solverButtonPressed("propagation"), "true");
  assert.equal(engine.solverButtonPressed("xpbd"), "false");
  assert.equal(engine.currentHref(), "http://127.0.0.1/musicspace.html");
  engine.clickSolverMode("xpbd");
  assert.equal(engine.solverMode(), "xpbd");
  assert.equal(engine.solverButtonPressed("propagation"), "false");
  assert.equal(engine.solverButtonPressed("xpbd"), "true");
  assert.equal(engine.currentHref(), "http://127.0.0.1/musicspace.html?solver=xpbd");
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
        cumulativePathBySource: Object.fromEntries(Object.entries(comparison.propagation.cumulativePathBySource)
          .map(([name, value]) => [name, Number(value.toFixed(3))])),
        displacementBySource: Object.fromEntries(Object.entries(comparison.propagation.displacementBySource)
          .map(([name, value]) => [name, Number(value.toFixed(3))]))
      },
      xpbd: {
        elapsedMs: Number(comparison.xpbd.elapsedMs.toFixed(3)),
        maxStepMs: Number(comparison.xpbd.maxStepMs.toFixed(3)),
        residualCount: comparison.xpbd.residualCount,
        hitEntityCapCount: comparison.xpbd.hitEntityCapCount,
        hitStepCapCount: comparison.xpbd.hitStepCapCount,
        cumulativePathBySource: Object.fromEntries(Object.entries(comparison.xpbd.cumulativePathBySource)
          .map(([name, value]) => [name, Number(value.toFixed(3))])),
        displacementBySource: Object.fromEntries(Object.entries(comparison.xpbd.displacementBySource)
          .map(([name, value]) => [name, Number(value.toFixed(3))]))
      },
      finalDistanceBetweenModes: Object.fromEntries(Object.entries(comparison.finalDistanceBetweenModes)
        .map(([name, value]) => [name, Number(value.toFixed(3))]))
    };

    for (const mode of ["propagation", "xpbd"]) {
      assert.equal(comparison[mode].hitStepCapCount, 0, `${scenario.name} ${mode} hit step caps`);
      assert.ok(comparison[mode].maxStepMs < 20, `${scenario.name} ${mode} max step too slow`);
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
    assert.ok(row.elapsedMs < 20, `${row.iterations} iterations took ${row.elapsedMs.toFixed(3)}ms`);
  }

  assert.equal(sweep.at(-1).nonFiniteResidualCount, 0);

  if (process.env.MUSICSPACE_PRINT_XPBD_SWEEP === "1") {
    console.log(JSON.stringify(sweep.map((row) => ({
      iterations: row.iterations,
      elapsedMs: Number(row.elapsedMs.toFixed(3)),
      nonFiniteResidualCount: row.nonFiniteResidualCount,
      residualCount: row.residualCount,
      worstResidual: Number(row.worstResidual.toFixed(3)),
      maxDisplacement: Number(row.maxDisplacement.toFixed(3)),
      displacementBySource: Object.fromEntries(Object.entries(row.displacementBySource)
        .map(([name, value]) => [name, Number(value.toFixed(3))]))
    })), null, 2));
  }
});

test("xpbd release refinement improves residuals after drag-budget solve", () => {
  const engine = createEngineHarness();
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
